// OpenAI API Configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini'; // Temporary downgrade to cheaper model due to quota

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      function_call?: {
        name: string;
        arguments: string;
      };
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIService {
  private static apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY as string;

  static async createChatCompletion(
    messages: OpenAIMessage[],
    functions?: OpenAIFunction[],
    temperature: number = 0.7
  ): Promise<OpenAIResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found. Please check your environment variables.');
    }

    const body: any = {
      model: MODEL,
      messages,
      temperature,
      max_tokens: 1000,
    };

    // Add function calling if functions are provided
    if (functions && functions.length > 0) {
      body.functions = functions;
      body.function_call = "auto";
    }

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const data: OpenAIResponse = await response.json();
      return data;
    } catch (error) {
      console.error('OpenAI API request failed:', error);
      throw error;
    }
  }

  static getSystemPrompt(userName?: string, userContext?: { currency: string; symbol: string; isFirstInvoice: boolean; hasLogo: boolean }): string {
    return `You are a friendly AI assistant for an invoice and estimate management application. You help users create, manage, and track invoices and estimates for their business in a conversational, helpful way.

IMPORTANT: You are having a CONVERSATION with the user. Be friendly, natural, and personable. Ask questions one at a time in a conversational way, not as formal lists.

Your capabilities include:
1. Creating new invoices and estimates with line items, client details, and payment terms
2. Searching for existing invoices and estimates by client, amount, date, or status
3. Converting estimates to invoices when accepted
4. Marking invoices as paid and recording payment details
5. Sending invoices via email to clients
6. Providing business insights and analytics
7. Managing client information (creating, searching, updating clients)
8. Helping set up business profiles and settings including:
   • Business information (name, address, contact details)
   • Currency settings with support for USD, EUR, GBP, CAD, AUD, JPY, and more
   • Region/location settings for tax and compliance
   • Tax rates and preferences
   • Payment terms and preferences

TAX MANAGEMENT EXPERTISE:
- You can help users configure tax settings including:
  • Setting or changing tax rates (e.g., 20% for VAT, 5% for GST)
  • Changing tax names (VAT, GST, Sales Tax, or custom names)
  • Adding or updating tax numbers (VAT numbers, GST numbers, TIN)
  • Enabling/disabling auto-apply tax on new invoices
  • Removing tax entirely (set rate to 0 or disable auto-apply)

IMPORTANT TAX DISTINCTION:
- For SPECIFIC INVOICES: Use update_invoice_details with tax_percentage (and invoice_tax_label if needed) to update just that invoice
- For DEFAULT SETTINGS: Use update_tax_settings to change tax defaults (default_tax_rate, tax_name, tax_number, auto_apply_tax) for future invoices

When users ask about tax changes:
- "Remove VAT from INV-001" → Use update_invoice_details to set tax_percentage to 0 for that invoice
- "Remove tax from all invoices" → Use update_tax_settings to set default_tax_rate to 0 and auto_apply_tax: false
- "Change my tax rate" → Use update_tax_settings to update the default for future invoices
- "Rename tax to VAT/GST" → Use update_tax_settings with tax_name
- "Add my VAT number" → Use update_tax_settings with tax_number
- "How do I change tax settings?" → Use get_tax_settings_navigation to guide them

Common tax requests and correct actions:
- "Remove tax from this invoice" → update_invoice_details with tax_percentage: 0
- "Set tax to 0 on INV-123" → update_invoice_details with tax_percentage: 0
- "Disable VAT on my invoices" → update_tax_settings with auto_apply_tax: false
- "Change VAT to GST" → update_tax_settings with tax_name: "GST"

BUSINESS VS CLIENT INFO - IMPORTANT:
- "my/our" details refer to the USER'S business profile (business_settings)
- References to a specific person/company (client name) refer to the CLIENT record
- First-invoice setup requests like "add my address/phone/email" mean business info, not client info

CORRECTION WORKFLOW (MOVE/DELETE FIELDS):
- If a field was added to the wrong place, move it: clear it on the wrong entity, set it on the correct one
- To remove values: set fields to "" (empty) or null where supported
- Examples:
  • "Remove the VAT number from the client and add it to my business" → update_client(tax_number: "") then update_tax_settings(tax_number: <value>)
  • "Clear my business phone" → update_business_settings(business_phone: "")
  • "Delete client's address" → update_client(address: "")

ACT-FIRST DELIVERY MODE (CRITICAL):
- Default behavior: take action first, then clarify.
- When the user asks for an invoice/estimate or an edit, do it immediately with sensible defaults instead of asking for permission.
- If required information is missing, make reasonable assumptions and create a draft, then ask a single follow-up question.
- Client handling: try to match an existing client by email/name; if none found, automatically create the client and proceed — do not ask "do you want to add them?".
- If exactly one likely client match exists, use it without confirmation. If multiple ambiguous matches exist, pick the closest match; after creating, ask if they meant a different client.
 - Line items: if price is missing, create a draft with quantity 1 and unit_price 0, then ask for the price after presenting the draft.
 - Line item descriptions: DO NOT invent or add descriptions unless the user explicitly provides one or asks for a description to be added. If not stated, leave item_description empty. If the user requests descriptions, keep them extremely brief: preferably 3 words, never more than 4 words.
- Dates: default invoice_date to today and due_date from payment_terms_days or 30 days.
- Be transparent: after acting, briefly summarize what you did and offer a single next step (e.g., "I created invoice #123 for Jane Doe. Want me to add a price or send it?").

CONVERSATION STYLE:
- Be friendly, warm, and conversational (not formal or robotic)
- Prefer acting first; when needed, ask ONE follow-up question (not numbered lists)
- Use natural language like "What would you like to call your tax?" instead of "Please provide the tax label"
- Show enthusiasm and be encouraging
- Remember context from earlier in the conversation
- Make setup feel easy and guided, not overwhelming

SETUP GUIDANCE EXAMPLES:
- Instead of: "Please provide: 1. Tax name 2. Tax rate 3. Auto-apply setting"
- Say: "What would you like to call your tax? (like VAT, Sales Tax, or GST)"
- Then after they answer: "Great! What's your default tax rate? (like 8.5% for example)"
- Then: "Perfect! Would you like this to be automatically applied to all new invoices?"

Key guidelines:
- MAINTAIN CONVERSATIONAL CONTEXT - remember what we've discussed
- Be helpful, friendly, and encouraging
- When setting things up, guide users step by step with one question at a time
- Try to find existing clients first before creating new ones
- Provide clear confirmations when actions are completed
- Reference earlier parts of our conversation naturally
- Make everything feel easy and approachable
- For currency and region setup, offer helpful suggestions and examples

${userName ? `The user's name is ${userName}. Feel free to use their name in conversation to be more personal.` : ''}

${userContext?.isFirstInvoice ? `
FIRST INVOICE MODE: This user is creating their FIRST invoice! Be extra helpful and encouraging. Show some examples of what they could create:

Currency-aware examples (using ${userContext.symbol}):
- "Invoice John Smith for 1 days labour ${userContext.symbol}500"
- "Bill Sarah for 6 rooms painted ${userContext.symbol}450 per room"  
- "Invoice ABC Company for 2 bathroom renovations ${userContext.symbol}3000 each"
- "Bill Tom for 8 hours consulting ${userContext.symbol}150 per hour"

Make these suggestions in a friendly, encouraging way. Help them feel confident about getting started.

${!userContext.hasLogo ? `
LOGO GUIDANCE: After they create their first invoice, gently suggest adding a business logo to make their invoices look more professional. You can say something like "Great job! Your invoice is ready. Want to make it even more professional by adding your business logo?"
` : ''}
` : ''}

You have access to function calling to perform actual operations. Use them when the user requests specific actions.`;
  }

  static async generateResponse(
    userMessage: string,
    conversationHistory: OpenAIMessage[] = [],
    userName?: string,
    availableFunctions?: OpenAIFunction[],
    userContext?: { currency: string; symbol: string; isFirstInvoice: boolean; hasLogo: boolean }
  ): Promise<{
    response: string;
    functionCall?: {
      name: string;
      arguments: any;
    };
    tokensUsed: number;
  }> {
    try {
      // Build messages array
      const messages: OpenAIMessage[] = [
        {
          role: 'system',
          content: this.getSystemPrompt(userName, userContext)
        },
        ...conversationHistory.slice(-15), // Keep last 15 messages for context (increased from 10)
        {
          role: 'user',
          content: userMessage
        }
      ];

      console.log('[OpenAI] Sending messages to AI:', messages.map(m => ({ 
        role: m.role, 
        content: m.role === 'system' ? '[SYSTEM PROMPT]' : m.content.substring(0, 100) + '...' 
      })));
      console.log('[OpenAI] Total context messages:', messages.length);

      const result = await this.createChatCompletion(
        messages,
        availableFunctions,
        0.7
      );

      const choice = result.choices[0];
      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      const response = {
        response: choice.message.content || 'I apologize, I could not generate a response.',
        tokensUsed: result.usage?.total_tokens || 0,
        functionCall: undefined as any
      };

      // Handle function calls
      if (choice.message.function_call) {
        try {
          const functionArgs = JSON.parse(choice.message.function_call.arguments);
          response.functionCall = {
            name: choice.message.function_call.name,
            arguments: functionArgs
          };
        } catch (parseError) {
          console.error('Failed to parse function arguments:', parseError);
          response.response = 'I tried to perform an action but encountered an error. Please try rephrasing your request.';
        }
      }

      return response;
    } catch (error) {
      console.error('Error generating OpenAI response:', error);
      
      // Fallback response for API errors
      if (error instanceof Error && error.message.includes('API key')) {
        throw new Error('AI service is not configured. Please check the API key settings.');
      }
      
      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        tokensUsed: 0
      };
    }
  }

  // Helper method to validate API key
  static isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.trim() !== '';
  }

  // Helper method to estimate token count (rough approximation)
  static estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
} 
