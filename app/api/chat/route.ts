import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { parseCurrency, formatCurrency } from '@/utils/format';
import { createClient } from '@supabase/supabase-js';
import { getDocxContent } from '@/utils/docx-parser';
import fs from 'fs';
import path from 'path';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Verify OpenAI API Key is available
if (!process.env.OPENAI_API_KEY) {
    console.error('CRITICAL: OPENAI_API_KEY is not set in environment variables');
}

// Load MENA knowledge base
const MENA_KNOWLEDGE_BASE = fs.readFileSync(
    path.join(process.cwd(), 'mena_knowledge_base.txt'),
    'utf-8'
);

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    // Sort by budget descending and limit to 200 for very fast response
    query = query.order('budget', { ascending: false }).limit(200);

    const { data, error, count } = await query;

    if (error) {
        console.error('Supabase query error:', error);
        return { records: [], totalCount: 0 };
    }

    return { records: data || [], totalCount: count || data?.length || 0 };
}

/**
 * Format raw data for GPT (HYBRID: Statistics + Sample Records)
 */
function formatDatabaseResults(records: any[], totalCount: number, appliedFilters: any): string {
    if (!records || records.length === 0) {
        return `No matching data found in the database.

Applied filters were: ${JSON.stringify(appliedFilters, null, 2)}

SUGGESTION: Try without date filters or check if the brand name is spelled correctly. The database contains data for brands like: Talabat, Careem, Deliveroo, Noon, Keeta, Amazon, Jahez, HungerStation, etc.`;
    }

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

    // Calculate savings percentage
    const savingsPercentage = totalBudget > 0 ? ((totalBudget - totalNetBudget) / totalBudget * 100).toFixed(1) : '0.0';

    return `
DATABASE QUERY RESULTS (${records.length} campaigns found):

OVERALL STATISTICS:
- Total Ratecard Budget: ${formatCurrency(totalBudget)} (estimated media value)
- Total Net Spend: ${formatCurrency(totalNetBudget)} (actual negotiated spend)
- Savings from Negotiations: ${savingsPercentage}%
- Total Volume: ${totalVolume.toLocaleString()}
- Total Campaigns: ${records.length}

NOTE: "Net Spend" = actual negotiated cost (available for offline media). For online media, net equals ratecard.

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

export async function POST(req: Request) {
    try {
        console.log('=== AI Chat API Request Started (Improved Version) ===');

        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1];
        const userQuestion = lastMessage?.content || '';
        console.log('User question:', userQuestion);

        // Load DOCX content (REDUCED to 20k for faster response)
        const docxContent = await getDocxContent();
        const docxExcerpt = docxContent ? docxContent.substring(0, 20000) : 'Document not available';
        console.log('DOCX content length:', docxExcerpt.length);

        // Extract filters and query database
        const filters = extractQueryFilters(userQuestion);
        console.log('Extracted filters:', JSON.stringify(filters, null, 2));

        const { records, totalCount } = await queryDatabase(filters);
        console.log(`Query returned ${records.length} records`);
        console.log(`Applied filters:`, JSON.stringify(filters, null, 2));

        // Format raw data (NO SUMMARIZATION)
        const databaseContext = formatDatabaseResults(records, totalCount, filters);

        const systemPrompt = `You are a Strategic Analyst for MENA Food Delivery Market.

INSTRUCTIONS:
- Answer with SPECIFIC NUMBERS from the database statistics below
- Format: "$X across Y campaigns" with proper commas
- If no data found, say so clearly
- **IMPORTANT: Keep answers CONCISE (max 500 words)**
- Use bullet points for clarity
- Avoid repetition

BUDGET TERMINOLOGY:
- "Ratecard Budget" = Estimated media value (what it would cost without negotiations)
- "Net Spend" = Actual negotiated cost paid (reflects media buying effectiveness)
- Net spend data is available for OFFLINE media (TV, Radio). For ONLINE media, net equals ratecard.
- When discussing budgets, mention both if relevant to show negotiation savings.

KNOWLEDGE BASE:
${MENA_KNOWLEDGE_BASE}

MARKET ANALYSIS EXCERPT:
${docxExcerpt}

DATABASE RESULTS:
${databaseContext}

Today: ${new Date().toISOString().split('T')[0]}
`;

        const validMessages = messages.filter((msg: any) => msg && msg.content && msg.role);
        console.log('Valid messages count:', validMessages.length);

        const result = streamText({
            model: openai('gpt-4o-mini'), // Using mini for higher rate limits (200k TPM vs 30k)
            system: systemPrompt,
            messages: validMessages,
        });

        console.log('Streaming response...');
        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error('=== AI Chat API Error ===');
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);

        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                message: error?.message || 'Unknown error',
                details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
