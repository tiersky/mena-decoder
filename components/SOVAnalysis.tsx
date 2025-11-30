import React, { useState, useMemo } from 'react';
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';
import { Filter, DollarSign, BarChart2 } from 'lucide-react';
import { parseCurrency, getBudgetValue, BudgetView } from '@/utils/format';

interface SOVAnalysisProps {
    data: any[];
    budgetView: BudgetView;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
};

const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
};

// Vibrant color palette for nodes - Talabat colors
const COLORS = [
    '#FF5900', '#CFFF00', '#431412', '#F59E0B', '#10B981',
    '#E55000', '#8B5CF6', '#14B8A6', '#6366F1', '#84CC16',
    '#06B6D4', '#F43F5E', '#A855F7', '#D946EF', '#EC4899'
];

// Link color palette (semi-transparent versions) - Talabat colors
const LINK_COLORS = [
    'rgba(255, 89, 0, 0.4)', 'rgba(207, 255, 0, 0.4)', 'rgba(67, 20, 18, 0.4)',
    'rgba(245, 158, 11, 0.4)', 'rgba(16, 185, 129, 0.4)', 'rgba(229, 80, 0, 0.4)',
    'rgba(139, 92, 246, 0.4)', 'rgba(20, 184, 166, 0.4)', 'rgba(99, 102, 241, 0.4)',
    'rgba(132, 204, 22, 0.4)', 'rgba(6, 182, 212, 0.4)', 'rgba(244, 63, 94, 0.4)'
];

export default function SOVAnalysis({ data, budgetView }: SOVAnalysisProps) {
    const [scope, setScope] = useState<'Overall' | 'Online' | 'Offline'>('Overall');
    const [selectedBrand, setSelectedBrand] = useState<string>('All');
    const [selectedCountry, setSelectedCountry] = useState<string>('All');
    const [zoomLevel, setZoomLevel] = useState<number>(1);

    // Extract unique options for filters
    const brands = useMemo(() => {
        const unique = new Set(data.map(d => d.brand).filter(Boolean));
        return ['All', ...Array.from(unique).sort()];
    }, [data]);

    const countries = useMemo(() => {
        const unique = new Set(data.map(d => d.country).filter(Boolean));
        return ['All', ...Array.from(unique).sort()];
    }, [data]);

    // Filter Data
    const filteredData = useMemo(() => {
        return data.filter(item => {
            // 1. Country Filter
            if (selectedCountry !== 'All' && item.country !== selectedCountry) return false;

            // 2. Brand Filter
            if (selectedBrand !== 'All' && item.brand !== selectedBrand) return false;

            // 3. Scope Filter
            if (scope === 'Online' && item.media !== 'ONLINE') return false;
            if (scope === 'Offline' && item.media === 'ONLINE') return false;

            return true;
        });
    }, [data, selectedCountry, selectedBrand, scope]);

    // Calculate Stats
    const stats = useMemo(() => {
        const totalSpend = filteredData.reduce((acc, curr) => acc + getBudgetValue(curr, budgetView), 0);
        const totalVolume = filteredData.reduce((acc, curr) => acc + parseCurrency(curr.volume), 0);
        return { totalSpend, totalVolume };
    }, [filteredData, budgetView]);

    // Transform Data for Sankey with enhanced node tracking
    const sankeyData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        const nodeMap = new Map<string, number>();
        const nodeColors = new Map<string, string>();
        const nodeValues = new Map<string, number>(); // Track total value per node

        // Track which level each node belongs to
        const nodeLevels = new Map<string, 'brand' | 'media' | 'channel'>();

        let colorIndex = 0;
        const getNodeIndex = (name: string, level: 'brand' | 'media' | 'channel') => {
            if (!nodeMap.has(name)) {
                const index = nodes.length;
                nodeMap.set(name, index);
                nodeLevels.set(name, level);
                const color = COLORS[colorIndex % COLORS.length];
                nodeColors.set(name, color);
                colorIndex++;
                nodes.push({ name, value: 0 });
                nodeValues.set(name, 0);
            }
            return nodeMap.get(name)!;
        };

        // Determine if we should show 2-level (Brand -> Media) or 3-level (Brand -> Media -> Channel)
        const showChannels = selectedBrand !== 'All';

        if (selectedBrand === 'All') {
            // Simplified view: "ALL BRANDS" -> Media
            const brandMediaMap = new Map<string, number>();

            filteredData.forEach(item => {
                const budget = getBudgetValue(item, budgetView);
                if (budget <= 0) return;

                const media = item.media || 'Unknown';
                const bmKey = `ALL BRANDS|${media}`;
                brandMediaMap.set(bmKey, (brandMediaMap.get(bmKey) || 0) + budget);
            });

            // Sort by value
            const sortedBrandMedia = Array.from(brandMediaMap.entries()).sort((a, b) => b[1] - a[1]);

            // Create nodes and links
            const allBrandsIndex = getNodeIndex('ALL BRANDS', 'brand');

            sortedBrandMedia.forEach(([key, value], idx) => {
                const [_, media] = key.split('|');
                const mediaIndex = getNodeIndex(media, 'media');

                // Update node values for proper sizing
                const currentBrandValue = nodeValues.get('ALL BRANDS') || 0;
                nodeValues.set('ALL BRANDS', currentBrandValue + value);

                const currentMediaValue = nodeValues.get(media) || 0;
                nodeValues.set(media, currentMediaValue + value);

                links.push({
                    source: allBrandsIndex,
                    target: mediaIndex,
                    value,
                    stroke: LINK_COLORS[idx % LINK_COLORS.length],
                });
            });
        } else {
            // Detailed view: Brand -> Media -> Channel
            const brandMediaMap = new Map<string, number>();
            const mediaChannelMap = new Map<string, number>();

            filteredData.forEach(item => {
                const budget = getBudgetValue(item, budgetView);
                if (budget <= 0) return;

                const brand = item.brand || 'Unknown';
                const media = item.media || 'Unknown';
                const channel = item.channel || 'Unknown';

                const bmKey = `${brand}|${media}`;
                brandMediaMap.set(bmKey, (brandMediaMap.get(bmKey) || 0) + budget);

                const mcKey = `${media}|${channel}`;
                mediaChannelMap.set(mcKey, (mediaChannelMap.get(mcKey) || 0) + budget);
            });

            // Sort by value
            const sortedBrandMedia = Array.from(brandMediaMap.entries()).sort((a, b) => b[1] - a[1]);
            const sortedMediaChannel = Array.from(mediaChannelMap.entries()).sort((a, b) => b[1] - a[1]);

            let linkColorIndex = 0;
            sortedBrandMedia.forEach(([key, value]) => {
                const [brand, media] = key.split('|');
                const sourceIndex = getNodeIndex(brand, 'brand');
                const targetIndex = getNodeIndex(media, 'media');

                // Update node values
                const currentBrandValue = nodeValues.get(brand) || 0;
                nodeValues.set(brand, currentBrandValue + value);

                const currentMediaValue = nodeValues.get(media) || 0;
                nodeValues.set(media, currentMediaValue + value);

                links.push({
                    source: sourceIndex,
                    target: targetIndex,
                    value,
                    stroke: LINK_COLORS[linkColorIndex % LINK_COLORS.length],
                });
                linkColorIndex++;
            });

            sortedMediaChannel.forEach(([key, value]) => {
                const [media, channel] = key.split('|');
                const sourceIndex = getNodeIndex(media, 'media');
                const targetIndex = getNodeIndex(channel, 'channel');

                // Update node values
                const currentMediaValue = nodeValues.get(media) || 0;
                nodeValues.set(media, currentMediaValue + value);

                const currentChannelValue = nodeValues.get(channel) || 0;
                nodeValues.set(channel, currentChannelValue + value);

                links.push({
                    source: sourceIndex,
                    target: targetIndex,
                    value,
                    stroke: LINK_COLORS[linkColorIndex % LINK_COLORS.length],
                });
                linkColorIndex++;
            });
        }

        // Update node values in the nodes array
        nodes.forEach(node => {
            node.value = nodeValues.get(node.name) || 0;
        });

        return { nodes, links, nodeColors, nodeLevels, nodeValues, showChannels };
    }, [filteredData, selectedBrand, budgetView]);

    // Custom node renderer with colors and black text with percentages
    const CustomNode = ({ x, y, width, height, index, payload }: any) => {
        const color = sankeyData.nodeColors.get(payload.name) || '#3B82F6';
        const nodeValue = sankeyData.nodeValues.get(payload.name) || 0;

        // Calculate percentage of total
        const total = stats.totalSpend;
        const percentage = total > 0 ? ((nodeValue / total) * 100).toFixed(1) : '0.0';

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={color}
                    fillOpacity={0.9}
                    rx={4}
                />
                <text
                    x={x + width / 2}
                    y={y + height / 2 - 6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#000"
                    fontSize={11}
                    fontWeight="600"
                    style={{
                        pointerEvents: 'none',
                        textShadow: '0 0 2px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,0.6)'
                    }}
                >
                    {payload.name}
                </text>
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#000"
                    fontSize={9}
                    fontWeight="500"
                    style={{
                        pointerEvents: 'none',
                        textShadow: '0 0 2px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,0.6)'
                    }}
                >
                    ({percentage}%)
                </text>
            </g>
        );
    };

    // Custom link renderer with variable width
    const CustomLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload }: any) => {
        const link = sankeyData.links[index];
        const strokeWidth = link?.strokeWidth || linkWidth;
        const stroke = link?.stroke || 'rgba(0,0,0,0.2)';

        return (
            <path
                d={`
                    M${sourceX},${sourceY}
                    C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
                `}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeOpacity={0.5}
                style={{ transition: 'all 0.3s ease' }}
            />
        );
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10 mb-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-[#FF5900]" />
                    <h2 className="text-lg font-bold text-[#431412]">Channel Mix</h2>
                </div>
            </div>

            {/* Independent Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-[#f4ede2]/50 p-4 rounded-lg">
                {/* Scope Filter */}
                <div>
                    <label className="block text-xs font-medium text-[#431412]/70 mb-1">Scope</label>
                    <select
                        value={scope}
                        onChange={(e) => setScope(e.target.value as any)}
                        className="w-full text-sm border-[#431412]/20 rounded-md shadow-sm focus:ring-2 focus:ring-[#FF5900]"
                    >
                        <option value="Overall">Overall (Online & Offline)</option>
                        <option value="Online">Online Only</option>
                        <option value="Offline">Offline Only</option>
                    </select>
                </div>

                {/* Brand Filter */}
                <div>
                    <label className="block text-xs font-medium text-[#431412]/70 mb-1">Brand</label>
                    <select
                        value={selectedBrand}
                        onChange={(e) => setSelectedBrand(e.target.value)}
                        className="w-full text-sm border-[#431412]/20 rounded-md shadow-sm focus:ring-2 focus:ring-[#FF5900]"
                    >
                        {brands.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>

                {/* Country Filter */}
                <div>
                    <label className="block text-xs font-medium text-[#431412]/70 mb-1">Country</label>
                    <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        className="w-full text-sm border-[#431412]/20 rounded-md shadow-sm focus:ring-2 focus:ring-[#FF5900]"
                    >
                        {countries.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Level Labels */}
            <div className={`flex ${sankeyData.showChannels ? 'justify-between' : 'justify-around'} mb-2 px-8`}>
                <div className="text-sm font-semibold text-[#431412] bg-[#FF5900]/10 px-3 py-1 rounded">BRANDS</div>
                <div className="text-sm font-semibold text-[#431412] bg-[#CFFF00]/30 px-3 py-1 rounded">MEDIA</div>
                {sankeyData.showChannels && (
                    <div className="text-sm font-semibold text-[#431412] bg-[#431412]/10 px-3 py-1 rounded">CHANNELS</div>
                )}
            </div>

            {/* Sankey Chart */}
            <div className="relative">
                {/* Zoom Controls */}
                <div className="absolute top-2 right-2 z-10 flex gap-2 bg-white/90 px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                    <button
                        onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        title="Zoom Out"
                    >
                        -
                    </button>
                    <span className="px-2 py-1 text-xs font-medium text-gray-600">
                        {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                        onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        title="Zoom In"
                    >
                        +
                    </button>
                    <button
                        onClick={() => setZoomLevel(1)}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        title="Reset Zoom"
                    >
                        Reset
                    </button>
                </div>

                <div className="overflow-auto h-[600px] w-full border border-gray-100 rounded-lg bg-gray-50">
                    {sankeyData.nodes.length > 0 && sankeyData.links.length > 0 ? (
                        <div style={{
                            minHeight: `${Math.max(600, sankeyData.nodes.length * 40) * zoomLevel}px`,
                            minWidth: '100%',
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'top left',
                            width: `${100 / zoomLevel}%`
                        }}>
                            <ResponsiveContainer width="100%" height={Math.max(600, sankeyData.nodes.length * 40)}>
                                <Sankey
                                    data={sankeyData}
                                    node={<CustomNode />}
                                    link={<CustomLink />}
                                    nodeWidth={20}
                                    nodePadding={Math.max(10, Math.min(50, 600 / sankeyData.nodes.length))}
                                    margin={{ left: 40, right: 40, top: 40, bottom: 40 }}
                                    iterations={64}
                                    sort={true}
                                >
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                            border: '1px solid #ccc',
                                            borderRadius: '8px',
                                            padding: '8px 12px'
                                        }}
                                        formatter={(value: any) => formatCurrency(value)}
                                    />
                                </Sankey>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            No data available for the selected filters
                        </div>
                    )}
                </div>
                <div className="absolute top-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
                    Scroll to view full chart
                </div>
            </div>

            {/* Dynamic Stats Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#431412]/10">
                <div className={`${budgetView === 'net' ? 'bg-[#00A86B]/10' : 'bg-[#FF5900]/10'} p-4 rounded-lg flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 ${budgetView === 'net' ? 'bg-[#00A86B]/20' : 'bg-[#FF5900]/20'} rounded-full`}>
                            <DollarSign className={`w-5 h-5 ${budgetView === 'net' ? 'text-[#00A86B]' : 'text-[#FF5900]'}`} />
                        </div>
                        <div>
                            <p className="text-sm text-[#431412]/70 font-semibold">
                                Total {budgetView === 'net' ? 'Net' : 'Ratecard'} Spend
                            </p>
                            <p className={`text-xl font-extrabold ${budgetView === 'net' ? 'text-[#00A86B]' : 'text-[#431412]'}`}>
                                {formatCurrency(stats.totalSpend)}
                            </p>
                        </div>
                    </div>
                </div>

                {(scope === 'Online' || scope === 'Overall') && (
                    <div className="bg-[#CFFF00]/20 p-4 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#CFFF00]/40 rounded-full">
                                <BarChart2 className="w-5 h-5 text-[#431412]" />
                            </div>
                            <div>
                                <p className="text-sm text-[#431412]/70 font-semibold">Total Impressions (Volume)</p>
                                <p className="text-xl font-extrabold text-[#431412]">{formatNumber(stats.totalVolume)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
