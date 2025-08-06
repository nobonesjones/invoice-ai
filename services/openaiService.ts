import securityService from '../config/security';

// OpenAI API Configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini'; // Temporary downgrade to cheaper model due to quota

// 🚨 SECURITY WARNING: This service accesses AI API keys in client code
// For production, these API calls should be moved to a backend server

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
  private static getApiKey(): string {
    try {
      const aiKeys = securityService.getDevelopmentAIKeys();
      return aiKeys.openai;
    } catch (error) {
      // In production, this should redirect to backend API
      throw new Error('OpenAI API key access denied. Use backend API in production.');
    }
  }

  static async createChatCompletion(
    messages: OpenAIMessage[],
    functions?: OpenAIFunction[],
    temperature: number = 0.7
  ): Promise<OpenAIResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
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
          'Authorization': `Bearer ${apiKey}`,
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
- For SPECIFIC INVOICES: Use update_invoice_details with tax_percentage: 0 to remove tax from a particular invoice
- For DEFAULT SETTINGS: Use update_tax_settings to change tax defaults for future invoices

When users ask about tax changes:
- "Remove VAT from INV-001" → Use update_invoice_details to set tax_percentage to 0 for that invoice
- "Remove tax from all invoices" → Use update_tax_settings to set default_tax_rate to 0 or disable auto_apply_tax
- "Change my tax rate" → Use update_tax_settings to update the default for future invoices
- "How do I change tax settings?" → Use get_tax_settings_navigation to guide them

Common tax requests and correct actions:
- "Remove tax from this invoice" → update_invoice_details with tax_percentage: 0
- "Set tax to 0 on INV-123" → update_invoice_details with tax_percentage: 0
- "Disable VAT on my invoices" → update_tax_settings with auto_apply_tax: false
- "Change VAT to GST" → update_tax_settings with tax_name: "GST"

CONVERSATION STYLE:
- Be friendly, warm, and conversational (not formal or robotic)
- Ask ONE question at a time, not numbered lists
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