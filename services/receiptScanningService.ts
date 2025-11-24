import * as FileSystem from 'expo-file-system';
import { SupabaseClient } from '@supabase/supabase-js';

export interface ScannedExpenseData {
    merchant_name?: string;
    total_amount?: number;
    tax_amount?: number;
    expense_date?: Date;
    category_id?: string;
    category_name?: string;
    description?: string;
}

export class ReceiptScanningService {
    /**
     * Scans a receipt image and extracts expense details using the process-receipt Edge Function.
     * @param imageUri The local URI of the image to scan.
     * @param supabase The Supabase client instance.
     * @param availableCategories Optional list of categories to help the AI match.
     * @returns Extracted expense data.
     */
    static async scanReceipt(
        imageUri: string,
        supabase: SupabaseClient,
        availableCategories: { id: string; name: string }[] = []
    ): Promise<ScannedExpenseData> {
        try {
            // 1. Convert image to base64
            const base64Image = await FileSystem.readAsStringAsync(imageUri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // 2. Get mime type based on extension (simple check)
            const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
            let mimeType = 'image/jpeg';
            if (extension === 'png') mimeType = 'image/png';
            if (extension === 'webp') mimeType = 'image/webp';

            // 3. Call Supabase Edge Function
            const { data, error } = await supabase.functions.invoke('process-receipt', {
                body: {
                    base64Image,
                    mimeType,
                    categories: availableCategories.map(c => c.name)
                }
            });

            if (error) {
                console.error('Edge function error:', error);
                throw new Error(`Scanning failed: ${error.message}`);
            }

            if (!data || !data.success) {
                throw new Error(data?.error || 'Failed to process receipt');
            }

            const parsedData = data.data;

            // 4. Map category name to ID if possible
            let categoryId = undefined;

            // First try exact match from AI suggestion
            if (parsedData.category_suggestion && availableCategories.length > 0) {
                const matchedCategory = availableCategories.find(
                    c => c.name.toLowerCase() === parsedData.category_suggestion.toLowerCase()
                );
                if (matchedCategory) {
                    categoryId = matchedCategory.id;
                }
            }

            return {
                merchant_name: parsedData.merchant_name,
                total_amount: parsedData.total_amount,
                tax_amount: parsedData.tax_amount,
                expense_date: parsedData.transaction_date ? new Date(parsedData.transaction_date) : new Date(),
                description: `Receipt for ${parsedData.item_category || 'items'} from ${parsedData.merchant_name}`,
                category_name: parsedData.category_suggestion,
                category_id: categoryId,
            };

        } catch (error) {
            console.error('Receipt scanning failed:', error);
            throw error;
        }
    }
}
