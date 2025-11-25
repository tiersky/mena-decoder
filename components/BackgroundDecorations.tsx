'use client';

import React from 'react';

export default function BackgroundDecorations() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Wavy Lines - Spread across different parts of the page */}
            <svg
                className="absolute inset-0 w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1440 900"
                preserveAspectRatio="none"
            >
                {/* Orange wavy line - Top area */}
                <path
                    d="M 0 100 Q 180 85, 360 95 T 720 110 Q 900 105, 1080 100 T 1440 90"
                    stroke="#FF5900"
                    strokeWidth="8"
                    fill="none"
                    opacity="0.35"
                    strokeLinecap="round"
                />

                {/* Green dashed wavy line - Middle area */}
                <path
                    d="M 0 450 Q 180 470, 360 460 T 720 480 Q 900 490, 1080 475 T 1440 465"
                    stroke="#CFFF00"
                    strokeWidth="6"
                    fill="none"
                    opacity="0.4"
                    strokeDasharray="15 10"
                    strokeLinecap="round"
                />

                {/* Orange wavy line - Bottom area */}
                <path
                    d="M 0 750 Q 180 730, 360 745 T 720 760 Q 900 770, 1080 755 T 1440 740"
                    stroke="#FF5900"
                    strokeWidth="8"
                    fill="none"
                    opacity="0.3"
                    strokeLinecap="round"
                />
            </svg>

            {/* Scattered Icons - Higher opacity, repositioned for better visibility */}
            {/* Mobile Icon - Top Left Area */}
            <div className="absolute" style={{ top: '15%', left: '10%', width: '70px', height: '70px', opacity: 0.18 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_mobile_bda7057b3d.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Scooter Icon - Top Right Area */}
            <div className="absolute" style={{ top: '20%', right: '15%', width: '85px', height: '85px', opacity: 0.2 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_scooter_4252e3ccf0.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Forward Icon - Middle Left */}
            <div className="absolute" style={{ top: '48%', left: '8%', width: '65px', height: '65px', opacity: 0.16 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_forward_2a84eca16e.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Favorites Icon - Closer to center, visible on 1920x1080 */}
            <div className="absolute" style={{ top: '35%', right: '22%', width: '75px', height: '75px', opacity: 0.19 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_favorites_31a3c72077.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Additional scattered instances for more coverage */}
            {/* Mobile Icon - Closer to center cards, visible on smaller screens */}
            <div className="absolute" style={{ top: '25%', left: '35%', width: '60px', height: '60px', opacity: 0.17 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_mobile_bda7057b3d.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Scooter Icon - Middle Center */}
            <div className="absolute" style={{ top: '55%', left: '48%', width: '80px', height: '80px', opacity: 0.18 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_scooter_4252e3ccf0.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Forward Icon - Top Center-Right */}
            <div className="absolute" style={{ top: '12%', left: '62%', width: '70px', height: '70px', opacity: 0.17 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_forward_2a84eca16e.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Favorites Icon - Bottom area, closer to center */}
            <div className="absolute" style={{ bottom: '22%', left: '38%', width: '68px', height: '68px', opacity: 0.18 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_favorites_31a3c72077.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Mobile Icon - Bottom Right, visible area */}
            <div className="absolute" style={{ bottom: '18%', right: '18%', width: '65px', height: '65px', opacity: 0.16 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_mobile_bda7057b3d.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Forward Icon - Lower area */}
            <div className="absolute" style={{ bottom: '30%', left: '18%', width: '72px', height: '72px', opacity: 0.17 }}>
                <img
                    src="https://corporate.talabat.com/uploads/ic_imperfect_forward_2a84eca16e.svg"
                    alt=""
                    className="w-full h-full object-contain"
                />
            </div>
        </div>
    );
}
