'use client';

import React, { memo } from 'react';
import {
    ComposableMap,
    Geographies,
    Geography,
    ZoomableGroup
} from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const MENA_COUNTRIES = [
    "United Arab Emirates", "Saudi Arabia", "Kuwait", "Bahrain", "Oman", "Qatar",
    "Egypt", "Iraq", "Jordan", "Lebanon", "Yemen", "Syria", "Iran", "Turkey", "Israel", "Palestine"
];

// Mapping from GeoJSON name to our data name
const COUNTRY_NAME_MAP: Record<string, string> = {
    "United Arab Emirates": "UAE",
    "Saudi Arabia": "KSA",
    "Kuwait": "Kuwait",
    "Bahrain": "Bahrain",
    "Oman": "Oman",
    "Qatar": "Qatar",
    "Egypt": "Egypt",
    "Iraq": "Iraq",
    "Jordan": "Jordan"
};

interface MenaMapProps {
    selectedCountry: string;
    onSelectCountry: (country: string) => void;
    data?: any[]; // Optional data for coloring
}

const MenaMap = ({ selectedCountry, onSelectCountry, data }: MenaMapProps) => {
    const [tooltip, setTooltip] = React.useState<{ name: string; x: number; y: number } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    return (
        <div ref={containerRef} className="w-full h-[400px] bg-[#F4EDE3] rounded-xl overflow-hidden border border-[#431412]/10 relative">
            {tooltip && (
                <div
                    className="absolute bg-[#431412] text-white px-3 py-1.5 rounded-md text-sm font-medium pointer-events-none z-50 shadow-lg whitespace-nowrap"
                    style={{
                        left: `${tooltip.x}px`,
                        top: `${tooltip.y - 40}px`,
                    }}
                >
                    {tooltip.name}
                </div>
            )}
            <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                    scale: 800,
                    center: [45, 25] // Center on MENA
                }}
                className="w-full h-full"
            >
                <ZoomableGroup zoom={1} minZoom={1} maxZoom={4}>
                    <Geographies geography={geoUrl}>
                        {({ geographies }) =>
                            geographies.map((geo) => {
                                const countryName = geo.properties.name;
                                const isMena = MENA_COUNTRIES.includes(countryName);
                                const mappedName = COUNTRY_NAME_MAP[countryName];
                                const isSelected = mappedName === selectedCountry;

                                // Styling - Talabat colors
                                let fill = "#EAEAEC"; // Default non-MENA
                                let stroke = "#D6D6DA";
                                let hoverFill = "#EAEAEC";

                                if (isMena) {
                                    fill = isSelected ? "#FF5900" : "#FFB380"; // Orange for selected, Light Orange for MENA
                                    stroke = "#FFFFFF";
                                    hoverFill = "#E55000"; // Darker orange on hover

                                    if (!mappedName) {
                                        // MENA country but not in our dataset mapping (e.g. Yemen)
                                        fill = "#cbd5e1";
                                        hoverFill = "#94a3b8";
                                    }
                                }

                                return (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill={fill}
                                        stroke={stroke}
                                        strokeWidth={0.5}
                                        style={{
                                            default: { outline: "none", transition: "all 250ms" },
                                            hover: { fill: hoverFill, outline: "none", cursor: isMena && mappedName ? "pointer" : "default" },
                                            pressed: { outline: "none" },
                                        }}
                                        onMouseEnter={(e: any) => {
                                            if (isMena && containerRef.current) {
                                                const rect = containerRef.current.getBoundingClientRect();
                                                setTooltip({
                                                    name: countryName,
                                                    x: e.clientX - rect.left,
                                                    y: e.clientY - rect.top
                                                });
                                            }
                                        }}
                                        onMouseMove={(e: any) => {
                                            if (isMena && tooltip && containerRef.current) {
                                                const rect = containerRef.current.getBoundingClientRect();
                                                setTooltip({
                                                    name: countryName,
                                                    x: e.clientX - rect.left,
                                                    y: e.clientY - rect.top
                                                });
                                            }
                                        }}
                                        onMouseLeave={() => {
                                            setTooltip(null);
                                        }}
                                        onClick={() => {
                                            if (isMena && mappedName) {
                                                onSelectCountry(mappedName === selectedCountry ? 'All' : mappedName);
                                            }
                                        }}
                                    />
                                );
                            })
                        }
                    </Geographies>
                </ZoomableGroup>
            </ComposableMap>

            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur p-2 rounded-lg text-xs text-[#431412]/70 shadow-sm">
                Click to filter by country
            </div>
        </div>
    );
};

export default memo(MenaMap);
