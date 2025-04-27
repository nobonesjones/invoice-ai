import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { supabase } from '@/config/supabase';
import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let geminiProModel: any = null;

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiProModel = genAI.getGenerativeModel({
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
    console.log('Gemini Pro model initialized for minutes generation.');
  } catch (error) {
    console.error('Error initializing Gemini API for minutes:', error);
  }
} else {
  console.warn('Gemini API key is not set. Minutes generation may fail.');
}

async function extractAndSaveActionItems(minutes: string, meetingId: string) {
  try {
    console.log('Starting action items extraction for meeting:', meetingId);

    const actionItemsMatch = minutes.match(/(?:Main\s+)?Action\s+Items:?\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|\s*$)/i);
    
    if (!actionItemsMatch || !actionItemsMatch[1] || actionItemsMatch[1].trim() === 'None') {
      console.log('No action items found for meeting:', meetingId);
      
      const { error } = await supabase
        .from('action_items')
        .upsert([{
          meeting_id: meetingId,
          content: 'No action items identified',
          completed: false,
          created_at: new Date().toISOString()
        }], { onConflict: 'meeting_id,content' })
        .select();
        
      if (error) {
        console.error('Error creating placeholder action item:', error);
      }
      return;
    }

    const actionItems = actionItemsMatch[1]
      .split(/\n/)
      .map(item => item.trim().replace(/^[•\-\*]\s*/, '')) // Remove bullet points
      .filter(item => item && item !== 'No action items agreed' && item.length > 3);

    console.log(`Extracted ${actionItems.length} action items:`, actionItems);

    const { error: deleteError } = await supabase
      .from('action_items')
      .delete()
      .eq('meeting_id', meetingId);
      
    if (deleteError) {
      console.error('Error deleting existing action items:', deleteError);
    }

    if (actionItems.length > 0) {
      const actionItemsToInsert = actionItems.map(content => ({
        meeting_id: meetingId,
        content,
        completed: false,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('action_items')
        .insert(actionItemsToInsert)
        .select();

      if (error) {
        console.error('Error saving action items:', error);
      } else {
        console.log(`Successfully saved ${actionItemsToInsert.length} action items`);
      }
    } else {
      const { error } = await supabase
        .from('action_items')
        .upsert([{
          meeting_id: meetingId,
          content: 'No action items identified',
          completed: false,
          created_at: new Date().toISOString()
        }], { onConflict: 'meeting_id,content' })
        .select();
        
      if (error) {
        console.error('Error creating placeholder action item:', error);
      }
    }
  } catch (error) {
    console.error('Error extracting action items:', error);
  }
}

async function retryAsync<T>(fn: () => Promise<T>, retries = 5, delay = 1000, operationName = 'operation'): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1}/${retries} for ${operationName}...`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${i + 1} failed for ${operationName}: ${lastError.message}. Retrying in ${delay / 1000}s...`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error(`All ${retries} attempts failed for ${operationName}.`);
  throw lastError || new Error(`Failed to complete ${operationName} after ${retries} attempts`);
}

export async function generateAndStoreMeetingMinutes(meetingId: string): Promise<void> {
  try {
    console.log('Starting minutes generation for meeting:', meetingId);

    let transcripts: { content: string }[] | null = null;
    try {
      transcripts = await retryAsync(async () => {
        console.log(`Fetching transcript for meeting ${meetingId}...`);
        const { data, error } = await supabase
          .from('transcripts')
          .select('content')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true }); 

        if (error) {
          console.error(`Supabase error fetching transcript: ${error.message}`);
          throw error; // Throw to trigger retry
        }
        if (!data || data.length === 0) {
          console.log('Transcript not found yet...');
          throw new Error('Transcript not yet available'); // Throw to trigger retry
        }
        console.log(`Transcript found with ${data.length} parts.`);
        return data;
      }, 5, 2000, 'fetch transcript'); // 5 attempts, 2 second delay
    } catch (error) {
      console.error('Failed to fetch transcript after multiple retries:', error);
      return; // Exit if transcript cannot be fetched
    }

    if (!transcripts || transcripts.length === 0) {
      console.error('Proceeding without transcripts, cannot generate minutes.');
      return;
    }

    if (!geminiProModel) {
      console.error('Gemini Pro model is not initialized. Cannot generate minutes.');
      throw new Error('Gemini Pro model failed to initialize. Check API Key.');
    }

    const fullTranscript = transcripts.map(t => t.content).join('\n\n'); // Use double newline just in case

    const maxLength = 30000; // Characters (adjust based on Gemini limits/testing)
    const truncatedTranscript = fullTranscript.length > maxLength 
      ? fullTranscript.substring(0, maxLength) + "... [transcript truncated due to length]"
      : fullTranscript;

    console.log(`Transcript length: ${fullTranscript.length} characters, using ${truncatedTranscript.length} characters`);

    const prompt = `Analyze the following meeting transcript. Generate meeting minutes strictly adhering to the structure and markers below. DO NOT deviate from this format.

TRANSCRIPT:
"""
${truncatedTranscript}
"""

OUTPUT FORMAT:

**Meeting Summary:**
[A single paragraph, 2-3 sentences long, summarizing key discussion points. NO bullet points.]

**Meeting Minutes:**
[Bulleted list using '-' or '*'. Each bullet point represents a distinct topic, decision, or key piece of information.]

**Main Action Items:**
[Bulleted list using '-' or '*'. List specific, actionable tasks. If NO action items exist, write exactly "None" on a single line under this heading and nothing else.]

Ensure each section heading (**Meeting Summary:**, **Meeting Minutes:**, **Main Action Items:**) appears exactly as shown, including the double asterisks and colon, on its own line, followed by the content for that section.
`;

    try {
      console.log('Sending request to Gemini Pro...');
      const startTime = Date.now();
      
      const result = await geminiProModel.generateContent(prompt);
      const response = await result.response;
      const minutes = response.text();

      const endTime = Date.now();
      console.log(`Gemini Pro response received in ${(endTime - startTime) / 1000} seconds`);

      if (!minutes) {
        console.log('No minutes generated by Gemini for meeting:', meetingId);
        return;
      }

      console.log('Storing minutes in database...');
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ 
          minutes_text: minutes,
          has_minutes: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      if (updateError) {
        console.error('Error updating meeting with minutes:', updateError);
        throw updateError;
      } else {
        console.log('Successfully stored minutes for meeting:', meetingId);
      }

      await extractAndSaveActionItems(minutes, meetingId);

      console.log('Successfully generated and stored minutes for meeting:', meetingId);
    } catch (error) {
      console.error('Error generating minutes:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error generating minutes:', error);
    throw error;
  }
}
