import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { parseCurrency, formatCurrency } from '@/utils/format';
import { createClient } from '@supabase/supabase-js';
import { getDocxContent } from '@/utils/docx-parser';
import fs from 'fs';
import path from 'path';

// Allow streaming responses up to 60 seconds for complex queries
export const maxDuration = 60;

// Verify OpenAI API Key is available
if (!process.env.OPENAI_API_KEY) {
    console.error('CRITICAL: OPENAI_API_KEY is not set in environment variables');
}

// Load MENA knowledge base
let MENA_KNOWLEDGE_BASE = '';
try {
    MENA_KNOWLEDGE_BASE = fs.readFileSync(
        path.join(process.cwd(), 'mena_knowledge_base.txt'),
        'utf-8'
    );
} catch {
    console.warn('Warning: mena_knowledge_base.txt not found');
}

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cache for summary table (refreshes every 5 minutes)
let summaryTableCache: { data: string; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate pre-computed summary table for major brands
 * This is the AI's "go-to" reference for quick answers
 */
async function generateSummaryTable(): Promise<string> {
    // Check cache
    if (summaryTableCache && Date.now() - summaryTableCache.timestamp < CACHE_TTL) {
        return summaryTableCache.data;
    }

    try {
        // Fetch all data for comprehensive summary
        const { data: allRecords, error } = await supabase
            .from('unified_competitive_stats')
            .select('brand, country, media, budget, net_budget, date')
            .limit(50000);

        if (error || !allRecords) {
            console.error('Failed to generate summary table:', error);
            return 'Summary table unavailable - query database directly.';
        }

        // Aggregate by brand
        const brandSummary: Record<string, {
            totalRatecard: number;
            totalNet: number;
            campaigns: number;
            countries: Set<string>;
            months: Set<string>;
            mediaTypes: Set<string>;
        }> = {};

        // Aggregate by brand + country
        const brandCountrySummary: Record<string, Record<string, {
            ratecard: number;
            net: number;
            campaigns: number;
        }>> = {};

        allRecords.forEach((r: any) => {
            const brand = (r.brand || 'Unknown').toUpperCase();
            const country = r.country || 'Unknown';
            const ratecard = parseCurrency(r.budget);
            const net = r.net_budget ? parseCurrency(r.net_budget) : ratecard;
            const month = r.date ? r.date.substring(0, 7) : 'Unknown';
            const media = r.media || 'Unknown';

            // Brand summary
            if (!brandSummary[brand]) {
                brandSummary[brand] = {
                    totalRatecard: 0, totalNet: 0, campaigns: 0,
                    countries: new Set(), months: new Set(), mediaTypes: new Set()
                };
            }
            brandSummary[brand].totalRatecard += ratecard;
            brandSummary[brand].totalNet += net;
            brandSummary[brand].campaigns += 1;
            brandSummary[brand].countries.add(country);
            brandSummary[brand].months.add(month);
            brandSummary[brand].mediaTypes.add(media);

            // Brand + Country summary
            if (!brandCountrySummary[brand]) brandCountrySummary[brand] = {};
            if (!brandCountrySummary[brand][country]) {
                brandCountrySummary[brand][country] = { ratecard: 0, net: 0, campaigns: 0 };
            }
            brandCountrySummary[brand][country].ratecard += ratecard;
            brandCountrySummary[brand][country].net += net;
            brandCountrySummary[brand][country].campaigns += 1;
        });

        // Get top 20 brands by spend
        const topBrands = Object.entries(brandSummary)
            .sort((a, b) => b[1].totalRatecard - a[1].totalRatecard)
            .slice(0, 20);

        // Format summary table
        let summaryTable = `
═══════════════════════════════════════════════════════════════════════════════
                    MASTER SUMMARY TABLE - TOP 20 BRANDS (ALL-TIME)
═══════════════════════════════════════════════════════════════════════════════

BRAND                  | RATECARD SPEND  | NET SPEND       | CAMPAIGNS | COUNTRIES | SAVINGS %
-----------------------|-----------------|-----------------|-----------|-----------|----------
`;

        topBrands.forEach(([brand, stats]) => {
            const savings = stats.totalRatecard > 0
                ? ((stats.totalRatecard - stats.totalNet) / stats.totalRatecard * 100).toFixed(1)
                : '0.0';
            const brandName = brand.substring(0, 22).padEnd(22);
            const ratecard = formatCurrency(stats.totalRatecard).padStart(15);
            const net = formatCurrency(stats.totalNet).padStart(15);
            const campaigns = stats.campaigns.toString().padStart(9);
            const countries = stats.countries.size.toString().padStart(9);
            summaryTable += `${brandName} |${ratecard} |${net} |${campaigns} |${countries} | ${savings}%\n`;
        });

        // Add brand x country breakdown for top brands
        summaryTable += `
═══════════════════════════════════════════════════════════════════════════════
                    BRAND SPEND BY COUNTRY (TOP 10 BRANDS)
═══════════════════════════════════════════════════════════════════════════════
`;

        topBrands.slice(0, 10).forEach(([brand]) => {
            const countryData = brandCountrySummary[brand] || {};
            const sortedCountries = Object.entries(countryData)
                .sort((a, b) => b[1].ratecard - a[1].ratecard);

            summaryTable += `\n${brand}:\n`;
            sortedCountries.forEach(([country, stats]) => {
                const savings = stats.ratecard > 0
                    ? ((stats.ratecard - stats.net) / stats.ratecard * 100).toFixed(1)
                    : '0.0';
                summaryTable += `  ${country.padEnd(10)}: Ratecard ${formatCurrency(stats.ratecard).padStart(12)}, Net ${formatCurrency(stats.net).padStart(12)}, ${stats.campaigns} campaigns (${savings}% savings)\n`;
            });
        });

        // Cache the result
        summaryTableCache = { data: summaryTable, timestamp: Date.now() };
        return summaryTable;

    } catch (err) {
        console.error('Error generating summary table:', err);
        return 'Summary table generation failed - query database directly.';
    }
}

/**
 * Extract relevant filter criteria from the user's question (IMPROVED VERSION)
 */
function extractQueryFilters(question: string): {
    brands?: string[];
    countries?: string[];
    media?: string[];
    channels?: string[];
    categories?: string[];
    dateRange?: { start?: string; end?: string };
} {
    const filters: any = {};
    const lowerQuestion = question.toLowerCase();

    // Extract brands (expanded list)
    const knownBrands = [
        'amazon', 'talabat', 'careem', 'deliveroo', 'noon', 'keeta', 'instashop',
        'hungerstation', 'hunger station', 'mrsool', 'marsool', 'jahez',
        'kfc', 'mcdonalds', 'mcdonald', 'pizza hut', 'burger king', 'subway',
        'localy', 'snoonu', 'chefz', 'kibsons', 'elgrocer'
    ];
    const mentionedBrands = knownBrands.filter(brand => lowerQuestion.includes(brand.toLowerCase()));
    if (mentionedBrands.length > 0) {
        filters.brands = mentionedBrands;
    }

    // Extract countries
    const countryMap: Record<string, string> = {
        'ksa': 'KSA', 'saudi': 'KSA', 'saudi arabia': 'KSA',
        'uae': 'UAE', 'emirates': 'UAE', 'dubai': 'UAE', 'abu dhabi': 'UAE',
        'qatar': 'QATAR', 'doha': 'QATAR',
        'kuwait': 'KUWAIT',
        'bahrain': 'BAHRAIN',
        'oman': 'OMAN', 'muscat': 'OMAN',
        'egypt': 'EGYPT', 'cairo': 'EGYPT',
        'jordan': 'JORDAN', 'amman': 'JORDAN',
        'iraq': 'IRAQ', 'baghdad': 'IRAQ'
    };
    const mentionedCountries: string[] = [];
    for (const [keyword, country] of Object.entries(countryMap)) {
        if (lowerQuestion.includes(keyword)) {
            mentionedCountries.push(country);
        }
    }
    if (mentionedCountries.length > 0) {
        filters.countries = [...new Set(mentionedCountries)];
    }

    // Extract media types
    if (lowerQuestion.includes('online') || lowerQuestion.includes('digital') || lowerQuestion.includes('internet')) {
        filters.media = ['ONLINE'];
    }
    if (lowerQuestion.includes('tv') || lowerQuestion.includes('television')) {
        filters.media = filters.media || [];
        filters.media.push('TV');
    }
    if (lowerQuestion.includes('radio')) {
        filters.media = filters.media || [];
        filters.media.push('RADIO');
    }

    // Extract channels
    const channels = ['instagram', 'facebook', 'youtube', 'twitter', 'snapchat', 'tiktok', 'google'];
    const mentionedChannels = channels.filter(ch => lowerQuestion.includes(ch));
    if (mentionedChannels.length > 0) {
        filters.channels = mentionedChannels;
    }

    // Extract time periods (IMPROVED)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Year-based
    // Only apply date filters for EXPLICIT years, not ambiguous phrases like "last year"
    const year2024Match = lowerQuestion.match(/\b2024\b/);
    const year2025Match = lowerQuestion.match(/\b2025\b|this year/);
    const year2023Match = lowerQuestion.match(/\b2023\b/);

    // Quarter-based
    const q1Match = lowerQuestion.match(/q1|first quarter|quarter 1/);
    const q2Match = lowerQuestion.match(/q2|second quarter|quarter 2/);
    const q3Match = lowerQuestion.match(/q3|third quarter|quarter 3/);
    const q4Match = lowerQuestion.match(/q4|fourth quarter|quarter 4/);

    // Month-based
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthMatch = months.findIndex(m => lowerQuestion.includes(m));

    if (year2024Match) {
        filters.dateRange = { start: '2024-01-01', end: '2024-12-31' };
        if (q1Match) filters.dateRange = { start: '2024-01-01', end: '2024-03-31' };
        if (q2Match) filters.dateRange = { start: '2024-04-01', end: '2024-06-30' };
        if (q3Match) filters.dateRange = { start: '2024-07-01', end: '2024-09-30' };
        if (q4Match) filters.dateRange = { start: '2024-10-01', end: '2024-12-31' };
    } else if (year2025Match) {
        filters.dateRange = { start: '2025-01-01', end: '2025-12-31' };
        if (q1Match) filters.dateRange = { start: '2025-01-01', end: '2025-03-31' };
        if (q2Match) filters.dateRange = { start: '2025-04-01', end: '2025-06-30' };
    } else if (year2023Match) {
        filters.dateRange = { start: '2023-01-01', end: '2023-12-31' };
    } else if (q1Match) {
        filters.dateRange = { start: `${currentYear}-01-01`, end: `${currentYear}-03-31` };
    } else if (q2Match) {
        filters.dateRange = { start: `${currentYear}-04-01`, end: `${currentYear}-06-30` };
    } else if (monthMatch >= 0) {
        const monthNum = String(monthMatch + 1).padStart(2, '0');
        const year = year2024Match ? 2024 : year2025Match ? 2025 : currentYear;
        const lastDay = new Date(year, monthMatch + 1, 0).getDate();
        filters.dateRange = { start: `${year}-${monthNum}-01`, end: `${year}-${monthNum}-${lastDay}` };
    }

    return filters;
}

/**
 * Query Supabase with filters (RETURNS RAW DATA, NO SUMMARIZATION)
 */
async function queryDatabase(filters: ReturnType<typeof extractQueryFilters>) {
    let query = supabase
        .from('unified_competitive_stats')
        .select('*');

    // Apply brand filter
    if (filters.brands && filters.brands.length > 0) {
        const brandConditions = filters.brands.map(b => `brand.ilike.%${b}%`).join(',');
        query = query.or(brandConditions);
    }

    // Apply country filter
    if (filters.countries && filters.countries.length > 0) {
        query = query.in('country', filters.countries);
    }

    // Apply media filter
    if (filters.media && filters.media.length > 0) {
        query = query.in('media', filters.media);
    }

    // Apply channel filter
    if (filters.channels && filters.channels.length > 0) {
        const channelConditions = filters.channels.map(c => `channel.ilike.%${c}%`).join(',');
        query = query.or(channelConditions);
    }

    // Apply date range filter
    if (filters.dateRange) {
        if (filters.dateRange.start) {
            query = query.gte('date', filters.dateRange.start);
        }
        if (filters.dateRange.end) {
            query = query.lte('date', filters.dateRange.end);
        }
    }

    // Get total count first for accurate reporting
    const countQuery = supabase
        .from('unified_competitive_stats')
        .select('*', { count: 'exact', head: true });

    // Apply same filters to count query
    if (filters.brands && filters.brands.length > 0) {
        const brandConditions = filters.brands.map(b => `brand.ilike.%${b}%`).join(',');
        countQuery.or(brandConditions);
    }
    if (filters.countries && filters.countries.length > 0) {
        countQuery.in('country', filters.countries);
    }
    if (filters.media && filters.media.length > 0) {
        countQuery.in('media', filters.media);
    }
    if (filters.dateRange?.start) {
        countQuery.gte('date', filters.dateRange.start);
    }
    if (filters.dateRange?.end) {
        countQuery.lte('date', filters.dateRange.end);
    }

    const { count: totalCount } = await countQuery;

    // Fetch ALL matching records for accurate aggregation (up to 10,000)
    // For numerical accuracy, we need all records not just top 200
    query = query.order('budget', { ascending: false }).limit(10000);

    const { data, error } = await query;

    if (error) {
        console.error('Supabase query error:', error);
        return { records: [], totalCount: 0, truncated: false };
    }

    const isTruncated = (totalCount || 0) > 10000;

    return {
        records: data || [],
        totalCount: totalCount || data?.length || 0,
        truncated: isTruncated
    };
}

/**
 * Format raw data for GPT (HYBRID: Statistics + Sample Records)
 */
function formatDatabaseResults(
    records: any[],
    totalCount: number,
    appliedFilters: any,
    truncated: boolean = false
): string {
    if (!records || records.length === 0) {
        return `No matching data found in the database.

Applied filters were: ${JSON.stringify(appliedFilters, null, 2)}

SUGGESTION: Try without date filters or check if the brand name is spelled correctly. The database contains data for brands like: Talabat, Careem, Deliveroo, Noon, Keeta, Amazon, Jahez, HungerStation, etc.`;
    }

    const dataAccuracyNote = truncated
        ? `⚠️ DATA NOTE: Query returned ${totalCount} total records but only ${records.length} were analyzed. Numbers may be approximate.`
        : `✓ DATA ACCURACY: All ${totalCount} matching records analyzed. Numbers are EXACT.`;

    // Calculate aggregates (ratecard budget)
    const totalBudget = records.reduce((acc, r) => acc + parseCurrency(r.budget), 0);
    // Calculate net budget (actual spend for offline, fallback to budget for online)
    const totalNetBudget = records.reduce((acc, r) => {
        if (r.net_budget) {
            return acc + parseCurrency(r.net_budget);
        }
        return acc + parseCurrency(r.budget);
    }, 0);
    const totalVolume = records.reduce((acc, r) => acc + parseCurrency(r.volume), 0);

    // Group by brand (including net_budget)
    const brandStats: Record<string, { budget: number; netBudget: number; campaigns: number; volume: number }> = {};
    records.forEach((r) => {
        const brand = r.brand || 'Unknown';
        if (!brandStats[brand]) brandStats[brand] = { budget: 0, netBudget: 0, campaigns: 0, volume: 0 };
        brandStats[brand].budget += parseCurrency(r.budget);
        brandStats[brand].netBudget += r.net_budget ? parseCurrency(r.net_budget) : parseCurrency(r.budget);
        brandStats[brand].campaigns += 1;
        brandStats[brand].volume += parseCurrency(r.volume);
    });

    // Group by brand + country (for detailed breakdowns)
    const brandCountryStats: Record<string, Record<string, { budget: number; campaigns: number }>> = {};
    records.forEach((r) => {
        const brand = r.brand || 'Unknown';
        const country = r.country || 'Unknown';
        if (!brandCountryStats[brand]) brandCountryStats[brand] = {};
        if (!brandCountryStats[brand][country]) brandCountryStats[brand][country] = { budget: 0, campaigns: 0 };
        brandCountryStats[brand][country].budget += parseCurrency(r.budget);
        brandCountryStats[brand][country].campaigns += 1;
    });

    // Group by brand + channel (for channel mix by brand)
    const brandChannelStats: Record<string, Record<string, number>> = {};
    records.forEach((r) => {
        const brand = r.brand || 'Unknown';
        const channel = r.channel || 'Unknown';
        if (!brandChannelStats[brand]) brandChannelStats[brand] = {};
        brandChannelStats[brand][channel] = (brandChannelStats[brand][channel] || 0) + 1;
    });

    // Group by channel
    const channelStats: Record<string, number> = {};
    records.forEach((r) => {
        const channel = r.channel || 'Unknown';
        channelStats[channel] = (channelStats[channel] || 0) + 1;
    });

    // Group by country
    const countryStats: Record<string, { budget: number; campaigns: number }> = {};
    records.forEach((r) => {
        const country = r.country || 'Unknown';
        if (!countryStats[country]) countryStats[country] = { budget: 0, campaigns: 0 };
        countryStats[country].budget += parseCurrency(r.budget);
        countryStats[country].campaigns += 1;
    });

    // Group by month
    const monthlyActivity: Record<string, number> = {};
    records.forEach((r) => {
        if (r.date) {
            const month = r.date.substring(0, 7); // YYYY-MM
            monthlyActivity[month] = (monthlyActivity[month] || 0) + 1;
        }
    });

    // Take top 10 sample records for context
    const sampleRecords = records.slice(0, 10).map(r => ({
        brand: r.brand,
        country: r.country,
        media: r.media,
        channel: r.channel,
        budget: r.budget,
        date: r.date ? r.date.substring(0, 10) : null,
    }));

    // Format brand-country breakdown for top 15 brands
    const topBrands = Object.keys(brandStats)
        .sort((a, b) => brandStats[b].budget - brandStats[a].budget)
        .slice(0, 15);

    const brandCountryBreakdowns = topBrands.map(brand => {
        const countries = Object.entries(brandCountryStats[brand] || {})
            .sort((a, b) => b[1].budget - a[1].budget)
            .map(([country, stats]) =>
                `    ${country}: ${formatCurrency(stats.budget)} (${stats.campaigns} campaigns)`
            )
            .join('\n');
        return `  ${brand}:\n${countries}`;
    }).join('\n\n');

    // Format brand-channel breakdown for top 5 brands
    const brandChannelBreakdowns = topBrands.map(brand => {
        const channels = Object.entries(brandChannelStats[brand] || {})
            .sort((a, b) => b[1] - a[1])
            .map(([channel, count]) => `    ${channel}: ${count} campaigns`)
            .join('\n');
        return `  ${brand}:\n${channels}`;
    }).join('\n\n');

    // Calculate savings
    const savingsAmount = totalBudget - totalNetBudget;
    const savingsPercentage = totalBudget > 0 ? ((savingsAmount / totalBudget) * 100).toFixed(1) : '0.0';
    const hasNetData = records.some(r => r.net_budget && parseCurrency(r.net_budget) !== parseCurrency(r.budget));

    // Count offline vs online records
    const offlineRecords = records.filter(r => r.media && ['TV', 'RADIO', 'PRINT', 'OOH', 'OUTDOOR'].includes(r.media.toUpperCase()));
    const onlineRecords = records.filter(r => r.media && r.media.toUpperCase() === 'ONLINE');

    return `
DATABASE QUERY RESULTS (${totalCount} campaigns found):

${dataAccuracyNote}

OVERALL STATISTICS:
- Total Ratecard Budget: ${formatCurrency(totalBudget)} (published/list price - media value before negotiations)
- Total Net Spend: ${formatCurrency(totalNetBudget)} (actual negotiated cost paid)
- Savings from Negotiations: ${formatCurrency(savingsAmount)} (${savingsPercentage}% savings rate)
- Total Volume: ${totalVolume.toLocaleString()}
- Total Campaigns: ${totalCount}
- Offline Campaigns (TV/Radio/OOH): ${offlineRecords.length} (has net spend data)
- Online Campaigns (Digital): ${onlineRecords.length} (net = ratecard, no negotiation data)

CRITICAL: When answering questions about spend/budget, use the EXACT numbers above. Do NOT estimate or round significantly.

INTERPRETATION GUIDE:
- ${hasNetData ? `This data includes negotiated rates. The ${savingsPercentage}% savings shows media buying effectiveness.` : 'This data is primarily online - net spend equals ratecard (no negotiation margin).'}
- When discussing budgets: Use NET SPEND for actual investment, RATECARD for media value comparison.

TOP BRANDS (by budget):
${Object.entries(brandStats)
    .sort((a, b) => b[1].budget - a[1].budget)
    .slice(0, 10)
    .map(([brand, stats]) =>
        `  - ${brand}: Ratecard ${formatCurrency(stats.budget)}, Net ${formatCurrency(stats.netBudget)}, ${stats.campaigns} campaigns`
    )
    .join('\n')}

COUNTRY BREAKDOWN (overall):
${Object.entries(countryStats)
    .sort((a, b) => b[1].budget - a[1].budget)
    .map(([country, stats]) =>
        `  - ${country}: ${formatCurrency(stats.budget)}, ${stats.campaigns} campaigns`
    )
    .join('\n')}

BRAND BREAKDOWN BY COUNTRY (top 15 brands):
${brandCountryBreakdowns}

CHANNEL BREAKDOWN (overall):
${Object.entries(channelStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([channel, count]) => `  - ${channel}: ${count} campaigns`)
    .join('\n')}

BRAND BREAKDOWN BY CHANNEL (top 15 brands):
${brandChannelBreakdowns}

MONTHLY ACTIVITY:
${Object.entries(monthlyActivity)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => `  - ${month}: ${count} campaigns`)
    .join('\n')}

SAMPLE RECORDS (Top 10 by budget):
${JSON.stringify(sampleRecords, null, 2)}

Use these detailed breakdowns to answer questions about country distribution, channel mix, and brand-specific data.
`;
}

/**
 * Detect question type to provide better responses
 */
function detectQuestionType(question: string): {
    isNumerical: boolean;
    isStrategic: boolean;
    isComparison: boolean;
    needsClarification: boolean;
    clarificationNeeded?: string;
} {
    const lower = question.toLowerCase();

    const isNumerical = /spend|budget|cost|how much|total|amount|revenue|investment|\$|dollar/i.test(lower);
    const isStrategic = /strategy|recommend|should|compete|position|market share|opportunity|threat|swot|analysis/i.test(lower);
    const isComparison = /compare|vs|versus|difference|better|worse|more than|less than/i.test(lower);

    // Check if question needs clarification
    let needsClarification = false;
    let clarificationNeeded: string | undefined;

    // Ambiguous time reference
    if (/last year|this year|recent/i.test(lower) && !/2024|2025|2023/i.test(lower)) {
        needsClarification = true;
        clarificationNeeded = 'time period';
    }

    // Missing country for spend questions
    if (isNumerical && !/uae|ksa|saudi|qatar|kuwait|bahrain|oman|egypt|jordan|iraq|all countr/i.test(lower)) {
        // Only flag if asking about a specific brand
        if (/talabat|amazon|keeta|careem|deliveroo|noon|jahez/i.test(lower)) {
            needsClarification = true;
            clarificationNeeded = clarificationNeeded ? `${clarificationNeeded} and country` : 'country';
        }
    }

    return { isNumerical, isStrategic, isComparison, needsClarification, clarificationNeeded };
}

export async function POST(req: Request) {
    try {
        console.log('=== AI Chat API Request Started (Bulletproof Version) ===');

        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1];
        const userQuestion = lastMessage?.content || '';
        console.log('User question:', userQuestion);

        // Detect question type
        const questionType = detectQuestionType(userQuestion);
        console.log('Question type:', questionType);

        // Generate summary table (cached for efficiency)
        const summaryTable = await generateSummaryTable();
        console.log('Summary table generated/cached');

        // Load DOCX content (only for strategic questions, skip for numerical)
        let docxExcerpt = '';
        if (questionType.isStrategic) {
            const docxContent = await getDocxContent();
            docxExcerpt = docxContent ? docxContent.substring(0, 15000) : '';
            console.log('DOCX loaded for strategic question');
        }

        // Extract filters and query database
        const filters = extractQueryFilters(userQuestion);
        console.log('Extracted filters:', JSON.stringify(filters, null, 2));

        const { records, totalCount, truncated } = await queryDatabase(filters);
        console.log(`Query returned ${records.length} records (total: ${totalCount}, truncated: ${truncated})`);

        // Format database results
        const databaseContext = formatDatabaseResults(records, totalCount, filters, truncated);

        // Build clarification prompt if needed
        const clarificationPrompt = questionType.needsClarification
            ? `\n⚠️ CLARIFICATION MAY BE NEEDED: The user's question is ambiguous about ${questionType.clarificationNeeded}. If you cannot provide a precise answer, politely ask them to specify (e.g., "Which country would you like me to focus on?" or "Are you asking about 2024 or all-time data?").`
            : '';

        const systemPrompt = `You are a Senior Strategic Analyst specializing in the MENA Food Delivery & Quick Commerce market.

═══════════════════════════════════════════════════════════════════════════════
                              RESPONSE GUIDELINES
═══════════════════════════════════════════════════════════════════════════════

1. **ACCURACY IS PARAMOUNT**: Use EXACT numbers from the data provided. Never estimate or make up figures.

2. **FOR NUMERICAL QUESTIONS** (spend, budget, campaigns):
   - First check the MASTER SUMMARY TABLE below for quick answers
   - Quote exact figures: "$X across Y campaigns in Z country"
   - Include both Ratecard and Net Spend when relevant
   - Mention savings percentage for offline media

3. **FOR STRATEGIC QUESTIONS** (recommendations, analysis):
   - Support arguments with data from the summary table
   - Reference competitive positioning
   - Be actionable and specific

4. **FORMAT**:
   - Keep answers CONCISE (150-300 words ideal)
   - Use bullet points for clarity
   - Bold key numbers and insights

5. **WHEN UNSURE**: Ask a clarifying question instead of guessing
${clarificationPrompt}

═══════════════════════════════════════════════════════════════════════════════
                        BUDGET TERMINOLOGY REFERENCE
═══════════════════════════════════════════════════════════════════════════════

• RATECARD SPEND = Published media price (before negotiations)
• NET SPEND = Actual cost paid (after negotiations) - USE THIS FOR INVESTMENT DISCUSSIONS
• SAVINGS % = (Ratecard - Net) / Ratecard × 100
• OFFLINE media (TV, Radio, OOH) has negotiated rates → shows savings
• ONLINE media (Digital) has no negotiation → Net = Ratecard

═══════════════════════════════════════════════════════════════════════════════
              🎯 MASTER SUMMARY TABLE (YOUR PRIMARY REFERENCE)
═══════════════════════════════════════════════════════════════════════════════
${summaryTable}

═══════════════════════════════════════════════════════════════════════════════
                    FILTERED QUERY RESULTS (Based on user question)
═══════════════════════════════════════════════════════════════════════════════
${databaseContext}

${questionType.isStrategic && docxExcerpt ? `
═══════════════════════════════════════════════════════════════════════════════
                           MARKET INTELLIGENCE
═══════════════════════════════════════════════════════════════════════════════
${docxExcerpt}
` : ''}

${MENA_KNOWLEDGE_BASE ? `
═══════════════════════════════════════════════════════════════════════════════
                           KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════════════════════
${MENA_KNOWLEDGE_BASE.substring(0, 10000)}
` : ''}

Today's Date: ${new Date().toISOString().split('T')[0]}
`;

        const validMessages = messages.filter((msg: any) => msg && msg.content && msg.role);
        console.log('Valid messages count:', validMessages.length);

        const result = streamText({
            model: openai('gpt-4o-mini'),
            system: systemPrompt,
            messages: validMessages,
            temperature: 0.3, // Lower temperature for more consistent/factual responses
        });

        console.log('Streaming response...');
        return result.toTextStreamResponse();

    } catch (error: any) {
        console.error('=== AI Chat API Error ===');
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);

        // Return a user-friendly error message
        const errorMessage = error?.message?.includes('rate limit')
            ? 'The AI service is currently busy. Please try again in a few seconds.'
            : 'I encountered an error processing your request. Please try rephrasing your question.';

        return new Response(
            JSON.stringify({
                error: 'AI processing error',
                message: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
