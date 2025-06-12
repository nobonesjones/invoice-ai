import { supabase } from '@/config/supabase';

export interface MemoryFact {
  id?: string;
  user_id: string;
  fact_type: 'rate' | 'preference' | 'client_info' | 'business_rule' | 'workflow';
  category?: string;
  key: string;
  value: string;
  confidence_score: number;
  source_conversation_id?: string;
  source_type: 'conversation' | 'pattern_analysis' | 'user_input';
  created_at?: string;
  last_used_at?: string;
  use_count?: number;
  is_active?: boolean;
}

export class MemoryService {
  // Extract facts from conversation messages
  static async extractFactsFromConversation(
    userId: string,
    conversationId: string,
    messages: any[]
  ): Promise<MemoryFact[]> {
    const facts: MemoryFact[] = [];

    for (const message of messages) {
      if (message.role === 'user') {
        const extractedFacts = this.extractFactsFromMessage(message.content, userId, conversationId);
        facts.push(...extractedFacts);
      }
    }

    // Save extracted facts to database
    if (facts.length > 0) {
      await this.saveMemoryFacts(facts);
    }

    return facts;
  }

  // Extract facts from a single message
  private static extractFactsFromMessage(
    content: string,
    userId: string,
    conversationId: string
  ): MemoryFact[] {
    const facts: MemoryFact[] = [];
    const lowerContent = content.toLowerCase();

    // Rate extraction patterns
    const ratePatterns = [
      /(?:charge|rate|fee|cost|price).*?(\$?\d+(?:\.\d{2})?)\s*(?:per|\/)\s*hour/i,
      /(\$?\d+(?:\.\d{2})?)\s*(?:per|\/)\s*hour/i,
      /(?:my|our)\s+(?:hourly\s+)?(?:rate|fee)\s+is\s+(\$?\d+(?:\.\d{2})?)/i,
      /(?:i|we)\s+charge\s+(\$?\d+(?:\.\d{2})?)/i
    ];

    for (const pattern of ratePatterns) {
      const match = content.match(pattern);
      if (match) {
        const rate = match[1].replace('$', '');
        facts.push({
          user_id: userId,
          fact_type: 'rate',
          category: 'hourly_rate',
          key: 'default_hourly_rate',
          value: rate,
          confidence_score: 0.9,
          source_conversation_id: conversationId,
          source_type: 'conversation'
        });
      }
    }

    // Client preference patterns
    const clientPreferencePatterns = [
      /(?:client|customer)\s+([a-zA-Z\s]+)\s+(?:prefers|likes|wants|usually)/i,
      /([a-zA-Z\s]+)\s+(?:always|usually|typically)\s+(?:wants|needs|prefers)/i
    ];

    for (const pattern of clientPreferencePatterns) {
      const match = content.match(pattern);
      if (match) {
        facts.push({
          user_id: userId,
          fact_type: 'client_info',
          category: 'preference',
          key: match[1].trim(),
          value: content,
          confidence_score: 0.7,
          source_conversation_id: conversationId,
          source_type: 'conversation'
        });
      }
    }

    // Business rule patterns
    const businessRulePatterns = [
      /(?:always|usually|typically|normally)\s+(?:charge|bill|invoice|send)/i,
      /(?:my|our)\s+(?:policy|rule|standard)\s+is/i,
      /(?:i|we)\s+(?:always|usually|typically|normally)\s+(?:do|make|create)/i
    ];

    for (const pattern of businessRulePatterns) {
      if (pattern.test(content)) {
        facts.push({
          user_id: userId,
          fact_type: 'business_rule',
          category: 'standard_practice',
          key: 'business_practice',
          value: content,
          confidence_score: 0.8,
          source_conversation_id: conversationId,
          source_type: 'conversation'
        });
      }
    }

    // Service/item pricing patterns
    const servicePricePatterns = [
      /([a-zA-Z\s]+?)\s+(?:is|costs?|charges?)\s+(\$?\d+(?:\.\d{2})?)/i,
      /(\$?\d+(?:\.\d{2})?)\s+for\s+([a-zA-Z\s]+)/i
    ];

    for (const pattern of servicePricePatterns) {
      const match = content.match(pattern);
      if (match) {
        const service = pattern.source.includes('for') ? match[2] : match[1];
        const price = pattern.source.includes('for') ? match[1] : match[2];
        
        facts.push({
          user_id: userId,
          fact_type: 'rate',
          category: 'service_pricing',
          key: service.trim().toLowerCase(),
          value: price.replace('$', ''),
          confidence_score: 0.8,
          source_conversation_id: conversationId,
          source_type: 'conversation'
        });
      }
    }

    return facts;
  }

  // Save memory facts to database
  static async saveMemoryFacts(facts: MemoryFact[]): Promise<void> {
    try {
      for (const fact of facts) {
        // Check if similar fact already exists
        const { data: existingFacts } = await supabase
          .from('chat_memory_facts')
          .select('*')
          .eq('user_id', fact.user_id)
          .eq('fact_type', fact.fact_type)
          .eq('key', fact.key)
          .eq('is_active', true);

        if (existingFacts && existingFacts.length > 0) {
          // Update existing fact (reinforce it)
          await supabase
            .from('chat_memory_facts')
            .update({
              value: fact.value,
              confidence_score: Math.min(existingFacts[0].confidence_score + 0.1, 1.0),
              last_used_at: new Date().toISOString(),
              use_count: existingFacts[0].use_count + 1
            })
            .eq('id', existingFacts[0].id);
        } else {
          // Insert new fact
          await supabase
            .from('chat_memory_facts')
            .insert({
              user_id: fact.user_id,
              fact_type: fact.fact_type,
              category: fact.category,
              key: fact.key,
              value: fact.value,
              confidence_score: fact.confidence_score,
              source_conversation_id: fact.source_conversation_id,
              source_type: fact.source_type
            });
        }
      }
    } catch (error) {
      console.error('[MemoryService] Error saving memory facts:', error);
    }
  }

  // Get relevant facts for a user and context
  static async getRelevantFacts(
    userId: string,
    context?: string,
    factTypes?: string[]
  ): Promise<MemoryFact[]> {
    try {
      let query = supabase
        .from('chat_memory_facts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('confidence_score', { ascending: false });

      if (factTypes && factTypes.length > 0) {
        query = query.in('fact_type', factTypes);
      }

      const { data: facts, error } = await query;

      if (error) throw error;

      // Filter by context relevance if provided
      if (context && facts) {
        const contextLower = context.toLowerCase();
        return facts.filter(fact => 
          contextLower.includes(fact.key.toLowerCase()) ||
          fact.value.toLowerCase().includes(contextLower) ||
          fact.confidence_score > 0.8
        );
      }

      return facts || [];
    } catch (error) {
      console.error('[MemoryService] Error getting relevant facts:', error);
      return [];
    }
  }

  // Get user's default rates
  static async getUserRates(userId: string): Promise<Record<string, number>> {
    const facts = await this.getRelevantFacts(userId, undefined, ['rate']);
    const rates: Record<string, number> = {};

    for (const fact of facts) {
      if (fact.fact_type === 'rate') {
        rates[fact.key] = parseFloat(fact.value);
      }
    }

    return rates;
  }

  // Get user's business preferences
  static async getUserPreferences(userId: string): Promise<Record<string, string>> {
    const facts = await this.getRelevantFacts(userId, undefined, ['preference', 'business_rule']);
    const preferences: Record<string, string> = {};

    for (const fact of facts) {
      preferences[fact.key] = fact.value;
    }

    return preferences;
  }

  // Generate enhanced system prompt with user context
  static async generateEnhancedPrompt(userId: string, basePrompt: string): Promise<string> {
    const rates = await this.getUserRates(userId);
    const preferences = await this.getUserPreferences(userId);

    let enhancedPrompt = basePrompt;

    if (Object.keys(rates).length > 0) {
      enhancedPrompt += '\n\nUSER RATES:\n';
      for (const [service, rate] of Object.entries(rates)) {
        enhancedPrompt += `• ${service}: $${rate}\n`;
      }
    }

    if (Object.keys(preferences).length > 0) {
      enhancedPrompt += '\n\nUSER PREFERENCES:\n';
      for (const [key, value] of Object.entries(preferences)) {
        enhancedPrompt += `• ${key}: ${value}\n`;
      }
    }

    return enhancedPrompt;
  }
} 