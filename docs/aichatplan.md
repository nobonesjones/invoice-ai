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
- **Conversational AI** with persistent memory
- **Voice input/output** for hands-free operation
- **Function calling** for invoice operations (create, edit, search, pay)
- **Rich document display** showing invoices directly in chat
- **Contextual awareness** of user's business patterns and preferences

### Technology Stack
- **Frontend**: React Native with TypeScript
- **AI Model**: OpenAI GPT-4 with function calling
- **Voice**: React Native Voice + OpenAI Whisper
- **Memory**: Supabase PostgreSQL + Vector embeddings
- **Functions**: Supabase Edge Functions
- **Real-time**: Supabase Realtime subscriptions

---

## System Architecture

### High-Level Flow
```
User Input (Voice/Text) 
    ↓
Voice Processing (RN Voice → Whisper)
    ↓
Context Loading (Memory + Business Data)
    ↓
AI Processing (GPT-4 + Function Calls)
    ↓
Response Generation (Text + Documents)
    ↓
UI Display (Chat Messages + Invoice Cards)
```

### Component Structure
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
│   ├── useAIChat.tsx        # Main AI integration
│   ├── useVoiceInput.tsx    # Voice recording logic
│   ├── useChatMemory.tsx    # Memory management
│   └── useFunctionCalls.tsx # Function execution
└── services/
    ├── aiService.ts         # OpenAI API integration
    ├── voiceService.ts      # Whisper API integration
    ├── memoryService.ts     # Memory management
    └── functionService.ts   # Function implementations
```

---

## Memory System

### Memory Types

#### 1. Conversational Memory (Short-term)
- **Purpose**: Track current conversation context
- **Duration**: Current session only
- **Storage**: In-memory state + database backup
- **Max Size**: 10 messages (4K tokens)

#### 2. Session Memory (Medium-term)  
- **Purpose**: Remember context across conversations in same day
- **Duration**: 24 hours or logout
- **Storage**: Database with TTL
- **Examples**: "Working on Johnson project today"

#### 3. Persistent Memory (Long-term)
- **Purpose**: User preferences, patterns, business context
- **Duration**: Permanent until deleted
- **Storage**: Database + vector embeddings
- **Examples**: Default rates, client preferences, work habits

### Database Schema

```sql
-- Conversations
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant', 'system', 'function')) NOT NULL,
  content TEXT,
  message_type TEXT CHECK (message_type IN ('text', 'voice', 'function_call', 'function_result', 'document')) DEFAULT 'text',
  function_name TEXT,
  function_parameters JSONB,
  function_result JSONB,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  tokens_used INTEGER DEFAULT 0
);

-- Memory Facts
CREATE TABLE chat_memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  fact_type TEXT CHECK (fact_type IN ('preference', 'pattern', 'context', 'client_info', 'business_rule')) NOT NULL,
  category TEXT, -- 'pricing', 'scheduling', 'communication', 'workflow'
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1) DEFAULT 0.5,
  source_conversation_id UUID REFERENCES chat_conversations(id),
  source_type TEXT DEFAULT 'conversation', -- 'conversation', 'pattern_analysis', 'user_input'
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  use_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

-- Vector Embeddings
CREATE TABLE chat_memory_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI ada-002 embedding size
  metadata JSONB DEFAULT '{}',
  source_type TEXT DEFAULT 'conversation',
  source_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create vector similarity search index
CREATE INDEX chat_memory_embeddings_vector_idx ON chat_memory_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Memory Management Functions

```typescript
// Memory extraction after conversation
const extractMemoryFacts = async (conversationId: string, messages: ChatMessage[]) => {
  const extractionPrompt = `
    Analyze this conversation and extract learnable facts about the user's business:
    
    Categories to extract:
    1. Pricing patterns (rates, project values, discounts)
    2. Client relationships (communication preferences, payment patterns)
    3. Work habits (scheduling, invoicing frequency, follow-ups)
    4. Business rules (terms, policies, workflows)
    
    For each fact, provide:
    - Type: preference/pattern/context/client_info/business_rule
    - Category: pricing/scheduling/communication/workflow
    - Key: descriptive identifier
    - Value: the actual fact/preference
    - Confidence: 0.0-1.0 based on how certain this fact is
    
    Messages: ${JSON.stringify(messages)}
  `;
  
  // Call OpenAI to extract facts
  // Save to database with proper categorization
};

// Context retrieval for new messages
const buildContextForMessage = async (userId: string, message: string): Promise<ChatContext> => {
  // 1. Get recent conversation (last 10 messages)
  const recentHistory = await getRecentMessages(userId, 10);
  
  // 2. Search relevant memory using embeddings
  const embedding = await createEmbedding(message);
  const relevantMemory = await searchMemoryByEmbedding(userId, embedding, 5);
  
  // 3. Get business context (recent invoices, clients)
  const businessContext = await getRelevantBusinessData(userId, message);
  
  // 4. Apply token budget (max 4000 tokens)
  const context = optimizeContextForTokens({
    recentHistory,
    relevantMemory,
    businessContext
  }, 4000);
  
  return context;
};
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

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Basic text-based AI chat with core functionality

#### Week 1: Core Chat Infrastructure
- [ ] Set up chat database tables
- [ ] Create basic ChatScreen component
- [ ] Implement ChatMessage components
- [ ] Set up OpenAI API integration
- [ ] Create basic function calling system

#### Week 2: Basic Function Calls
- [ ] Implement create_invoice function
- [ ] Implement search_invoices function
- [ ] Implement mark_invoice_paid function
- [ ] Add basic error handling
- [ ] Create simple invoice display in chat

**Deliverable**: Working text chat that can create, search, and mark invoices as paid

---

### Phase 2: Memory System (Weeks 3-4)
**Goal**: Add conversational memory and context awareness

#### Week 3: Database & Memory Infrastructure
- [ ] Set up memory tables (facts, embeddings, conversations)
- [ ] Implement memory extraction system
- [ ] Create embedding generation pipeline
- [ ] Build context retrieval system

#### Week 4: Memory Integration
- [ ] Integrate memory into chat responses
- [ ] Add fact learning from conversations
- [ ] Implement memory-based suggestions
- [ ] Create memory management UI

**Deliverable**: AI that remembers user preferences and business patterns

---

### Phase 3: Voice Integration (Weeks 5-6)
**Goal**: Add voice input/output capabilities

#### Week 5: Voice Input
- [ ] Set up React Native Voice
- [ ] Create VoiceInput component
- [ ] Integrate OpenAI Whisper API
- [ ] Add voice error handling

#### Week 6: Voice Polish & Testing
- [ ] Add visual feedback for voice recording
- [ ] Implement voice quality optimization
- [ ] Add offline voice handling
- [ ] Test voice in various conditions

**Deliverable**: Hands-free voice interaction with AI chat

---

### Phase 4: Rich Documents (Weeks 7-8)
**Goal**: Enhanced document display and interactions

#### Week 7: Document Cards
- [ ] Create InvoiceCard component
- [ ] Create ClientCard component
- [ ] Add document actions (view, edit, etc.)
- [ ] Implement card interactions

#### Week 8: Advanced Documents
- [ ] Add PaymentCard component
- [ ] Create ReportCard component
- [ ] Add batch actions
- [ ] Implement document export

**Deliverable**: Rich visual documents embedded in chat

---

### Phase 5: Advanced Features (Weeks 9-10)
**Goal**: Polish and advanced functionality

#### Week 9: Analytics & Insights
- [ ] Add revenue analytics functions
- [ ] Create insight generation
- [ ] Implement proactive suggestions
- [ ] Add business intelligence features

#### Week 10: Polish & Optimization
- [ ] Performance optimization
- [ ] Advanced error handling
- [ ] Security hardening
- [ ] User experience polish

**Deliverable**: Production-ready AI chat system

---

## Technical Implementation Details

### API Rate Limiting
```typescript
// services/rateLimiter.ts
export class RateLimiter {
  private limits = {
    chat_messages: { count: 100, window: 3600 }, // 100 per hour
    voice_transcriptions: { count: 50, window: 3600 }, // 50 per hour
    function_calls: { count: 200, window: 3600 } // 200 per hour
  };

  async checkLimit(userId: string, action: string): Promise<boolean> {
    const key = `ratelimit:${userId}:${action}`;
    const current = await redis.get(key) || 0;
    
    if (current >= this.limits[action].count) {
      throw new Error(`Rate limit exceeded for ${action}`);
    }
    
    await redis.incr(key);
    await redis.expire(key, this.limits[action].window);
    return true;
  }
}
```

### Context Window Management
```typescript
// services/contextManager.ts
export class ContextManager {
  private readonly MAX_TOKENS = 4000;
  
  async buildContext(userId: string, message: string): Promise<ChatContext> {
    const components = {
      systemPrompt: await this.getSystemPrompt(userId),
      recentHistory: await this.getRecentHistory(userId),
      relevantMemory: await this.getRelevantMemory(userId, message),
      businessContext: await this.getBusinessContext(userId, message)
    };
    
    // Calculate tokens for each component
    const tokenCounts = {
      systemPrompt: this.countTokens(components.systemPrompt),
      recentHistory: this.countTokens(components.recentHistory),
      relevantMemory: this.countTokens(components.relevantMemory),
      businessContext: this.countTokens(components.businessContext)
    };
    
    // Optimize for token budget
    return this.optimizeContext(components, tokenCounts);
  }
  
  private optimizeContext(components: any, tokenCounts: any): ChatContext {
    let totalTokens = Object.values(tokenCounts).reduce((a, b) => a + b, 0);
    
    // If over budget, trim components by priority
    if (totalTokens > this.MAX_TOKENS) {
      // Priority: System > Memory > Business > History
      components.recentHistory = this.trimHistory(
        components.recentHistory,
        this.MAX_TOKENS - tokenCounts.systemPrompt - tokenCounts.relevantMemory - tokenCounts.businessContext
      );
    }
    
    return components;
  }
}
```

### Security Implementation
```typescript
// middleware/chatSecurity.ts
export class ChatSecurity {
  static validateMessage(message: string): ValidationResult {
    // Check for SQL injection attempts
    const sqlPatterns = [/union\s+select/i, /drop\s+table/i, /delete\s+from/i];
    if (sqlPatterns.some(pattern => pattern.test(message))) {
      return { valid: false, reason: 'Potential SQL injection detected' };
    }
    
    // Check for prompt injection
    const promptPatterns = [/ignore\s+previous/i, /system\s*:/i, /assistant\s*:/i];
    if (promptPatterns.some(pattern => pattern.test(message))) {
      return { valid: false, reason: 'Potential prompt injection detected' };
    }
    
    // Check message length
    if (message.length > 10000) {
      return { valid: false, reason: 'Message too long' };
    }
    
    return { valid: true };
  }
  
  static async validateFunctionCall(userId: string, functionName: string, parameters: any): Promise<boolean> {
    // Validate user has access to referenced resources
    if (parameters.invoice_id) {
      const hasAccess = await this.validateInvoiceAccess(userId, parameters.invoice_id);
      if (!hasAccess) throw new Error('Access denied to invoice');
    }
    
    if (parameters.client_id) {
      const hasAccess = await this.validateClientAccess(userId, parameters.client_id);
      if (!hasAccess) throw new Error('Access denied to client');
    }
    
    return true;
  }
}
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

## Success Metrics

### Core Metrics
- **Response Time**: < 3 seconds for text, < 10 seconds for voice
- **Function Success Rate**: > 95%
- **User Satisfaction**: > 4.5/5 rating
- **Voice Accuracy**: > 90% transcription accuracy

### Business Metrics
- **Invoice Creation Speed**: 50% faster than manual entry
- **User Engagement**: Daily active usage > 70%
- **Error Rate**: < 5% failed operations
- **Memory Accuracy**: > 85% relevant context retrieval

### Technical Metrics
- **API Costs**: < $0.10 per user per day
- **Database Performance**: < 100ms query response
- **Memory Usage**: < 500MB per user session
- **Uptime**: > 99.9% availability

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
