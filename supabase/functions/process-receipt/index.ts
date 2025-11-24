import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "https://esm.sh/openai@4.20.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReceiptOCRRequest {
    base64Image: string
    mimeType: string
    categories?: string[]
}

interface ReceiptOCRResult {
    success: boolean
    data?: {
        merchant_name: string
        total_amount: number
        tax_amount?: number
        transaction_date: string
        category_suggestion: string
        item_category: string
    }
    error?: string
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { base64Image, mimeType, categories = [] }: ReceiptOCRRequest = await req.json()

        if (!base64Image || !mimeType) {
            throw new Error('Missing required fields: base64Image and mimeType')
        }

        // Validate image format
        const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!validMimeTypes.includes(mimeType)) {
            throw new Error(`Invalid mime type. Supported types: ${validMimeTypes.join(', ')}`)
        }

        const openai = new OpenAI({
            apiKey: Deno.env.get('OPENAI_API_KEY'),
        })

        const categoryList = categories.length > 0
            ? categories.join(', ')
            : 'Entertainment, Equipment, Fuel, Insurance, Legal, Licenses, Marketing, Meals, Professional Services, Repairs, Rent, Software, Subscriptions, Supplies, Taxes, Training, Travel, Utilities';

        const prompt = `You are an expert receipt scanner. Analyze this receipt image and extract the following information:

1. Merchant Name (the store/business name)
2. Total Amount (final amount paid)
3. Tax Amount (if visible)
4. Transaction Date (in YYYY-MM-DD format)
5. Category Suggestion (MUST choose one from these categories: ${categoryList})
6. Item Category (general description of what was purchased - e.g., "food", "household items", "building materials", "car parts", "clothing", "electronics", etc.)

IMPORTANT RULES:
- You MUST always provide a category_suggestion from the list above
- Match the category name EXACTLY as it appears in the list
- The item_category should be a simple, general description of the type of goods purchased
- If the receipt is unclear, make your best estimate rather than leaving fields empty

Return ONLY a valid JSON object with these exact keys:
{
  "merchant_name": "string",
  "total_amount": number,
  "tax_amount": number or null,
  "transaction_date": "YYYY-MM-DD",
  "category_suggestion": "string (REQUIRED - must match one from the list)",
  "item_category": "string (e.g., food, household items, etc.)"
}

Do not include any markdown formatting or additional text.`

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 500,
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
            throw new Error('No content received from OpenAI')
        }

        // Clean up content if it contains markdown code blocks
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim()

        let parsedData
        try {
            parsedData = JSON.parse(cleanContent)
        } catch (e) {
            console.error('Failed to parse OpenAI response:', cleanContent)
            throw new Error('Invalid JSON response from AI')
        }

        // Validate required fields
        if (!parsedData.merchant_name || !parsedData.total_amount) {
            throw new Error('Missing required fields in AI response')
        }

        // Ensure category is always present
        if (!parsedData.category_suggestion) {
            parsedData.category_suggestion = 'General'
        }

        // Ensure item_category is present
        if (!parsedData.item_category) {
            parsedData.item_category = 'items'
        }

        const result: ReceiptOCRResult = {
            success: true,
            data: {
                merchant_name: parsedData.merchant_name,
                total_amount: typeof parsedData.total_amount === 'number'
                    ? parsedData.total_amount
                    : parseFloat(parsedData.total_amount),
                tax_amount: parsedData.tax_amount
                    ? (typeof parsedData.tax_amount === 'number'
                        ? parsedData.tax_amount
                        : parseFloat(parsedData.tax_amount))
                    : undefined,
                transaction_date: parsedData.transaction_date || new Date().toISOString().split('T')[0],
                category_suggestion: parsedData.category_suggestion,
                item_category: parsedData.item_category,
            },
        }

        return new Response(
            JSON.stringify(result),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            },
        )

    } catch (error) {
        console.error('Error processing receipt:', error)

        const errorResult: ReceiptOCRResult = {
            success: false,
            error: error.message || 'Unknown error occurred',
        }

        return new Response(
            JSON.stringify(errorResult),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            },
        )
    }
})
