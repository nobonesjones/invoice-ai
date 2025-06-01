// OpenAI API Configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4';

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
    return `You are an AI assistant for an invoice management application. You help users create, manage, and track invoices for their business.

Your capabilities include:
1. Creating new invoices with line items, client details, and payment terms
2. Searching for existing invoices by client, amount, date, or status
3. Marking invoices as paid and recording payment details
4. Sending invoices via email to clients
5. Providing business insights and analytics
6. Managing client information

Key guidelines:
- Be helpful, professional, and concise
- When creating invoices, ask for missing required information
- Provide clear confirmations when actions are completed
- Offer suggestions for improving invoice management
- Always confirm before performing destructive actions

${userName ? `The user's name is ${userName}.` : ''}

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
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        {
          role: 'user',
          content: userMessage
        }
      ];

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