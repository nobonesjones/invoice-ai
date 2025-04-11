// Script to generate minutes for meetings that have transcripts but no minutes
import { createClient } from '@supabase/supabase-js';
import { generateAndStoreMeetingMinutes } from '../lib/services/generate-minutes.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateMissingMinutes() {
  try {
    console.log('Fetching meetings with missing minutes...');
    
    // Get meetings that have audio and transcripts but no minutes
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, name')
      .eq('is_deleted', false)
      .not('audio_url', 'is', null)
      .is('minutes_text', null)
      .eq('status', 'transcribed')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching meetings:', error);
      return;
    }
    
    console.log(`Found ${meetings.length} meetings with missing minutes`);
    
    // Process each meeting
    for (const meeting of meetings) {
      console.log(`Generating minutes for meeting: ${meeting.name} (${meeting.id})`);
      try {
        await generateAndStoreMeetingMinutes(meeting.id);
        console.log(`Successfully generated minutes for meeting: ${meeting.id}`);
      } catch (err) {
        console.error(`Error generating minutes for meeting ${meeting.id}:`, err);
      }
      
      // Wait a bit between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('Finished generating missing minutes');
  } catch (error) {
    console.error('Error in generateMissingMinutes:', error);
  }
}

// Run the script
generateMissingMinutes()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
