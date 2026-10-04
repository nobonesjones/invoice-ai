import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL_RECIPIENT") || "support@yourdomain.com"; // Default or env var

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupportTicketRequest {
    name: string;
    email: string;
    subject: string;
    message: string;
    priority?: string;
    user_id?: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { name, email, subject, message, priority = "medium", user_id } = await req.json() as SupportTicketRequest;
        console.log('Received support ticket request:', { name, email, subject, message, user_id });

        // Validate required fields
        if (!name || !email || !message) {
            console.error('Validation failed: Missing required fields');
            return new Response(
                JSON.stringify({ error: 'Name, email, and message are required.' }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400,
                }
            );
        }

        // 1. Insert into Supabase Database
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        console.log('Inserting ticket into database...');

        const { data: ticket, error: dbError } = await supabase
            .from("customer_support_tickets")
            .insert({
                user_id: user_id || null,
                name,
                email,
                subject: subject || "Support Request",
                message,
                priority,
                status: "open",
            })
            .select()
            .single();

        if (dbError) {
            console.error("Database Error:", dbError);
            console.error("Insert attempted with:", { user_id, name, email, subject, message, priority });
            throw new Error(`Failed to save support ticket: ${dbError.message}`);
        }

        // 2. Send Email via Resend
        if (RESEND_API_KEY) {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: "Support App <onboarding@resend.dev>", // Default Resend sender
                    to: [SUPPORT_EMAIL],
                    subject: `New Support Ticket: ${subject}`,
                    html: `
            <h1>New Support Ticket</h1>
            <p><strong>From:</strong> ${name} (${email})</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Priority:</strong> ${priority}</p>
            <hr />
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, "<br>")}</p>
            <hr />
            <p><small>Ticket ID: ${ticket.id}</small></p>
          `,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("Resend Error:", errorData);
                // We don't fail the request if email fails, but we log it.
            }
        } else {
            console.warn("RESEND_API_KEY not set. Email not sent.");
        }

        return new Response(JSON.stringify({ success: true, ticket }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
