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
 * Extract relevant filter criteria from the user's question
 */
function extractQueryFilters(question: string): {
    brands?: string[];
    countries?: string[];
    categories?: string[];
    dateRange?: { start?: string; end?: string };
} {
    const filters: any = {};
    const lowerQuestion = question.toLowerCase();

    // Extract brands
    const knownBrands = ['amazon', 'jahez', 'talabat', 'careem', 'deliveroo', 'noon', 'keeta', 'hunger station', 'instashop', 'kfc', 'pizza hut', 'mcdonald', 'localy'];
    const mentionedBrands = knownBrands.filter(brand => lowerQuestion.includes(brand.toLowerCase()));
    if (mentionedBrands.length > 0) {
        filters.brands = mentionedBrands;
    }

    // Extract countries
    const knownCountries = ['ksa', 'saudi', 'uae', 'emirates', 'qatar', 'kuwait', 'bahrain', 'oman', 'egypt'];
    const countryMap: Record<string, string> = {
        'ksa': 'KSA',
        'saudi': 'KSA',
        'uae': 'UAE',
        'emirates': 'UAE',
        'qatar': 'QATAR',
        'kuwait': 'KUWAIT',
        'bahrain': 'BAHRAIN',
        'oman': 'OMAN',
        'egypt': 'EGYPT'
    };
    const mentionedCountries = knownCountries.filter(c => lowerQuestion.includes(c));
    if (mentionedCountries.length > 0) {
        filters.countries = [...new Set(mentionedCountries.map(c => countryMap[c]))];
    }

    // Extract time periods
    const currentYear = new Date().getFullYear();
    const lastYearMatch = lowerQuestion.match(/last year|2024/);
    const thisYearMatch = lowerQuestion.match(/this year|2025/);
    const q1Match = lowerQuestion.match(/q1|first quarter/);
    const q2Match = lowerQuestion.match(/q2|second quarter/);
    const q3Match = lowerQuestion.match(/q3|third quarter/);
    const q4Match = lowerQuestion.match(/q4|fourth quarter/);

    if (lastYearMatch) {
        filters.dateRange = { start: '2024-01-01', end: '2024-12-31' };
    } else if (thisYearMatch) {
        filters.dateRange = { start: '2025-01-01', end: '2025-12-31' };
    } else if (q2Match && thisYearMatch) {
        filters.dateRange = { start: '2025-04-01', end: '2025-06-30' };
    } else if (q2Match) {
        filters.dateRange = { start: `${currentYear}-04-01`, end: `${currentYear}-06-30` };
    }

    return filters;
}

/**
 * Query Supabase with filters extracted from the user question
 */
async function queryDatabase(filters: ReturnType<typeof extractQueryFilters>) {
    let query = supabase
        .from('unified_competitive_stats')
        .select('*');

    // Apply brand filter
    if (filters.brands && filters.brands.length > 0) {
        // Use case-insensitive matching
        const brandConditions = filters.brands.map(b => `brand.ilike.%${b}%`).join(',');
        query = query.or(brandConditions);
    }

    // Apply country filter
    if (filters.countries && filters.countries.length > 0) {
        query = query.in('country', filters.countries);
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

    const { data, error } = await query.limit(1000);

    if (error) {
        console.error('Supabase query error:', error);
        return [];
    }

    return data || [];
}

/**
 * Analyze and summarize queried data
 */
function summarizeQueryResults(data: any[]): string {
    if (!data || data.length === 0) {
        return 'No matching data found in the database.';
    }

    // Calculate aggregates
    const totalBudget = data.reduce((acc, item) => acc + parseCurrency(item.budget), 0);
    const totalVolume = data.reduce((acc, item) => acc + parseCurrency(item.volume), 0);

    // Group by brand
    const brandStats: Record<string, { budget: number; campaigns: number; volume: number }> = {};
    data.forEach((item) => {
        const brand = item.brand || 'Unknown';
        if (!brandStats[brand]) {
            brandStats[brand] = { budget: 0, campaigns: 0, volume: 0 };
        }
        brandStats[brand].budget += parseCurrency(item.budget);
        brandStats[brand].campaigns += 1;
        brandStats[brand].volume += parseCurrency(item.volume);
    });

    // Group by country
    const countryStats: Record<string, { budget: number; campaigns: number }> = {};
    data.forEach((item) => {
        const country = item.country || 'Unknown';
        if (!countryStats[country]) {
            countryStats[country] = { budget: 0, campaigns: 0 };
        }
        countryStats[country].budget += parseCurrency(item.budget);
        countryStats[country].campaigns += 1;
    });

    // Group by category
    const categoryStats: Record<string, number> = {};
    data.forEach((item) => {
        const category = item.category || 'Unknown';
        categoryStats[category] = (categoryStats[category] || 0) + parseCurrency(item.budget);
    });

    // Format the summary
    const brandSummary = Object.entries(brandStats)
        .sort((a, b) => b[1].budget - a[1].budget)
        .slice(0, 10)
        .map(([brand, stats]) =>
            `  - ${brand}: ${formatCurrency(stats.budget)} budget, ${stats.campaigns} campaigns, ${stats.volume.toLocaleString()} volume`
        )
        .join('\n');

    const countrySummary = Object.entries(countryStats)
        .sort((a, b) => b[1].budget - a[1].budget)
        .map(([country, stats]) =>
            `  - ${country}: ${formatCurrency(stats.budget)} budget, ${stats.campaigns} campaigns`
        )
        .join('\n');

    const categorySummary = Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, budget]) =>
            `  - ${category}: ${formatCurrency(budget)}`
        )
        .join('\n');

    return `
Database Query Results (${data.length} records found):
- Total Budget: ${formatCurrency(totalBudget)}
- Total Volume: ${totalVolume.toLocaleString()}

Top Brands:
${brandSummary}

Countries:
${countrySummary}

Top Categories:
${categorySummary}
`;
}

export async function POST(req: Request) {
    try {
        console.log('=== AI Chat API Request Started ===');

        // Parse request body
        const { messages } = await req.json();
        console.log('Received messages:', JSON.stringify(messages, null, 2));

        // Get the last user message
        const lastMessage = messages[messages.length - 1];
        const userQuestion = lastMessage?.content || '';
        console.log('User question:', userQuestion);

        // Load docx content
        console.log('Loading DOCX content...');
        const docxContent = await getDocxContent();
        console.log('DOCX content length:', docxContent?.length || 0);

        // Extract filters and query database
        console.log('Extracting query filters...');
        const filters = extractQueryFilters(userQuestion);
        console.log('Filters:', filters);

        console.log('Querying database...');
        const queryResults = await queryDatabase(filters);
        console.log('Query results count:', queryResults?.length || 0);

        const dataSummary = summarizeQueryResults(queryResults);

        const systemPrompt = `
You are an expert Strategic Analyst for the MENA Food Delivery Market.

**MENA Market Intelligence (from internal research document):**
${MENA_KNOWLEDGE_BASE}

**Additional Market Analysis (from MENA Delivery Market Competitive Analysis document):**
${docxContent ? docxContent.substring(0, 15000) : 'Document not available'}

**Current Database Query Results:**
${dataSummary}

**Instructions:**
- Answer the user's question using BOTH the database query results AND the market intelligence documents above.
- ALWAYS cite specific numbers from the database when available (e.g., "According to our data, Amazon spent $X in KSA last year...").
- Reference strategic insights from the market analysis document when relevant.
- If the database query results show "No matching data found", check if the market intelligence documents contain relevant information.
- Do not hallucinate numbers. If specific data is missing, say so and provide context from what is available.
- Keep answers concise, strategic, and executive-level.
- When referencing data, be clear about the source (database vs. market analysis document).
`;

        // Filter and validate messages before converting
        const validMessages = messages.filter((msg: any) =>
            msg && msg.content && msg.role
        );
        console.log('Valid messages count:', validMessages.length);
        console.log('Calling OpenAI API...');

        const result = streamText({
            model: openai('gpt-4o'),
            system: systemPrompt,
            messages: validMessages,
        });

        console.log('Streaming response...');
        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error('=== AI Chat API Error ===');
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        console.error('Error details:', JSON.stringify(error, null, 2));

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
