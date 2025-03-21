import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Initialize the Gemini API with your API key
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');

// Get the Gemini 2.0 Flash model
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatService {
  private transcript: string;
  private minutes: string;
  private context: string;

  constructor(transcript: string, minutes: string) {
    if (!transcript || !minutes) {
      throw new Error('Both transcript and minutes are required for chat functionality');
    }
    
    this.transcript = transcript;
    this.minutes = minutes;
    this.context = `You are a helpful friendly chat agent and with the context of the meeting transcript below, please answer the users question below.

Be concise and use plain direct language.

Always stay on the topic of this meeting. You must not go off topic unless it's pleasantries or talking about the meeting, how it went, how they can improve, what was bad, what was good, and tips about the meeting.

Meeting Minutes:
${minutes}

Meeting Transcript:
${transcript}`;
  }

  async sendMessage(message: string): Promise<string> {
    try {
      if (!message.trim()) {
        throw new Error('Please enter a message');
      }

      const prompt = `${this.context}\n\nUser Question:\n${message}`;
      const result = await model.generateContent([
        {
          text: prompt
        }
      ]);
      
      const response = await result.response;
      if (!response.text()) {
        throw new Error('No response received from AI');
      }
      return response.text();
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw error instanceof Error ? error : new Error('Failed to get response from AI');
    }
  }

  async regenerateResponse(message: string): Promise<string> {
    try {
      if (!message.trim()) {
        throw new Error('Cannot regenerate response for empty message');
      }

      const prompt = `${this.context}\n\nUser Question:\n${message}\n\nPlease provide a different perspective on this question, keeping your response focused on the meeting content.`;
      const result = await model.generateContent([
        {
          text: prompt
        }
      ]);
      
      const response = await result.response;
      if (!response.text()) {
        throw new Error('No response received from AI');
      }
      return response.text();
    } catch (error) {
      console.error('Error regenerating response:', error);
      throw error instanceof Error ? error : new Error('Failed to regenerate AI response');
    }
  }
}
