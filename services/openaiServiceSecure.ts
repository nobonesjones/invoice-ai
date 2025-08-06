// Secure OpenAI Service using Supabase Edge Functions
// This keeps your API key on the server, not in the client app

import { supabase } from '@/config/supabase';

// Use the same interfaces from your original service
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

export class OpenAIServiceSecure {
  static async createChatCompletion(
    messages: OpenAIMessage[],
    functions?: OpenAIFunction[],
    temperature: number = 0.7
  ): Promise<OpenAIResponse> {
    try {
      // Call your Edge Function instead of OpenAI directly
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages,
          functions,
          temperature,
        },
      });

      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }

      return data as OpenAIResponse;
    } catch (error) {
      console.error('OpenAI Edge Function request failed:', error);
      throw error;
    }
  }

  // Helper method to validate configuration - always true for Edge Function
  static isConfigured(): boolean {
    // Edge Function handles API key, so we just check if Supabase is configured
    return !!process.env.EXPO_PUBLIC_API_URL && !!process.env.EXPO_PUBLIC_API_KEY;
  }

  // Keep all your existing methods unchanged
  static getSystemPrompt(userName?: string, userContext?: { currency: string; symbol: string; isFirstInvoice: boolean; hasLogo: boolean }): string {
    return `You are a friendly AI assistant for an invoice and estimate management application. You help users create, manage, and track invoices and estimates for their business in a conversational, helpful way.

IMPORTANT: You are having a CONVERSATION with the user. Be friendly, natural, and personable. Ask questions one at a time in a conversational way, not as formal lists.

${userName ? `The user's name is ${userName}.` : ''}
${userContext ? `
Context:
- User's currency: ${userContext.currency} (${userContext.symbol})
- This is ${userContext.isFirstInvoice ? 'their FIRST invoice' : 'NOT their first invoice'}
- They ${userContext.hasLogo ? 'have' : 'do not have'} a business logo uploaded
` : ''}

Your personality:
- Warm and encouraging
- Professional but not stuffy
- Helpful and proactive
- Celebratory when appropriate (especially for first invoices!)

When helping create invoices or estimates:
1. If they haven't created one before, be extra encouraging and guide them step by step
2. Ask for one piece of information at a time in a natural, conversational way
3. Provide helpful suggestions and examples
4. Use their currency symbol (${userContext?.symbol || '$'}) in any monetary examples
5. Celebrate milestones with them

Remember: You're like a friendly business assistant who genuinely cares about their success!`;
  }

  static extractStructuredData(content: string): any {
    try {
      // Look for JSON in various formats
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       content.match(/(\{[\s\S]*\})/);
      
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // If no JSON found, return null
      return null;
    } catch (error) {
      console.error('Failed to extract structured data:', error);
      return null;
    }
  }
}