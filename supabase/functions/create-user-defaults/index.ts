import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Supabase Edge Function 'create-user-defaults' is ready.");

interface WebhookPayload {
  type: string;
  table: string;
  record: any;
  schema: string;
  old_record: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse the webhook payload
    const payload: WebhookPayload = await req.json();
    console.log("Webhook payload received:", payload);

    // Check if this is a new user signup in auth.users table
    if (payload.type !== "INSERT" || payload.table !== "users" || payload.schema !== "auth") {
      console.log("Not a user signup event, ignoring");
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = payload.record.id;
    const userEmail = payload.record.email;
    
    console.log(`Creating default settings for new user: ${userId} (${userEmail})`);

    // Create default payment_options row
    const defaultPaymentOptions = {
      user_id: userId,
      paypal_enabled: false,
      paypal_email: null,
      stripe_enabled: false,
      bank_transfer_enabled: false,
      bank_details: null,
      invoice_terms_notes: "Payment is due within 30 days of invoice date. Late payments may incur additional fees.",
    };

    const { data: paymentOptionsData, error: paymentError } = await supabase
      .from('payment_options')
      .insert(defaultPaymentOptions)
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment_options:', paymentError);
      throw new Error(`Failed to create payment options: ${paymentError.message}`);
    }

    console.log('Payment options created:', paymentOptionsData);

    // Create default business_settings row
    const defaultBusinessSettings = {
      user_id: userId,
      business_name: null,
      business_address: null,
      business_email: userEmail, // Use the user's signup email as default
      business_phone: null,
      business_website: null,
      currency_code: 'USD', // Default currency
      tax_name: 'Tax',
      default_tax_rate: 0, // 0% default tax rate
      business_logo_url: null,
    };

    const { data: businessSettingsData, error: businessError } = await supabase
      .from('business_settings')
      .insert(defaultBusinessSettings)
      .select()
      .single();

    if (businessError) {
      console.error('Error creating business_settings:', businessError);
      // If payment_options was created but business_settings failed, 
      // we should clean up the payment_options row
      await supabase
        .from('payment_options')
        .delete()
        .eq('user_id', userId);
      
      throw new Error(`Failed to create business settings: ${businessError.message}`);
    }

    console.log('Business settings created:', businessSettingsData);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Default user settings created successfully",
      data: {
        payment_options: paymentOptionsData,
        business_settings: businessSettingsData,
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in create-user-defaults function:', error);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      message: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}); 