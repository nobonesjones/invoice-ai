import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import Constants from 'expo-constants';
import { supabase } from '@/config/supabase';

// Define the structure of stored chat messages
export interface StoredGlobalChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  created_at: string;
  updated_at: string;
}

// Define the structure of meeting data for context
interface MeetingContext {
  id: string;
  name: string;
  minutes: string;
  created_at: string;
}

export class GlobalChatService {
  private context: string;
  private userId: string;
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private meetingsContext: MeetingContext[] = [];

  constructor(userId: string) {
    if (!userId) {
      throw new Error('User ID is required for chat functionality');
    }

    this.userId = userId;
    this.context = ''; // Will be populated in loadMeetingsContext

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

  async loadMeetingsContext(): Promise<boolean> {
    try {
      // Fetch all meetings with transcripts and minutes for the user
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('id, name, minutes_text, created_at')
        .eq('user_id', this.userId)
        .eq('is_deleted', false)
        .not('minutes_text', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching meetings:', error);
        return false;
      }

      if (!meetings || meetings.length === 0) {
        this.context = `You are a very helpful and organized personal assistant with access to the user's meeting data. Your role is to provide direct, polite, and concise answers about the user's meetings. Be friendly and positive but always stay focused on the meeting data.

INSTRUCTIONS:
1. When the user asks about a specific meeting, identify which meeting they're referring to and provide relevant information.
2. If the user doesn't specify a meeting, try to determine which meeting might be most relevant to their question.
3. If you can't find relevant information in the meeting data, politely say so rather than making up an answer.
4. Keep your responses concise and to the point.
5. Be playful and pleasant with greetings or harmless questions.
6. Always try to see the best in any situation while remaining grounded in reality.

The user has no meetings recorded yet. You can help them get started by suggesting they record a meeting.`;
        return true;
      }

      // Store meetings context
      this.meetingsContext = meetings.map(meeting => ({
        id: meeting.id,
        name: meeting.name,
        minutes: meeting.minutes_text,
        created_at: meeting.created_at
      }));

      // Create the system prompt with all meetings data
      let meetingsData = '';
      this.meetingsContext.forEach((meeting, index) => {
        meetingsData += `MEETING ${index + 1}: "${meeting.name}" (${new Date(meeting.created_at).toLocaleDateString()})\n`;
        meetingsData += `MINUTES:\n${meeting.minutes}\n\n`;
        meetingsData += `---\n\n`;
      });

      this.context = `You are a very helpful and organized personal assistant with access to the user's meeting data. Your role is to provide direct, polite, and concise answers about the user's meetings. Be friendly and positive but always stay focused on the meeting data.

INSTRUCTIONS:
1. When the user asks about a specific meeting, identify which meeting they're referring to and provide relevant information.
2. If the user doesn't specify a meeting, try to determine which meeting might be most relevant to their question.
3. If you can't find relevant information in the meeting data, politely say so rather than making up an answer.
4. Keep your responses concise and to the point.
5. Be playful and pleasant with greetings or harmless questions.
6. Always try to see the best in any situation while remaining grounded in reality.

Here is the data from all the user's meetings:

${meetingsData}`;

      return true;
    } catch (error) {
      console.error('Error loading meetings context:', error);
      return false;
    }
  }

  async loadChatHistory(): Promise<StoredGlobalChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('global_chat_messages')
        .select('*')
        .eq('user_id', this.userId)
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

  async saveMessage(role: 'user' | 'assistant', content: string, error: boolean = false): Promise<StoredGlobalChatMessage | null> {
    try {
      const message = {
        user_id: this.userId,
        role,
        content,
        error,
      };

      const { data, error: dbError } = await supabase
        .from('global_chat_messages')
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
      // Add a reminder about the context to the prompt
      const prompt = `${this.context}\n\nRemember to reference specific meetings when answering.\n\nUser Question:\n${message}`;
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
      // Add a reminder about the context to the prompt
      const prompt = `${this.context}\n\nRemember to reference specific meetings when answering.\n\nUser Question:\n${lastUserMessage}`;
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

  // Method to get a specific meeting's details if the user asks about it
  getMeetingDetails(meetingName: string): MeetingContext | null {
    const normalizedName = meetingName.toLowerCase();
    
    // Try to find a meeting that matches the name
    const meeting = this.meetingsContext.find(m => 
      m.name.toLowerCase().includes(normalizedName)
    );
    
    return meeting || null;
  }
}
