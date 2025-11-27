/**
 * Embeddings Utility
 * Generates OpenAI vector embeddings for campaign records to enable semantic search
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Faster and cheaper than text-embedding-3-large
      input: text.substring(0, 8000), // OpenAI limit is 8191 tokens
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * OpenAI allows up to 2048 inputs per request
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 100; // Conservative batch size
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch.map(t => t.substring(0, 8000)),
        encoding_format: 'float',
      });

      embeddings.push(...response.data.map(d => d.embedding));

      console.log(`Generated embeddings ${i + 1}-${Math.min(i + BATCH_SIZE, texts.length)} of ${texts.length}`);

      // Rate limiting: wait 1 second between batches
      if (i + BATCH_SIZE < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error generating embeddings for batch ${i}-${i + BATCH_SIZE}:`, error);
      throw error;
    }
  }

  return embeddings;
}

/**
 * Create searchable text from campaign record
 * This matches the searchable_text computed column in the database
 */
export function createSearchableText(record: {
  brand?: string;
  country?: string;
  category?: string;
  media?: string;
  channel?: string;
  date?: Date | string;
}): string {
  const parts = [
    record.brand || '',
    record.country || '',
    record.category || '',
    record.media || '',
    record.channel || '',
  ];

  if (record.date) {
    const dateStr = typeof record.date === 'string'
      ? record.date
      : record.date.toISOString();
    const yearMonth = dateStr.substring(0, 7); // YYYY-MM
    parts.push(yearMonth);
  }

  return parts.filter(Boolean).join(' ');
}

/**
 * Semantic search using embeddings
 * Returns records sorted by similarity to query
 */
export async function semanticSearch(
  supabase: any,
  query: string,
  matchThreshold: number = 0.7,
  matchCount: number = 100
): Promise<any[]> {
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Call database function for semantic search
  const { data, error } = await supabase.rpc('search_campaigns_semantic', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error('Semantic search error:', error);
    throw error;
  }

  return data || [];
}

/**
 * Hybrid search: Combines semantic search with traditional filters
 */
export async function hybridSearch(
  supabase: any,
  query: string,
  filters: {
    brands?: string[];
    countries?: string[];
    media?: string[];
    channels?: string[];
    dateFrom?: string;
    dateTo?: string;
  } = {},
  matchCount: number = 200
): Promise<any[]> {
  // Start with semantic search
  const semanticResults = await semanticSearch(supabase, query, 0.6, matchCount * 2);

  // Apply additional filters if provided
  let filteredResults = semanticResults;

  if (filters.brands && filters.brands.length > 0) {
    const brandsUpper = filters.brands.map(b => b.toUpperCase());
    filteredResults = filteredResults.filter(r =>
      brandsUpper.some(brand => r.brand?.toUpperCase().includes(brand))
    );
  }

  if (filters.countries && filters.countries.length > 0) {
    const countriesUpper = filters.countries.map(c => c.toUpperCase());
    filteredResults = filteredResults.filter(r =>
      countriesUpper.includes(r.country?.toUpperCase())
    );
  }

  if (filters.media && filters.media.length > 0) {
    const mediaUpper = filters.media.map(m => m.toUpperCase());
    filteredResults = filteredResults.filter(r =>
      mediaUpper.includes(r.media?.toUpperCase())
    );
  }

  if (filters.channels && filters.channels.length > 0) {
    const channelsUpper = filters.channels.map(c => c.toUpperCase());
    filteredResults = filteredResults.filter(r =>
      channelsUpper.some(channel => r.channel?.toUpperCase().includes(channel))
    );
  }

  if (filters.dateFrom) {
    filteredResults = filteredResults.filter(r =>
      r.date && new Date(r.date) >= new Date(filters.dateFrom!)
    );
  }

  if (filters.dateTo) {
    filteredResults = filteredResults.filter(r =>
      r.date && new Date(r.date) <= new Date(filters.dateTo!)
    );
  }

  return filteredResults.slice(0, matchCount);
}
