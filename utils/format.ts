// Utility function to format large numbers for chart axes
export const formatChartNumber = (value: number): string => {
    if (value === 0) return '0';

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1000000000) {
        return `${sign}${(absValue / 1000000000).toFixed(1)}B`;
    }
    if (absValue >= 1000000) {
        return `${sign}${(absValue / 1000000).toFixed(1)}M`;
    }
    if (absValue >= 1000) {
        return `${sign}${(absValue / 1000).toFixed(1)}K`;
    }

    return `${sign}${absValue.toFixed(0)}`;
};

// Utility function to format currency for tooltips
export const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`;
};

export const parseCurrency = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;

    // Remove currency symbols, commas, and whitespace
    const cleanValue = value.replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleanValue);

    return isNaN(parsed) ? 0 : parsed;
};

// Budget view type for toggle between ratecard and net spend
export type BudgetView = 'ratecard' | 'net';

// Interface for competitive stats data with optional net_budget
export interface CompetitiveStatsItem {
    budget: string;
    net_budget?: string | null;
    [key: string]: unknown;
}

// Helper to get the appropriate budget value based on view selection
// For 'net' view: uses net_budget if available, otherwise falls back to budget
// For 'ratecard' view: always uses budget (ratecard value)
export const getBudgetValue = (
    item: CompetitiveStatsItem,
    view: BudgetView
): number => {
    if (view === 'net' && item.net_budget) {
        return parseCurrency(item.net_budget);
    }
    return parseCurrency(item.budget);
};
