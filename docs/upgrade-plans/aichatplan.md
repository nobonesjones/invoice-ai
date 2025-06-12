# AI Chat System Implementation Plan
*Invoice AI Application - Complete Technical Specification*

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Memory System](#memory-system)
4. [Voice Integration](#voice-integration)
5. [Function Calling](#function-calling)
6. [Document Display](#document-display)
7. [Technical Implementation](#technical-implementation)
8. [Implementation Phases](#implementation-phases)
9. [Database Schema](#database-schema)
10. [Security & Privacy](#security--privacy)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Plan](#deployment-plan)

---

## Overview

### Goals
Build an AI-powered chat interface for invoice management with:
- **Autonomous AI Agent** with persistent memory and reasoning capabilities
- **Voice input/output** for hands-free operation
- **Function calling** for invoice operations (create, edit, search, pay)
- **Rich document display** showing invoices directly in chat
- **Contextual awareness** of user's business patterns and preferences
- **Multi-step reasoning** for complex business workflows

### Technology Stack
- **Frontend**: React Native with TypeScript
- **AI Model**: OpenAI Assistants API (GPT-4) with built-in memory and threading
- **Voice**: React Native Voice + OpenAI Whisper
- **Memory**: OpenAI Threads + Supabase PostgreSQL for business data
- **Functions**: OpenAI Assistant Tools + Supabase Edge Functions
- **Real-time**: Supabase Realtime subscriptions

### Key Architecture Decision: OpenAI Assistants API

**Why Assistants API over Chat Completions:**
- ✅ **Built-in Memory**: Automatic conversation threading eliminates manual context management
- ✅ **Better Reasoning**: Enhanced multi-step planning and autonomous decision making
- ✅ **Persistent State**: Conversations maintain context across sessions automatically
- ✅ **Tool Integration**: Native tool calling with better error handling and retry logic
- ✅ **Thread Management**: Seamless conversation persistence without token management
- ✅ **Future-Ready**: Positioned for OpenAI's agent ecosystem evolution

**Migration Benefits:**
- Eliminate manual 15-message context window management
- Reduce complexity in `chatService.ts` and `openaiService.ts`
- Enable true conversational memory across sessions
- Support for complex multi-step workflows (e.g., "Create 5 invoices for my regular clients")
- Better handling of incomplete information gathering

---

## System Architecture

### High-Level Flow (Updated for Assistants API)
```
User Input (Voice/Text) 
    ↓
Voice Processing (RN Voice → Whisper)
    ↓
Assistant Thread Loading (OpenAI persistent context)
    ↓
AI Processing (Assistant API + Native Tool Calls)
    ↓
Response Generation (Text + Tool Results)
    ↓
UI Display (Chat Messages + Invoice Cards)
```

### Component Structure (Updated)
```
/app/chat/
├── ChatScreen.tsx           # Main chat interface
├── components/
│   ├── ChatMessage.tsx      # Individual message display
│   ├── VoiceInput.tsx       # Voice recording interface
│   ├── DocumentCards/
│   │   ├── InvoiceCard.tsx  # Invoice display in chat
│   │   ├── ClientCard.tsx   # Client display in chat
│   │   └── PaymentCard.tsx  # Payment display in chat
├── hooks/
│   ├── useAIAssistant.tsx   # OpenAI Assistants API integration
│   ├── useVoiceInput.tsx    # Voice recording logic
│   ├── useAssistantThread.tsx # Thread management
│   └── useAssistantTools.tsx  # Tool execution
└── services/
    ├── assistantService.ts  # OpenAI Assistants API integration
    ├── voiceService.ts      # Whisper API integration
    ├── threadService.ts     # Thread management
    └── toolService.ts       # Assistant tool implementations
```

### New Architecture Benefits

#### 1. Simplified Memory Management
**Before (Chat Completions):**
```typescript
// Manual context management
const conversationHistory = this.convertChatMessagesToOpenAI(
  allPreviousMessages.slice(0, -1) // Exclude just-saved message
);
// Limited to 15 messages due to token constraints
...conversationHistory.slice(-15)
```

**After (Assistants API):**
```typescript
// Automatic thread management
const thread = await this.getOrCreateThread(userId);
await this.addMessageToThread(thread.id, userMessage);
const run = await this.createRun(thread.id, assistantId);
// OpenAI handles all context automatically
```

#### 2. Enhanced Tool Calling
**Before:**
```typescript
// Manual function result handling
if (aiResult.functionCall) {
  functionResult = await InvoiceFunctionService.executeFunction(
    aiResult.functionCall.name,
    aiResult.functionCall.arguments,
    userId
  );
  // Manual integration back into conversation
}
```

**After:**
```typescript
// Native Assistant tool calling
const tools = [
  {
    type: "function",
    function: {
      name: "create_invoice",
      description: "Create a new invoice",
      parameters: { /* schema */ }
    }
  }
];
// OpenAI handles tool execution flow automatically
```

#### 3. Persistent Conversation State
**Before:**
```typescript
// Manual conversation recreation
const conversation = await this.getOrCreateConversation(userId);
const messages = await this.getConversationMessages(conversation.id);
// Lost context between sessions
```

**After:**
```typescript
// Persistent threads across sessions
const thread = await this.getOrCreateThread(userId);
// Full conversation history maintained by OpenAI
// Context persists across app sessions automatically
```

---

## Memory System (Updated for Assistants API)

### Hybrid Memory Architecture

#### 1. Conversational Memory (OpenAI Threads)
- **Purpose**: Track conversation context and reasoning flow
- **Duration**: Persistent across sessions until explicitly deleted
- **Storage**: OpenAI Threads API (native Assistant memory)
- **Capacity**: No token limit management needed
- **Benefits**: 
  - Automatic context management
  - Built-in reasoning chain preservation
  - Cross-session conversation continuity
  - No manual token counting

#### 2. Business Data Memory (Supabase)  
- **Purpose**: Store invoice, client, and business operation data
- **Duration**: Permanent business records
- **Storage**: Supabase PostgreSQL with RLS
- **Access**: Via Assistant tools for real-time business operations
- **Examples**: "Create invoice", "Search clients", "Mark paid"

#### 3. User Patterns & Preferences (Supabase + Vector)
- **Purpose**: Learn user habits, preferences, business rules
- **Duration**: Long-term learning (months/years)
- **Storage**: Database + vector embeddings for similarity search
- **Integration**: Injected into Assistant system prompt and tool parameters
- **Examples**: Default rates, client preferences, work habits, business rules

### Updated Database Schema (Simplified)

```sql
-- Assistant Threads mapping (lightweight)
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  openai_thread_id TEXT UNIQUE NOT NULL,
  title TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Simplified message tracking (for UI display only)
CREATE TABLE chat_message_display (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES chat_threads(id) NOT NULL,
  openai_message_id TEXT,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Business patterns and preferences (enhanced)
CREATE TABLE user_business_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  pattern_type TEXT CHECK (pattern_type IN ('pricing', 'scheduling', 'communication', 'workflow', 'client_preference')) NOT NULL,
  category TEXT, -- 'rates', 'terms', 'follow_ups', 'templates'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1) DEFAULT 0.5,
  learned_from TEXT DEFAULT 'conversation', -- 'conversation', 'pattern_analysis', 'user_input'
  created_at TIMESTAMP DEFAULT NOW(),
  last_reinforced_at TIMESTAMP DEFAULT NOW(),
  reinforcement_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

-- Vector embeddings for pattern matching
CREATE TABLE business_pattern_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  pattern_id UUID REFERENCES user_business_patterns(id),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Assistant System Prompt Integration

```typescript
// Enhanced system prompt with learned patterns
const buildSystemPromptWithPatterns = async (userId: string): Promise<string> => {
  const patterns = await getUserBusinessPatterns(userId);
  
  const basePrompt = `You are an AI assistant for invoice management...`;
  
  const patternsContext = patterns.map(p => {
    switch (p.pattern_type) {
      case 'pricing':
        return `The user typically charges ${p.value.rate} for ${p.key} work.`;
      case 'scheduling':
        return `The user prefers ${p.value.preference} for ${p.key}.`;
      case 'communication':
        return `For ${p.key}, the user usually ${p.value.approach}.`;
      case 'workflow':
        return `The user's workflow for ${p.key} is: ${p.value.steps}.`;
      case 'client_preference':
        return `For client ${p.key}: ${p.value.notes}`;
    }
  }).join('\n');
  
  return `${basePrompt}\n\nLEARNED USER PATTERNS:\n${patternsContext}`;
};
```

### Memory Management Flow

```typescript
// Simplified memory management with Assistants API
export class AssistantMemoryService {
  // 1. Get or create persistent thread
  async getOrCreateThread(userId: string): Promise<string> {
    let thread = await this.getActiveThread(userId);
    
    if (!thread) {
      // Create new OpenAI thread
      const openaiThread = await openai.beta.threads.create({
        metadata: { userId }
      });
      
      // Store thread mapping
      thread = await this.saveThreadMapping(userId, openaiThread.id);
    }
    
    return thread.openai_thread_id;
  }
  
  // 2. Add message with automatic context
  async addMessageToThread(threadId: string, message: string, userId: string): Promise<void> {
    // Inject business patterns into message context
    const patterns = await this.getRelevantPatterns(userId, message);
    const enhancedMessage = this.enhanceMessageWithPatterns(message, patterns);
    
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: enhancedMessage
    });
  }
  
  // 3. Learn patterns from assistant responses
  async extractPatternsFromRun(userId: string, threadId: string, runId: string): Promise<void> {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    const messages = await openai.beta.threads.messages.list(threadId);
    
    // Analyze for new patterns
    const newPatterns = await this.analyzeForPatterns(messages.data, userId);
    await this.saveBusinessPatterns(userId, newPatterns);
  }
}
```

---

## Voice Integration

### Hybrid Voice Strategy

#### Phase 1: Real-time Feedback (React Native Voice)
```typescript
// VoiceInput.tsx
const VoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');

  useEffect(() => {
    Voice.onSpeechResults = (e) => {
      setTranscript(e.value[0]); // Real-time preview
    };
    
    Voice.onSpeechEnd = (e) => {
      sendToWhisper(recordedAudio); // High-quality processing
    };
  }, []);

  const startListening = async () => {
    setIsListening(true);
    await Voice.start('en-US');
  };

  const sendToWhisper = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('model', 'whisper-1');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData
    });
    
    const result = await response.json();
    setFinalTranscript(result.text);
    onTranscriptionComplete(result.text);
  };

  return (
    <View style={styles.voiceContainer}>
      <TouchableOpacity onPress={startListening} style={styles.micButton}>
        <View style={[styles.micIcon, isListening && styles.listening]}>
          <Mic size={24} color={isListening ? '#ff4444' : '#666'} />
        </View>
      </TouchableOpacity>
      
      {isListening && (
        <View style={styles.listeningFeedback}>
          <Text style={styles.transcript}>{transcript}</Text>
          <View style={styles.waveform}>
            {/* Animated waveform component */}
          </View>
        </View>
      )}
    </View>
  );
};
```

#### Voice Error Handling
```typescript
const VoiceErrorHandler = {
  handleTimeout: () => {
    showToast("Voice timeout. Please try again or type your message.");
    fallbackToTextInput();
  },
  
  handleNoSpeech: () => {
    showToast("No speech detected. Tap and speak clearly.");
    resetVoiceInput();
  },
  
  handleNetworkError: () => {
    showToast("Network error. Using offline transcription.");
    useOfflineTranscription();
  },
  
  handlePermissionDenied: () => {
    showToast("Microphone permission required.");
    openAppSettings();
  }
};
```

---

## Function Calling

### Available Functions

#### 1. Invoice Management
```typescript
const invoiceFunctions = {
  create_invoice: {
    name: "create_invoice",
    description: "Create a new invoice for a client",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "Client name or company" },
        client_email: { type: "string", format: "email" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number", minimum: 0 },
              rate: { type: "number", minimum: 0 },
              amount: { type: "number", minimum: 0 }
            },
            required: ["description", "quantity", "rate"]
          }
        },
        due_date: { type: "string", format: "date" },
        payment_terms: { type: "string" },
        notes: { type: "string" },
        tax_rate: { type: "number", minimum: 0, maximum: 100 },
        discount_amount: { type: "number", minimum: 0 }
      },
      required: ["client_name", "items"]
    }
  },

  search_invoices: {
    name: "search_invoices",
    description: "Search and filter invoices",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string" },
        status: { 
          type: "string", 
          enum: ["draft", "sent", "paid", "overdue", "cancelled"] 
        },
        date_from: { type: "string", format: "date" },
        date_to: { type: "string", format: "date" },
        min_amount: { type: "number" },
        max_amount: { type: "number" },
        invoice_number: { type: "string" },
        limit: { type: "number", default: 10, maximum: 50 }
      }
    }
  },

  mark_invoice_paid: {
    name: "mark_invoice_paid",
    description: "Record payment for an invoice",
    parameters: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        payment_amount: { type: "number", minimum: 0 },
        payment_method: { 
          type: "string", 
          enum: ["cash", "bank_transfer", "paypal", "stripe", "check", "other"] 
        },
        payment_date: { type: "string", format: "date" },
        notes: { type: "string" }
      },
      required: ["invoice_id", "payment_amount", "payment_method"]
    }
  },

  send_invoice: {
    name: "send_invoice",
    description: "Send invoice via email",
    parameters: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        email_template: { 
          type: "string", 
          enum: ["standard", "reminder", "final_notice", "custom"] 
        },
        custom_message: { type: "string" },
        include_pdf: { type: "boolean", default: true }
      },
      required: ["invoice_id"]
    }
  }
};
```

#### 2. Client Management
```typescript
const clientFunctions = {
  search_clients: {
    name: "search_clients",
    description: "Search for clients",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        limit: { type: "number", default: 10 }
      }
    }
  },

  create_client: {
    name: "create_client",
    description: "Create a new client",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string", format: "email" },
        phone: { type: "string" },
        address: { type: "string" },
        company: { type: "string" }
      },
      required: ["name"]
    }
  },

  get_client_history: {
    name: "get_client_history",
    description: "Get client's invoice and payment history",
    parameters: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        include_payments: { type: "boolean", default: true },
        limit: { type: "number", default: 20 }
      },
      required: ["client_id"]
    }
  }
};
```

#### 3. Analytics & Reporting
```typescript
const analyticsFunctions = {
  get_revenue_summary: {
    name: "get_revenue_summary",
    description: "Get revenue summary for a period",
    parameters: {
      type: "object",
      properties: {
        period: { 
          type: "string", 
          enum: ["this_week", "this_month", "this_quarter", "this_year", "custom"] 
        },
        start_date: { type: "string", format: "date" },
        end_date: { type: "string", format: "date" },
        group_by: { 
          type: "string", 
          enum: ["day", "week", "month", "client"] 
        }
      }
    }
  },

  get_outstanding_invoices: {
    name: "get_outstanding_invoices",
    description: "Get all unpaid/overdue invoices",
    parameters: {
      type: "object",
      properties: {
        overdue_only: { type: "boolean", default: false },
        sort_by: { 
          type: "string", 
          enum: ["due_date", "amount", "client_name", "created_date"] 
        }
      }
    }
  }
};
```

### Function Implementation

```typescript
// services/functionService.ts
export class FunctionService {
  private supabase: SupabaseClient;
  private userId: string;

  async executeFunction(functionName: string, parameters: any): Promise<FunctionResult> {
    try {
      switch (functionName) {
        case 'create_invoice':
          return await this.createInvoice(parameters);
        case 'search_invoices':
          return await this.searchInvoices(parameters);
        case 'mark_invoice_paid':
          return await this.markInvoicePaid(parameters);
        // ... other functions
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallback_action: this.generateFallbackAction(functionName, parameters)
      };
    }
  }

  private async createInvoice(params: CreateInvoiceParams): Promise<FunctionResult> {
    // 1. Validate parameters
    const validation = await this.validateInvoiceParams(params);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        needs_clarification: validation.missing_fields
      };
    }

    // 2. Create invoice in database
    const { data: invoice, error } = await this.supabase
      .from('invoices')
      .insert({
        user_id: this.userId,
        client_name: params.client_name,
        client_email: params.client_email,
        total_amount: this.calculateTotal(params.items),
        due_date: params.due_date,
        // ... other fields
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Create line items
    await this.createLineItems(invoice.id, params.items);

    // 4. Return result with invoice document
    return {
      success: true,
      message: `Created invoice #${invoice.invoice_number} for ${params.client_name}`,
      documents: [{
        type: 'invoice',
        data: invoice
      }],
      actions: ['view', 'edit', 'send', 'mark_paid']
    };
  }

  private async searchInvoices(params: SearchInvoicesParams): Promise<FunctionResult> {
    let query = this.supabase
      .from('invoices')
      .select('*, line_items(*)')
      .eq('user_id', this.userId);

    // Apply filters
    if (params.client_name) {
      query = query.ilike('client_name', `%${params.client_name}%`);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.date_from) {
      query = query.gte('created_at', params.date_from);
    }
    // ... other filters

    const { data: invoices, error } = await query
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (error) throw error;

    return {
      success: true,
      message: `Found ${invoices.length} invoices`,
      documents: invoices.map(invoice => ({
        type: 'invoice',
        data: invoice
      })),
      summary: {
        total_count: invoices.length,
        total_amount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
        by_status: this.groupInvoicesByStatus(invoices)
      }
    };
  }
}
```

---

## Document Display

### Chat Message Types

```typescript
interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'text' | 'voice' | 'function_call' | 'function_result' | 'document';
  attachments: DocumentAttachment[];
  created_at: string;
  tokens_used?: number;
}

interface DocumentAttachment {
  id: string;
  type: 'invoice' | 'client' | 'payment' | 'report';
  data: any;
  actions: string[];
  display_format: 'card' | 'list' | 'summary';
}
```

### Document Card Components

#### Invoice Card
```typescript
// components/DocumentCards/InvoiceCard.tsx
interface InvoiceCardProps {
  invoice: Invoice;
  displayFormat: 'card' | 'summary' | 'detailed';
  onAction: (action: string, invoice: Invoice) => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, displayFormat, onAction }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10B981';
      case 'overdue': return '#EF4444';
      case 'sent': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  if (displayFormat === 'summary') {
    return (
      <TouchableOpacity 
        style={styles.summaryCard}
        onPress={() => onAction('view', invoice)}
      >
        <View style={styles.summaryHeader}>
          <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
            <Text style={styles.statusText}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.clientName}>{invoice.client_name}</Text>
        <Text style={styles.amount}>${invoice.total_amount.toFixed(2)}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.invoiceCard}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceNumber}>📄 INVOICE #{invoice.invoice_number}</Text>
          <Text style={styles.createdDate}>
            Created {format(new Date(invoice.created_at), 'MMM dd, yyyy')}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
          <Text style={styles.statusText}>{invoice.status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Client Info */}
      <View style={styles.clientSection}>
        <Text style={styles.clientName}>{invoice.client_name}</Text>
        {invoice.client_email && (
          <Text style={styles.clientEmail}>{invoice.client_email}</Text>
        )}
      </View>

      {/* Line Items Preview */}
      <View style={styles.itemsSection}>
        {invoice.line_items.slice(0, 2).map((item, index) => (
          <View key={index} style={styles.lineItem}>
            <Text style={styles.itemDescription}>
              {item.quantity}x {item.description}
            </Text>
            <Text style={styles.itemAmount}>
              ${(item.quantity * item.rate).toFixed(2)}
            </Text>
          </View>
        ))}
        {invoice.line_items.length > 2 && (
          <Text style={styles.moreItems}>
            +{invoice.line_items.length - 2} more items
          </Text>
        )}
      </View>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>${invoice.total_amount.toFixed(2)}</Text>
        </View>
        {invoice.due_date && (
          <Text style={styles.dueDate}>
            Due {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onAction('view', invoice)}
        >
          <Eye size={16} color="#666" />
          <Text style={styles.actionText}>View</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onAction('edit', invoice)}
        >
          <Edit size={16} color="#666" />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>

        {invoice.status !== 'paid' && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onAction('mark_paid', invoice)}
          >
            <CheckCircle size={16} color="#10B981" />
            <Text style={[styles.actionText, { color: '#10B981' }]}>Mark Paid</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onAction('send', invoice)}
        >
          <Send size={16} color="#3B82F6" />
          <Text style={[styles.actionText, { color: '#3B82F6' }]}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

#### Client Card
```typescript
// components/DocumentCards/ClientCard.tsx
const ClientCard: React.FC<ClientCardProps> = ({ client, onAction }) => {
  return (
    <View style={styles.clientCard}>
      <View style={styles.clientHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {client.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{client.name}</Text>
          {client.email && (
            <Text style={styles.clientEmail}>{client.email}</Text>
          )}
          {client.phone && (
            <Text style={styles.clientPhone}>{client.phone}</Text>
          )}
        </View>
      </View>

      <View style={styles.clientStats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{client.total_invoices}</Text>
          <Text style={styles.statLabel}>Invoices</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>${client.total_billed?.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Billed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>${client.outstanding_amount?.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Outstanding</Text>
        </View>
      </View>

      <View style={styles.clientActions}>
        <TouchableOpacity onPress={() => onAction('view_profile', client)}>
          <Text style={styles.actionText}>View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onAction('create_invoice', client)}>
          <Text style={styles.actionText}>New Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onAction('call', client)}>
          <Phone size={16} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onAction('email', client)}>
          <Mail size={16} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

---

## Implementation Phases (Updated for Assistants API Migration)

### Phase 0: Assistants API Migration (Week 1)
**Goal**: Migrate from Chat Completions to Assistants API for better memory and reasoning

#### Migration Steps:
- [ ] Create new `assistantService.ts` with Assistants API integration
- [ ] Implement thread management system
- [ ] Migrate existing functions to Assistant tools format
- [ ] Update `chatService.ts` to use Assistants API
- [ ] Test conversation persistence across sessions
- [ ] Migrate existing conversations to thread format

**Success Criteria**: 
- All existing functionality works with Assistants API
- Conversations persist across app sessions
- Tool calling works seamlessly
- No token limit management needed

---

### Phase 1: Enhanced Memory & Reasoning (Week 2)
**Goal**: Leverage Assistants API capabilities for better autonomy

#### Week 2: Memory Enhancement
- [ ] Set up assistant with enhanced system prompt
- [ ] Implement business pattern learning system
- [ ] Create user preference extraction
- [ ] Add pattern-based suggestions
- [ ] Test multi-step reasoning workflows

**Deliverable**: AI that truly learns user patterns and handles complex workflows autonomously

---

### Phase 2: Advanced Tool Integration (Week 3)
**Goal**: Enhanced function calling with better error handling

#### Week 3: Tool Enhancement
- [ ] Implement all invoice management tools in Assistant format
- [ ] Add advanced client management tools
- [ ] Create analytics and reporting tools
- [ ] Add batch operation tools (e.g., "Create invoices for all my regular clients")
- [ ] Implement tool error handling and retry logic

**Deliverable**: Comprehensive tool suite with robust error handling

---

### Phase 3: Voice Integration (Week 4)
**Goal**: Add voice capabilities to the enhanced Assistant

#### Week 4: Voice Polish
- [ ] Integrate voice input with Assistants API
- [ ] Test voice workflows with memory persistence
- [ ] Add voice feedback for complex workflows
- [ ] Optimize voice-to-tool workflows

**Deliverable**: Voice-enabled autonomous AI assistant

---

### Phase 4: Rich Document Enhancement (Week 5)
**Goal**: Enhanced document display leveraging better AI reasoning

#### Week 5: Smart Documents
- [ ] Enhance invoice cards with AI-generated insights
- [ ] Add smart document actions based on conversation context
- [ ] Implement batch document operations
- [ ] Create intelligent document recommendations

**Deliverable**: Context-aware document interface

---

### Phase 5: Advanced Business Intelligence (Week 6)
**Goal**: Leverage persistent memory for business insights

#### Week 6: Business Intelligence
- [ ] Add pattern-based business insights
- [ ] Create proactive recommendations
- [ ] Implement trend analysis
- [ ] Add automated workflow suggestions

**Deliverable**: AI that proactively helps with business optimization

---

## Migration Strategy: Chat Completions → Assistants API

### 1. Service Layer Migration

#### Current Architecture:
```typescript
// openaiService.ts - Chat Completions
export class OpenAIService {
  static async sendMessage(messages: ChatMessage[], functions?: any[]) {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      functions: functions
    });
    return response;
  }
}
```

#### New Architecture:
```typescript
// assistantService.ts - Assistants API
export class AssistantService {
  private static assistantId: string;
  
  static async initializeAssistant() {
    this.assistantId = await this.createOrGetAssistant();
  }
  
  static async sendMessage(userId: string, message: string) {
    const threadId = await this.getOrCreateThread(userId);
    
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message
    });
    
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: this.assistantId
    });
    
    return await this.waitForCompletion(threadId, run.id);
  }
}
```

### 2. Database Migration

#### Update Existing Tables:
```sql
-- Add thread mapping for existing conversations
ALTER TABLE chat_conversations ADD COLUMN openai_thread_id TEXT;

-- Migration script to convert existing conversations
CREATE OR REPLACE FUNCTION migrate_conversations_to_threads()
RETURNS void AS $$
DECLARE
  conv RECORD;
  thread_id TEXT;
BEGIN
  FOR conv IN SELECT * FROM chat_conversations WHERE openai_thread_id IS NULL LOOP
    -- Create OpenAI thread for each existing conversation
    -- This would be done via API calls in the migration script
    -- UPDATE chat_conversations SET openai_thread_id = ? WHERE id = conv.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 3. Gradual Migration Approach

#### Phase A: Parallel Systems
```typescript
// chatService.ts - During migration
export class ChatService {
  static async processMessage(message: string, userId: string) {
    const useAssistants = await this.shouldUseAssistants(userId);
    
    if (useAssistants) {
      return await AssistantService.sendMessage(userId, message);
    } else {
      return await OpenAIService.sendMessage(/* existing logic */);
    }
  }
  
  private static async shouldUseAssistants(userId: string): Promise<boolean> {
    // Feature flag or gradual rollout logic
    const userConfig = await this.getUserConfig(userId);
    return userConfig.use_assistants_api || false;
  }
}
```

#### Phase B: Full Migration
```typescript
// chatService.ts - After migration
export class ChatService {
  static async processMessage(message: string, userId: string) {
    return await AssistantService.sendMessage(userId, message);
  }
}
```

### 4. Testing Strategy for Migration

#### Migration Tests:
```typescript
describe('Assistants API Migration', () => {
  test('should maintain conversation context across sessions', async () => {
    const userId = 'test-user';
    
    // Send first message
    await AssistantService.sendMessage(userId, 'My rate is $75/hour');
    
    // Simulate app restart by creating new service instance
    const newService = new AssistantService();
    
    // Send follow-up message
    const response = await newService.sendMessage(userId, 'Create an invoice for 2 hours of work');
    
    // Should remember the rate from previous session
    expect(response).toContain('$150'); // 2 hours * $75
  });
  
  test('should handle tool calling better than chat completions', async () => {
    const response = await AssistantService.sendMessage(
      'test-user', 
      'Create invoices for all my regular clients'
    );
    
    // Should handle complex multi-step workflow
    expect(response.tool_calls).toHaveLength(greaterThan(1));
    expect(response.success).toBe(true);
  });
});
```

---

## Testing Strategy

### Unit Tests
```typescript
// tests/chatService.test.ts
describe('ChatService', () => {
  test('should create invoice with valid parameters', async () => {
    const params = {
      client_name: 'Test Client',
      items: [{ description: 'Test Item', quantity: 1, rate: 100 }]
    };
    
    const result = await chatService.executeFunction('create_invoice', params);
    
    expect(result.success).toBe(true);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].type).toBe('invoice');
  });
  
  test('should handle memory extraction correctly', async () => {
    const messages = [
      { role: 'user', content: 'I charge $75 per hour for consulting' },
      { role: 'assistant', content: 'I\'ll remember your consulting rate is $75/hour' }
    ];
    
    const facts = await memoryService.extractFacts(messages);
    
    expect(facts).toContainEqual({
      type: 'preference',
      key: 'consulting_rate',
      value: '$75',
      confidence_score: expect.any(Number)
    });
  });
});
```

### Integration Tests
```typescript
// tests/integration/chatFlow.test.ts
describe('Complete Chat Flow', () => {
  test('should handle voice → transcription → AI → function call → response', async () => {
    // Mock voice input
    const audioBlob = new Blob(['fake audio data']);
    
    // Test transcription
    const transcript = await voiceService.transcribe(audioBlob);
    expect(transcript).toBe('Create an invoice for John Smith for $500');
    
    // Test AI processing
    const response = await aiService.processMessage(transcript);
    expect(response.function_calls).toHaveLength(1);
    expect(response.function_calls[0].name).toBe('create_invoice');
    
    // Test function execution
    const result = await functionService.executeFunction(
      response.function_calls[0].name,
      response.function_calls[0].parameters
    );
    expect(result.success).toBe(true);
  });
});
```

### Performance Tests
```typescript
// tests/performance/chatPerformance.test.ts
describe('Chat Performance', () => {
  test('should respond within 3 seconds for text messages', async () => {
    const start = Date.now();
    const response = await chatService.processMessage('Show me recent invoices');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(3000);
  });
  
  test('should handle 100 concurrent requests', async () => {
    const promises = Array.from({ length: 100 }, () =>
      chatService.processMessage('Hello')
    );
    
    const results = await Promise.all(promises);
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

---

## Deployment Plan

### Environment Setup
```yaml
# .env.production
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://...
RATE_LIMIT_ENABLED=true
LOG_LEVEL=error
```

### Database Migrations
```sql
-- Migration checklist:
-- 1. Chat tables (conversations, messages, memory_facts, embeddings)
-- 2. Indexes for performance (vector search, user queries)
-- 3. RLS policies for security
-- 4. Functions for memory management
-- 5. Triggers for automatic fact extraction
```

### Monitoring & Analytics
```typescript
// services/analytics.ts
export class ChatAnalytics {
  static trackMessage(userId: string, messageType: string, tokens: number) {
    // Track usage metrics
    analytics.track('chat_message_sent', {
      user_id: userId,
      message_type: messageType,
      tokens_used: tokens,
      timestamp: new Date()
    });
  }
  
  static trackFunctionCall(userId: string, functionName: string, success: boolean) {
    analytics.track('function_called', {
      user_id: userId,
      function_name: functionName,
      success: success,
      timestamp: new Date()
    });
  }
}
```

### Error Monitoring
```typescript
// services/errorTracking.ts
export class ErrorTracking {
  static captureError(error: Error, context: any) {
    Sentry.captureException(error, {
      tags: {
        service: 'ai_chat',
        user_id: context.userId,
        function_name: context.functionName
      },
      extra: context
    });
  }
}
```

---

## Expected Benefits from Assistants API Migration

### 1. **Autonomous Conversation Management**
**Before**: Manual token counting and context window management
```typescript
// Complex manual management
const conversationHistory = this.convertChatMessagesToOpenAI(
  allPreviousMessages.slice(0, -1)
);
if (conversationHistory.length > 15) {
  conversationHistory = conversationHistory.slice(-15);
}
```

**After**: Automatic thread persistence
```typescript
// Simple, persistent threads
const threadId = await this.getOrCreateThread(userId);
await openai.beta.threads.messages.create(threadId, {
  role: "user", 
  content: message
});
```

### 2. **Enhanced Multi-Step Reasoning**
**Current Problem**: AI forgets context mid-conversation
- User: "Create invoice for Ben"
- AI: "What's the client's name?" (Already said it was Ben!)

**Expected Solution**: Persistent context enables complex workflows
- User: "Create invoices for all my regular clients with their usual rates"
- AI: Remembers all clients, their rates, creates multiple invoices autonomously

### 3. **Cross-Session Memory**
**Before**: Conversations reset on app restart
**After**: Conversations continue seamlessly across sessions

### 4. **Better Error Recovery**
**Before**: Failed function calls break conversation flow
**After**: Native retry logic and error handling within OpenAI's system

### 5. **Reduced Complexity**
- Eliminate 200+ lines of context management code
- No more token counting logic
- Simplified error handling
- Automatic conversation persistence

---

## Success Metrics (Updated)

### Core Performance Metrics
- **Response Time**: < 3 seconds for simple requests, < 10 seconds for complex multi-step workflows
- **Tool Success Rate**: > 98% (improved from 95% with better error handling)
- **Cross-Session Memory**: 100% conversation persistence
- **Multi-Step Workflow Success**: > 90% for complex requests

### Memory & Intelligence Metrics
- **Context Retention**: Unlimited conversation history (vs. previous 15 message limit)
- **Pattern Learning**: Recognize user patterns within 3-5 interactions
- **Autonomous Task Completion**: Handle 80% of requests without asking for clarification
- **Reasoning Accuracy**: Correctly infer missing information 85% of the time

### User Experience Metrics
- **Conversation Continuity**: 100% preservation across app sessions
- **Workflow Completion**: 90% of complex tasks completed in single conversation
- **Clarification Reduction**: 60% fewer "what did you mean?" responses
- **User Satisfaction**: > 4.7/5 rating (improved from 4.5/5)

### Technical Metrics
- **Code Complexity**: 50% reduction in service layer complexity
- **API Cost Optimization**: Better cost efficiency with native tools
- **Error Rate**: < 2% failed operations (improved from 5%)
- **Memory Footprint**: 70% reduction in client-side memory usage

---

## Next Steps

1. **Review & Approve Plan**: Get stakeholder sign-off on approach
2. **Set Up Development Environment**: Configure APIs, database, tools
3. **Start Phase 1**: Begin with basic chat infrastructure
4. **Weekly Reviews**: Track progress against milestones
5. **User Testing**: Get feedback early and often
6. **Iterate & Improve**: Refine based on real usage

---

*This document serves as the master plan for AI chat implementation. Update as requirements evolve.*
