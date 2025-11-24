import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

let cachedDocxContent: string | null = null;

/**
 * Extracts and returns text content from the MENA Delivery Market Competitive Analysis docx file
 * Results are cached to avoid repeated parsing
 */
export async function getDocxContent(): Promise<string> {
    if (cachedDocxContent) {
        return cachedDocxContent;
    }

    try {
        const docxPath = path.join(process.cwd(), 'MENA Delivery Market Competitive Analysis.docx');

        if (!fs.existsSync(docxPath)) {
            console.warn('MENA docx file not found at:', docxPath);
            return '';
        }

        const buffer = fs.readFileSync(docxPath);
        const result = await mammoth.extractRawText({ buffer });

        cachedDocxContent = result.value;

        if (result.messages.length > 0) {
            console.warn('Mammoth conversion messages:', result.messages);
        }

        return cachedDocxContent;
    } catch (error) {
        console.error('Error parsing docx file:', error);
        return '';
    }
}

/**
 * Clear the cache (useful for testing or if file is updated)
 */
export function clearDocxCache(): void {
    cachedDocxContent = null;
}
