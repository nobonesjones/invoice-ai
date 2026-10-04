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
        spend_description: string
    }
    error?: string
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log('Processing receipt request...');
        const { base64Image, mimeType, categories = [] }: ReceiptOCRRequest = await req.json()
        console.log(`Received request with mimeType: ${mimeType}, base64 length: ${base64Image?.length}`);

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
6. Spend Description (general description of what was purchased - e.g., "food", "household items", "building materials", "car parts", "clothing", "electronics", etc.)

FIRST: decide whether the image actually shows a receipt (or an invoice/till slip/order
confirmation with a merchant and an amount). If it does not — or it is too blurry, dark or
cropped to read a merchant name and total from it — return ONLY:
{
  "not_receipt": true,
  "reason": "short description of what the image shows or why it is unreadable"
}
Never invent a merchant, amount or date that is not visible in the image.

IMPORTANT RULES (when it IS a readable receipt):
- You MUST always provide a category_suggestion from the list above
- Match the category name EXACTLY as it appears in the list
- The spend_description should be a simple, general description of the type of goods purchased
- If a minor field (date, tax) is unclear, make your best estimate; the merchant and total must be read from the image

Return ONLY a valid JSON object with these exact keys:
{
  "merchant_name": "string",
  "total_amount": number,
  "tax_amount": number or null,
  "transaction_date": "YYYY-MM-DD",
  "category_suggestion": "string (REQUIRED - must match one from the list)",
  "spend_description": "string (e.g., food, household items, etc.)"
}

Do not include any markdown formatting or additional text.`

        console.log('Sending request to OpenAI with model: gpt-4.1-nano');
        const response = await openai.chat.completions.create({
            model: "gpt-4.1-nano",
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
            temperature: 0,
        })

        const content = response.choices[0]?.message?.content
        console.log('OpenAI Response Content:', content);
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

        // The model's own verdict that the image is not a readable receipt.
        if (parsedData.not_receipt) {
            const reason = typeof parsedData.reason === 'string' ? parsedData.reason.trim().replace(/\.+$/, '') : ''
            const notAReceipt: ReceiptOCRResult = {
                success: false,
                error: reason
                    ? `Couldn't read a receipt in this photo — it looks like: ${reason}. Try a clearer photo, or add the expense manually.`
                    : `Couldn't read a receipt in this photo. Try a clearer photo, or add the expense manually.`,
            }
            return new Response(
                JSON.stringify(notAReceipt),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
        }

        // Validate what came back. A total of 0 is a real value (and what the model
        // returns for images it can't read), so check type, not truthiness.
        const totalAmount = typeof parsedData.total_amount === 'number'
            ? parsedData.total_amount
            : parseFloat(parsedData.total_amount)
        const merchant = typeof parsedData.merchant_name === 'string' ? parsedData.merchant_name.trim() : ''
        if (!merchant || Number.isNaN(totalAmount)) {
            throw new Error('Missing required fields in AI response')
        }

        // Merchant "Unknown" with a zero total is the model saying the image is not
        // a readable receipt. That is a user problem, not a server error: return it
        // as a 200 so the app surfaces this message instead of a generic failure.
        if (totalAmount === 0 && /^unknown$/i.test(merchant)) {
            const notAReceipt: ReceiptOCRResult = {
                success: false,
                error: parsedData.spend_description
                    ? `Couldn't read a receipt in this photo — it looks like: ${parsedData.spend_description}. Try a clearer photo, or add the expense manually.`
                    : `Couldn't read a receipt in this photo. Try a clearer photo, or add the expense manually.`,
            }
            return new Response(
                JSON.stringify(notAReceipt),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
        }

        // Ensure category is always present
        if (!parsedData.category_suggestion) {
            parsedData.category_suggestion = 'General'
        }

        // Ensure spend_description is present
        if (!parsedData.spend_description) {
            parsedData.spend_description = parsedData.item_category || 'items'
        }

        const result: ReceiptOCRResult = {
            success: true,
            data: {
                merchant_name: merchant,
                total_amount: totalAmount,
                tax_amount: parsedData.tax_amount
                    ? (typeof parsedData.tax_amount === 'number'
                        ? parsedData.tax_amount
                        : parseFloat(parsedData.tax_amount))
                    : undefined,
                transaction_date: parsedData.transaction_date || new Date().toISOString().split('T')[0],
                category_suggestion: parsedData.category_suggestion,
                spend_description: parsedData.spend_description,
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
