export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      blogs: {
        Row: {
          author: string | null
          content: string
          cover_image_url: string | null
          excerpt: string | null
          id: number
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          content: string
          cover_image_url?: string | null
          excerpt?: string | null
          id?: number
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          content?: string
          cover_image_url?: string | null
          excerpt?: string | null
          id?: number
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          auto_apply_tax: boolean
          auto_update_default_design: boolean | null
          business_address: string | null
          business_email: string | null
          business_logo_url: string | null
          business_name: string | null
          business_phone: string | null
          business_website: string | null
          created_at: string
          currency_code: string | null
          default_accent_color: string | null
          default_invoice_design: string | null
          default_tax_rate: number | null
          estimate_terminology: string | null
          id: string
          invoice_reference_format: string | null
          region: string | null
          show_business_address: boolean | null
          show_business_logo: boolean | null
          show_business_name: boolean | null
          show_business_tax_number: boolean | null
          show_notes_section: boolean | null
          tax_name: string | null
          tax_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_apply_tax?: boolean
          auto_update_default_design?: boolean | null
          business_address?: string | null
          business_email?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          created_at?: string
          currency_code?: string | null
          default_accent_color?: string | null
          default_invoice_design?: string | null
          default_tax_rate?: number | null
          estimate_terminology?: string | null
          id?: string
          invoice_reference_format?: string | null
          region?: string | null
          show_business_address?: boolean | null
          show_business_logo?: boolean | null
          show_business_name?: boolean | null
          show_business_tax_number?: boolean | null
          show_notes_section?: boolean | null
          tax_name?: string | null
          tax_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_apply_tax?: boolean
          auto_update_default_design?: boolean | null
          business_address?: string | null
          business_email?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          created_at?: string
          currency_code?: string | null
          default_accent_color?: string | null
          default_invoice_design?: string | null
          default_tax_rate?: number | null
          estimate_terminology?: string | null
          id?: string
          invoice_reference_format?: string | null
          region?: string | null
          show_business_address?: boolean | null
          show_business_logo?: boolean | null
          show_business_name?: boolean | null
          show_business_tax_number?: boolean | null
          show_notes_section?: boolean | null
          tax_name?: string | null
          tax_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_memory_embeddings: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_memory_facts: {
        Row: {
          category: string | null
          confidence_score: number | null
          created_at: string | null
          fact_type: string
          id: string
          is_active: boolean | null
          key: string
          last_used_at: string | null
          source_conversation_id: string | null
          source_type: string | null
          use_count: number | null
          user_id: string
          value: string
        }
        Insert: {
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          fact_type: string
          id?: string
          is_active?: boolean | null
          key: string
          last_used_at?: string | null
          source_conversation_id?: string | null
          source_type?: string | null
          use_count?: number | null
          user_id: string
          value: string
        }
        Update: {
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          fact_type?: string
          id?: string
          is_active?: boolean | null
          key?: string
          last_used_at?: string | null
          source_conversation_id?: string | null
          source_type?: string | null
          use_count?: number | null
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_memory_facts_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_display: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string | null
          id: string
          openai_message_id: string | null
          role: string
          thread_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string | null
          id?: string
          openai_message_id?: string | null
          role: string
          thread_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          openai_message_id?: string | null
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_display_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json | null
          content: string | null
          conversation_id: string
          created_at: string | null
          function_name: string | null
          function_parameters: Json | null
          function_result: Json | null
          id: string
          message_type: string | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          attachments?: Json | null
          content?: string | null
          conversation_id: string
          created_at?: string | null
          function_name?: string | null
          function_parameters?: Json | null
          function_result?: Json | null
          id?: string
          message_type?: string | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          attachments?: Json | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          function_name?: string | null
          function_parameters?: Json | null
          function_result?: Json | null
          id?: string
          message_type?: string | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          openai_thread_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          openai_thread_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          openai_thread_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customer_support_tickets: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string
          subject: string | null
          message: string
          status: string
          priority: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email: string
          subject?: string | null
          message: string
          status?: string
          priority?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string
          subject?: string | null
          message?: string
          status?: string
          priority?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          address_client: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tax_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_client?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_client?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      estimate_activities: {
        Row: {
          activity_data: Json | null
          activity_description: string
          activity_type: string
          created_at: string
          estimate_id: string
          id: string
          ip_address: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          activity_description: string
          activity_type: string
          created_at?: string
          estimate_id: string
          id?: string
          ip_address?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          activity_description?: string
          activity_type?: string
          created_at?: string
          estimate_id?: string
          id?: string
          ip_address?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_activities_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          created_at: string | null
          estimate_id: string
          id: string
          item_description: string | null
          item_image_url: string | null
          item_name: string
          line_item_discount_type: string | null
          line_item_discount_value: number | null
          quantity: number | null
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          estimate_id: string
          id?: string
          item_description?: string | null
          item_image_url?: string | null
          item_name: string
          line_item_discount_type?: string | null
          line_item_discount_value?: number | null
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          estimate_id?: string
          id?: string
          item_description?: string | null
          item_image_url?: string | null
          item_name?: string
          line_item_discount_type?: string | null
          line_item_discount_value?: number | null
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_share_analytics: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          referrer: string | null
          share_id: string
          user_agent: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          referrer?: string | null
          share_id: string
          user_agent?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          referrer?: string | null
          share_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_share_analytics_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "estimate_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_shares: {
        Row: {
          created_at: string | null
          estimate_id: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          share_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          estimate_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          share_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          estimate_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          share_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_shares_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accent_color: string | null
          acceptance_terms: string | null
          bank_account_active: boolean | null
          client_id: string
          converted_to_invoice_id: string | null
          created_at: string | null
          custom_headline: string | null
          discount_type: string | null
          discount_value: number | null
          estimate_date: string | null
          estimate_number: string
          estimate_template: string | null
          id: string
          is_accepted: boolean | null
          notes: string | null
          paypal_active: boolean | null
          po_number: string | null
          status: string | null
          stripe_active: boolean | null
          subtotal_amount: number | null
          tax_percentage: number | null
          total_amount: number | null
          updated_at: string | null
          user_id: string
          valid_until_date: string | null
        }
        Insert: {
          accent_color?: string | null
          acceptance_terms?: string | null
          bank_account_active?: boolean | null
          client_id: string
          converted_to_invoice_id?: string | null
          created_at?: string | null
          custom_headline?: string | null
          discount_type?: string | null
          discount_value?: number | null
          estimate_date?: string | null
          estimate_number: string
          estimate_template?: string | null
          id?: string
          is_accepted?: boolean | null
          notes?: string | null
          paypal_active?: boolean | null
          po_number?: string | null
          status?: string | null
          stripe_active?: boolean | null
          subtotal_amount?: number | null
          tax_percentage?: number | null
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
          valid_until_date?: string | null
        }
        Update: {
          accent_color?: string | null
          acceptance_terms?: string | null
          bank_account_active?: boolean | null
          client_id?: string
          converted_to_invoice_id?: string | null
          created_at?: string | null
          custom_headline?: string | null
          discount_type?: string | null
          discount_value?: number | null
          estimate_date?: string | null
          estimate_number?: string
          estimate_template?: string | null
          id?: string
          is_accepted?: boolean | null
          notes?: string | null
          paypal_active?: boolean | null
          po_number?: string | null
          status?: string | null
          stripe_active?: boolean | null
          subtotal_amount?: number | null
          tax_percentage?: number | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string
          valid_until_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_converted_to_invoice_id_fkey"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      faq: {
        Row: {
          answer: string
          created_at: string | null
          id: number
          question: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: number
          question: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: number
          question?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      invoice_activities: {
        Row: {
          activity_data: Json | null
          activity_description: string
          activity_type: string
          created_at: string | null
          id: string
          invoice_id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          activity_description: string
          activity_type: string
          created_at?: string | null
          id?: string
          invoice_id: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          activity_description?: string
          activity_type?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_activities_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          item_description: string | null
          item_image_url: string | null
          item_name: string
          line_item_discount_type: string | null
          line_item_discount_value: number | null
          quantity: number
          total_price: number
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          item_description?: string | null
          item_image_url?: string | null
          item_name: string
          line_item_discount_type?: string | null
          line_item_discount_value?: number | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          item_description?: string | null
          item_image_url?: string | null
          item_name?: string
          line_item_discount_type?: string | null
          line_item_discount_value?: number | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_share_analytics: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          referrer: string | null
          share_id: string
          user_agent: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          referrer?: string | null
          share_id: string
          user_agent?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          referrer?: string | null
          share_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_share_analytics_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "invoice_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_shares: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          invoice_id: string
          is_active: boolean | null
          pdf_path: string | null
          share_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invoice_id: string
          is_active?: boolean | null
          pdf_path?: string | null
          share_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invoice_id?: string
          is_active?: boolean | null
          pdf_path?: string | null
          share_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_shares_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          accent_color: string | null
          bank_account_active: boolean
          client_id: string
          created_at: string
          custom_headline: string | null
          discount_type: string | null
          discount_value: number
          due_date: string | null
          due_date_option: string | null
          id: string
          invoice_date: string
          invoice_design: string | null
          invoice_number: string
          invoice_tax_label: string | null
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payment_notes: string | null
          paypal_active: boolean
          po_number: string | null
          status: string
          stripe_active: boolean
          subtotal_amount: number
          tax_percentage: number
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          bank_account_active?: boolean
          client_id: string
          created_at?: string
          custom_headline?: string | null
          discount_type?: string | null
          discount_value?: number
          due_date?: string | null
          due_date_option?: string | null
          id?: string
          invoice_date?: string
          invoice_design?: string | null
          invoice_number: string
          invoice_tax_label?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_notes?: string | null
          paypal_active?: boolean
          po_number?: string | null
          status?: string
          stripe_active?: boolean
          subtotal_amount?: number
          tax_percentage?: number
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          bank_account_active?: boolean
          client_id?: string
          created_at?: string
          custom_headline?: string | null
          discount_type?: string | null
          discount_value?: number
          due_date?: string | null
          due_date_option?: string | null
          id?: string
          invoice_date?: string
          invoice_design?: string | null
          invoice_number?: string
          invoice_tax_label?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_notes?: string | null
          paypal_active?: boolean
          po_number?: string | null
          status?: string
          stripe_active?: boolean
          subtotal_amount?: number
          tax_percentage?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_client_id"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_options: {
        Row: {
          bank_details: string | null
          bank_transfer_enabled: boolean
          created_at: string | null
          id: string
          invoice_terms_notes: string | null
          paypal_email: string | null
          paypal_enabled: boolean
          stripe_enabled: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bank_details?: string | null
          bank_transfer_enabled?: boolean
          created_at?: string | null
          id?: string
          invoice_terms_notes?: string | null
          paypal_email?: string | null
          paypal_enabled?: boolean
          stripe_enabled?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bank_details?: string | null
          bank_transfer_enabled?: boolean
          created_at?: string | null
          id?: string
          invoice_terms_notes?: string | null
          paypal_email?: string | null
          paypal_enabled?: boolean
          stripe_enabled?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          business_logo_url: string | null
          created_at: string | null
          free_limit: number | null
          id: string
          industry: string | null
          invoice_count: number | null
          onboarding_completed: boolean | null
          region: string | null
          sent_invoice_count: number | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          business_logo_url?: string | null
          created_at?: string | null
          free_limit?: number | null
          id: string
          industry?: string | null
          invoice_count?: number | null
          onboarding_completed?: boolean | null
          region?: string | null
          sent_invoice_count?: number | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          business_logo_url?: string | null
          created_at?: string | null
          free_limit?: number | null
          id?: string
          industry?: string | null
          invoice_count?: number | null
          onboarding_completed?: boolean | null
          region?: string | null
          sent_invoice_count?: number | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_saved_items: {
        Row: {
          created_at: string
          default_quantity: number
          description: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          image_url: string | null
          item_name: string
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          item_name: string
          price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          item_name?: string
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
