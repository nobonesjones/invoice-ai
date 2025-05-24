export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      business_settings: {
        Row: {
          auto_apply_tax: boolean
          business_address: string | null
          business_email: string | null
          business_logo_url: string | null
          business_name: string | null
          business_phone: string | null
          business_website: string | null
          created_at: string
          currency_code: string | null
          default_tax_rate: number | null
          id: string
          region: string | null
          tax_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_apply_tax?: boolean
          business_address?: string | null
          business_email?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          created_at?: string
          currency_code?: string | null
          default_tax_rate?: number | null
          id?: string
          region?: string | null
          tax_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_apply_tax?: boolean
          business_address?: string | null
          business_email?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          created_at?: string
          currency_code?: string | null
          default_tax_rate?: number | null
          id?: string
          region?: string | null
          tax_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_zip_code: string | null
          state_province_region: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_zip_code?: string | null
          state_province_region?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_zip_code?: string | null
          state_province_region?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      invoices: {
        Row: {
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
          invoice_number: string
          notes: string | null
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
          invoice_number: string
          notes?: string | null
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
          invoice_number?: string
          notes?: string | null
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
          paypal_email?: string | null
          paypal_enabled?: boolean
          stripe_enabled?: boolean
          updated_at?: string | null
          user_id?: string
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
