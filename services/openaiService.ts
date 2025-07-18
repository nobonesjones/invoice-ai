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

  static getSystemPrompt(userName?: string): string {
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

You have access to function calling to perform actual operations. Use them when the user requests specific actions.`;
  }

  static async generateResponse(
    userMessage: string,
    conversationHistory: OpenAIMessage[] = [],
    userName?: string,
    availableFunctions?: OpenAIFunction[]
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
          content: this.getSystemPrompt(userName)
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