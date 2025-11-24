declare module 'react-simple-maps' {
    import * as React from 'react';

    export interface ComposableMapProps {
        width?: number;
        height?: number;
        projection?: string | ((width: number, height: number) => any);
        projectionConfig?: any;
        className?: string;
        style?: React.CSSProperties;
        children?: React.ReactNode;
    }

    export const ComposableMap: React.FC<ComposableMapProps>;

    export interface ZoomableGroupProps {
        center?: [number, number];
        zoom?: number;
        minZoom?: number;
        maxZoom?: number;
        translateExtent?: [[number, number], [number, number]];
        onMoveStart?: (position: { coordinates: [number, number]; zoom: number }) => void;
        onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void;
        className?: string;
        style?: React.CSSProperties;
        children?: React.ReactNode;
    }

    export const ZoomableGroup: React.FC<ZoomableGroupProps>;

    export interface GeographiesProps {
        geography?: string | Record<string, any> | string[];
        children: (args: { geographies: any[] }) => React.ReactNode;
        className?: string;
        style?: React.CSSProperties;
    }

    export const Geographies: React.FC<GeographiesProps>;

    export interface GeographyProps {
        geography: any;
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        className?: string;
        style?: {
            default?: React.CSSProperties;
            hover?: React.CSSProperties;
            pressed?: React.CSSProperties;
        };
        onClick?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
        onMouseEnter?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
        onMouseMove?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
        onMouseLeave?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
        onMouseDown?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
        onMouseUp?: (event: React.MouseEvent<SVGPathElement, MouseEvent>) => void;
        onFocus?: (event: React.FocusEvent<SVGPathElement>) => void;
        onBlur?: (event: React.FocusEvent<SVGPathElement>) => void;
    }

    export const Geography: React.FC<GeographyProps>;

    export interface MarkerProps {
        coordinates: [number, number];
        children?: React.ReactNode;
        className?: string;
        style?: {
            default?: React.CSSProperties;
            hover?: React.CSSProperties;
            pressed?: React.CSSProperties;
        };
        onClick?: (event: React.MouseEvent<SVGGElement, MouseEvent>) => void;
        onMouseEnter?: (event: React.MouseEvent<SVGGElement, MouseEvent>) => void;
        onMouseLeave?: (event: React.MouseEvent<SVGGElement, MouseEvent>) => void;
        onMouseDown?: (event: React.MouseEvent<SVGGElement, MouseEvent>) => void;
        onMouseUp?: (event: React.MouseEvent<SVGGElement, MouseEvent>) => void;
        onFocus?: (event: React.FocusEvent<SVGGElement>) => void;
        onBlur?: (event: React.FocusEvent<SVGGElement>) => void;
    }

    export const Marker: React.FC<MarkerProps>;
}
