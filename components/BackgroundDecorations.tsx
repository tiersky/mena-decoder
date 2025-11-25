'use client';

import React from 'react';

export default function BackgroundDecorations() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Wavy Orange Line - Diagonal from top-left to bottom-right */}
            <svg
                className="absolute inset-0 w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1440 900"
                preserveAspectRatio="none"
            >
                {/* Main wavy line */}
                <path
                    d="M 0 80 Q 200 60, 400 100 T 800 180 Q 1000 220, 1200 280 T 1440 420"
                    stroke="#FF5900"
                    strokeWidth="20"
                    fill="none"
                    opacity="0.15"
                    strokeLinecap="round"
                />

                {/* Dashed thinner version */}
                <path
                    d="M 0 120 Q 200 100, 400 140 T 800 220 Q 1000 260, 1200 320 T 1440 460"
                    stroke="#FF5900"
                    strokeWidth="4"
                    fill="none"
                    opacity="0.25"
                    strokeDasharray="20 15"
                    strokeLinecap="round"
                />
            </svg>

            {/* Scattered Icons */}
            {/* Mobile Icon - Top Left Area */}
            <div className="absolute" style={{ top: '15%', left: '8%', width: '80px', height: '80px', opacity: 0.08 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_mobile_bda7057b3d.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Scooter Icon - Top Right Area */}
            <div className="absolute" style={{ top: '25%', right: '12%', width: '100px', height: '100px', opacity: 0.1 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_scooter_4252e3ccf0.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Forward Icon - Middle Left */}
            <div className="absolute" style={{ top: '50%', left: '5%', width: '70px', height: '70px', opacity: 0.07 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_forward_2a84eca16e.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Favorites Icon - Bottom Right */}
            <div className="absolute" style={{ bottom: '20%', right: '8%', width: '90px', height: '90px', opacity: 0.09 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_favorites_31a3c72077.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Additional scattered instances for more coverage */}
            {/* Mobile Icon - Bottom Left */}
            <div className="absolute" style={{ bottom: '30%', left: '15%', width: '60px', height: '60px', opacity: 0.06 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_mobile_bda7057b3d.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Scooter Icon - Middle Center */}
            <div className="absolute" style={{ top: '45%', left: '50%', width: '85px', height: '85px', opacity: 0.08, transform: 'translateX(-50%)' }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_scooter_4252e3ccf0.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Forward Icon - Top Center */}
            <div className="absolute" style={{ top: '10%', left: '60%', width: '75px', height: '75px', opacity: 0.07 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_forward_2a84eca16e.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Favorites Icon - Middle Right */}
            <div className="absolute" style={{ top: '60%', right: '20%', width: '70px', height: '70px', opacity: 0.08 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_favorites_31a3c72077.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Mobile Icon - Bottom Center */}
            <div className="absolute" style={{ bottom: '15%', left: '40%', width: '65px', height: '65px', opacity: 0.07 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_mobile_bda7057b3d.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Forward Icon - Lower Right */}
            <div className="absolute" style={{ bottom: '25%', right: '30%', width: '80px', height: '80px', opacity: 0.06 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_forward_2a84eca16e.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>
        </div>
    );
}
