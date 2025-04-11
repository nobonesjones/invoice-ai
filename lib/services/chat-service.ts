import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import Constants from 'expo-constants';
import { supabase } from '@/config/supabase';

// Define the structure of stored chat messages
export interface StoredChatMessage {
  id: string;
  meeting_id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  created_at: string;
  updated_at: string;
}

export class ChatService {
  private context: string;
  private meetingId: string | null;
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(transcript: string, minutes: string, meetingId?: string) {
    if (!transcript || !minutes) {
      throw new Error('Transcript and minutes are required for chat functionality');
    }

    this.context = `You are very helpful and organised, experienced PA, you are direct and polite and always want to give the user an answer that best helps his question in a kind friendly but very direct way no matter how strange they might be. Keep answers a concise as possible without being abrupt or rude. You are only able to talk about the users meeting data you have been given, if the user has other questions, ask them to use the main chat window where you can ask broader questions about their meetings. be playful and pleasent with greetings or harmless questions related to you and the user, be positive and act as a soundign board always trying to see the best of any situatin whilst remaining grounded in reality and the truth.

TRANSCRIPT:
${transcript}

MINUTES:
${minutes}`;

    this.meetingId = meetingId || null;

    // Initialize the Gemini API
    try {
      const apiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;
      
      if (!apiKey) {
        console.warn('Gemini API key is not set. Chat functionality will not work properly.');
        return;
      }
      
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
    } catch (error) {
      console.error('Error initializing Gemini API:', error);
    }
  }

  async loadChatHistory(): Promise<StoredChatMessage[]> {
    if (!this.meetingId) {
      console.warn('Meeting ID is not set. Cannot load chat history.');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('meeting_id', this.meetingId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error loading chat history:', error);
      return [];
    }
  }

  async saveMessage(role: 'user' | 'assistant', content: string, error: boolean = false): Promise<StoredChatMessage | null> {
    if (!this.meetingId) {
      console.warn('Meeting ID is not set. Cannot save message.');
      return null;
    }

    try {
      const message = {
        meeting_id: this.meetingId,
        role,
        content,
        error,
      };

      const { data, error: dbError } = await supabase
        .from('chat_messages')
        .insert(message)
        .select()
        .single();

      if (dbError) {
        console.error('Error saving message:', dbError);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API is not initialized. Please check your API key.');
    }

    // Save user message to database
    await this.saveMessage('user', message);

    try {
      const prompt = `${this.context}\n\nUser Question:\n${message}`;
      const result = await this.model.generateContent([{ text: prompt }]);
      const responseText = result.response.text();
      
      // Save assistant response to database
      await this.saveMessage('assistant', responseText);
      
      return responseText;
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      
      // Save error message to database
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.saveMessage('assistant', errorMessage, true);
      
      throw error;
    }
  }

  async regenerateResponse(lastUserMessage: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API is not initialized. Please check your API key.');
    }

    try {
      const prompt = `${this.context}\n\nUser Question:\n${lastUserMessage}`;
      const result = await this.model.generateContent([{ text: prompt }]);
      const responseText = result.response.text();
      
      // Save regenerated response to database
      await this.saveMessage('assistant', responseText);
      
      return responseText;
    } catch (error) {
      console.error('Error regenerating response:', error);
      
      // Save error message to database
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.saveMessage('assistant', errorMessage, true);
      
      throw error;
    }
  }
}
