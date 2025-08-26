// This is a fixed version that shows the changes needed to prevent duplicate assistant creation

// In the assistantService.ts file, modify these methods:

// Option 1: Completely disable assistant creation (RECOMMENDED)
// Replace the initialize() method:
static async initialize(): Promise<void> {
  if (this.isInitialized) return;
  
  try {
    console.log('[AssistantService] Skipping assistant initialization - using edge function');
    // Don't create any assistants - the edge function handles everything
    this.isInitialized = true;
  } catch (error) {
    console.error('[AssistantService] Initialization error:', error);
    throw error;
  }
}

// Option 2: Fetch assistant ID from database (like edge function does)
// Replace getOrCreateAssistant() method:
private static async getOrCreateAssistant(): Promise<string> {
  // Use cached promise to avoid duplicate fetches
  if (this.assistantPromise) {
    return this.assistantPromise;
  }

  this.assistantPromise = this.fetchAssistantIdFromDatabase();
  return this.assistantPromise;
}

// Add new method to fetch from database:
private static async fetchAssistantIdFromDatabase(): Promise<string> {
  try {
    console.log('[AssistantService] Fetching assistant ID from database...');
    
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'assistant_id')
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch assistant ID: ${error.message}`);
    }
    
    if (!data?.value || data.value === 'asst_placeholder') {
      throw new Error('No valid assistant ID found in database. Run: node scripts/update-assistant.js');
    }
    
    console.log('[AssistantService] Using assistant:', data.value);
    return data.value;
    
  } catch (error) {
    console.error('[AssistantService] Error:', error.message);
    throw error;
  }
}

// Option 3: Remove the createAssistant method entirely
// DELETE the createAssistant() method - it should never be called