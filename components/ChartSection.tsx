'use client';

import React from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    ScatterChart,
    Scatter,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { parseCurrency, formatChartNumber, formatCurrency, getBudgetValue, BudgetView } from '@/utils/format';

interface ChartSectionProps {
    data: any[];
    budgetView: BudgetView;
}

const COLORS = ['#FF5900', '#CFFF00', '#431412', '#F59E0B', '#10B981', '#E55000', '#8B5CF6', '#14B8A6'];

export default function ChartSection({ data, budgetView }: ChartSectionProps) {
    // Brand Budget Over Time (Monthly view with top 8 brands by total budget)
    const brandBudgetData = React.useMemo(() => {
        const brandBudgetByMonth: Record<string, Record<string, number>> = {};
        const brandTotals: Record<string, number> = {};

        // Helper to parse date in various formats (DD/MM/YYYY or YYYY-MM-DD)
        const parseDate = (dateStr: string): { year: number; month: number } | null => {
            if (!dateStr) return null;

            // Try DD/MM/YYYY format first (e.g., "01/04/2024" = April 1, 2024)
            // Format: day/month/year - our CSV uses this format
            const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (dmyMatch) {
                const month = parseInt(dmyMatch[2], 10); // Second group is MONTH
                const year = parseInt(dmyMatch[3], 10);
                return { year, month };
            }

            // Try YYYY-MM-DD format (e.g., "2024-04-01")
            const ymdMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (ymdMatch) {
                const year = parseInt(ymdMatch[1], 10);
                const month = parseInt(ymdMatch[2], 10);
                return { year, month };
            }

            // Fallback to Date parsing
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return { year: date.getFullYear(), month: date.getMonth() + 1 };
            }

            return null;
        };

        // First pass: calculate monthly budgets and total per brand
        data.forEach((item) => {
            if (!item.date || !item.brand || !item.budget) return;

            const parsed = parseDate(item.date);
            if (!parsed) return;

            const monthKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
            const brand = item.brand;
            const budget = getBudgetValue(item, budgetView);

            if (!brandBudgetByMonth[monthKey]) {
                brandBudgetByMonth[monthKey] = {};
            }
            brandBudgetByMonth[monthKey][brand] = (brandBudgetByMonth[monthKey][brand] || 0) + budget;

            // Track total budget per brand for ranking
            brandTotals[brand] = (brandTotals[brand] || 0) + budget;
        });

        // Get top 8 brands by total budget (not alphabetically)
        const topBrandsByBudget = Object.entries(brandTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([brand]) => brand);

        const sortedMonths = Object.keys(brandBudgetByMonth).sort();

        return sortedMonths.map((month) => ({
            month,
            ...topBrandsByBudget.reduce((acc, brand) => {
                acc[brand] = brandBudgetByMonth[month][brand] || 0;
                return acc;
            }, {} as Record<string, number>),
        }));
    }, [data, budgetView]);

    // Top brands by budget
    const topBrands = React.useMemo(() => {
        const brandTotals: Record<string, number> = {};

        data.forEach((item) => {
            if (!item.brand || !item.budget) return;
            const brand = item.brand;
            const budget = getBudgetValue(item, budgetView);
            brandTotals[brand] = (brandTotals[brand] || 0) + budget;
        });

        return Object.entries(brandTotals)
            .map(([brand, budget]) => ({ brand, budget }))
            .sort((a, b) => b.budget - a.budget)
            .slice(0, 15);
    }, [data, budgetView]);

    // Category breakdown (Pie Chart)
    const categoryData = React.useMemo(() => {
        const categoryTotals: Record<string, number> = {};

        data.forEach((item) => {
            if (!item.category || !item.budget) return;
            const category = item.category;
            const budget = getBudgetValue(item, budgetView);
            categoryTotals[category] = (categoryTotals[category] || 0) + budget;
        });

        return Object.entries(categoryTotals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [data, budgetView]);

    // Brand aggregated data for scatter plot
    const brandScatterData = React.useMemo(() => {
        const brandTotals: Record<string, { campaigns: number; budget: number }> = {};

        data.forEach((item) => {
            if (!item.brand || !item.budget) return;
            const brand = item.brand;
            const budget = getBudgetValue(item, budgetView);

            if (!brandTotals[brand]) {
                brandTotals[brand] = { campaigns: 0, budget: 0 };
            }
            brandTotals[brand].campaigns += 1;
            brandTotals[brand].budget += budget;
        });

        return Object.entries(brandTotals)
            .map(([brand, totals]) => ({
                brand,
                campaigns: totals.campaigns,
                budget: totals.budget,
            }))
            .sort((a, b) => a.campaigns - b.campaigns); // Sort by campaigns for ordered X-axis
    }, [data, budgetView]);

    // Brand x Country Heatmap Data
    const brandCountryHeatmap = React.useMemo(() => {
        const heatmapData: Record<string, Record<string, number>> = {};

        data.forEach((item) => {
            if (!item.brand || !item.country || !item.budget) return;
            const brand = item.brand;
            const country = item.country;
            const budget = getBudgetValue(item, budgetView);

            if (!heatmapData[brand]) {
                heatmapData[brand] = {};
            }
            heatmapData[brand][country] = (heatmapData[brand][country] || 0) + budget;
        });

        // Get top 10 brands
        const topBrandNames = Object.entries(heatmapData)
            .map(([brand, countries]) => ({
                brand,
                total: Object.values(countries).reduce((a, b) => a + b, 0),
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
            .map((item) => item.brand);

        // Convert to array format for visualization
        const allCountries = Array.from(new Set(data.map((item) => item.country).filter(Boolean)));

        return topBrandNames.map((brand) => ({
            brand,
            ...allCountries.reduce((acc, country) => {
                acc[country] = heatmapData[brand][country] || 0;
                return acc;
            }, {} as Record<string, number>),
        }));
    }, [data, budgetView]);

    const allCountries = React.useMemo(
        () => Array.from(new Set(data.map((item) => item.country).filter(Boolean))),
        [data]
    );

    return (
        <div className="space-y-8">
            {/* Brand x Country Heatmap */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10">
                <h2 className="text-lg font-bold text-[#431412] mb-4">Brand Spend by Country (Heatmap)</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={brandCountryHeatmap}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="brand"
                            angle={-35}
                            textAnchor="end"
                            height={120}
                            fontSize={11}
                            interval={0}
                        />
                        <YAxis
                            tickFormatter={formatChartNumber}
                            fontSize={11}
                            width={60}
                        />
                        <Tooltip
                            formatter={(value: any) => formatCurrency(Number(value))}
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px'
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        {allCountries.map((country, index) => (
                            <Bar
                                key={country}
                                dataKey={country}
                                stackId="a"
                                fill={COLORS[index % COLORS.length]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Top Brands by Budget */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10">
                <h2 className="text-lg font-bold text-[#431412] mb-4">Top 15 Brands by Budget</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topBrands} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            type="number"
                            tickFormatter={formatChartNumber}
                            fontSize={11}
                        />
                        <YAxis
                            dataKey="brand"
                            type="category"
                            width={120}
                            fontSize={10}
                        />
                        <Tooltip
                            formatter={(value: any) => formatCurrency(Number(value))}
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px'
                            }}
                        />
                        <Bar
                            dataKey="budget"
                            fill="#FF5900"
                            radius={[0, 4, 4, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10">
                    <h2 className="text-lg font-bold text-[#431412] mb-4">Budget by Category</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                label={({
                                    cx,
                                    cy,
                                    midAngle,
                                    innerRadius,
                                    outerRadius,
                                    percent,
                                    name,
                                }: any) => {
                                    const RADIAN = Math.PI / 180;
                                    const radius = outerRadius + 30;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                    // Truncate specific long names
                                    let displayName = name;
                                    if (name === 'TRADING COMPANIES') {
                                        displayName = 'TRADING CO...';
                                    } else if (name === 'ENTERTAINMENT & LEISURE') {
                                        displayName = 'ENTERTAINME...';
                                    } else if (name.length > 15) {
                                        displayName = name.substring(0, 12) + '...';
                                    }

                                    return (
                                        <text
                                            x={x}
                                            y={y}
                                            fill="#374151"
                                            textAnchor={x > cx ? 'start' : 'end'}
                                            dominantBaseline="central"
                                            fontSize={11}
                                            fontWeight={500}
                                        >
                                            {displayName}
                                        </text>
                                    );
                                }}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {categoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: any) => formatCurrency(Number(value))}
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Media Channel Scatter */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10">
                    <h2 className="text-lg font-bold text-[#431412] mb-4">Media/Channel: Campaigns vs Budget</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart>
                            <CartesianGrid stroke="#e5e7eb" />
                            <XAxis
                                dataKey="campaigns"
                                name="Campaigns"
                                fontSize={11}
                            />
                            <YAxis
                                dataKey="budget"
                                name="Budget"
                                tickFormatter={formatChartNumber}
                                fontSize={11}
                                width={60}
                            />
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                content={({ active, payload }: any) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                                <p className="font-semibold text-gray-900 mb-2">{data.brand}</p>
                                                <p className="text-sm text-gray-600">
                                                    Budget: <span className="font-medium text-gray-900">{formatCurrency(data.budget)}</span>
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Campaigns: <span className="font-medium text-gray-900">{data.campaigns}</span>
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Scatter data={brandScatterData} fill="#FF5900" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Brand Budget Trends */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10">
                <h2 className="text-lg font-bold text-[#431412] mb-4">Brand Budget Trends Over Time</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={brandBudgetData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="month"
                            fontSize={11}
                        />
                        <YAxis
                            tickFormatter={formatChartNumber}
                            fontSize={11}
                            width={60}
                        />
                        <Tooltip
                            formatter={(value: any) => formatCurrency(Number(value))}
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px'
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        {Object.keys(brandBudgetData[0] || {})
                            .filter((key) => key !== 'month')
                            .slice(0, 8)
                            .map((brand, index) => (
                                <Line
                                    key={brand}
                                    type="monotone"
                                    dataKey={brand}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                            ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
