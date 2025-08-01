import { supabase } from '@/config/supabase';
import { ReferenceNumberService } from './referenceNumberService';
import { OpenAIFunction } from '@/services/openaiService';
import { UsageService } from '@/services/usageService';
import { UsageTrackingService } from '@/services/usageTrackingService';
import { DEFAULT_DESIGN_ID } from '@/constants/invoiceDesigns';

// Function definitions for OpenAI
export const INVOICE_FUNCTIONS: OpenAIFunction[] = [
  {
    name: "create_invoice",
    description: "Create a new invoice with client details and line items. If client doesn't exist, they will be created automatically.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Name of the client for this invoice"
        },
        client_email: {
          type: "string",
          description: "Email address of the client (optional)"
        },
        client_phone: {
          type: "string",
          description: "Phone number of the client (optional)"
        },
        client_address: {
          type: "string",
          description: "Address of the client (optional)"
        },
        invoice_date: {
          type: "string",
          format: "date",
          description: "Invoice date (YYYY-MM-DD). If not provided, uses today's date"
        },
        due_date: {
          type: "string",
          format: "date",
          description: "Due date for payment (YYYY-MM-DD). If not provided, calculates based on payment terms"
        },
        payment_terms_days: {
          type: "number",
          default: 30,
          description: "Number of days from invoice date until payment is due (used if due_date not provided)"
        },
        line_items: {
          type: "array",
          description: "Array of items/services being invoiced",
          items: {
            type: "object",
            properties: {
              item_name: {
                type: "string",
                description: "Name of the item/service"
              },
              item_description: {
                type: "string",
                description: "Description of the item/service (optional)"
              },
              quantity: {
                type: "number",
                default: 1,
                description: "Quantity of the item"
              },
              unit_price: {
                type: "number",
                description: "Price per unit"
              }
            },
            required: ["item_name", "unit_price"]
          },
          minItems: 1
        },
        tax_percentage: {
          type: "number",
          default: 0,
          description: "Tax percentage to apply (e.g., 8.5 for 8.5%)"
        },
        discount_type: {
          type: "string",
          enum: ["percentage", "fixed"],
          description: "Type of discount to apply"
        },
        discount_value: {
          type: "number",
          default: 0,
          description: "Discount value (percentage or fixed amount)"
        },
        notes: {
          type: "string",
          description: "Additional notes for the invoice (optional)"
        },
        custom_headline: {
          type: "string",
          description: "Custom headline/title for the invoice (optional)"
        }
      },
      required: ["client_name", "line_items"]
    }
  },
  {
    name: "create_client",
    description: "Create a new client/customer/contact record without creating an invoice. Use this when the user wants to add a new client, customer, contact, or business partner to their database.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the client, customer, or company"
        },
        email: {
          type: "string",
          format: "email",
          description: "Email address of the client/customer (optional)"
        },
        phone: {
          type: "string",
          description: "Phone number of the client/customer (optional)"
        },
        address: {
          type: "string",
          description: "Address of the client/customer (optional)"
        },
        notes: {
          type: "string",
          description: "Additional notes about the client/customer (optional)"
        }
      },
      required: ["name"]
    }
  },
  {
    name: "search_clients",
    description: "Search for existing clients/customers by name or email. Use this before creating invoices to find existing clients.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Client/customer name to search for (partial matches supported)"
        },
        email: {
          type: "string",
          description: "Client email to search for"
        },
        limit: {
          type: "number",
          default: 10,
          description: "Maximum number of results to return"
        }
      }
    }
  },
  {
    name: "update_client",
    description: "Update an existing client's details like name, email, phone, address, tax number, or notes. Use this when user wants to edit or update client information.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Current name of the client to update (used to find the client)"
        },
        client_id: {
          type: "string",
          description: "Client ID if known (alternative to client_name)"
        },
        new_name: {
          type: "string",
          description: "New name for the client (optional)"
        },
        email: {
          type: "string",
          format: "email",
          description: "New email address (optional)"
        },
        phone: {
          type: "string",
          description: "New phone number (optional)"
        },
        address: {
          type: "string",
          description: "New address (optional)"
        },
        tax_number: {
          type: "string",
          description: "New tax number/VAT number/TIN for the client (optional)"
        },
        notes: {
          type: "string",
          description: "New notes about the client (optional)"
        }
      }
    }
  },
  {
    name: "search_invoices",
    description: "Search for invoices by various criteria like client name, status, date range, or amount",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Search by client name (partial match)"
        },
        status: {
          type: "string",
          enum: ["draft", "sent", "paid", "overdue"],
          description: "Filter by invoice status"
        },
        date_from: {
          type: "string",
          format: "date",
          description: "Start date for date range filter (YYYY-MM-DD)"
        },
        date_to: {
          type: "string",
          format: "date",
          description: "End date for date range filter (YYYY-MM-DD)"
        },
        min_amount: {
          type: "number",
          description: "Minimum invoice amount"
        },
        max_amount: {
          type: "number",
          description: "Maximum invoice amount"
        },
        limit: {
          type: "number",
          default: 10,
          description: "Maximum number of results to return"
        }
      }
    }
  },
  {
    name: "get_invoice_by_number",
    description: "Get a specific invoice by its invoice number",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to search for"
        }
      },
      required: ["invoice_number"]
    }
  },
  {
    name: "get_recent_invoices",
    description: "Get the most recent invoices for the user",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          default: 5,
          description: "Number of recent invoices to return"
        },
        status_filter: {
          type: "string",
          enum: ["all", "unpaid", "paid", "overdue"],
          default: "all",
          description: "Filter by payment status"
        }
      }
    }
  },
  {
    name: "get_invoice_summary",
    description: "Get a summary of all invoices including totals and counts",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["this_month", "this_year", "all_time"],
          default: "this_month",
          description: "Time period for the summary"
        }
      }
    }
  },
  {
    name: "get_client_outstanding_amount",
    description: "Get the total outstanding amount for a specific client (unpaid invoices). Use when user asks 'how much does X owe me' or 'what's X's balance'.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Name of the client to check outstanding balance for"
        }
      },
      required: ["client_name"]
    }
  },
  {
    name: "get_business_settings",
    description: "Get the current business settings and profile information for the user",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "update_business_settings",
    description: "Update business profile settings including company name, address, tax rates, and contact information",
    parameters: {
      type: "object",
      properties: {
        business_name: {
          type: "string",
          description: "Name of the business/company"
        },
        business_address: {
          type: "string",
          description: "Business address for invoices"
        },
        business_email: {
          type: "string",
          description: "Business email address"
        },
        business_phone: {
          type: "string",
          description: "Business phone number"
        },
        business_website: {
          type: "string",
          description: "Business website URL"
        },
        currency_code: {
          type: "string",
          description: "Currency code (e.g., USD, EUR, GBP)"
        },
        default_tax_rate: {
          type: "number",
          description: "Default tax rate percentage (e.g., 8.5 for 8.5%)"
        },
        tax_name: {
          type: "string",
          description: "Name for tax on invoices (e.g., 'VAT', 'Sales Tax', 'GST')"
        },
        auto_apply_tax: {
          type: "boolean",
          description: "Whether to automatically apply tax to new invoices"
        },
        region: {
          type: "string",
          description: "Business region/location"
        }
      }
    }
  },
  {
    name: "get_setup_progress",
    description: "Check what parts of the business profile are set up and what still needs configuration",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "set_currency",
    description: "Set the default currency for invoices. Provides suggestions for common currencies.",
    parameters: {
      type: "object",
      properties: {
        currency_code: {
          type: "string",
          description: "Three-letter currency code (e.g., USD, EUR, GBP, CAD, AUD, JPY)"
        }
      },
      required: ["currency_code"]
    }
  },
  {
    name: "set_region",
    description: "Set the business region/location. This helps with tax and legal compliance suggestions.",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Business region or country (e.g., United States, Canada, United Kingdom, Australia, etc.)"
        }
      },
      required: ["region"]
    }
  },
  {
    name: "get_currency_options",
    description: "Get a list of common currency options with their codes and names",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "update_invoice_line_items",
    description: "Add, update, or remove line items from an existing invoice. Use this when user wants to add items to an invoice, modify existing items, or remove items.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to update (e.g., INV-001)"
        },
        action: {
          type: "string",
          enum: ["add", "update", "remove"],
          description: "Whether to add new items, update existing items, or remove items"
        },
        line_items: {
          type: "array",
          description: "Array of line items to add, update, or remove",
          items: {
            type: "object",
            properties: {
              item_id: {
                type: "string",
                description: "ID of existing line item (required for update/remove actions)"
              },
              item_name: {
                type: "string",
                description: "Name of the item/service"
              },
              item_description: {
                type: "string",
                description: "Description of the item/service (optional)"
              },
              quantity: {
                type: "number",
                default: 1,
                description: "Quantity of the item"
              },
              unit_price: {
                type: "number",
                description: "Price per unit"
              }
            },
            required: ["item_name", "unit_price"]
          }
        }
      },
      required: ["invoice_number", "action", "line_items"]
    }
  },
  {
    name: "get_invoice_details",
    description: "Get detailed information about a specific invoice including all line items. Use this to check current invoice contents before making updates.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to get details for (e.g., INV-001)"
        }
      },
      required: ["invoice_number"]
    }
  },
  {
    name: "update_invoice_details",
    description: "Update basic invoice information like invoice number, dates, tax rates, notes, etc. (not for line items - use update_invoice_line_items for that). ⚠️ IMPORTANT: Only change client information if user explicitly requests it - preserve existing client otherwise.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The current invoice number to update"
        },
        new_invoice_number: {
          type: "string",
          description: "New invoice number/reference to set"
        },
        client_name: {
          type: "string",
          description: "⚠️ ONLY use this if user explicitly says to change the client (e.g., 'change client to John'). Do NOT use for general invoice updates."
        },
        client_email: {
          type: "string",
          description: "⚠️ ONLY use this if user explicitly says to change the client email. Do NOT use for general invoice updates."
        },
        invoice_date: {
          type: "string",
          format: "date",
          description: "Update invoice date (YYYY-MM-DD)"
        },
        due_date: {
          type: "string",
          format: "date",
          description: "Update due date (YYYY-MM-DD)"
        },
        tax_percentage: {
          type: "number",
          description: "Update tax percentage"
        },
        discount_type: {
          type: "string",
          enum: ["percentage", "fixed"],
          description: "Update discount type"
        },
        discount_value: {
          type: "number",
          description: "Update discount value"
        },
        notes: {
          type: "string",
          description: "Update invoice notes"
        },
        custom_headline: {
          type: "string",
          description: "Update custom headline"
        }
      },
      required: ["invoice_number"]
    }
  },
  {
    name: "update_invoice_payment_methods",
    description: "Enable or disable payment methods (Stripe, PayPal, Bank Transfer) on a specific invoice. Payment methods can only be enabled if they are configured in the user's payment settings.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to update payment methods for"
        },
        stripe_active: {
          type: "boolean",
          description: "Enable/disable Stripe payments on this invoice"
        },
        paypal_active: {
          type: "boolean",
          description: "Enable/disable PayPal payments on this invoice"
        },
        bank_account_active: {
          type: "boolean",
          description: "Enable/disable bank transfer payments on this invoice"
        }
      },
      required: ["invoice_number"]
    }
  },
  {
    name: "setup_paypal_payments",
    description: "Enable PayPal payments by collecting the PayPal email address and enabling it in user's payment settings. Can optionally enable it on a specific invoice as well.",
    parameters: {
      type: "object",
      properties: {
        paypal_email: {
          type: "string",
          format: "email",
          description: "PayPal email address for receiving payments"
        },
        invoice_number: {
          type: "string",
          description: "Optional: Invoice number to also enable PayPal on after setting up"
        }
      },
      required: ["paypal_email"]
    }
  },
  {
    name: "setup_bank_transfer_payments",
    description: "Enable bank transfer payments by collecting bank account details and enabling it in user's payment settings. Can optionally enable it on a specific invoice as well.",
    parameters: {
      type: "object",
      properties: {
        bank_details: {
          type: "string",
          description: "Bank account details including bank name, account number, sort code/routing number, IBAN, SWIFT/BIC code as needed"
        },
        invoice_number: {
          type: "string",
          description: "Optional: Invoice number to also enable bank transfer on after setting up"
        }
      },
      required: ["bank_details"]
    }
  },
  {
    name: "get_payment_options",
    description: "Get the user's payment method configuration including PayPal email, bank transfer details, and which payment methods are enabled. This is DIFFERENT from business settings - this shows payment integration settings.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "delete_invoice",
    description: "Delete an invoice permanently. This action cannot be undone. Use with caution.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to delete"
        }
      },
      required: ["invoice_number"]
    }
  },
  {
    name: "delete_client",
    description: "Delete a client permanently. This will also delete all associated invoices. This action cannot be undone. Use with extreme caution.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "The name of the client to delete"
        },
        confirm_delete_invoices: {
          type: "boolean",
          description: "Must be true to confirm deletion of client and all their invoices"
        }
      },
      required: ["client_name", "confirm_delete_invoices"]
    }
  },
  {
    name: "duplicate_invoice",
    description: "Create a copy of an existing invoice with a new invoice number. Useful for recurring invoices or similar work. ⚠️ PRESERVES original client unless explicitly told to change it.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to duplicate"
        },
        new_client_name: {
          type: "string",
          description: "⚠️ ONLY use this if user explicitly says to change the client (e.g., 'duplicate for Sarah'). Otherwise, preserve original client."
        },
        new_invoice_date: {
          type: "string",
          format: "date",
          description: "Optional: Set a new date for the duplicated invoice (YYYY-MM-DD)"
        }
      },
      required: ["invoice_number"]
    }
  },
  {
    name: "duplicate_estimate",
    description: "Create a copy of an existing estimate with a new estimate number. Useful for recurring estimates or similar work. ⚠️ PRESERVES original client unless explicitly told to change it.",
    parameters: {
      type: "object",
      properties: {
        estimate_number: {
          type: "string",
          description: "The estimate number to duplicate"
        },
        new_client_name: {
          type: "string",
          description: "⚠️ ONLY use this if user explicitly says to change the client (e.g., 'duplicate for Sarah'). Otherwise, preserve original client."
        },
        new_estimate_date: {
          type: "string",
          format: "date",
          description: "Optional: Set a new date for the duplicated estimate (YYYY-MM-DD)"
        }
      },
      required: ["estimate_number"]
    }
  },
  {
    name: "duplicate_client",
    description: "Create a copy of an existing client with a new name. Useful for similar clients or companies with multiple locations.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "The name of the client to duplicate"
        },
        new_client_name: {
          type: "string",
          description: "The name for the new client copy"
        }
      },
      required: ["client_name", "new_client_name"]
    }
  },
  {
    name: "create_estimate",
    description: "Create a new estimate/quote with client details and line items. If client doesn't exist, they will be created automatically.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Name of the client for this estimate"
        },
        client_email: {
          type: "string",
          description: "Email address of the client (optional)"
        },
        client_phone: {
          type: "string",
          description: "Phone number of the client (optional)"
        },
        client_address: {
          type: "string",
          description: "Address of the client (optional)"
        },
        estimate_date: {
          type: "string",
          format: "date",
          description: "Estimate date (YYYY-MM-DD). If not provided, uses today's date"
        },
        valid_until_date: {
          type: "string",
          format: "date",
          description: "Date until when the estimate is valid (YYYY-MM-DD). If not provided, calculates based on validity period"
        },
        validity_days: {
          type: "number",
          default: 30,
          description: "Number of days from estimate date until estimate expires (used if valid_until_date not provided)"
        },
        line_items: {
          type: "array",
          description: "Array of items/services being estimated",
          items: {
            type: "object",
            properties: {
              item_name: {
                type: "string",
                description: "Name of the item/service"
              },
              item_description: {
                type: "string",
                description: "Description of the item/service (optional)"
              },
              quantity: {
                type: "number",
                default: 1,
                description: "Quantity of the item"
              },
              unit_price: {
                type: "number",
                description: "Price per unit"
              }
            },
            required: ["item_name", "unit_price"]
          },
          minItems: 1
        },
        tax_percentage: {
          type: "number",
          default: 0,
          description: "Tax percentage to apply (e.g., 8.5 for 8.5%)"
        },
        discount_type: {
          type: "string",
          enum: ["percentage", "fixed"],
          description: "Type of discount to apply"
        },
        discount_value: {
          type: "number",
          default: 0,
          description: "Discount value (percentage or fixed amount)"
        },
        notes: {
          type: "string",
          description: "Additional notes for the estimate (optional)"
        },
        custom_headline: {
          type: "string",
          description: "Custom headline/title for the estimate (optional)"
        },
        acceptance_terms: {
          type: "string",
          description: "Terms and conditions for estimate acceptance (optional)"
        }
      },
      required: ["client_name", "line_items"]
    }
  },
  {
    name: "search_estimates",
    description: "Search for estimates by various criteria like client name, status, date range, or amount",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Search by client name (partial match)"
        },
        status: {
          type: "string",
          enum: ["draft", "sent", "accepted", "declined", "expired", "converted", "cancelled"],
          description: "Filter by estimate status"
        },
        date_from: {
          type: "string",
          format: "date",
          description: "Start date for date range filter (YYYY-MM-DD)"
        },
        date_to: {
          type: "string",
          format: "date",
          description: "End date for date range filter (YYYY-MM-DD)"
        },
        min_amount: {
          type: "number",
          description: "Minimum estimate amount"
        },
        max_amount: {
          type: "number",
          description: "Maximum estimate amount"
        },
        limit: {
          type: "number",
          default: 10,
          description: "Maximum number of results to return"
        }
      }
    }
  },
  {
    name: "get_estimate_by_number",
    description: "Get a specific estimate by its estimate number",
    parameters: {
      type: "object",
      properties: {
        estimate_number: {
          type: "string",
          description: "The estimate number to search for"
        }
      },
      required: ["estimate_number"]
    }
  },
  {
    name: "get_recent_estimates",
    description: "Get the most recent estimates for the user",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          default: 5,
          description: "Number of recent estimates to return"
        },
        status_filter: {
          type: "string",
          enum: ["all", "pending", "accepted", "declined", "expired"],
          default: "all",
          description: "Filter by status"
        }
      }
    }
  },
  {
    name: "convert_estimate_to_invoice",
    description: "Convert an existing estimate to an invoice",
    parameters: {
      type: "object",
      properties: {
        estimate_number: {
          type: "string",
          description: "The estimate number to convert"
        },
        estimate_id: {
          type: "string",
          description: "The estimate ID to convert (alternative to estimate_number)"
        },
        invoice_date: {
          type: "string",
          format: "date",
          description: "Invoice date (YYYY-MM-DD). If not provided, uses today's date"
        },
        due_date: {
          type: "string",
          format: "date",
          description: "Due date for payment (YYYY-MM-DD). If not provided, calculates based on payment terms"
        },
        payment_terms_days: {
          type: "number",
          default: 30,
          description: "Number of days from invoice date until payment is due"
        }
      },
      required: ["estimate_number"]
    }
  },
  {
    name: "edit_recent_invoice",
    description: "Edit the most recently created INVOICE in the conversation. This function is optimized to find the most recent invoice even if the exact number doesn't match. Use this function when: 1) You just created an invoice and user wants to edit it, 2) User mentions editing an 'invoice', 3) The document was created as an invoice. Use this ONLY for actual invoices, NOT for estimates. The function will automatically find the most recent invoice if the specified number cannot be found. This allows making changes like adding/removing line items, updating amounts, changing due dates, modifying payment methods, etc.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "Optional: Specific invoice number to edit. If not provided, will edit the most recent invoice from this conversation."
        },
        operation: {
          type: "string",
          enum: ["add_item", "remove_item", "update_item", "update_details", "update_payment_methods", "update_due_date"],
          description: "Type of edit to perform on the invoice"
        },
        line_items_to_add: {
          type: "array",
          description: "New line items to add to the invoice (for add_item operation)",
          items: {
            type: "object",
            properties: {
              item_name: { type: "string" },
              item_description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" }
            },
            required: ["item_name", "quantity", "unit_price"]
          }
        },
        item_name_to_remove: {
          type: "string",
          description: "Name of the item to remove (for remove_item operation)"
        },
        item_updates: {
          type: "object",
          description: "Updates to apply to a specific item (for update_item operation)",
          properties: {
            item_name: { type: "string", description: "Name of item to update" },
            new_quantity: { type: "number" },
            new_unit_price: { type: "number" },
            new_description: { type: "string" }
          }
        },
        due_date: {
          type: "string",
          description: "New due date in YYYY-MM-DD format or relative like '30 days' (for update_due_date operation)"
        },
        payment_methods: {
          type: "object",
          description: "Payment method settings to update (for update_payment_methods operation)",
          properties: {
            paypal_active: { type: "boolean" },
            stripe_active: { type: "boolean" },
            bank_account_active: { type: "boolean" }
          }
        },
        notes: {
          type: "string",
          description: "Updated notes for the invoice (for update_details operation)"
        }
      },
      required: ["operation"]
    }
  },
  {
    name: "edit_recent_estimate",
    description: "ALWAYS call this function when the user wants to edit/modify/change/update an estimate or quote, regardless of numbering format (EST- or INV-). This function will find and edit the most recent estimate. Use this for ANY estimate modifications: adding items, removing items, changing dates, updating details, etc. The user might say 'add an item', 'change the date', 'update the estimate', 'modify the quote' - ALWAYS call this function for estimate edits.",
    parameters: {
      type: "object",
      properties: {
        estimate_number: {
          type: "string",
          description: "Optional: Specific estimate number to edit. If not provided, will edit the most recent estimate from this conversation."
        },
        operation: {
          type: "string",
          enum: ["add_item", "remove_item", "update_item", "update_details", "update_payment_methods", "update_validity"],
          description: "Type of edit to perform on the estimate"
        },
        line_items_to_add: {
          type: "array",
          description: "New line items to add to the estimate (for add_item operation)",
          items: {
            type: "object",
            properties: {
              item_name: { type: "string" },
              item_description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" }
            },
            required: ["item_name", "quantity", "unit_price"]
          }
        },
        item_name_to_remove: {
          type: "string",
          description: "Name of the item to remove (for remove_item operation)"
        },
        item_updates: {
          type: "object",
          description: "Updates to apply to a specific item (for update_item operation)",
          properties: {
            item_name: { type: "string", description: "Name of item to update" },
            new_quantity: { type: "number" },
            new_unit_price: { type: "number" },
            new_description: { type: "string" }
          }
        },
        valid_until_date: {
          type: "string",
          description: "New validity date in YYYY-MM-DD format or relative like '30 days' (for update_validity operation)"
        },
        payment_methods: {
          type: "object",
          description: "Payment method settings to update (for update_payment_methods operation)",
          properties: {
            paypal_active: { type: "boolean" },
            stripe_active: { type: "boolean" },
            bank_account_active: { type: "boolean" }
          }
        },
        notes: {
          type: "string",
          description: "Updated notes for the estimate (for update_details operation)"
        },
        acceptance_terms: {
          type: "string",
          description: "Updated acceptance terms for the estimate (for update_details operation)"
        }
      },
      required: ["operation"]
    }
  },
  {
    name: "check_usage_limits",
    description: "Check if the user can create more invoices/estimates based on their subscription status and current usage. ALWAYS call this before attempting to create any invoice or estimate.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "update_tax_settings",
    description: "Update tax-related settings including tax rate, tax name (VAT/GST/Sales Tax), tax number, and auto-apply tax toggle. Use this when user wants to change tax settings, remove tax, or disable tax on invoices.",
    parameters: {
      type: "object",
      properties: {
        default_tax_rate: {
          type: "number",
          description: "Default tax rate percentage (e.g., 20 for 20%). Set to 0 or null to remove tax."
        },
        tax_name: {
          type: "string",
          description: "Name for tax on invoices (e.g., 'VAT', 'Sales Tax', 'GST', 'None', or custom name)"
        },
        tax_number: {
          type: "string",
          description: "Business tax number/VAT number/GST number/TIN"
        },
        auto_apply_tax: {
          type: "boolean",
          description: "Whether to automatically apply tax to new invoices. Set to false to disable tax by default."
        }
      }
    }
  },
  {
    name: "get_tax_settings_navigation",
    description: "Provide step-by-step instructions on how to navigate to the Tax & Currency settings page in the app. Use this when user asks how to change tax settings manually.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_design_options",
    description: "Get available invoice design templates with detailed descriptions, personality traits, and industry recommendations. Use this when user asks about design options or wants to change invoice appearance.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_color_options",
    description: "Get available accent color options with color psychology, industry associations, and personality traits. Use this when user asks about colors or wants to change invoice colors.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "update_invoice_design",
    description: "Update the design template for a specific invoice or set new business default design. Use when user wants to change invoice appearance, make it more professional, modern, clean, etc.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "Invoice number to update (optional - if not provided, updates business default)"
        },
        design_id: {
          type: "string",
          description: "Design template ID: 'classic', 'modern', 'clean', or 'simple'",
          enum: ["classic", "modern", "clean", "simple"]
        },
        apply_to_defaults: {
          type: "boolean",
          description: "Whether to also update business default design (default: false)"
        },
        reasoning: {
          type: "string",
          description: "Explanation of why this design was chosen (for user feedback)"
        }
      },
      required: ["design_id"]
    }
  },
  {
    name: "update_invoice_color",
    description: "Update the accent color for a specific invoice or set new business default color. Use when user wants to change colors, match brand, or requests specific color personality.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "Invoice number to update (optional - if not provided, updates business default)"
        },
        accent_color: {
          type: "string",
          description: "Hex color code (e.g., '#3B82F6')"
        },
        apply_to_defaults: {
          type: "boolean",
          description: "Whether to also update business default color (default: false)"
        },
        reasoning: {
          type: "string",
          description: "Explanation of why this color was chosen (for user feedback)"
        }
      },
      required: ["accent_color"]
    }
  },
  {
    name: "update_invoice_appearance",
    description: "Update both design and color for a specific invoice. Use when user wants comprehensive appearance changes or mentions both design and color preferences.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "Invoice number to update (optional - if not provided, updates business defaults)"
        },
        design_id: {
          type: "string",
          description: "Design template ID: 'classic', 'modern', 'clean', or 'simple'",
          enum: ["classic", "modern", "clean", "simple"]
        },
        accent_color: {
          type: "string",
          description: "Hex color code (e.g., '#3B82F6')"
        },
        apply_to_defaults: {
          type: "boolean",
          description: "Whether to also update business defaults (default: false)"
        },
        reasoning: {
          type: "string",
          description: "Explanation of the design and color choices (for user feedback)"
        }
      },
      required: []
    }
  }
];

export interface InvoiceSearchParams {
  client_name?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  limit?: number;
}

export interface FunctionResult {
  success: boolean;
  data?: any;
  message: string;
  error?: string;
  attachments?: any[];
}

export class InvoiceFunctionService {
  // Track ongoing invoice creations to prevent duplicates
  private static ongoingCreations = new Map<string, Promise<FunctionResult>>();
  private static readonly CREATION_TIMEOUT = 30000; // 30 seconds

  static async executeFunction(
    functionName: string,
    parameters: any,
    userId: string
  ): Promise<FunctionResult> {
    try {
      console.log(`[AI FUNCTION CALL] ${functionName} called with params:`, parameters);
      console.log(`[AI FUNCTION CALL] User ID: ${userId}`);
      
      switch (functionName) {
        case 'search_invoices':
          return await this.searchInvoices(parameters, userId);
        case 'get_invoice_by_number':
          return await this.getInvoiceByNumber(parameters, userId);
        case 'get_recent_invoices':
          return await this.getRecentInvoices(parameters, userId);
        case 'get_invoice_summary':
          return await this.getInvoiceSummary(parameters, userId);
        case 'create_invoice':
          return await this.createInvoiceWithDeduplication(parameters, userId);
        case 'create_client':
          return await this.createClientWithDeduplication(parameters, userId);
        case 'search_clients':
          return await this.searchClients(parameters, userId);
        case 'get_business_settings':
          return await this.getBusinessSettings(parameters, userId);
        case 'update_business_settings':
          return await this.updateBusinessSettings(parameters, userId);
        case 'get_setup_progress':
          return await this.getSetupProgress(parameters, userId);
        case 'set_currency':
          return await this.setCurrency(parameters, userId);
        case 'set_region':
          return await this.setRegion(parameters, userId);
        case 'get_currency_options':
          return await this.getCurrencyOptions(parameters, userId);
        case 'update_invoice_line_items':
          return await this.updateInvoiceLineItems(parameters, userId);
        case 'get_invoice_details':
          return await this.getInvoiceDetails(parameters, userId);
        case 'update_invoice_details':
          return await this.updateInvoiceDetails(parameters, userId);
        case 'update_client':
          return await this.updateClient(parameters, userId);
        case 'get_client_outstanding_amount':
          return await this.getClientOutstandingAmount(parameters, userId);
        case 'update_invoice_payment_methods':
          return await this.updateInvoicePaymentMethods(parameters, userId);
        case 'setup_paypal_payments':
          return await this.setupPayPalPayments(parameters, userId);
        case 'setup_bank_transfer_payments':
          return await this.setupBankTransferPayments(parameters, userId);
        case 'get_payment_options':
          return await this.getPaymentOptions(parameters, userId);
        case 'delete_invoice':
          return await this.deleteInvoice(parameters, userId);
        case 'delete_client':
          return await this.deleteClient(parameters, userId);
        case 'duplicate_invoice':
          return await this.duplicateInvoice(parameters, userId);
        case 'duplicate_estimate':
          return await this.duplicateEstimate(parameters, userId);
        case 'duplicate_client':
          return await this.duplicateClient(parameters, userId);
        case 'create_estimate':
          return await this.createEstimateWithDeduplication(parameters, userId);
        case 'search_estimates':
          return await this.searchEstimates(parameters, userId);
        case 'get_estimate_by_number':
          return await this.getEstimateByNumber(parameters, userId);
        case 'get_recent_estimates':
          return await this.getRecentEstimates(parameters, userId);
        case 'convert_estimate_to_invoice':
          return await this.convertEstimateToInvoice(parameters, userId);
        case 'edit_recent_invoice':
          console.log('[AI FUNCTION CALL] ✅ EDIT_RECENT_INVOICE function called!');
          return await this.editRecentInvoice(parameters, userId);
        case 'edit_recent_estimate':
          console.log('[AI FUNCTION CALL] ✅ EDIT_RECENT_ESTIMATE function called!');
          return await this.editRecentEstimate(parameters, userId);
        case 'check_usage_limits':
          console.error('🚨🚨🚨 CHECK_USAGE_LIMITS CASE HIT!!! 🚨🚨🚨');
          console.error('🚨 About to call checkUsageLimits with userId:', userId);
          const result = await this.checkUsageLimits(userId);
          console.error('🚨 checkUsageLimits result:', result);
          return result;
        case 'update_tax_settings':
          return await this.updateTaxSettings(parameters, userId);
        case 'get_tax_settings_navigation':
          return await this.getTaxSettingsNavigation(parameters, userId);
        case 'get_design_options':
          return await this.getDesignOptions(parameters, userId);
        case 'get_color_options':
          return await this.getColorOptions(parameters, userId);
        case 'update_invoice_design':
          return await this.updateInvoiceDesign(parameters, userId);
        case 'update_invoice_color':
          return await this.updateInvoiceColor(parameters, userId);
        case 'update_invoice_appearance':
          return await this.updateInvoiceAppearance(parameters, userId);
        default:
          return {
            success: false,
            message: `Unknown function: ${functionName}`,
            error: 'Function not found'
          };
      }
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      return {
        success: false,
        message: 'An error occurred while executing the function',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async searchInvoices(params: InvoiceSearchParams, userId: string): Promise<FunctionResult> {
    let query = supabase
      .from('invoices')
      .select(`
        *,
        clients!inner(name, email),
        line_items:invoice_line_items(*)
      `)
      .eq('user_id', userId);

    // Apply filters
    if (params.client_name) {
      // Use proper join to search client names
      query = query.ilike('clients.name', `%${params.client_name}%`);
    }
    
    if (params.status) {
      // Handle "unpaid" status by filtering for sent and overdue
      if (params.status === 'unpaid') {
        query = query.in('status', ['sent', 'overdue']);
      } else {
        query = query.eq('status', params.status);
      }
    }
    
    if (params.date_from) {
      query = query.gte('created_at', params.date_from);
    }
    
    if (params.date_to) {
      query = query.lte('created_at', params.date_to);
    }
    
    if (params.min_amount) {
      query = query.gte('total_amount', params.min_amount);
    }
    
    if (params.max_amount) {
      query = query.lte('total_amount', params.max_amount);
    }

    const { data: invoices, error } = await query
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (error) {
      throw new Error(`Failed to search invoices: ${error.message}`);
    }

    const resultMessage = invoices?.length 
      ? `Found ${invoices.length} invoice${invoices.length === 1 ? '' : 's'} matching your criteria.`
      : 'No invoices found matching your criteria.';

    return {
      success: true,
      data: invoices || [],
      message: resultMessage
    };
  }

  private static async getInvoiceByNumber(params: { invoice_number: string }, userId: string): Promise<FunctionResult> {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        line_items:invoice_line_items(*)
      `)
      .eq('user_id', userId)
      .eq('invoice_number', params.invoice_number)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          message: `Invoice #${params.invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }
      throw new Error(`Failed to get invoice: ${error.message}`);
    }

    return {
      success: true,
      data: invoice,
      message: `Found invoice #${params.invoice_number} for ${invoice.client_name}.`
    };
  }

  private static async getRecentInvoices(params: { limit?: number; status_filter?: string }, userId: string): Promise<FunctionResult> {
    let query = supabase
      .from('invoices')
      .select(`
        *,
        line_items:invoice_line_items(*)
      `)
      .eq('user_id', userId);

    // Apply status filter
    if (params.status_filter && params.status_filter !== 'all') {
      if (params.status_filter === 'unpaid') {
        query = query.in('status', ['draft', 'sent']);
      } else if (params.status_filter === 'overdue') {
        query = query.eq('status', 'overdue');
      } else {
        query = query.eq('status', params.status_filter);
      }
    }

    const { data: invoices, error } = await query
      .order('created_at', { ascending: false })
      .limit(params.limit || 5);

    if (error) {
      throw new Error(`Failed to get recent invoices: ${error.message}`);
    }

    const statusText = params.status_filter === 'all' ? '' : ` ${params.status_filter}`;
    const resultMessage = invoices?.length 
      ? `Here are your ${invoices.length} most recent${statusText} invoices.`
      : `No${statusText} invoices found.`;

    return {
      success: true,
      data: invoices || [],
      message: resultMessage
    };
  }

  private static async getInvoiceSummary(params: { period?: string }, userId: string): Promise<FunctionResult> {
    let dateFilter = '';
    const period = params.period || 'this_month';

    // Calculate date filter based on period
    const now = new Date();
    switch (period) {
      case 'this_month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = startOfMonth.toISOString();
        break;
      case 'this_year':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateFilter = startOfYear.toISOString();
        break;
      case 'all_time':
      default:
        dateFilter = '';
        break;
    }

    let query = supabase
      .from('invoices')
      .select('status, total_amount')
      .eq('user_id', userId);

    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data: invoices, error } = await query;

    if (error) {
      throw new Error(`Failed to get invoice summary: ${error.message}`);
    }

    // Calculate summary statistics
    const summary = {
      total_invoices: invoices?.length || 0,
      total_amount: 0,
      paid_amount: 0,
      outstanding_amount: 0,
      draft_count: 0,
      sent_count: 0,
      paid_count: 0,
      overdue_count: 0,
      period: period
    };

    invoices?.forEach(invoice => {
      summary.total_amount += invoice.total_amount || 0;
      
      switch (invoice.status) {
        case 'draft':
          summary.draft_count++;
          break;
        case 'sent':
          summary.sent_count++;
          summary.outstanding_amount += invoice.total_amount || 0;
          break;
        case 'paid':
          summary.paid_count++;
          summary.paid_amount += invoice.total_amount || 0;
          break;
        case 'overdue':
          summary.overdue_count++;
          summary.outstanding_amount += invoice.total_amount || 0;
          break;
      }
    });

    const periodText = period === 'all_time' ? 'all time' : period.replace('_', ' ');
    let message = `Invoice summary for ${periodText}:\n`;
    message += `• Total: ${summary.total_invoices} invoices worth $${summary.total_amount.toFixed(2)}\n`;
    message += `• Paid: ${summary.paid_count} invoices ($${summary.paid_amount.toFixed(2)})\n`;
    message += `• Outstanding: ${summary.sent_count + summary.overdue_count} invoices ($${summary.outstanding_amount.toFixed(2)})`;
    
    if (summary.overdue_count > 0) {
      message += `\n• Overdue: ${summary.overdue_count} invoices need attention`;
    }

    return {
      success: true,
      data: summary,
      message: message
    };
  }

  // Wrapper to prevent duplicate invoice creation
  private static async createInvoiceWithDeduplication(params: any, userId: string): Promise<FunctionResult> {
    // Create a unique key for this invoice creation attempt
    const clientName = params.client_name || 'unknown_client';
    const itemsHash = JSON.stringify(params.line_items || []).slice(0, 50);
    const deduplicationKey = `${userId}-${clientName}-${itemsHash}-${Date.now().toString().slice(-6)}`;
    
    console.log(`[AI Invoice Create] Deduplication key: ${deduplicationKey}`);
    
    // Check if there's already an ongoing creation for this user
    const ongoingUserCreations = Array.from(this.ongoingCreations.keys()).filter(key => key.startsWith(userId));
    
    if (ongoingUserCreations.length > 0) {
      console.log(`[AI Invoice Create] Found ${ongoingUserCreations.length} ongoing creation(s) for user ${userId}`);
      
      // Wait a short time and check if the creation is still ongoing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const stillOngoing = Array.from(this.ongoingCreations.keys()).filter(key => key.startsWith(userId));
      if (stillOngoing.length > 0) {
        console.log(`[AI Invoice Create] Blocking duplicate creation attempt for user ${userId}`);
        return {
          success: false,
          message: "I'm already creating an invoice for you. Please wait a moment for it to complete.",
          error: 'Duplicate creation blocked'
        };
      }
    }
    
    // Create the invoice creation promise
    const creationPromise = this.createInvoice(params, userId);
    
    // Store it in the map
    this.ongoingCreations.set(deduplicationKey, creationPromise);
    
    // Set up cleanup after timeout
    const timeoutHandle = setTimeout(() => {
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Invoice Create] Cleaned up timed-out creation: ${deduplicationKey}`);
    }, this.CREATION_TIMEOUT);
    
    try {
      // Wait for the creation to complete
      const result = await creationPromise;
      
      // Clean up immediately on completion
      clearTimeout(timeoutHandle);
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Invoice Create] Cleaned up completed creation: ${deduplicationKey}`);
      
      return result;
    } catch (error) {
      // Clean up on error
      clearTimeout(timeoutHandle);
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Invoice Create] Cleaned up failed creation: ${deduplicationKey}`);
      throw error;
    }
  }

  private static async createInvoice(params: any, userId: string): Promise<FunctionResult> {
    try {
      // Check usage limit for free plan users
      console.log('[AI Invoice Create] Checking usage limits...');
      
      // First check if user is subscribed
      console.error('🔄 CREATE INVOICE - CHECKING SUBSCRIPTION STATUS 🔄');
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      
      console.error('🔄 CREATE INVOICE - PROFILE RESULT:', profile);
      const isSubscribed = profile?.subscription_tier && ['premium', 'grandfathered'].includes(profile.subscription_tier);
      console.error('🔄 CREATE INVOICE - IS SUBSCRIBED?', isSubscribed);
      
      // Only check limits for free users
      if (!isSubscribed) {
        console.error('❌ CREATE INVOICE - USER NOT SUBSCRIBED - CHECKING LIMITS ❌');
        const usageStats = await UsageTrackingService.getInstance().getUserUsageStats(userId);
        const totalItems = (usageStats.invoicesCreated || 0) + (usageStats.estimatesCreated || 0);
        console.error('❌ CREATE INVOICE - USAGE STATS:', { totalItems, limit: 3 });
        
        if (totalItems >= 3) {
          console.log('[AI Invoice Create] User has reached free plan limit');
          console.error('❌ CREATE INVOICE - LIMIT REACHED - BLOCKING CREATION ❌');
          return {
            success: false,
            message: "I notice you've reached your free plan limit of 3 items. To continue creating invoices and estimates, you can upgrade to premium by going to the Settings tab and clicking the Upgrade button at the top. Once subscribed, you'll have unlimited access!",
            error: 'Free plan limit reached'
          };
        }
      } else {
        console.error('✅ CREATE INVOICE - USER IS SUBSCRIBED - PROCEEDING ✅');
      }
      
      console.log('[AI Invoice Create] Creating invoice...');

      // Step 0: Get user's business settings for default tax rate, design, and color
      let defaultTaxRate = 0;
      let businessCurrency = 'USD';
      let businessCurrencySymbol = '$';
      let defaultDesign = 'classic';
      let defaultAccentColor = '#14B8A6';
      
      // Step 0.1: Get user's payment settings to determine which payment methods should be enabled
      let paypalEnabled = false;
      let stripeEnabled = false;
      let bankTransferEnabled = false;
      
      try {
        const { data: paymentOptions } = await supabase
          .from('payment_options')
          .select('paypal_enabled, stripe_enabled, bank_transfer_enabled')
          .eq('user_id', userId)
          .single();
          
        if (paymentOptions) {
          paypalEnabled = paymentOptions.paypal_enabled || false;
          stripeEnabled = paymentOptions.stripe_enabled || false;
          bankTransferEnabled = paymentOptions.bank_transfer_enabled || false;
          console.log('[AI Invoice Create] Payment settings:', {
            paypal: paypalEnabled,
            stripe: stripeEnabled,
            bankTransfer: bankTransferEnabled
          });
        } else {
          console.log('[AI Invoice Create] No payment options configured - all payment methods disabled');
        }
      } catch (paymentError) {
        console.log('[AI Invoice Create] Error loading payment options (will disable all):', paymentError);
      }
      
      try {
        const { data: businessSettings } = await supabase
          .from('business_settings')
          .select('default_tax_rate, auto_apply_tax, currency_code, default_invoice_design, default_accent_color, show_business_logo, show_business_name, show_business_address, show_business_tax_number, show_notes_section')
          .eq('user_id', userId)
          .single();
          
        if (businessSettings) {
          console.log('[AI Invoice Create] Loaded business settings:', businessSettings);
          if (businessSettings.auto_apply_tax && businessSettings.default_tax_rate) {
            defaultTaxRate = businessSettings.default_tax_rate;
            console.log('[AI Invoice Create] Applying default tax rate:', defaultTaxRate, '%');
          }
          if (businessSettings.currency_code) {
            businessCurrency = businessSettings.currency_code;
            businessCurrencySymbol = this.getCurrencySymbol(businessSettings.currency_code);
            console.log('[AI Invoice Create] Using business currency:', businessCurrency, businessCurrencySymbol);
          }
          if (businessSettings.default_invoice_design) {
            defaultDesign = businessSettings.default_invoice_design;
            console.log('[AI Invoice Create] Using default design:', defaultDesign);
          }
          if (businessSettings.default_accent_color) {
            defaultAccentColor = businessSettings.default_accent_color;
            console.log('[AI Invoice Create] Using default accent color:', defaultAccentColor);
          }
          
          // Log display settings for reference
          console.log('[AI Invoice Create] Display settings:', {
            show_business_logo: businessSettings.show_business_logo,
            show_business_name: businessSettings.show_business_name,
            show_business_address: businessSettings.show_business_address,
            show_business_tax_number: businessSettings.show_business_tax_number,
            show_notes_section: businessSettings.show_notes_section
          });
        }
      } catch (settingsError) {
        console.log('[AI Invoice Create] No business settings found, using defaults');
      }

      // Use default tax rate if no tax percentage specified
      const taxPercentage = params.tax_percentage !== undefined ? params.tax_percentage : defaultTaxRate;

      // Step 1: Find or create client with improved search
      let clientId: string;
      let existingClient = null;

      // First, try to find by email if provided
      if (params.client_email) {
        const { data: emailClient } = await supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', userId)
          .eq('email', params.client_email)
          .single();
        existingClient = emailClient;
      }
      
      // If not found by email, try multiple name matching strategies
      if (!existingClient) {
        const clientName = params.client_name.toLowerCase().trim();
        
        // Strategy 1: Exact match (case insensitive)
        const { data: exactMatch } = await supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', userId)
          .ilike('name', clientName)
          .single();
        
        if (exactMatch) {
          existingClient = exactMatch;
        } else {
          // Strategy 2: Partial match - check if client name contains the search term or vice versa
          const { data: partialMatches } = await supabase
            .from('clients')
            .select('id, name, email')
            .eq('user_id', userId);
          
          if (partialMatches) {
            // Find the best match
            const bestMatch = partialMatches.find(client => {
              const dbName = client.name.toLowerCase();
              const searchName = clientName;
              
              // Check if either name contains the other (ignoring common suffixes/prefixes)
              return dbName.includes(searchName) || 
                     searchName.includes(dbName) ||
                     this.normalizeClientName(dbName) === this.normalizeClientName(searchName);
            });
            
            if (bestMatch) {
              existingClient = bestMatch;
              console.log(`[Invoice Create] Found partial match: "${params.client_name}" matched with "${bestMatch.name}"`);
            }
          }
        }
      }

      if (existingClient) {
        clientId = existingClient.id;
        console.log(`[Invoice Create] Using existing client: ${existingClient.name} (${existingClient.email})`);
      } else {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            user_id: userId,
            name: params.client_name,
            email: params.client_email || null,
            phone: params.client_phone || null,
            address_client: params.client_address || null
          })
          .select('id, name, email')
          .single();

        if (clientError) {
          throw new Error(`Failed to create client: ${clientError.message}`);
        }

        clientId = newClient.id;
        console.log(`[Invoice Create] Created new client: ${newClient.name} (${newClient.email})`);
      }

      // Step 2: Generate unique invoice number
      const invoiceNumber = await ReferenceNumberService.generateNextReference(userId, 'invoice');

      // Step 3: Calculate dates
      const invoiceDate = params.invoice_date || new Date().toISOString().split('T')[0];
      let dueDate = params.due_date;
      
      if (!dueDate && params.payment_terms_days) {
        const invoiceDateObj = new Date(invoiceDate);
        invoiceDateObj.setDate(invoiceDateObj.getDate() + (params.payment_terms_days || 30));
        dueDate = invoiceDateObj.toISOString().split('T')[0];
      }

      // Step 4: Calculate line item totals
      const lineItems = params.line_items.map((item: any) => ({
        ...item,
        quantity: item.quantity || 1,
        total_price: (item.quantity || 1) * item.unit_price
      }));

      const subtotalAmount = lineItems.reduce((sum: number, item: any) => sum + item.total_price, 0);

      // Step 5: Calculate discounts and taxes
      let discountAmount = 0;
      if (params.discount_value > 0) {
        if (params.discount_type === 'percentage') {
          discountAmount = subtotalAmount * (params.discount_value / 100);
        } else {
          discountAmount = params.discount_value;
        }
      }

      const discountedAmount = subtotalAmount - discountAmount;
      const taxAmount = discountedAmount * ((taxPercentage || 0) / 100);
      const totalAmount = discountedAmount + taxAmount;

      // Step 6: Create invoice with user's enabled payment methods
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: userId,
          client_id: clientId,
          invoice_number: invoiceNumber,
          status: 'draft',
          invoice_date: invoiceDate,
          due_date: dueDate,
          custom_headline: params.custom_headline || null,
          subtotal_amount: subtotalAmount,
          discount_type: params.discount_type || null,
          discount_value: params.discount_value || 0,
          tax_percentage: taxPercentage || 0,
          total_amount: totalAmount,
          notes: params.notes || null,
          invoice_design: defaultDesign,
          accent_color: defaultAccentColor,
          paypal_active: paypalEnabled,
          stripe_active: stripeEnabled,
          bank_account_active: bankTransferEnabled
        })
        .select('*')
        .single();

      if (invoiceError) {
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      // Step 7: Create line items
      const lineItemsToInsert = lineItems.map((item: any) => ({
        invoice_id: invoice.id,
        user_id: userId,
        item_name: item.item_name,
        item_description: item.item_description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      }));

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) {
        // If line items fail, clean up the invoice
        await supabase.from('invoices').delete().eq('id', invoice.id);
        throw new Error(`Failed to create line items: ${lineItemsError.message}`);
      }

      // Step 8: Return success with invoice details
      const successMessage = `Great! I've successfully created invoice #${invoiceNumber} for ${params.client_name}.

The invoice includes:
${lineItems.map((item: any, index: number) => 
  `• ${item.item_name}${item.item_description ? ` (${item.item_description})` : ''} - $${item.unit_price}${item.quantity > 1 ? ` x ${item.quantity} = $${item.total_price}` : ''}`
).join('\n')}

Total: $${totalAmount.toFixed(2)}${invoice.due_date ? ` • Due: ${new Date(invoice.due_date).toLocaleDateString()}` : ''}

I've applied your default design settings:
• Design: ${defaultDesign}
• Accent Color: ${defaultAccentColor}

Would you like me to help you send this invoice or make any changes?`;

      return {
        success: true,
        data: {
          invoice: {
            ...invoice,
            client_name: params.client_name,
            client_email: params.client_email
          },
          client_id: clientId,
          line_items: lineItems,
          calculations: {
            subtotal: subtotalAmount,
            discount: discountAmount,
            tax: taxAmount,
            total: totalAmount
          }
        },
        message: successMessage
      };

    } catch (error) {
      console.error('[Invoice Create] Error:', error);
      return {
        success: false,
        message: `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async generateInvoiceNumber(userId: string): Promise<string> {
    // Get the latest invoice number for this user
    const { data: latestInvoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    
    if (latestInvoice?.invoice_number) {
      // Extract number from invoice number (assumes format like "INV-001", "INV-002", etc.)
      const match = latestInvoice.invoice_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    // Format with leading zeros (e.g., "INV-001", "INV-002")
    return `INV-${nextNumber.toString().padStart(3, '0')}`;
  }

  private static normalizeClientName(name: string): string {
    // Remove common business suffixes and normalize for better matching
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+(corp|corporation|inc|incorporated|llc|ltd|limited|co|company|sales|group|enterprises|solutions|services|consulting)\.?$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static async findOrCreateClient(params: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  }, userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let existingClient = null;

      // First, try to find by email if provided
      if (params.email) {
        const { data: emailClient } = await supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', userId)
          .eq('email', params.email)
          .single();
        existingClient = emailClient;
      }
      
      // If not found by email, try multiple name matching strategies
      if (!existingClient) {
        const clientName = params.name.toLowerCase().trim();
        
        // Strategy 1: Exact match (case insensitive)
        const { data: exactMatch } = await supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', userId)
          .ilike('name', clientName)
          .single();
        
        if (exactMatch) {
          existingClient = exactMatch;
        } else {
          // Strategy 2: Partial match - check if client name contains the search term or vice versa
          const { data: partialMatches } = await supabase
            .from('clients')
            .select('id, name, email')
            .eq('user_id', userId);
          
          if (partialMatches) {
            // Find the best match
            const bestMatch = partialMatches.find(client => {
              const dbName = client.name.toLowerCase();
              const searchName = clientName;
              
              // Check if either name contains the other (ignoring common suffixes/prefixes)
              return dbName.includes(searchName) || 
                     searchName.includes(dbName) ||
                     this.normalizeClientName(dbName) === this.normalizeClientName(searchName);
            });
            
            if (bestMatch) {
              existingClient = bestMatch;
              console.log(`[Find/Create Client] Found partial match: "${params.name}" matched with "${bestMatch.name}"`);
            }
          }
        }
      }

      if (existingClient) {
        console.log(`[Find/Create Client] Using existing client: ${existingClient.name} (${existingClient.email})`);
        return { success: true, data: existingClient };
      } else {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            user_id: userId,
            name: params.name,
            email: params.email || null,
            phone: params.phone || null,
            address_client: params.address || null
          })
          .select('id, name, email')
          .single();

        if (clientError) {
          throw new Error(`Failed to create client: ${clientError.message}`);
        }

        console.log(`[Find/Create Client] Created new client: ${newClient.name} (${newClient.email})`);
        return { success: true, data: newClient };
      }
    } catch (error) {
      console.error('[Find/Create Client] Error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Currency symbol mapping function
  private static getCurrencySymbol(code: string): string {
    const mapping: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      CAD: 'CA$',
      AUD: 'A$',
      NZD: 'NZ$',
      CHF: 'CHF',
      SEK: 'kr',
      DKK: 'kr',
      NOK: 'kr',
      BGN: 'лв',
      CZK: 'Kč',
      HUF: 'Ft',
      PLN: 'zł',
      RON: 'lei',
      AED: 'د.إ'
    };
    if (!code) return '$';
    const normalized = code.split(' ')[0]; // Handle "GBP - British Pound" format
    return mapping[normalized] || '$';
  }

  // Wrapper to prevent duplicate client creation
  private static async createClientWithDeduplication(params: any, userId: string): Promise<FunctionResult> {
    // Create a unique key for this client creation attempt
    const clientName = (params.name || 'unknown_client').toLowerCase().trim();
    const clientEmail = (params.email || '').toLowerCase().trim();
    const deduplicationKey = `${userId}-client-${clientName}-${clientEmail}-${Date.now().toString().slice(-6)}`;
    
    console.log(`[AI Client Create] Deduplication key: ${deduplicationKey}`);
    
    // Check if there's already an ongoing client creation for this user
    const ongoingUserCreations = Array.from(this.ongoingCreations.keys()).filter(key => 
      key.startsWith(userId) && key.includes('-client-')
    );
    
    if (ongoingUserCreations.length > 0) {
      console.log(`[AI Client Create] Found ${ongoingUserCreations.length} ongoing client creation(s) for user ${userId}`);
      
      // Wait a short time and check if the creation is still ongoing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const stillOngoing = Array.from(this.ongoingCreations.keys()).filter(key => 
        key.startsWith(userId) && key.includes('-client-')
      );
      if (stillOngoing.length > 0) {
        console.log(`[AI Client Create] Blocking duplicate client creation attempt for user ${userId}`);
        return {
          success: false,
          message: "I'm already creating a client for you. Please wait a moment for it to complete.",
          error: 'Duplicate client creation blocked'
        };
      }
    }
    
    // Create the client creation promise
    const creationPromise = this.createClient(params, userId);
    
    // Store it in the map
    this.ongoingCreations.set(deduplicationKey, creationPromise);
    
    // Set up cleanup after timeout
    const timeoutHandle = setTimeout(() => {
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Client Create] Cleaned up timed-out creation: ${deduplicationKey}`);
    }, this.CREATION_TIMEOUT);
    
    try {
      // Wait for the creation to complete
      const result = await creationPromise;
      
      // Clean up immediately on completion
      clearTimeout(timeoutHandle);
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Client Create] Cleaned up completed creation: ${deduplicationKey}`);
      
      return result;
    } catch (error) {
      // Clean up on error
      clearTimeout(timeoutHandle);
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Client Create] Cleaned up failed creation: ${deduplicationKey}`);
      throw error;
    }
  }

  private static async createClient(params: any, userId: string): Promise<FunctionResult> {
    try {
      // Validate required parameters
      if (!params.name) {
        return {
          success: false,
          message: 'Client name is required.',
          error: 'Missing required parameter: name'
        };
      }

      // Check if client already exists by name (and email if provided)
      let existingClientQuery = supabase
        .from('clients')
        .select('id, name, email')
        .eq('user_id', userId)
        .ilike('name', params.name);

      if (params.email) {
        existingClientQuery = existingClientQuery.eq('email', params.email);
      }

      const { data: existingClient } = await existingClientQuery.single();

      if (existingClient) {
        return {
          success: false,
          message: `A client named "${params.name}"${params.email ? ` with email ${params.email}` : ''} already exists.`,
          error: 'Client already exists'
        };
      }

      // Create new client
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: userId,
          name: params.name,
          email: params.email || null,
          phone: params.phone || null,
          address_client: params.address || null,
          notes: params.notes || null
        })
        .select('id, name, email, phone, address_client, notes')
        .single();

      if (clientError) {
        throw new Error(`Failed to create client: ${clientError.message}`);
      }

      // Build success message based on new workflow
      const baseMessage = `Great! I added ${params.name} as a new client.`;
      
      // Determine what details are missing and could be added
      const missingDetails = [];
      if (!params.email) missingDetails.push("Email");
      if (!params.phone) missingDetails.push("Phone number");  
      if (!params.address) missingDetails.push("Address");
      
      let successMessage = baseMessage;
      if (missingDetails.length > 0) {
        successMessage += `\n\nWould you like to add any more details?\n${missingDetails.map(detail => `• ${detail}?`).join('\n')}`;
      }

      return {
        success: true,
        data: {
          client: newClient,
          type: 'client'
        },
        message: successMessage
      };

    } catch (error) {
      console.error('Error creating client:', error);
      return {
        success: false,
        message: 'Failed to create client. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async searchClients(params: { name?: string; email?: string; limit?: number }, userId: string): Promise<FunctionResult> {
    let query = supabase
      .from('clients')
      .select('id, name, email, phone, address_client, notes, created_at, updated_at')
      .eq('user_id', userId);

    if (params.name) {
      query = query.ilike('name', `%${params.name}%`);
    }
    
    if (params.email) {
      query = query.eq('email', params.email);
    }

    const { data: clients, error } = await query
      .order('name', { ascending: true })
      .limit(params.limit || 10);

    if (error) {
      throw new Error(`Failed to search clients: ${error.message}`);
    }

    let resultMessage = '';
    let resultData = null;

    if (clients && clients.length > 0) {
      if (clients.length === 1) {
        resultMessage = `Found ${clients[0].name}${clients[0].email ? ` (${clients[0].email})` : ''}.`;
        resultData = {
          client: clients[0],
          type: 'client'
        };
      } else {
        resultMessage = `Found ${clients.length} clients matching your criteria:
${clients.map(client => `• ${client.name}${client.email ? ` (${client.email})` : ''}`).join('\n')}`;
        resultData = {
          clients: clients,
          type: 'client_list'
        };
      }
    } else {
      resultMessage = 'No clients found matching your criteria.';
      resultData = null;
    }

    return {
      success: true,
      data: resultData,
      message: resultMessage
    };
  }

  private static async getBusinessSettings(params: {}, userId: string): Promise<FunctionResult> {
    try {
      const { data: businessSettings, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to get business settings: ${error.message}`);
      }

      if (!businessSettings) {
        return {
          success: true,
          data: null,
          message: `I'd love to help you get your business profile set up! 😊 

I can help you configure things like your business name, address, tax settings, and more. This will make creating invoices much smoother.

What would you like to start with? I could help you set up:
• Your business information
• Tax settings 
• Currency preferences

Just let me know what sounds good to you!`
        };
      }

      const setupStatus = this.analyzeSetupStatus(businessSettings);
      
      let message = `Here are your current business settings:

• Business Name: ${businessSettings.business_name || 'Not set'}
• Address: ${businessSettings.business_address || 'Not set'}
• Email: ${businessSettings.business_email || 'Not set'}
• Phone: ${businessSettings.business_phone || 'Not set'}
• Website: ${businessSettings.business_website || 'Not set'}
• Currency: ${businessSettings.currency_code || 'Not set'}
• Tax Rate: ${businessSettings.default_tax_rate || 'Not set'}%
• Tax Name: ${businessSettings.tax_name || 'Not set'}
• Auto Apply Tax: ${businessSettings.auto_apply_tax ? 'Yes' : 'No'}
• Region: ${businessSettings.region || 'Not set'}`;

      if (setupStatus.incomplete.length > 0) {
        message += `\n\nIncomplete settings: ${setupStatus.incomplete.join(', ')}`;
        message += `\n\nWould you like me to help you complete these settings?`;
      }

      return {
        success: true,
        data: businessSettings,
        message: message
      };

    } catch (error) {
      console.error('Error getting business settings:', error);
      return {
        success: false,
        message: 'Failed to retrieve business settings. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static analyzeSetupStatus(settings: any): { complete: string[]; incomplete: string[] } {
    const complete: string[] = [];
    const incomplete: string[] = [];

    if (settings.business_name) complete.push('Business name');
    else incomplete.push('Business name');

    if (settings.business_address) complete.push('Business address');
    else incomplete.push('Business address');

    if (settings.business_email) complete.push('Business email');
    else incomplete.push('Business email');

    if (settings.currency_code) complete.push('Currency');
    else incomplete.push('Currency');

    if (settings.default_tax_rate) complete.push('Default tax rate');
    else incomplete.push('Default tax rate');

    if (settings.tax_name) complete.push('Tax name');
    else incomplete.push('Tax name');

    if (settings.region) complete.push('Region');
    else incomplete.push('Region');

    return { complete: complete, incomplete: incomplete };
  }

  private static async updateBusinessSettings(params: any, userId: string): Promise<FunctionResult> {
    try {
      // Check if business settings already exist
      const { data: existingSettings } = await supabase
        .from('business_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      const updateData: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      // Only update fields that are provided
      if (params.business_name !== undefined) updateData.business_name = params.business_name;
      if (params.business_address !== undefined) updateData.business_address = params.business_address;
      if (params.business_email !== undefined) updateData.business_email = params.business_email;
      if (params.business_phone !== undefined) updateData.business_phone = params.business_phone;
      if (params.business_website !== undefined) updateData.business_website = params.business_website;
      if (params.currency_code !== undefined) updateData.currency_code = params.currency_code;
      if (params.default_tax_rate !== undefined) updateData.default_tax_rate = params.default_tax_rate;
      if (params.tax_name !== undefined) updateData.tax_name = params.tax_name;
      if (params.auto_apply_tax !== undefined) updateData.auto_apply_tax = params.auto_apply_tax;
      if (params.region !== undefined) updateData.region = params.region;

      let result;
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('business_settings')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Create new settings
        updateData.created_at = new Date().toISOString();
        result = await supabase
          .from('business_settings')
          .insert(updateData)
          .select()
          .single();
      }

      if (result.error) {
        throw new Error(`Failed to update business settings: ${result.error.message}`);
      }

      // Build success message showing what was updated
      const updatedFields = Object.keys(params).map(key => {
        switch (key) {
          case 'business_name': return 'Business name';
          case 'business_address': return 'Business address';
          case 'business_email': return 'Business email';
          case 'business_phone': return 'Business phone';
          case 'business_website': return 'Business website';
          case 'currency_code': return 'Currency';
          case 'default_tax_rate': return 'Default tax rate';
          case 'tax_name': return 'Tax label';
          case 'auto_apply_tax': return 'Auto apply tax';
          case 'region': return 'Region';
          default: return key;
        }
      });

      const message = `Great! I've updated your business settings:

${updatedFields.map(field => `✓ ${field}`).join('\n')}

Your invoice settings are now configured and will be applied to all new invoices. Is there anything else you'd like me to help you set up?`;

      return {
        success: true,
        data: result.data,
        message: message
      };

    } catch (error) {
      console.error('Error updating business settings:', error);
      return {
        success: false,
        message: 'Failed to update business settings. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getSetupProgress(params: {}, userId: string): Promise<FunctionResult> {
    try {
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      const setupChecklist = {
        business_info: {
          name: 'Business Information',
          items: [
            { key: 'business_name', label: 'Business Name', completed: !!businessSettings?.business_name },
            { key: 'business_address', label: 'Business Address', completed: !!businessSettings?.business_address },
            { key: 'business_email', label: 'Business Email', completed: !!businessSettings?.business_email },
            { key: 'business_phone', label: 'Business Phone', completed: !!businessSettings?.business_phone },
            { key: 'business_website', label: 'Business Website', completed: !!businessSettings?.business_website }
          ]
        },
        financial_settings: {
          name: 'Financial Settings',
          items: [
            { key: 'currency_code', label: 'Currency', completed: !!businessSettings?.currency_code },
            { key: 'default_tax_rate', label: 'Tax Rate', completed: !!businessSettings?.default_tax_rate },
            { key: 'tax_name', label: 'Tax Name (VAT/Sales Tax)', completed: !!businessSettings?.tax_name },
            { key: 'auto_apply_tax', label: 'Auto Apply Tax', completed: businessSettings?.auto_apply_tax !== undefined },
            { key: 'region', label: 'Business Region', completed: !!businessSettings?.region }
          ]
        }
      };

      // Calculate completion percentages
      let totalItems = 0;
      let completedItems = 0;
      let message = 'Here\'s your business setup progress:\n\n';

      Object.values(setupChecklist).forEach(category => {
        const categoryCompleted = category.items.filter(item => item.completed).length;
        const categoryTotal = category.items.length;
        totalItems += categoryTotal;
        completedItems += categoryCompleted;

        message += `**${category.name}** (${categoryCompleted}/${categoryTotal})\n`;
        category.items.forEach(item => {
          message += `${item.completed ? '✅' : '❌'} ${item.label}\n`;
        });
        message += '\n';
      });

      const overallPercentage = Math.round((completedItems / totalItems) * 100);
      message = `Overall Progress: ${overallPercentage}% Complete (${completedItems}/${totalItems})\n\n` + message;

      // Provide next steps
      const incompleteItems = Object.values(setupChecklist)
        .flatMap(category => category.items)
        .filter(item => !item.completed);

      if (incompleteItems.length > 0) {
        message += `**Next Steps:**\n`;
        message += `To complete your setup, I can help you configure:\n`;
        incompleteItems.slice(0, 3).forEach(item => {
          message += `• ${item.label}\n`;
        });
        
        if (incompleteItems.length > 3) {
          message += `• ...and ${incompleteItems.length - 3} more\n`;
        }
        
        message += `\nJust ask me to "set up my business name" or "configure tax settings" and I'll guide you through it!`;
      } else {
        message += `🎉 **Congratulations!** Your business profile is fully configured and ready for invoicing!`;
      }

      return {
        success: true,
        data: {
          checklist: setupChecklist,
          overall_percentage: overallPercentage,
          completed_items: completedItems,
          total_items: totalItems,
          incomplete_items: incompleteItems
        },
        message: message
      };

    } catch (error) {
      console.error('Error getting setup progress:', error);
      return {
        success: false,
        message: 'Failed to retrieve setup progress. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async setCurrency(params: { currency_code: string }, userId: string): Promise<FunctionResult> {
    try {
      // Validate currency code
      const currencyCode = params.currency_code.toUpperCase();
      if (!currencyCode || currencyCode.length !== 3) {
        return {
          success: false,
          message: 'Invalid currency code. Please provide a three-letter currency code like USD, EUR, or GBP.',
          error: 'Invalid currency code'
        };
      }

      // Check if business settings exist, create if not
      const { data: existingSettings } = await supabase
        .from('business_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      let result;
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('business_settings')
          .update({ 
            currency_code: currencyCode,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Create new settings
        result = await supabase
          .from('business_settings')
          .insert({
            user_id: userId,
            currency_code: currencyCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (result.error) {
        throw new Error(`Failed to update currency: ${result.error.message}`);
      }

      const successMessage = `Perfect! I've set your default currency to ${currencyCode}. 💰

All your new invoices will now use this currency. Is there anything else you'd like me to help you set up?`;

      return {
        success: true,
        data: result.data,
        message: successMessage
      };

    } catch (error) {
      console.error('Error setting currency:', error);
      return {
        success: false,
        message: 'Failed to set currency. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async setRegion(params: { region: string }, userId: string): Promise<FunctionResult> {
    try {
      // Validate region
      if (!params.region || params.region.trim() === '') {
        return {
          success: false,
          message: 'Region is required. Please provide your business location (like "United States" or "Canada").',
          error: 'Missing required parameter: region'
        };
      }

      const region = params.region.trim();

      // Check if business settings exist, create if not
      const { data: existingSettings } = await supabase
        .from('business_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      let result;
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('business_settings')
          .update({ 
            region: region,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Create new settings
        result = await supabase
          .from('business_settings')
          .insert({
            user_id: userId,
            region: region,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (result.error) {
        throw new Error(`Failed to update region: ${result.error.message}`);
      }

      const successMessage = `Great! I've set your business region to ${region}. 🌍

This will help with tax and compliance suggestions for your invoices. Is there anything else you'd like me to help you configure?`;

      return {
        success: true,
        data: result.data,
        message: successMessage
      };

    } catch (error) {
      console.error('Error setting region:', error);
      return {
        success: false,
        message: 'Failed to set region. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getCurrencyOptions(params: {}, userId: string): Promise<FunctionResult> {
    try {
      // Provide a hardcoded list of common currencies
      const currencyOptions = [
        { currency_code: 'USD', currency_name: 'US Dollar', symbol: '$' },
        { currency_code: 'EUR', currency_name: 'Euro', symbol: '€' },
        { currency_code: 'GBP', currency_name: 'British Pound', symbol: '£' },
        { currency_code: 'CAD', currency_name: 'Canadian Dollar', symbol: 'CA$' },
        { currency_code: 'AUD', currency_name: 'Australian Dollar', symbol: 'A$' },
        { currency_code: 'NZD', currency_name: 'New Zealand Dollar', symbol: 'NZ$' },
        { currency_code: 'CHF', currency_name: 'Swiss Franc', symbol: 'CHF' },
        { currency_code: 'SEK', currency_name: 'Swedish Krona', symbol: 'kr' },
        { currency_code: 'DKK', currency_name: 'Danish Krone', symbol: 'kr' },
        { currency_code: 'NOK', currency_name: 'Norwegian Krone', symbol: 'kr' },
        { currency_code: 'BGN', currency_name: 'Bulgarian Lev', symbol: 'лв' },
        { currency_code: 'CZK', currency_name: 'Czech Koruna', symbol: 'Kč' },
        { currency_code: 'HUF', currency_name: 'Hungarian Forint', symbol: 'Ft' },
        { currency_code: 'PLN', currency_name: 'Polish Złoty', symbol: 'zł' },
        { currency_code: 'RON', currency_name: 'Romanian Leu', symbol: 'lei' },
        { currency_code: 'AED', currency_name: 'UAE Dirham', symbol: 'د.إ' }
      ];

      const successMessage = `Here are some common currency options:

${currencyOptions.map((option: any) => `• ${option.currency_code} (${option.symbol}) - ${option.currency_name}`).join('\n')}

Just tell me which currency you'd like to use (like "set my currency to USD" or "use EUR") and I'll set it up for you!`;

      return {
        success: true,
        data: currencyOptions,
        message: successMessage
      };

    } catch (error) {
      console.error('Error getting currency options:', error);
      return {
        success: false,
        message: 'Failed to retrieve currency options. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateInvoiceLineItems(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, action, line_items } = params;

      if (!invoice_number || !action || !line_items) {
        return {
          success: false,
          message: 'Invoice number, action, and line_items are required.',
          error: 'Missing required parameters'
        };
      }

      // Get the invoice first
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      let updatedLineItems = [...(invoice.line_items || [])];
      let actionDescription = '';

      switch (action) {
        case 'add':
          // Add new line items
          for (const newItem of line_items) {
            const { data: addedItem, error: addError } = await supabase
              .from('invoice_line_items')
              .insert({
                invoice_id: invoice.id,
                user_id: userId,
                item_name: newItem.item_name,
                item_description: newItem.item_description || null,
                quantity: newItem.quantity || 1,
                unit_price: newItem.unit_price,
                total_price: (newItem.quantity || 1) * newItem.unit_price
              })
              .select()
              .single();

            if (addError) {
              console.error('Error adding line item:', addError);
              continue;
            }
            updatedLineItems.push(addedItem);
          }
          actionDescription = `Added ${line_items.length} item(s)`;
          break;

        case 'update':
          // Update existing line items
          for (const updateItem of line_items) {
            if (!updateItem.item_id) continue;

            const { error: updateError } = await supabase
              .from('invoice_line_items')
              .update({
                item_name: updateItem.item_name,
                item_description: updateItem.item_description || null,
                quantity: updateItem.quantity || 1,
                unit_price: updateItem.unit_price,
                total_price: (updateItem.quantity || 1) * updateItem.unit_price
              })
              .eq('id', updateItem.item_id)
              .eq('user_id', userId);

            if (updateError) {
              console.error('Error updating line item:', updateError);
            }
          }
          actionDescription = `Updated ${line_items.length} item(s)`;
          break;

        case 'remove':
          // Remove line items
          for (const removeItem of line_items) {
            if (!removeItem.item_id) continue;

            const { error: removeError } = await supabase
              .from('invoice_line_items')
              .delete()
              .eq('id', removeItem.item_id)
              .eq('user_id', userId);

            if (removeError) {
              console.error('Error removing line item:', removeError);
            }
          }
          actionDescription = `Removed ${line_items.length} item(s)`;
          break;
      }

      // Recalculate totals
      const { data: currentLineItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      const subtotalAmount = currentLineItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
      
      // Apply existing discounts and taxes
      let discountAmount = 0;
      if (invoice.discount_value > 0) {
        if (invoice.discount_type === 'percentage') {
          discountAmount = subtotalAmount * (invoice.discount_value / 100);
        } else {
          discountAmount = invoice.discount_value;
        }
      }

      const discountedAmount = subtotalAmount - discountAmount;
      const taxAmount = discountedAmount * ((invoice.tax_percentage || 0) / 100);
      const totalAmount = discountedAmount + taxAmount;

      // Update invoice totals
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          subtotal_amount: subtotalAmount,
          total_amount: totalAmount
        })
        .eq('id', invoice.id)
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .single();

      if (updateError) {
        throw new Error(`Failed to update invoice totals: ${updateError.message}`);
      }

      const successMessage = `Successfully ${actionDescription.toLowerCase()} to invoice ${invoice_number}.

Updated totals:
• Subtotal: $${subtotalAmount.toFixed(2)}
• Total: $${totalAmount.toFixed(2)}

Would you like to view the updated invoice or make more changes?`;

      return {
        success: true,
        data: {
          invoice: {
            ...updatedInvoice,
            client_name: invoice.client_name,
            client_email: invoice.client_email
          },
          line_items: currentLineItems,
          action_performed: actionDescription
        },
        message: successMessage
      };

    } catch (error) {
      console.error('Error updating invoice line items:', error);
      return {
        success: false,
        message: 'Failed to update invoice line items. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getInvoiceDetails(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number } = params;

      if (!invoice_number) {
        return {
          success: false,
          message: 'Invoice number is required.',
          error: 'Missing required parameter: invoice_number'
        };
      }

      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (error || !invoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      const lineItemsList = invoice.line_items?.map((item: any, index: number) => 
        `${index + 1}. ${item.item_name}${item.item_description ? ` (${item.item_description})` : ''} - $${item.unit_price}${item.quantity > 1 ? ` x ${item.quantity} = $${item.total_price}` : ''}`
      ).join('\n') || 'No line items';

      const message = `Invoice ${invoice_number} details:

**Client:** ${invoice.client_name}${invoice.client_email ? ` (${invoice.client_email})` : ''}
**Status:** ${invoice.status}
**Date:** ${new Date(invoice.invoice_date).toLocaleDateString()}
**Due Date:** ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Not set'}

**Line Items:**
${lineItemsList}

**Totals:**
• Subtotal: $${invoice.subtotal_amount?.toFixed(2) || '0.00'}
• Tax (${invoice.tax_percentage || 0}%): $${((invoice.subtotal_amount || 0) * ((invoice.tax_percentage || 0) / 100)).toFixed(2)}
• Total: $${invoice.total_amount?.toFixed(2) || '0.00'}

${invoice.notes ? `**Notes:** ${invoice.notes}` : ''}`;

      return {
        success: true,
        data: {
          invoice: invoice,
          line_items: invoice.line_items
        },
        message: message
      };

    } catch (error) {
      console.error('Error getting invoice details:', error);
      return {
        success: false,
        message: 'Failed to get invoice details. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateInvoiceDetails(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, new_invoice_number, client_name, client_email, invoice_date, due_date, tax_percentage, discount_type, discount_value, notes, custom_headline } = params;

      if (!invoice_number) {
        return {
          success: false,
          message: 'Invoice number is required.',
          error: 'Missing required parameter: invoice_number'
        };
      }

      // Get the current invoice
      const { data: currentInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (fetchError || !currentInvoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      // Build update object with only provided fields
      const updateData: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      if (new_invoice_number) {
        updateData.invoice_number = new_invoice_number;
      }
      if (client_name) {
        console.warn('[updateInvoiceDetails] ⚠️ CHANGING CLIENT NAME from', currentInvoice.client_name, 'to', client_name);
        updateData.client_name = client_name;
        
        // Try to find matching client to preserve client_id relationship
        const { data: matchingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', client_name)
          .limit(1)
          .single();
          
        if (matchingClient) {
          updateData.client_id = matchingClient.id;
          console.log('[updateInvoiceDetails] Preserving client_id relationship:', matchingClient.id);
        } else {
          console.warn('[updateInvoiceDetails] No matching client found for name:', client_name);
        }
      }
      if (client_email) {
        console.warn('[updateInvoiceDetails] ⚠️ CHANGING CLIENT EMAIL from', currentInvoice.client_email, 'to', client_email);
        updateData.client_email = client_email;
      }
      if (invoice_date) {
        updateData.invoice_date = invoice_date;
      }
      if (due_date) {
        updateData.due_date = due_date;
      }
      if (tax_percentage !== undefined) {
        updateData.tax_percentage = tax_percentage;
      }
      if (discount_type) {
        updateData.discount_type = discount_type;
      }
      if (discount_value !== undefined) {
        updateData.discount_value = discount_value;
      }
      if (notes) {
        updateData.notes = notes;
      }
      if (custom_headline) {
        updateData.custom_headline = custom_headline;
      }

      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          message: 'No valid fields provided for update.',
          error: 'No update fields'
        };
      }

      // If tax or discount changed, recalculate totals
      if (updateData.tax_percentage !== undefined || updateData.discount_type || updateData.discount_value !== undefined) {
        const { data: lineItems } = await supabase
          .from('invoice_line_items')
          .select('total_price')
          .eq('invoice_id', currentInvoice.id);

        const subtotalAmount = lineItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
        
        let discountAmount = 0;
        const discountValue = updateData.discount_value !== undefined ? updateData.discount_value : currentInvoice.discount_value;
        const discountType = updateData.discount_type || currentInvoice.discount_type;

        if (discountValue > 0) {
          if (discountType === 'percentage') {
            discountAmount = subtotalAmount * (discountValue / 100);
          } else {
            discountAmount = discountValue;
          }
        }

        const discountedAmount = subtotalAmount - discountAmount;
        const taxPercentage = updateData.tax_percentage !== undefined ? updateData.tax_percentage : currentInvoice.tax_percentage;
        const taxAmount = discountedAmount * ((taxPercentage || 0) / 100);
        const totalAmount = discountedAmount + taxAmount;

        updateData.total_amount = totalAmount;
      }

      // Update the invoice
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .single();

      if (updateError) {
        throw new Error(`Failed to update invoice: ${updateError.message}`);
      }

      const message = `Successfully updated invoice ${invoice_number}.

${updatedInvoice.total_amount ? `New total: $${updatedInvoice.total_amount.toFixed(2)}` : ''}

Would you like to view the updated invoice or make more changes?`;

      return {
        success: true,
        data: {
          invoice: updatedInvoice,
          line_items: updatedInvoice.line_items,
          updated_fields: Object.keys(params).filter(key => key !== 'invoice_number')
        },
        message: message
      };

    } catch (error) {
      console.error('Error updating invoice details:', error);
      return {
        success: false,
        message: 'Failed to update invoice details. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateClient(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { client_name, client_id, new_name, email, phone, address, tax_number, notes } = params;

      if (!client_name && !client_id) {
        return {
          success: false,
          message: 'Client name or client_id is required.',
          error: 'Missing required parameter: client_name or client_id'
        };
      }

      console.log('[Update Client] Starting search for client:', { client_name, client_id, userId });

      let existingClient = null;

      if (client_id) {
        // Search by ID (more reliable)
        const { data: clientById, error: idError } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', userId)
          .eq('id', client_id)
          .single();

        if (idError) {
          return {
            success: false,
            message: `Client with ID ${client_id} not found.`,
            error: 'Client not found'
          };
        }
        existingClient = clientById;
      } else if (client_name) {
        // Search by name with very aggressive matching
        console.log('[Update Client] Searching for client by name:', client_name);
        
        // Get ALL clients for this user to debug
        const { data: allUserClients } = await supabase
          .from('clients')
          .select('id, name, email, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        console.log('[Update Client] All user clients:', allUserClients?.map(c => ({ name: c.name, id: c.id, created: c.created_at })));

        if (allUserClients && allUserClients.length > 0) {
          const searchName = client_name.toLowerCase().trim();
          
          // Try multiple matching strategies
          const exactMatch = allUserClients.find(c => c.name.toLowerCase().trim() === searchName);
          const startsWithMatch = allUserClients.find(c => c.name.toLowerCase().trim().startsWith(searchName));
          const containsMatch = allUserClients.find(c => c.name.toLowerCase().trim().includes(searchName));
          const wordsMatch = allUserClients.find(c => {
            const clientWords = c.name.toLowerCase().split(/\s+/);
            const searchWords = searchName.split(/\s+/);
            return searchWords.every((word: string) => clientWords.some((cWord: string) => cWord.includes(word)));
          });

          // Use the best match we can find
          existingClient = exactMatch || startsWithMatch || containsMatch || wordsMatch;
          
          if (exactMatch) {
            console.log('[Update Client] Found exact match:', existingClient?.name);
          } else if (startsWithMatch) {
            console.log('[Update Client] Found starts-with match:', existingClient?.name);
          } else if (containsMatch) {
            console.log('[Update Client] Found contains match:', existingClient?.name);
          } else if (wordsMatch) {
            console.log('[Update Client] Found words match:', existingClient?.name);
          }

          // If we still don't have a match, try the most recently created client
          if (!existingClient && allUserClients.length > 0) {
            const recentClient = allUserClients[0]; // Most recent due to ordering
            const recentClientAge = (Date.now() - new Date(recentClient.created_at).getTime()) / 1000; // seconds
            
            if (recentClientAge < 300) { // Created within last 5 minutes
              console.log('[Update Client] Using recently created client (age:', recentClientAge, 'seconds):', recentClient.name);
              existingClient = recentClient;
            }
          }
        }

        if (!existingClient) {
          // Provide helpful error with context
          const recentClients = allUserClients?.slice(0, 5) || [];
          return {
            success: false,
            message: `I couldn't find a client named "${client_name}". Your recent clients are:
${recentClients.map((c, i) => `${i + 1}. ${c.name} (${c.email || 'no email'})`).join('\n')}

If you just created an invoice for this client, please try again in a moment, or provide the exact client name as it appears above.`,
            error: 'Client not found'
          };
        }
      }

      if (!existingClient) {
        return {
          success: false,
          message: `Client "${client_name || client_id}" not found. You can create a new client with that name if needed.`,
          error: 'Client not found'
        };
      }

      console.log('[Update Client] Found client to update:', existingClient.name, existingClient.id);

      // Check if there are multiple clients with the same name that might be causing issues
      const { data: duplicateCheck } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('user_id', userId)
        .eq('name', existingClient.name);
      
      if (duplicateCheck && duplicateCheck.length > 1) {
        console.warn('[Update Client] Found', duplicateCheck.length, 'clients with name:', existingClient.name);
        console.warn('[Update Client] Duplicate clients:', duplicateCheck);
      }

      const updateData: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      if (new_name !== undefined) {
        updateData.name = new_name;
      }
      if (email !== undefined) {
        updateData.email = email;
      }
      if (phone !== undefined) {
        updateData.phone = phone;
      }
      if (address !== undefined) {
        updateData.address_client = address;
      }
      if (tax_number !== undefined) {
        updateData.tax_number = tax_number;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('user_id', userId)
        .eq('id', existingClient.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('[Update Client] Update error details:', updateError);
        
        // If it's a multiple rows error, try a more specific update
        if (updateError.message.includes('multiple') || updateError.message.includes('no rows')) {
          console.log('[Update Client] Attempting more specific update...');
          
          // Try updating by exact ID match only
          const { data: specificUpdate, error: specificError } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', existingClient.id)
            .select('*');

          if (specificError) {
            throw new Error(`Failed to update client (specific): ${specificError.message}`);
          }

          if (specificUpdate && specificUpdate.length > 0) {
            console.log('[Update Client] Successfully updated client with specific query');
            const updatedClientData = specificUpdate[0];
            
            // Build updated fields list for specific update case
            const specificUpdatedFields = [];
            if (new_name) specificUpdatedFields.push(`name to "${new_name}"`);
            if (email) specificUpdatedFields.push(`email to "${email}"`);
            if (phone) specificUpdatedFields.push(`phone to "${phone}"`);
            if (address) specificUpdatedFields.push(`address to "${address}"`);
            if (tax_number) specificUpdatedFields.push(`tax number to "${tax_number}"`);
            if (notes) specificUpdatedFields.push(`notes`);
            
            let message = `Successfully updated ${existingClient.name}'s ${specificUpdatedFields.join(', ')}.`;
            
            if (address) {
              message += `\n\nThis address will now appear on all invoices for ${existingClient.name}.`;
            }

            return {
              success: true,
              data: {
                client: updatedClientData,
                type: 'client'
              },
              message: message
            };
          }
        }
        
        throw new Error(`Failed to update client: ${updateError.message}`);
      }

      console.log('[Update Client] Successfully updated client:', updatedClient.name);

      // Build a better success message
      const updatedFields = [];
      if (new_name) updatedFields.push(`name to "${new_name}"`);
      if (email) updatedFields.push(`email to "${email}"`);
      if (phone) updatedFields.push(`phone to "${phone}"`);
      if (address) updatedFields.push(`address to "${address}"`);
      if (tax_number) updatedFields.push(`tax number to "${tax_number}"`);
      if (notes) updatedFields.push(`notes`);

      let message = `Successfully updated ${existingClient.name}'s ${updatedFields.join(', ')}.`;
      
      // Add context for address updates
      if (address) {
        message += `\n\nThis address will now appear on all invoices for ${existingClient.name}.`;
      }

      return {
        success: true,
        data: {
          client: updatedClient,
          type: 'client'
        },
        message: message
      };

    } catch (error) {
      console.error('Error updating client:', error);
      return {
        success: false,
        message: 'Failed to update client. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getClientOutstandingAmount(params: { client_name: string }, userId: string): Promise<FunctionResult> {
    try {
      const { client_name } = params;

      if (!client_name) {
        return {
          success: false,
          message: 'Client name is required.',
          error: 'Missing required parameter: client_name'
        };
      }

      console.log('[Get Outstanding] Searching for invoices for client:', client_name);

      // Use ilike for case-insensitive partial matching
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          invoice_number, 
          status, 
          total_amount, 
          due_date, 
          created_at,
          clients!inner(name, email)
        `)
        .eq('user_id', userId)
        .ilike('clients.name', `%${client_name}%`);

      if (error) {
        throw new Error(`Failed to get invoices: ${error.message}`);
      }

      if (!invoices || invoices.length === 0) {
        return {
          success: false,
          message: `No invoices found for "${client_name}". Double-check the client name or try searching for recent invoices.`,
          error: 'No invoices found'
        };
      }

      console.log('[Get Outstanding] Found', invoices.length, 'invoices for', client_name);

      // Filter for unpaid invoices (sent or overdue)
      const unpaidInvoices = invoices.filter(invoice => 
        invoice.status === 'sent' || invoice.status === 'overdue'
      );

      const totalOutstanding = unpaidInvoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);
      const totalAll = invoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);

      let message = `${client_name} invoice summary:\n\n`;
      
      if (unpaidInvoices.length > 0) {
        message += `💰 **Outstanding Amount: $${totalOutstanding.toFixed(2)}**\n`;
        message += `📄 Unpaid invoices: ${unpaidInvoices.length}\n\n`;
        
        message += `Unpaid invoices:\n`;
        unpaidInvoices.forEach(invoice => {
          message += `• ${invoice.invoice_number}: $${invoice.total_amount?.toFixed(2)} (${invoice.status})\n`;
        });
      } else {
        message += `✅ **All invoices are paid!**\n`;
        message += `💰 Total paid: $${totalAll.toFixed(2)}\n`;
      }

      message += `\n📊 Total invoices: ${invoices.length}`;

      return {
        success: true,
        data: {
          client_name: client_name,
          total_outstanding: totalOutstanding,
          total_amount: totalAll,
          unpaid_invoices: unpaidInvoices,
          all_invoices: invoices
        },
        message: message
      };

    } catch (error) {
      console.error('Error getting client outstanding amount:', error);
      return {
        success: false,
        message: 'Failed to get client outstanding amount. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateInvoicePaymentMethods(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, stripe_active, paypal_active, bank_account_active } = params;

      if (!invoice_number) {
        return {
          success: false,
          message: 'Invoice number is required.',
          error: 'Missing required parameter: invoice_number'
        };
      }

      // Get the current invoice
      const { data: currentInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (fetchError || !currentInvoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      // Get user's payment settings to validate what's allowed
      const { data: paymentOptions, error: paymentError } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Build update object with only provided fields
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      const enabledMethods: string[] = [];
      const disabledMethods: string[] = [];
      const errors: string[] = [];

      // Handle Stripe
      if (stripe_active !== undefined) {
        if (stripe_active && (!paymentOptions?.stripe_enabled)) {
          errors.push('Stripe is not enabled in your payment settings. Please enable it first in Payment Options.');
        } else {
          updateData.stripe_active = stripe_active;
          if (stripe_active) {
            enabledMethods.push('Stripe (Pay with Card)');
          } else {
            disabledMethods.push('Stripe (Pay with Card)');
          }
        }
      }

      // Handle PayPal
      if (paypal_active !== undefined) {
        if (paypal_active && (!paymentOptions?.paypal_enabled)) {
          errors.push('PayPal is not enabled in your payment settings. Please enable it first in Payment Options.');
        } else {
          updateData.paypal_active = paypal_active;
          if (paypal_active) {
            enabledMethods.push('PayPal');
          } else {
            disabledMethods.push('PayPal');
          }
        }
      }

      // Handle Bank Transfer
      if (bank_account_active !== undefined) {
        if (bank_account_active && (!paymentOptions?.bank_transfer_enabled)) {
          errors.push('Bank Transfer is not enabled in your payment settings. Please enable it first in Payment Options.');
        } else {
          updateData.bank_account_active = bank_account_active;
          if (bank_account_active) {
            enabledMethods.push('Bank Transfer');
          } else {
            disabledMethods.push('Bank Transfer');
          }
        }
      }

      // If there are validation errors, return them
      if (errors.length > 0) {
        return {
          success: false,
          message: `Cannot update payment methods:\n\n${errors.join('\n\n')}`,
          error: 'Payment method validation failed'
        };
      }

      // If no valid fields to update
      if (Object.keys(updateData).length <= 1) { // Only updated_at
        return {
          success: false,
          message: 'No valid payment method changes provided.',
          error: 'No update fields'
        };
      }

      // Update the invoice
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update invoice payment methods: ${updateError.message}`);
      }

      // Build success message
      let message = `Successfully updated payment methods for invoice ${invoice_number}.\n\n`;
      
      if (enabledMethods.length > 0) {
        message += `✅ Enabled: ${enabledMethods.join(', ')}\n`;
      }
      
      if (disabledMethods.length > 0) {
        message += `❌ Disabled: ${disabledMethods.join(', ')}\n`;
      }

      message += '\nCustomers can now use the enabled payment methods when paying this invoice.';

      return {
        success: true,
        data: {
          invoice: updatedInvoice,
          enabled_methods: enabledMethods,
          disabled_methods: disabledMethods
        },
        message: message
      };

    } catch (error) {
      console.error('Error updating invoice payment methods:', error);
      return {
        success: false,
        message: 'Failed to update invoice payment methods. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async setupPayPalPayments(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { paypal_email, invoice_number } = params;

      if (!paypal_email) {
        return {
          success: false,
          message: 'PayPal email address is required.',
          error: 'Missing required parameter: paypal_email'
        };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(paypal_email)) {
        return {
          success: false,
          message: 'Please provide a valid email address for PayPal.',
          error: 'Invalid email format'
        };
      }

      // Get or create payment options record
      let { data: paymentOptions, error: fetchError } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', userId)
        .single();

      let isNewRecord = false;
      if (fetchError && fetchError.code === 'PGRST116') {
        // No record exists, we'll create one
        isNewRecord = true;
        paymentOptions = null;
      } else if (fetchError) {
        throw new Error(`Failed to fetch payment options: ${fetchError.message}`);
      }

      const updateData = {
        user_id: userId,
        paypal_enabled: true,
        paypal_email: paypal_email,
        stripe_enabled: paymentOptions?.stripe_enabled || false,
        bank_transfer_enabled: paymentOptions?.bank_transfer_enabled || false,
        bank_details: paymentOptions?.bank_details || null,
        invoice_terms_notes: paymentOptions?.invoice_terms_notes || null
      };

      let savedOptions;
      if (isNewRecord) {
        const { data, error } = await supabase
          .from('payment_options')
          .insert(updateData)
          .select()
          .single();
        
        if (error) throw new Error(`Failed to create payment options: ${error.message}`);
        savedOptions = data;
      } else {
        const { data, error } = await supabase
          .from('payment_options')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw new Error(`Failed to update payment options: ${error.message}`);
        savedOptions = data;
      }

      let message = `🎉 PayPal payments are now set up!\n\n✅ PayPal enabled in your payment settings\n✅ PayPal email: ${paypal_email}`;

      // If invoice_number provided, also enable it on that invoice
      if (invoice_number) {
        const invoiceResult = await this.updateInvoicePaymentMethods(
          { invoice_number, paypal_active: true },
          userId
        );

        if (invoiceResult.success) {
          message += `\n✅ PayPal enabled on invoice ${invoice_number}`;
        } else {
          message += `\n⚠️ PayPal enabled in settings, but couldn't enable on invoice ${invoice_number}: ${invoiceResult.message}`;
        }
      }

      message += `\n\nCustomers can now pay via PayPal using ${paypal_email}. You can enable PayPal on individual invoices as needed.`;

      return {
        success: true,
        data: {
          payment_options: savedOptions,
          paypal_email: paypal_email,
          invoice_updated: !!invoice_number
        },
        message: message
      };

    } catch (error) {
      console.error('Error setting up PayPal payments:', error);
      return {
        success: false,
        message: 'Failed to set up PayPal payments. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async setupBankTransferPayments(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { bank_details, invoice_number } = params;

      if (!bank_details) {
        return {
          success: false,
          message: 'Bank account details are required.',
          error: 'Missing required parameter: bank_details'
        };
      }

      // Basic validation - ensure it's not just whitespace
      if (bank_details.trim().length < 10) {
        return {
          success: false,
          message: 'Please provide complete bank account details including bank name, account number, and routing information.',
          error: 'Insufficient bank details'
        };
      }

      // Get or create payment options record
      let { data: paymentOptions, error: fetchError } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', userId)
        .single();

      let isNewRecord = false;
      if (fetchError && fetchError.code === 'PGRST116') {
        // No record exists, we'll create one
        isNewRecord = true;
        paymentOptions = null;
      } else if (fetchError) {
        throw new Error(`Failed to fetch payment options: ${fetchError.message}`);
      }

      const updateData = {
        user_id: userId,
        bank_transfer_enabled: true,
        bank_details: bank_details.trim(),
        paypal_enabled: paymentOptions?.paypal_enabled || false,
        paypal_email: paymentOptions?.paypal_email || null,
        stripe_enabled: paymentOptions?.stripe_enabled || false,
        invoice_terms_notes: paymentOptions?.invoice_terms_notes || null
      };

      let savedOptions;
      if (isNewRecord) {
        const { data, error } = await supabase
          .from('payment_options')
          .insert(updateData)
          .select()
          .single();
        
        if (error) throw new Error(`Failed to create payment options: ${error.message}`);
        savedOptions = data;
      } else {
        const { data, error } = await supabase
          .from('payment_options')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw new Error(`Failed to update payment options: ${error.message}`);
        savedOptions = data;
      }

      let message = `🏦 Bank transfer payments are now set up!\n\n✅ Bank transfer enabled in your payment settings\n✅ Bank details saved securely`;

      // If invoice_number provided, also enable it on that invoice
      if (invoice_number) {
        const invoiceResult = await this.updateInvoicePaymentMethods(
          { invoice_number, bank_account_active: true },
          userId
        );

        if (invoiceResult.success) {
          message += `\n✅ Bank transfer enabled on invoice ${invoice_number}`;
        } else {
          message += `\n⚠️ Bank transfer enabled in settings, but couldn't enable on invoice ${invoice_number}: ${invoiceResult.message}`;
        }
      }

      message += `\n\nCustomers can now pay via bank transfer using your provided details. You can enable bank transfer on individual invoices as needed.`;

      return {
        success: true,
        data: {
          payment_options: savedOptions,
          bank_details_set: true,
          invoice_updated: !!invoice_number
        },
        message: message
      };

    } catch (error) {
      console.error('Error setting up bank transfer payments:', error);
      return {
        success: false,
        message: 'Failed to set up bank transfer payments. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getPaymentOptions(params: any, userId: string): Promise<FunctionResult> {
    try {
      // Get payment options from the payment_options table (NOT business_settings)
      const { data: paymentOptions, error } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No payment options set up yet
        return {
          success: true,
          data: {
            payment_methods_configured: false,
            paypal_enabled: false,
            paypal_email: null,
            stripe_enabled: false,
            bank_transfer_enabled: false,
            bank_details: null,
            invoice_terms_notes: null
          },
          message: `**Payment Methods Configuration**

❌ **No payment methods set up yet**

Available payment methods:
• **PayPal** - Not configured
• **Stripe** - Not configured  
• **Bank Transfer** - Not configured

I can help you set up PayPal and bank transfer payments. Just let me know which one you'd like to configure!

Note: Stripe requires manual connection through your Payment Options settings.`
        };
      } else if (error) {
        throw new Error(`Failed to fetch payment options: ${error.message}`);
      }

      // Build status message based on what's configured
      let message = `**Payment Methods Configuration**\n\n`;
      const enabledMethods: string[] = [];
      const disabledMethods: string[] = [];

      // PayPal status
      if (paymentOptions.paypal_enabled) {
        enabledMethods.push(`✅ **PayPal** - ${paymentOptions.paypal_email || 'Email not set'}`);
      } else {
        disabledMethods.push('❌ **PayPal** - Not enabled');
      }

      // Stripe status
      if (paymentOptions.stripe_enabled) {
        enabledMethods.push('✅ **Stripe** - Connected');
      } else {
        disabledMethods.push('❌ **Stripe** - Not connected');
      }

      // Bank Transfer status
      if (paymentOptions.bank_transfer_enabled) {
        enabledMethods.push('✅ **Bank Transfer** - Details configured');
      } else {
        disabledMethods.push('❌ **Bank Transfer** - Not enabled');
      }

      // Build message
      if (enabledMethods.length > 0) {
        message += `**Enabled Payment Methods:**\n${enabledMethods.join('\n')}\n\n`;
      }
      
      if (disabledMethods.length > 0) {
        message += `**Available to Setup:**\n${disabledMethods.join('\n')}\n\n`;
      }

      // Show bank details if configured
      if (paymentOptions.bank_transfer_enabled && paymentOptions.bank_details) {
        message += `**Bank Transfer Details:**\n${paymentOptions.bank_details}\n\n`;
      }

      // Show invoice terms if configured
      if (paymentOptions.invoice_terms_notes) {
        message += `**Payment Instructions & Notes:**\n${paymentOptions.invoice_terms_notes}\n\n`;
      }

      message += `I can help you set up or modify PayPal and bank transfer payments. Stripe requires manual connection through your Payment Options settings.`;

      return {
        success: true,
        data: {
          payment_methods_configured: true,
          paypal_enabled: paymentOptions.paypal_enabled,
          paypal_email: paymentOptions.paypal_email,
          stripe_enabled: paymentOptions.stripe_enabled,
          bank_transfer_enabled: paymentOptions.bank_transfer_enabled,
          bank_details: paymentOptions.bank_details,
          invoice_terms_notes: paymentOptions.invoice_terms_notes,
          enabled_count: enabledMethods.length,
          total_methods: 3
        },
        message: message
      };

    } catch (error) {
      console.error('Error getting payment options:', error);
      return {
        success: false,
        message: 'Failed to retrieve payment options. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async deleteInvoice(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number } = params;

      if (!invoice_number) {
        return {
          success: false,
          message: 'Invoice number is required.',
          error: 'Missing required parameter: invoice_number'
        };
      }

      // Get the invoice first to validate it exists and get the ID
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_name, total_amount')
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (fetchError || !invoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      // Delete line items first (foreign key constraint)
      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoice.id);

      if (lineItemsError) {
        throw new Error(`Failed to delete invoice line items: ${lineItemsError.message}`);
      }

      // Delete invoice activities if any exist
      const { error: activitiesError } = await supabase
        .from('invoice_activities')
        .delete()
        .eq('invoice_id', invoice.id);

      // Don't fail if activities table doesn't exist or has no records
      if (activitiesError && !activitiesError.message.includes('does not exist')) {
        console.warn('Warning: Could not delete invoice activities:', activitiesError.message);
      }

      // Delete the main invoice record
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (invoiceError) {
        throw new Error(`Failed to delete invoice: ${invoiceError.message}`);
      }

      return {
        success: true,
        data: null,
        message: `✅ **Invoice ${invoice_number} has been permanently deleted.**

Deleted invoice details:
• Client: ${invoice.client_name}
• Amount: $${invoice.total_amount?.toFixed(2) || '0.00'}

⚠️ This action cannot be undone.`
      };

    } catch (error) {
      console.error('Error deleting invoice:', error);
      return {
        success: false,
        message: 'Failed to delete invoice. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async deleteClient(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { client_name, confirm_delete_invoices } = params;

      if (!client_name) {
        return {
          success: false,
          message: 'Client name is required.',
          error: 'Missing required parameter: client_name'
        };
      }

      if (!confirm_delete_invoices) {
        return {
          success: false,
          message: 'You must confirm deletion of invoices by setting confirm_delete_invoices to true. This will delete the client AND all their invoices permanently.',
          error: 'Confirmation required'
        };
      }

      // Find the client
      const { data: clients, error: clientSearchError } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('user_id', userId)
        .ilike('name', `%${client_name}%`);

      if (clientSearchError) {
        throw new Error(`Failed to search for client: ${clientSearchError.message}`);
      }

      if (!clients || clients.length === 0) {
        return {
          success: false,
          message: `No client found with name "${client_name}".`,
          error: 'Client not found'
        };
      }

      if (clients.length > 1) {
        return {
          success: false,
          message: `Multiple clients found with name "${client_name}". Please be more specific:
${clients.map(c => `• ${c.name}${c.email ? ` (${c.email})` : ''}`).join('\n')}`,
          error: 'Multiple clients found'
        };
      }

      const client = clients[0];

      // Get all invoices for this client to show what will be deleted
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, status')
        .eq('user_id', userId)
        .eq('client_id', client.id);

      if (invoicesError) {
        throw new Error(`Failed to get client invoices: ${invoicesError.message}`);
      }

      const invoiceCount = invoices?.length || 0;
      const totalValue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      // Delete all invoices and their dependencies
      if (invoices && invoices.length > 0) {
        // Delete line items for all invoices
        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .delete()
          .in('invoice_id', invoices.map(inv => inv.id));

        if (lineItemsError) {
          throw new Error(`Failed to delete invoice line items: ${lineItemsError.message}`);
        }

        // Delete invoice activities if any exist
        const { error: activitiesError } = await supabase
          .from('invoice_activities')
          .delete()
          .in('invoice_id', invoices.map(inv => inv.id));

        // Don't fail if activities table doesn't exist
        if (activitiesError && !activitiesError.message.includes('does not exist')) {
          console.warn('Warning: Could not delete invoice activities:', activitiesError.message);
        }

        // Delete all invoices
        const { error: invoicesDeleteError } = await supabase
          .from('invoices')
          .delete()
          .eq('client_id', client.id);

        if (invoicesDeleteError) {
          throw new Error(`Failed to delete invoices: ${invoicesDeleteError.message}`);
        }
      }

      // Finally, delete the client
      const { error: clientDeleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (clientDeleteError) {
        throw new Error(`Failed to delete client: ${clientDeleteError.message}`);
      }

      return {
        success: true,
        data: null,
        message: `✅ **Client "${client.name}" has been permanently deleted.**

Deleted:
• **1 client** (${client.name})
• **${invoiceCount} invoice(s)** worth $${totalValue.toFixed(2)}

⚠️ This action cannot be undone.`
      };

    } catch (error) {
      console.error('Error deleting client:', error);
      return {
        success: false,
        message: 'Failed to delete client. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async duplicateInvoice(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, new_client_name, new_invoice_date } = params;

      if (!invoice_number) {
        return {
          success: false,
          message: 'Invoice number is required.',
          error: 'Missing required parameter: invoice_number'
        };
      }

      // Get the original invoice with line items
      const { data: originalInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (fetchError || !originalInvoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      // Handle client change if requested
      let clientId = originalInvoice.client_id;
      let clientName = originalInvoice.client_name;
      
      if (new_client_name) {
        // Find the new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .select('id, name')
          .eq('user_id', userId)
          .ilike('name', `%${new_client_name}%`)
          .single();

        if (clientError || !newClient) {
          return {
            success: false,
            message: `Client "${new_client_name}" not found. Please create the client first or use an existing client name.`,
            error: 'Client not found'
          };
        }

        clientId = newClient.id;
        clientName = newClient.name;
      }

      // Generate new invoice number
      const newInvoiceNumber = await ReferenceNumberService.generateNextReference(userId, 'invoice');

      // Set dates
      const invoiceDate = new_invoice_date || new Date().toISOString().split('T')[0];
      let dueDate = originalInvoice.due_date;
      
      // If we're changing the invoice date, recalculate due date based on original payment terms
      if (new_invoice_date && originalInvoice.due_date && originalInvoice.invoice_date) {
        const originalInvoiceDate = new Date(originalInvoice.invoice_date);
        const originalDueDate = new Date(originalInvoice.due_date);
        const daysDiff = Math.round((originalDueDate.getTime() - originalInvoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const newInvoiceDateObj = new Date(invoiceDate);
        newInvoiceDateObj.setDate(newInvoiceDateObj.getDate() + daysDiff);
        dueDate = newInvoiceDateObj.toISOString().split('T')[0];
      }

      // Create the duplicated invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: userId,
          client_id: clientId,
          invoice_number: newInvoiceNumber,
          status: 'draft', // Always start as draft
          invoice_date: invoiceDate,
          due_date: dueDate,
          custom_headline: originalInvoice.custom_headline,
          subtotal_amount: originalInvoice.subtotal_amount,
          discount_type: originalInvoice.discount_type,
          discount_value: originalInvoice.discount_value,
          tax_percentage: originalInvoice.tax_percentage,
          total_amount: originalInvoice.total_amount,
          notes: originalInvoice.notes,
          // Payment method settings from original
          stripe_active: originalInvoice.stripe_active,
          paypal_active: originalInvoice.paypal_active,
          bank_account_active: originalInvoice.bank_account_active
        })
        .select('*')
        .single();

      if (invoiceError) {
        throw new Error(`Failed to create duplicated invoice: ${invoiceError.message}`);
      }

      // Duplicate line items
      if (originalInvoice.line_items && originalInvoice.line_items.length > 0) {
        const lineItemsToInsert = originalInvoice.line_items.map((item: any) => ({
          invoice_id: newInvoice.id,
          user_id: userId,
          item_name: item.item_name,
          item_description: item.item_description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        }));

        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          // If line items fail, clean up the invoice
          await supabase.from('invoices').delete().eq('id', newInvoice.id);
          throw new Error(`Failed to duplicate line items: ${lineItemsError.message}`);
        }
      }

      const changesSummary = [];
      if (new_client_name) changesSummary.push(`Client changed to "${clientName}"`);
      if (new_invoice_date) changesSummary.push(`Date changed to ${new Date(invoiceDate).toLocaleDateString()}`);
      
      return {
        success: true,
        data: {
          invoice: {
            ...newInvoice,
            client_name: clientName
          },
          client_id: clientId,
          line_items: originalInvoice.line_items || []
        },
        message: `✅ **Invoice duplicated successfully!**

**Original:** ${invoice_number}
**New:** ${newInvoiceNumber}
**Client:** ${clientName}
**Total:** $${originalInvoice.total_amount?.toFixed(2) || '0.00'}

${changesSummary.length > 0 ? `**Changes:**\n${changesSummary.map(c => `• ${c}`).join('\n')}\n\n` : ''}The duplicated invoice is saved as a draft. Would you like me to help you send it or make any changes?`
      };

    } catch (error) {
      console.error('Error duplicating invoice:', error);
      return {
        success: false,
        message: 'Failed to duplicate invoice. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async duplicateEstimate(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { estimate_number, new_client_name, new_estimate_date } = params;

      if (!estimate_number) {
        return {
          success: false,
          message: 'Estimate number is required.',
          error: 'Missing required parameter: estimate_number'
        };
      }

      // Get the original estimate with line items
      const { data: originalEstimate, error: fetchError } = await supabase
        .from('estimates')
        .select(`
          *,
          line_items:estimate_line_items(*)
        `)
        .eq('user_id', userId)
        .eq('estimate_number', estimate_number)
        .single();

      if (fetchError || !originalEstimate) {
        return {
          success: false,
          message: `Estimate ${estimate_number} not found.`,
          error: 'Estimate not found'
        };
      }

      // Handle client change if requested
      let clientId = originalEstimate.client_id;
      let clientName = originalEstimate.client_name;
      
      if (new_client_name) {
        // Find the new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .select('id, name')
          .eq('user_id', userId)
          .ilike('name', `%${new_client_name}%`)
          .single();

        if (clientError || !newClient) {
          return {
            success: false,
            message: `Client "${new_client_name}" not found. Please create the client first or use an existing client name.`,
            error: 'Client not found'
          };
        }

        clientId = newClient.id;
        clientName = newClient.name;
      }

      // Generate new estimate number
      const newEstimateNumber = await ReferenceNumberService.generateNextReference(userId, 'estimate');

      // Set dates
      const estimateDate = new_estimate_date || new Date().toISOString().split('T')[0];
      let validUntil = originalEstimate.valid_until;
      
      // If we're changing the estimate date, recalculate valid_until based on original validity period
      if (new_estimate_date && originalEstimate.valid_until && originalEstimate.estimate_date) {
        const originalEstimateDate = new Date(originalEstimate.estimate_date);
        const originalValidUntil = new Date(originalEstimate.valid_until);
        const daysDiff = Math.round((originalValidUntil.getTime() - originalEstimateDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const newEstimateDateObj = new Date(estimateDate);
        newEstimateDateObj.setDate(newEstimateDateObj.getDate() + daysDiff);
        validUntil = newEstimateDateObj.toISOString().split('T')[0];
      }

      // Create the duplicated estimate
      const { data: newEstimate, error: estimateError } = await supabase
        .from('estimates')
        .insert({
          user_id: userId,
          client_id: clientId,
          estimate_number: newEstimateNumber,
          status: 'draft', // Always start as draft
          estimate_date: estimateDate,
          valid_until: validUntil,
          custom_headline: originalEstimate.custom_headline,
          subtotal_amount: originalEstimate.subtotal_amount,
          discount_type: originalEstimate.discount_type,
          discount_value: originalEstimate.discount_value,
          tax_percentage: originalEstimate.tax_percentage,
          total_amount: originalEstimate.total_amount,
          notes: originalEstimate.notes,
          estimate_template: originalEstimate.estimate_template
        })
        .select('*')
        .single();

      if (estimateError) {
        throw new Error(`Failed to create duplicated estimate: ${estimateError.message}`);
      }

      // Duplicate line items
      if (originalEstimate.line_items && originalEstimate.line_items.length > 0) {
        const lineItemsToInsert = originalEstimate.line_items.map((item: any) => ({
          estimate_id: newEstimate.id,
          user_id: userId,
          item_name: item.item_name,
          item_description: item.item_description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        }));

        const { error: lineItemsError } = await supabase
          .from('estimate_line_items')
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          // If line items fail, clean up the estimate
          await supabase.from('estimates').delete().eq('id', newEstimate.id);
          throw new Error(`Failed to duplicate line items: ${lineItemsError.message}`);
        }
      }

      const changesSummary = [];
      if (new_client_name) changesSummary.push(`Client changed to "${clientName}"`);
      if (new_estimate_date) changesSummary.push(`Date changed to ${new Date(estimateDate).toLocaleDateString()}`);
      
      return {
        success: true,
        data: {
          estimate: {
            ...newEstimate,
            client_name: clientName
          },
          client_id: clientId,
          line_items: originalEstimate.line_items || []
        },
        message: `✅ **Estimate duplicated successfully!**

**Original:** ${estimate_number}
**New:** ${newEstimateNumber}
**Client:** ${clientName}
**Total:** $${originalEstimate.total_amount?.toFixed(2) || '0.00'}

${changesSummary.length > 0 ? `**Changes:**\n${changesSummary.map(c => `• ${c}`).join('\n')}\n\n` : ''}The duplicated estimate is saved as a draft. Would you like me to help you send it or make any changes?`
      };

    } catch (error) {
      console.error('Error duplicating estimate:', error);
      return {
        success: false,
        message: 'Failed to duplicate estimate. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async duplicateClient(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { client_name, new_client_name } = params;

      if (!client_name || !new_client_name) {
        return {
          success: false,
          message: 'Both client_name and new_client_name are required.',
          error: 'Missing required parameters'
        };
      }

      // Find the original client
      const { data: originalClients, error: searchError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', `%${client_name}%`);

      if (searchError) {
        throw new Error(`Failed to search for client: ${searchError.message}`);
      }

      if (!originalClients || originalClients.length === 0) {
        return {
          success: false,
          message: `No client found with name "${client_name}".`,
          error: 'Client not found'
        };
      }

      if (originalClients.length > 1) {
        return {
          success: false,
          message: `Multiple clients found with name "${client_name}". Please be more specific:\n${originalClients.map(c => `• ${c.name}${c.email ? ` (${c.email})` : ''}`).join('\n')}`,
          error: 'Multiple clients found'
        };
      }

      const originalClient = originalClients[0];

      // Check if new client name already exists
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', new_client_name)
        .single();

      if (existingClient) {
        return {
          success: false,
          message: `A client named "${new_client_name}" already exists.`,
          error: 'Client name already exists'
        };
      }

      // Create the duplicated client
      const { data: newClient, error: createError } = await supabase
        .from('clients')
        .insert({
          user_id: userId,
          name: new_client_name,
          email: originalClient.email,
          phone: originalClient.phone,
          address_client: originalClient.address_client,
          tax_number: originalClient.tax_number,
          notes: originalClient.notes
        })
        .select('*')
        .single();

      if (createError) {
        throw new Error(`Failed to create duplicated client: ${createError.message}`);
      }

      return {
        success: true,
        data: {
          client: newClient,
          type: 'client'
        },
        message: `✅ **Client duplicated successfully!**

**Original:** ${originalClient.name}
**New:** ${new_client_name}

**Copied information:**
${originalClient.email ? `• Email: ${originalClient.email}` : ''}${originalClient.phone ? `\n• Phone: ${originalClient.phone}` : ''}${originalClient.address_client ? `\n• Address: ${originalClient.address_client}` : ''}${originalClient.tax_number ? `\n• Tax Number: ${originalClient.tax_number}` : ''}

The new client is ready to use for invoices!`
      };

    } catch (error) {
      console.error('Error duplicating client:', error);
      return {
        success: false,
        message: 'Failed to duplicate client. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Wrapper to prevent duplicate estimate creation
  private static async createEstimateWithDeduplication(params: any, userId: string): Promise<FunctionResult> {
    // Create a unique key for this estimate creation attempt
    const clientName = params.client_name || 'unknown_client';
    const itemsHash = JSON.stringify(params.line_items || []).slice(0, 50);
    const deduplicationKey = `${userId}-estimate-${clientName}-${itemsHash}-${Date.now().toString().slice(-6)}`;
    
    console.log(`[AI Estimate Create] Deduplication key: ${deduplicationKey}`);
    
    // Check if there's already an ongoing estimate creation for this user
    const ongoingUserCreations = Array.from(this.ongoingCreations.keys()).filter(key => 
      key.startsWith(userId) && key.includes('-estimate-')
    );
    
    if (ongoingUserCreations.length > 0) {
      console.log(`[AI Estimate Create] Found ${ongoingUserCreations.length} ongoing estimate creation(s) for user ${userId}`);
      
      // Wait a short time and check if the creation is still ongoing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const stillOngoing = Array.from(this.ongoingCreations.keys()).filter(key => 
        key.startsWith(userId) && key.includes('-estimate-')
      );
      if (stillOngoing.length > 0) {
        console.log(`[AI Estimate Create] Blocking duplicate estimate creation attempt for user ${userId}`);
        return {
          success: false,
          message: "I'm already creating an estimate for you. Please wait a moment for it to complete.",
          error: 'Duplicate estimate creation blocked'
        };
      }
    }
    
    // Create the estimate creation promise
    const creationPromise = this.createEstimate(params, userId);
    
    // Store it in the map
    this.ongoingCreations.set(deduplicationKey, creationPromise);
    
    // Set up cleanup after timeout
    const timeoutHandle = setTimeout(() => {
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Estimate Create] Cleaned up timed-out creation: ${deduplicationKey}`);
    }, this.CREATION_TIMEOUT);
    
    try {
      // Wait for the creation to complete
      const result = await creationPromise;
      
      // Clean up immediately on completion
      clearTimeout(timeoutHandle);
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Estimate Create] Cleaned up completed creation: ${deduplicationKey}`);
      
      return result;
    } catch (error) {
      // Clean up on error
      clearTimeout(timeoutHandle);
      this.ongoingCreations.delete(deduplicationKey);
      console.log(`[AI Estimate Create] Cleaned up failed creation: ${deduplicationKey}`);
      throw error;
    }
  }

  // Estimate-specific methods
  private static async createEstimate(params: any, userId: string): Promise<FunctionResult> {
    try {
      console.log('🚨 CREATE ESTIMATE FUNCTION CALLED!!! 🚨');
      
      // Check usage limit for free plan users
      console.log('[AI Estimate Create] Checking usage limits...');
      
      // First check if user is subscribed
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      
      const isSubscribed = profile?.subscription_tier && ['premium', 'grandfathered'].includes(profile.subscription_tier);
      
      // Only check limits for free users
      if (!isSubscribed) {
        const usageStats = await UsageTrackingService.getInstance().getUserUsageStats(userId);
        const totalItems = (usageStats.invoicesCreated || 0) + (usageStats.estimatesCreated || 0);
        
        if (totalItems >= 3) {
          console.log('[AI Estimate Create] User has reached free plan limit');
          return {
            success: false,
            message: "I notice you've reached your free plan limit of 3 items. To continue creating invoices and estimates, you can upgrade to premium by going to the Settings tab and clicking the Upgrade button at the top. Once subscribed, you'll have unlimited access!",
            error: 'Free plan limit reached'
          };
        }
      }
      
      console.log('[AI Estimate Create] Creating estimate with params:', params);
      
      // Get user's business settings for defaults
      let defaultTaxRate = 0;
      let businessCurrency = 'USD';
      let businessCurrencySymbol = '$';
      let defaultDesign = 'classic';
      let defaultAccentColor = '#14B8A6';
      
      // Get user's payment settings to determine which payment methods should be enabled
      let paypalEnabled = false;
      let stripeEnabled = false;
      let bankTransferEnabled = false;
      
      try {
        const { data: paymentOptions } = await supabase
          .from('payment_options')
          .select('paypal_enabled, stripe_enabled, bank_transfer_enabled')
          .eq('user_id', userId)
          .single();
          
        if (paymentOptions) {
          paypalEnabled = paymentOptions.paypal_enabled || false;
          stripeEnabled = paymentOptions.stripe_enabled || false;
          bankTransferEnabled = paymentOptions.bank_transfer_enabled || false;
          console.log('[AI Estimate Create] Payment settings:', {
            paypal: paypalEnabled,
            stripe: stripeEnabled,
            bankTransfer: bankTransferEnabled
          });
        } else {
          console.log('[AI Estimate Create] No payment options configured - all payment methods disabled');
        }
      } catch (paymentError) {
        console.log('[AI Estimate Create] Error loading payment options (will disable all):', paymentError);
      }
      
      try {
        const { data: businessSettings } = await supabase
          .from('business_settings')
          .select('default_tax_rate, auto_apply_tax, currency_code, default_invoice_design, default_accent_color')
          .eq('user_id', userId)
          .single();
          
        if (businessSettings) {
          if (businessSettings.auto_apply_tax && businessSettings.default_tax_rate) {
            defaultTaxRate = businessSettings.default_tax_rate;
          }
          if (businessSettings.currency_code) {
            businessCurrency = businessSettings.currency_code;
            businessCurrencySymbol = this.getCurrencySymbol(businessSettings.currency_code);
          }
          if (businessSettings.default_invoice_design) {
            defaultDesign = businessSettings.default_invoice_design;
          }
          if (businessSettings.default_accent_color) {
            defaultAccentColor = businessSettings.default_accent_color;
          }
        }
      } catch (settingsError) {
        console.log('[AI Estimate Create] Using default settings');
      }

      // Generate estimate number using unified reference service
      const estimateNumber = await ReferenceNumberService.generateNextReference(userId, 'estimate');
      
      // Process line items
      const processedLineItems = [];
      let subtotal = 0;

      for (const item of params.line_items || []) {
        const quantity = parseFloat(item.quantity) || 1;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const total = quantity * unitPrice;
        
        processedLineItems.push({
          item_name: item.item_name || item.name || 'Item',
          item_description: item.item_description || item.description || null,
          quantity: quantity,
          unit_price: unitPrice,
          total_price: total
        });
        
        subtotal += total;
      }

      // Calculate tax and total
      const taxPercentage = params.tax_percentage !== undefined ? params.tax_percentage : defaultTaxRate;
      const discountValue = params.discount_value || 0;
      const discountType = params.discount_type || 'percentage';
      
      let discountAmount = 0;
      if (discountType === 'percentage') {
        discountAmount = (subtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
      
      const discountedSubtotal = subtotal - discountAmount;
      const taxAmount = (discountedSubtotal * taxPercentage) / 100;
      const total = discountedSubtotal + taxAmount;

      // Handle dates
      const estimateDate = params.estimate_date ? new Date(params.estimate_date) : new Date();
      let validUntilDate;
      if (params.valid_until_date) {
        validUntilDate = new Date(params.valid_until_date);
      } else {
        const validityDays = params.validity_days || 30;
        validUntilDate = new Date(estimateDate);
        validUntilDate.setDate(validUntilDate.getDate() + validityDays);
      }

      // Create or find client
      let clientId = params.client_id;
      if (!clientId && (params.client_name || params.client_email)) {
        const clientResult = await this.findOrCreateClient({
          name: params.client_name,
          email: params.client_email,
          phone: params.client_phone,
          address: params.client_address
        }, userId);
        
        if (clientResult.success) {
          clientId = clientResult.data.id;
        }
      }

      // Create estimate record with user's enabled payment methods
      const estimateData = {
        user_id: userId,
        client_id: clientId,
        estimate_number: estimateNumber,
        estimate_date: estimateDate.toISOString().split('T')[0],
        valid_until_date: validUntilDate.toISOString().split('T')[0],
        subtotal_amount: subtotal,
        tax_percentage: taxPercentage,
        total_amount: total,
        discount_type: discountType,
        discount_value: discountValue,
        status: 'draft',
        notes: params.notes || '',
        acceptance_terms: params.acceptance_terms || '',
        estimate_template: defaultDesign,
        accent_color: defaultAccentColor,
        paypal_active: paypalEnabled,
        stripe_active: stripeEnabled,
        bank_account_active: bankTransferEnabled
      };

      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .insert(estimateData)
        .select()
        .single();

      if (estimateError) {
        throw new Error(`Failed to create estimate: ${estimateError.message}`);
      }

      // Create line items
      const lineItemsData = processedLineItems.map(item => ({
        estimate_id: estimate.id,
        user_id: userId,
        item_name: item.item_name,
        item_description: item.item_description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      }));

      const { error: lineItemsError } = await supabase
        .from('estimate_line_items')
        .insert(lineItemsData);

      if (lineItemsError) {
        throw new Error(`Failed to create estimate line items: ${lineItemsError.message}`);
      }

      const message = `✅ **Estimate ${estimateNumber} created successfully!**\n\n` +
        `📋 **Estimate Details:**\n` +
        `• Number: ${estimateNumber}\n` +
        `• Date: ${estimateDate.toLocaleDateString()}\n` +
        `• Valid until: ${validUntilDate.toLocaleDateString()}\n` +
        `• Subtotal: ${businessCurrencySymbol}${subtotal.toFixed(2)}\n` +
        (discountAmount > 0 ? `• Discount: -${businessCurrencySymbol}${discountAmount.toFixed(2)}\n` : '') +
        (taxAmount > 0 ? `• Tax (${taxPercentage}%): ${businessCurrencySymbol}${taxAmount.toFixed(2)}\n` : '') +
        `• **Total: ${businessCurrencySymbol}${total.toFixed(2)}**\n\n` +
        `🎯 The estimate has been created and is ready for review.`;

      // Calculate totals for consistency with invoice structure
      const calculations = {
        subtotal: subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total: total
      };

      // DEBUG LOGGING
      console.log('=== CREATE ESTIMATE RETURN DEBUG ===');
      console.log('Estimate data:', estimate);
      console.log('Line items data:', lineItemsData);

      // Return the same structure as createInvoice for consistency
      return {
        success: true,
        data: {
          estimate: {
            ...estimate,
            client_name: params.client_name,
            client_email: params.client_email
          },
          client_id: clientId,
          line_items: lineItemsData,
          calculations: calculations
        },
        message: message
      };

    } catch (error) {
      console.error('Error creating estimate:', error);
      return {
        success: false,
        message: 'Failed to create estimate. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async searchEstimates(params: any, userId: string): Promise<FunctionResult> {
    try {
      let query = supabase
        .from('estimates')
        .select(`
          *,
          clients(id, name, email, phone)
        `)
        .eq('user_id', userId);

      if (params.client_name) {
        query = query.ilike('clients.name', `%${params.client_name}%`);
      }

      if (params.status) {
        query = query.eq('status', params.status);
      }

      if (params.date_from) {
        query = query.gte('estimate_date', params.date_from);
      }

      if (params.date_to) {
        query = query.lte('estimate_date', params.date_to);
      }

      if (params.min_amount) {
        query = query.gte('total', params.min_amount);
      }

      if (params.max_amount) {
        query = query.lte('total', params.max_amount);
      }

      const limit = Math.min(params.limit || 10, 50);
      query = query.order('estimate_date', { ascending: false }).limit(limit);

      const { data: estimates, error } = await query;

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      if (!estimates || estimates.length === 0) {
        return {
          success: true,
          data: [],
          message: 'No estimates found matching your criteria.'
        };
      }

      const businessCurrencySymbol = this.getCurrencySymbol('USD'); // TODO: Get from user settings

      let message = `🔍 **Found ${estimates.length} estimate(s):**\n\n`;
      
      estimates.forEach(estimate => {
        const clientName = estimate.clients?.name || 'No client';
        const statusEmoji = estimate.status === 'accepted' ? '✅' : 
                           estimate.status === 'declined' ? '❌' : 
                           estimate.status === 'expired' ? '⏰' : '📋';
        
        message += `${statusEmoji} **${estimate.estimate_number}** - ${clientName}\n`;
        message += `   💰 ${businessCurrencySymbol}${estimate.total_amount.toFixed(2)} | `;
        message += `📅 ${new Date(estimate.estimate_date).toLocaleDateString()}\n`;
      });

      return {
        success: true,
        data: estimates,
        message: message
      };

    } catch (error) {
      console.error('Error searching estimates:', error);
      return {
        success: false,
        message: 'Failed to search estimates. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getEstimateByNumber(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { estimate_number } = params;

      if (!estimate_number) {
        return {
          success: false,
          message: 'Estimate number is required.',
          error: 'Missing required parameter: estimate_number'
        };
      }

      // Handle both old EST- format and new unified INV- format
      const { data: estimate, error } = await supabase
        .from('estimates')
        .select(`
          *,
          clients(id, name, email, phone, address),
          estimate_line_items(*)
        `)
        .eq('user_id', userId)
        .eq('estimate_number', estimate_number)
        .single();

      if (error || !estimate) {
        // Try pattern matching for backward compatibility
        const { data: estimates, error: searchError } = await supabase
          .from('estimates')
          .select(`
            *,
            clients(id, name, email, phone, address),
            estimate_line_items(*)
          `)
          .eq('user_id', userId)
          .or(`estimate_number.eq.${estimate_number},estimate_number.ilike.%${estimate_number}%`);
          
        if (searchError || !estimates || estimates.length === 0) {
          return {
            success: false,
            message: `Estimate ${estimate_number} not found. Note: Estimates now use unified numbering (INV-001, INV-002, etc.)`,
            error: 'Estimate not found'
          };
        }
        
        // Use the most recent matching estimate
        const sortedEstimates = estimates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const foundEstimate = sortedEstimates[0];
        
        const businessCurrencySymbol = this.getCurrencySymbol('USD'); // TODO: Get from user settings
        const clientName = foundEstimate.clients?.name || 'No client assigned';
        const statusEmoji = foundEstimate.status === 'accepted' ? '✅' : 
                           foundEstimate.status === 'declined' ? '❌' : 
                           foundEstimate.status === 'expired' ? '⏰' : '📋';

        const lineItemsList = foundEstimate.estimate_line_items?.map((item: any) => 
          `• ${item.item_name}${item.item_description ? ` (${item.item_description})` : ''} - ${businessCurrencySymbol}${item.unit_price}${item.quantity > 1 ? ` x ${item.quantity} = ${businessCurrencySymbol}${item.total_price}` : ''}`
        ).join('\n') || 'No line items';

        return {
          success: true,
          data: foundEstimate,
          message: `${statusEmoji} **Estimate ${foundEstimate.estimate_number}** (Found via search)\n\n` +
            `👤 **Client:** ${clientName}\n` +
            `📅 **Date:** ${new Date(foundEstimate.estimate_date).toLocaleDateString()}\n` +
            `⏰ **Valid Until:** ${new Date(foundEstimate.valid_until_date).toLocaleDateString()}\n` +
            `📋 **Status:** ${foundEstimate.status}\n` +
            `💰 **Amount:** ${businessCurrencySymbol}${foundEstimate.total_amount.toFixed(2)}\n\n` +
            `**Line Items:**\n${lineItemsList}`
        };
      }

      const businessCurrencySymbol = this.getCurrencySymbol('USD'); // TODO: Get from user settings
      const clientName = estimate.clients?.name || 'No client assigned';
      const statusEmoji = estimate.status === 'accepted' ? '✅' : 
                         estimate.status === 'declined' ? '❌' : 
                         estimate.status === 'expired' ? '⏰' : '📋';

      let message = `${statusEmoji} **Estimate ${estimate.estimate_number}**\n\n`;
      message += `👤 **Client:** ${clientName}\n`;
      message += `📅 **Date:** ${new Date(estimate.estimate_date).toLocaleDateString()}\n`;
      message += `⏰ **Valid until:** ${new Date(estimate.valid_until_date).toLocaleDateString()}\n`;
      message += `📊 **Status:** ${estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}\n`;
      message += `💰 **Total:** ${businessCurrencySymbol}${estimate.total_amount.toFixed(2)}\n\n`;

      if (estimate.estimate_line_items && estimate.estimate_line_items.length > 0) {
        message += `📋 **Line Items:**\n`;
        estimate.estimate_line_items.forEach((item: any) => {
          message += `• ${item.description} - Qty: ${item.quantity} × ${businessCurrencySymbol}${item.unit_price.toFixed(2)} = ${businessCurrencySymbol}${item.total.toFixed(2)}\n`;
        });
      }

      return {
        success: true,
        data: estimate,
        message: message,
        attachments: [{
          type: 'estimate',
          estimate_id: estimate.id,
          estimate_number: estimate.estimate_number,
          estimate: estimate,
          line_items: estimate.estimate_line_items || [],
          client_id: estimate.client_id
        }]
      };

    } catch (error) {
      console.error('Error getting estimate:', error);
      return {
        success: false,
        message: 'Failed to get estimate details. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getRecentEstimates(params: any, userId: string): Promise<FunctionResult> {
    try {
      const limit = Math.min(params.limit || 5, 20);
      const statusFilter = params.status_filter || 'all';

      let query = supabase
        .from('estimates')
        .select(`
          *,
          clients(id, name, email)
        `)
        .eq('user_id', userId);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      query = query.order('estimate_date', { ascending: false }).limit(limit);

      const { data: estimates, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch recent estimates: ${error.message}`);
      }

      if (!estimates || estimates.length === 0) {
        const filterText = statusFilter === 'all' ? '' : ` with status "${statusFilter}"`;
        return {
          success: true,
          data: [],
          message: `No recent estimates found${filterText}.`
        };
      }

      const businessCurrencySymbol = this.getCurrencySymbol('USD'); // TODO: Get from user settings

      let message = `📋 **Recent Estimates${statusFilter !== 'all' ? ` (${statusFilter})` : ''}:**\n\n`;
      
      estimates.forEach(estimate => {
        const clientName = estimate.clients?.name || 'No client';
        const statusEmoji = estimate.status === 'accepted' ? '✅' : 
                           estimate.status === 'declined' ? '❌' : 
                           estimate.status === 'expired' ? '⏰' : '📋';
        
        message += `${statusEmoji} **${estimate.estimate_number}** - ${clientName}\n`;
        message += `   💰 ${businessCurrencySymbol}${estimate.total_amount.toFixed(2)} | `;
        message += `📅 ${new Date(estimate.estimate_date).toLocaleDateString()}\n\n`;
      });

      return {
        success: true,
        data: estimates,
        message: message
      };

    } catch (error) {
      console.error('Error getting recent estimates:', error);
      return {
        success: false,
        message: 'Failed to get recent estimates. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async convertEstimateToInvoice(params: any, userId: string): Promise<FunctionResult> {
    try {
      // Check usage limit for free plan users
      console.log('[AI Estimate Convert] Checking usage limits...');
      const usageStats = await UsageTrackingService.getInstance().getUserUsageStats(userId);
      const totalItems = (usageStats.invoicesCreated || 0) + (usageStats.estimatesCreated || 0);
      
      if (totalItems >= 3) {
        console.log('[AI Estimate Convert] User has reached free plan limit');
        return {
          success: false,
          message: "I notice you've reached your free plan limit of 3 items. You'll need to upgrade to a premium plan to continue creating invoices and estimates. You can upgrade by tapping the upgrade button in your settings.",
          error: 'Free plan limit reached'
        };
      }
      
      const { estimate_number, payment_terms_days } = params;

      if (!estimate_number) {
        return {
          success: false,
          message: 'Estimate number is required.',
          error: 'Missing required parameter: estimate_number'
        };
      }

      // Get the estimate with line items - handle unified numbering
      let estimate;
      const { data: initialEstimate, error: estimateError } = await supabase
        .from('estimates')
        .select(`
          *,
          clients(id, name, email, phone, address),
          estimate_line_items(*)
        `)
        .eq('user_id', userId)
        .eq('estimate_number', estimate_number)
        .single();

      if (estimateError || !initialEstimate) {
        // Try pattern matching for backward compatibility
        const { data: estimates, error: searchError } = await supabase
          .from('estimates')
          .select(`
            *,
            clients(id, name, email, phone, address),
            estimate_line_items(*)
          `)
          .eq('user_id', userId)
          .or(`estimate_number.eq.${estimate_number},estimate_number.ilike.%${estimate_number}%`);
          
        if (searchError || !estimates || estimates.length === 0) {
          return {
            success: false,
            message: `Estimate ${estimate_number} not found. Note: Estimates now use unified numbering (INV-001, INV-002, etc.)`,
            error: 'Estimate not found'
          };
        }
        
        // Use the most recent matching estimate and continue with conversion
        const foundEstimate = estimates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        
        // Set estimate to the found one and continue with normal flow
        estimate = foundEstimate;
      } else {
        estimate = initialEstimate;
      }

      if (estimate.status === 'declined') {
        return {
          success: false,
          message: 'Cannot convert a declined estimate to an invoice.',
          error: 'Estimate declined'
        };
      }

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(userId);
      
      // Calculate due date
      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + (payment_terms_days || 30));

      // Create invoice record - inherit payment methods from estimate
      const invoiceData = {
        user_id: userId,
        client_id: estimate.client_id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal: estimate.subtotal_amount,
        tax_percentage: estimate.tax_percentage,
        tax_amount: estimate.total_amount - estimate.subtotal_amount,
        discount_type: estimate.discount_type,
        discount_value: estimate.discount_value,
        discount_amount: 0,
        total: estimate.total_amount,
        currency: 'USD', // TODO: Get from user settings
        status: 'unpaid',
        notes: estimate.notes,
        design_template: estimate.estimate_template || DEFAULT_DESIGN_ID,
        accent_color: estimate.accent_color || '#14B8A6',
        converted_from_estimate: estimate.id,
        paypal_active: estimate.paypal_active || false,
        stripe_active: estimate.stripe_active || false,
        bank_account_active: estimate.bank_account_active || false
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) {
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      // Create invoice line items from estimate line items
      const invoiceLineItems = estimate.estimate_line_items.map((item: any) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      }));

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(invoiceLineItems);

      if (lineItemsError) {
        throw new Error(`Failed to create invoice line items: ${lineItemsError.message}`);
      }

      // Update estimate status to accepted
      const { error: updateError } = await supabase
        .from('estimates')
        .update({ 
          status: 'accepted',
          converted_to_invoice_id: invoice.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', estimate.id);

      if (updateError) {
        console.error('Warning: Failed to update estimate status:', updateError);
      }

      const businessCurrencySymbol = this.getCurrencySymbol('USD'); // TODO: Get from user settings
      const clientName = estimate.clients?.name || 'No client';

      const message = `✅ **Estimate converted to Invoice successfully!**\n\n` +
        `📋 **Estimate ${estimate_number}** → 🧾 **Invoice ${invoiceNumber}**\n\n` +
        `👤 **Client:** ${clientName}\n` +
        `📅 **Invoice Date:** ${invoiceDate.toLocaleDateString()}\n` +
        `⏰ **Due Date:** ${dueDate.toLocaleDateString()}\n` +
        `💰 **Amount:** ${businessCurrencySymbol}${invoice.total.toFixed(2)}\n\n` +
        `🎯 The invoice is now ready to be sent to your client.`;

      return {
        success: true,
        data: invoice,
        message: message,
        attachments: [{
          type: 'invoice',
          invoice_id: invoice.id,
          invoice_number: invoiceNumber
        }]
      };

    } catch (error) {
      console.error('Error converting estimate to invoice:', error);
      return {
        success: false,
        message: 'Failed to convert estimate to invoice. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async generateNextEstimateNumber(userId: string): Promise<string> {
    // Get the latest numbers from both invoices and estimates to maintain unified numbering
    const [invoicesResult, estimatesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('invoice_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('estimates')
        .select('estimate_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ]);

    let highestNumber = 0;
    
    // Check latest invoice number
    if (invoicesResult.data?.invoice_number) {
      const invoiceMatch = invoicesResult.data.invoice_number.match(/(\d+)$/);
      if (invoiceMatch) {
        const invoiceNumber = parseInt(invoiceMatch[1]);
        highestNumber = Math.max(highestNumber, invoiceNumber);
      }
    }
    
    // Check latest estimate number (handle both old EST- format and new INV- format)
    if (estimatesResult.data?.estimate_number) {
      const estimateNumber = estimatesResult.data.estimate_number;
      let estimateMatch;
      
      // Try new INV- format first
      estimateMatch = estimateNumber.match(/INV-(\d+)$/);
      if (!estimateMatch) {
        // Fall back to old EST- format for backward compatibility
        estimateMatch = estimateNumber.match(/EST-(\d+)$/);
      }
      
      if (estimateMatch) {
        const estNumber = parseInt(estimateMatch[1]);
        highestNumber = Math.max(highestNumber, estNumber);
      }
    }
    
    const nextNumber = highestNumber + 1;
    
    // Use the same format as invoices: INV-001, INV-002, etc.
    return `INV-${nextNumber.toString().padStart(3, '0')}`;
  }

  // Edit recent invoice function
  private static async editRecentInvoice(params: any, userId: string): Promise<FunctionResult> {
    try {
      console.log('[AI Edit Invoice] Starting edit with params:', params);
      
      // SIMPLE APPROACH: Just get the most recent invoices
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients(id, name, email, phone),
          invoice_line_items(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5); // Get last 5 to have options
        
      if (error || !invoices || invoices.length === 0) {
        console.error('[AI Edit Invoice] Query error:', error);
        return {
          success: false,
          message: 'No invoices found to edit. Please create an invoice first.',
          error: 'No invoices found'
        };
      }
      
      // Log what we found for debugging
      console.log('[AI Edit Invoice] Found invoices:', invoices.map(i => ({
        number: i.invoice_number,
        created: i.created_at,
        id: i.id
      })));
      
      // Default to most recent
      let invoiceToEdit = invoices[0];
      
      // If a specific number was requested, try to find it
      if (params.invoice_number) {
        // Try exact match first
        const exactMatch = invoices.find(i => i.invoice_number === params.invoice_number);
        
        if (exactMatch) {
          console.log('[AI Edit Invoice] Found exact match for:', params.invoice_number);
          invoiceToEdit = exactMatch;
        } else {
          // Check if this might be an estimate
          const { data: estimate } = await supabase
            .from('estimates')
            .select('estimate_number')
            .eq('user_id', userId)
            .eq('estimate_number', params.invoice_number)
            .single();
            
          if (estimate) {
            return {
              success: false,
              message: `${params.invoice_number} is an estimate, not an invoice. Please use the edit estimate function instead.`,
              error: 'Document type mismatch'
            };
          }
          
          console.log('[AI Edit Invoice] No match found for:', params.invoice_number, '- using most recent:', invoiceToEdit.invoice_number);
        }
      }
      
      // Perform the requested operation
      return await this.performInvoiceEdit(invoiceToEdit, params, userId);
      
    } catch (error) {
      console.error('Error editing invoice:', error);
      return {
        success: false,
        message: 'Failed to edit invoice. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Edit recent estimate function
  private static async editRecentEstimate(params: any, userId: string): Promise<FunctionResult> {
    try {
      console.log('[AI Edit Estimate] Starting edit with params:', params);
      
      // SIMPLE APPROACH: Just get the most recent estimate, period.
      // Don't overcomplicate with number matching - the AI just created it!
      
      // CRITICAL FIX: Add RLS bypass header for AI operations
      // This ensures the query runs with the correct user context
      const { data: estimates, error } = await supabase
        .from('estimates')
        .select(`
          *,
          clients(id, name, email, phone),
          estimate_line_items(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5); // Get last 5 to have options
        
      if (error || !estimates || estimates.length === 0) {
        console.error('[AI Edit Estimate] Query error:', error);
        return {
          success: false,
          message: 'No estimates found to edit. Please create an estimate first.',
          error: 'No estimates found'
        };
      }
      
      // Log what we found for debugging
      console.log('[AI Edit Estimate] Found estimates:', estimates.map(e => ({
        number: e.estimate_number,
        created: e.created_at,
        id: e.id
      })));
      
      // Default to most recent
      let estimateToEdit = estimates[0];
      
      // If a specific number was requested, try to find it
      if (params.estimate_number) {
        // Try exact match first
        const exactMatch = estimates.find(e => e.estimate_number === params.estimate_number);
        
        if (exactMatch) {
          console.log('[AI Edit Estimate] Found exact match for:', params.estimate_number);
          estimateToEdit = exactMatch;
        } else {
          // Try partial match (handles EST- vs INV- confusion)
          const numberOnly = params.estimate_number.replace(/[^0-9]/g, '');
          const partialMatch = estimates.find(e => {
            const estimateNumberOnly = e.estimate_number.replace(/[^0-9]/g, '');
            return estimateNumberOnly === numberOnly;
          });
          
          if (partialMatch) {
            console.log('[AI Edit Estimate] Found partial match:', partialMatch.estimate_number, 'for requested:', params.estimate_number);
            estimateToEdit = partialMatch;
          } else {
            console.log('[AI Edit Estimate] No match found for:', params.estimate_number, '- using most recent:', estimateToEdit.estimate_number);
          }
        }
      }
      
      // Perform the requested operation
      return await this.performEstimateEdit(estimateToEdit, params, userId);
      
    } catch (error) {
      console.error('Error editing estimate:', error);
      return {
        success: false,
        message: 'Failed to edit estimate. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper function to perform invoice edits
  private static async performInvoiceEdit(invoice: any, params: any, userId: string): Promise<FunctionResult> {
    try {
      let updateData: any = {};
      let lineItemChanges = false;
      let operationDescription = '';
      
      switch (params.operation) {
        case 'add_item':
          if (!params.line_items_to_add || params.line_items_to_add.length === 0) {
            return {
              success: false,
              message: 'No line items provided to add.',
              error: 'Missing line items'
            };
          }
          
          // Add new line items
          const newItems = params.line_items_to_add.map((item: any) => ({
            invoice_id: invoice.id,
            user_id: userId,
            item_name: item.item_name,
            item_description: item.item_description || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price
          }));
          
          const { error: addError } = await supabase
            .from('invoice_line_items')
            .insert(newItems);
            
          if (addError) {
            throw new Error(`Failed to add line items: ${addError.message}`);
          }
          
          lineItemChanges = true;
          operationDescription = `Added ${params.line_items_to_add.length} new item(s)`;
          break;
          
        case 'remove_item':
          if (!params.item_name_to_remove) {
            return {
              success: false,
              message: 'No item name provided to remove.',
              error: 'Missing item name'
            };
          }
          
          const { error: removeError } = await supabase
            .from('invoice_line_items')
            .delete()
            .eq('invoice_id', invoice.id)
            .ilike('item_name', `%${params.item_name_to_remove}%`);
            
          if (removeError) {
            throw new Error(`Failed to remove item: ${removeError.message}`);
          }
          
          lineItemChanges = true;
          operationDescription = `Removed item: ${params.item_name_to_remove}`;
          break;
          
        case 'update_due_date':
          if (!params.due_date) {
            return {
              success: false,
              message: 'No due date provided.',
              error: 'Missing due date'
            };
          }
          
          let newDueDate;
          if (params.due_date.includes('days')) {
            const days = parseInt(params.due_date.match(/(\d+)/)?.[1] || '30');
            newDueDate = new Date();
            newDueDate.setDate(newDueDate.getDate() + days);
          } else {
            newDueDate = new Date(params.due_date);
          }
          
          updateData.due_date = newDueDate.toISOString().split('T')[0];
          operationDescription = `Updated due date to ${newDueDate.toLocaleDateString()}`;
          break;
          
        case 'update_payment_methods':
          if (!params.payment_methods) {
            return {
              success: false,
              message: 'No payment method settings provided.',
              error: 'Missing payment methods'
            };
          }
          
          if (params.payment_methods.paypal_active !== undefined) {
            updateData.paypal_active = params.payment_methods.paypal_active;
          }
          if (params.payment_methods.stripe_active !== undefined) {
            updateData.stripe_active = params.payment_methods.stripe_active;
          }
          if (params.payment_methods.bank_account_active !== undefined) {
            updateData.bank_account_active = params.payment_methods.bank_account_active;
          }
          
          operationDescription = 'Updated payment method settings';
          break;
          
        case 'update_details':
          if (params.notes !== undefined) {
            updateData.notes = params.notes;
          }
          if (params.custom_headline !== undefined) {
            updateData.custom_headline = params.custom_headline;
          }
          operationDescription = 'Updated invoice details';
          break;
          
        default:
          return {
            success: false,
            message: `Unknown operation: ${params.operation}`,
            error: 'Invalid operation'
          };
      }
      
      // If we have line item changes, recalculate totals
      if (lineItemChanges) {
        // Get updated line items
        const { data: updatedLineItems, error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', invoice.id);
          
        if (lineItemsError) {
          throw new Error(`Failed to fetch updated line items: ${lineItemsError.message}`);
        }
        
        // Recalculate totals
        const subtotal = updatedLineItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
        const discountAmount = invoice.discount_type === 'percentage' 
          ? subtotal * (invoice.discount_value / 100)
          : invoice.discount_value || 0;
        const discountedAmount = subtotal - discountAmount;
        const taxAmount = discountedAmount * ((invoice.tax_percentage || 0) / 100);
        const total = discountedAmount + taxAmount;
        
        updateData.subtotal_amount = subtotal;
        updateData.total_amount = total;
      }
      
      // Apply updates to invoice if any
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('invoices')
          .update(updateData)
          .eq('id', invoice.id);
          
        if (updateError) {
          throw new Error(`Failed to update invoice: ${updateError.message}`);
        }
      }
      
      // Get the updated invoice with line items for the response
      const { data: updatedInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients(id, name, email, phone),
          invoice_line_items(*)
        `)
        .eq('id', invoice.id)
        .single();
        
      if (fetchError) {
        throw new Error(`Failed to fetch updated invoice: ${fetchError.message}`);
      }
      
      const businessCurrencySymbol = this.getCurrencySymbol('USD'); // TODO: Get from user settings
      
      const message = `✅ **Invoice ${invoice.invoice_number} updated successfully!**\n\n` +
        `📝 **Change made:** ${operationDescription}\n` +
        `💰 **Total amount:** ${businessCurrencySymbol}${updatedInvoice.total_amount.toFixed(2)}\n\n` +
        `The updated invoice is ready for review.`;
      
      return {
        success: true,
        data: {
          invoice: {
            ...updatedInvoice,
            client_name: updatedInvoice.clients?.name,
            client_email: updatedInvoice.clients?.email
          },
          client_id: updatedInvoice.client_id,
          line_items: updatedInvoice.invoice_line_items,
          calculations: {
            subtotal: updatedInvoice.subtotal_amount,
            tax: (updatedInvoice.total_amount - updatedInvoice.subtotal_amount),
            total: updatedInvoice.total_amount
          }
        },
        message: message
      };
      
    } catch (error) {
      console.error('Error performing invoice edit:', error);
      throw error;
    }
  }

  // Helper function to perform estimate edits
  private static async performEstimateEdit(estimate: any, params: any, userId: string): Promise<FunctionResult> {
    try {
      let updateData: any = {};
      let lineItemChanges = false;
      let operationDescription = '';
      
      switch (params.operation) {
        case 'add_item':
          if (!params.line_items_to_add || params.line_items_to_add.length === 0) {
            return {
              success: false,
              message: 'No line items provided to add.',
              error: 'Missing line items'
            };
          }
          
          // Add new line items
          const newItems = params.line_items_to_add.map((item: any) => ({
            estimate_id: estimate.id,
            user_id: userId,
            item_name: item.item_name,
            item_description: item.item_description || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price
          }));
          
          const { error: addError } = await supabase
            .from('estimate_line_items')
            .insert(newItems);
            
          if (addError) {
            throw new Error(`Failed to add line items: ${addError.message}`);
          }
          
          lineItemChanges = true;
          operationDescription = `Added ${params.line_items_to_add.length} new item(s)`;
          break;
          
        case 'remove_item':
          if (!params.item_name_to_remove) {
            return {
              success: false,
              message: 'No item name provided to remove.',
              error: 'Missing item name'
            };
          }
          
          const { error: removeError } = await supabase
            .from('estimate_line_items')
            .delete()
            .eq('estimate_id', estimate.id)
            .ilike('item_name', `%${params.item_name_to_remove}%`);
            
          if (removeError) {
            throw new Error(`Failed to remove item: ${removeError.message}`);
          }
          
          lineItemChanges = true;
          operationDescription = `Removed item: ${params.item_name_to_remove}`;
          break;
          
        case 'update_validity':
          if (!params.valid_until_date) {
            return {
              success: false,
              message: 'No validity date provided.',
              error: 'Missing validity date'
            };
          }
          
          let newValidDate;
          if (params.valid_until_date.includes('days')) {
            const days = parseInt(params.valid_until_date.match(/(\d+)/)?.[1] || '30');
            newValidDate = new Date();
            newValidDate.setDate(newValidDate.getDate() + days);
          } else {
            newValidDate = new Date(params.valid_until_date);
          }
          
          updateData.valid_until_date = newValidDate.toISOString().split('T')[0];
          operationDescription = `Updated validity date to ${newValidDate.toLocaleDateString()}`;
          break;
          
        case 'update_payment_methods':
          if (!params.payment_methods) {
            return {
              success: false,
              message: 'No payment method settings provided.',
              error: 'Missing payment methods'
            };
          }
          
          if (params.payment_methods.paypal_active !== undefined) {
            updateData.paypal_active = params.payment_methods.paypal_active;
          }
          if (params.payment_methods.stripe_active !== undefined) {
            updateData.stripe_active = params.payment_methods.stripe_active;
          }
          if (params.payment_methods.bank_account_active !== undefined) {
            updateData.bank_account_active = params.payment_methods.bank_account_active;
          }
          
          operationDescription = 'Updated payment method settings';
          break;
          
        case 'update_details':
          if (params.notes !== undefined) {
            updateData.notes = params.notes;
          }
          if (params.acceptance_terms !== undefined) {
            updateData.acceptance_terms = params.acceptance_terms;
          }
          operationDescription = 'Updated estimate details';
          break;
          
        default:
          return {
            success: false,
            message: `Unknown operation: ${params.operation}`,
            error: 'Invalid operation'
          };
      }
      
      // If we have line item changes, recalculate totals
      if (lineItemChanges) {
        // Get updated line items
        const { data: updatedLineItems, error: lineItemsError } = await supabase
          .from('estimate_line_items')
          .select('*')
          .eq('estimate_id', estimate.id);
          
        if (lineItemsError) {
          throw new Error(`Failed to fetch updated line items: ${lineItemsError.message}`);
        }
        
        // Recalculate totals
        const subtotal = updatedLineItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
        const discountAmount = estimate.discount_type === 'percentage' 
          ? subtotal * (estimate.discount_value / 100)
          : estimate.discount_value || 0;
        const discountedAmount = subtotal - discountAmount;
        const taxAmount = discountedAmount * ((estimate.tax_percentage || 0) / 100);
        const total = discountedAmount + taxAmount;
        
        updateData.subtotal_amount = subtotal;
        updateData.total_amount = total;
      }
      
      // Apply updates to estimate if any
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('estimates')
          .update(updateData)
          .eq('id', estimate.id);
          
        if (updateError) {
          throw new Error(`Failed to update estimate: ${updateError.message}`);
        }
      }
      
      // Get the updated estimate with line items for the response
      const { data: updatedEstimate, error: fetchError } = await supabase
        .from('estimates')
        .select(`
          *,
          clients(id, name, email, phone),
          estimate_line_items(*)
        `)
        .eq('id', estimate.id)
        .single();
        
      if (fetchError) {
        throw new Error(`Failed to fetch updated estimate: ${fetchError.message}`);
      }
      
      const businessCurrencySymbol = this.getCurrencySymbol('USD'); // TODO: Get from user settings
      
      const message = `✅ **Estimate ${estimate.estimate_number} updated successfully!**\n\n` +
        `📝 **Change made:** ${operationDescription}\n` +
        `💰 **Total amount:** ${businessCurrencySymbol}${updatedEstimate.total_amount.toFixed(2)}\n\n` +
        `The updated estimate is ready for review.`;
      
      return {
        success: true,
        data: {
          estimate: {
            ...updatedEstimate,
            client_name: updatedEstimate.clients?.name,
            client_email: updatedEstimate.clients?.email
          },
          client_id: updatedEstimate.client_id,
          line_items: updatedEstimate.estimate_line_items,
          calculations: {
            subtotal: updatedEstimate.subtotal_amount,
            tax: (updatedEstimate.total_amount - updatedEstimate.subtotal_amount),
            total: updatedEstimate.total_amount
          }
        },
        message: message
      };
      
    } catch (error) {
      console.error('Error performing estimate edit:', error);
      throw error;
    }
  }

  private static async checkUsageLimits(userId: string): Promise<FunctionResult> {
    console.error('🚨🚨🚨 CHECK USAGE LIMITS CALLED!!! 🚨🚨🚨');
    console.error('🚨 USER ID:', userId);
    console.error('🚨 TIMESTAMP:', new Date().toISOString());
    try {
      console.log('[AI Usage Check] Checking user limits for userId:', userId);
      
      // First check if user is subscribed
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      
      console.log('[AI Usage Check] Profile query result:', { profile, error: profileError });
      console.log('[AI Usage Check] Profile subscription_tier:', profile?.subscription_tier);
      
      const isSubscribed = profile?.subscription_tier && ['premium', 'grandfathered'].includes(profile.subscription_tier);
      console.log('[AI Usage Check] Is subscribed?', isSubscribed);
      
      if (isSubscribed) {
        console.log('[AI Usage Check] User is subscribed - unlimited access');
        console.error('🎉🎉🎉 PREMIUM USER DETECTED - SHOULD ALLOW CREATION!!! 🎉🎉🎉');
        console.error('🎉 USER:', userId);
        console.error('🎉 SUBSCRIPTION TIER:', profile.subscription_tier);
        console.error('🎉 RETURNING SUCCESS WITH UNLIMITED ACCESS');
        return {
          success: true,
          data: {
            canCreate: true,
            isSubscribed: true,
            subscription_tier: profile.subscription_tier,
            message: "You have unlimited access to create invoices and estimates with your premium subscription."
          },
          message: "✅ You can create unlimited invoices and estimates with your premium subscription!"
        };
      }
      
      // Free user - check usage
      const usageStats = await UsageTrackingService.getInstance().getUserUsageStats(userId);
      const totalItems = (usageStats.invoicesCreated || 0) + (usageStats.estimatesCreated || 0);
      const remaining = Math.max(0, 3 - totalItems);
      
      if (totalItems >= 3) {
        console.log('[AI Usage Check] User has reached free plan limit');
        return {
          success: true,
          data: {
            canCreate: false,
            isSubscribed: false,
            totalItems: totalItems,
            limit: 3,
            remaining: 0
          },
          message: "❌ You've reached your free plan limit of 3 items. To continue creating invoices and estimates, you can upgrade to premium by going to the Settings tab and clicking the Upgrade button at the top. Once subscribed, you'll have unlimited access and can cancel anytime!"
        };
      }
      
      console.log('[AI Usage Check] User can still create items:', remaining, 'remaining');
      return {
        success: true,
        data: {
          canCreate: true,
          isSubscribed: false,
          totalItems: totalItems,
          limit: 3,
          remaining: remaining
        },
        message: `✅ You can create items! You have ${remaining} out of 3 free items remaining.`
      };
      
    } catch (error) {
      console.error('Error checking usage limits:', error);
      return {
        success: false,
        message: 'Failed to check usage limits. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateTaxSettings(params: any, userId: string): Promise<FunctionResult> {
    try {
      console.log('[AI Tax Settings Update] Updating tax settings with params:', params);
      
      // Check if business settings exist, create if not
      const { data: existingSettings } = await supabase
        .from('business_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      const updateData: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      // Only update fields that are provided
      if (params.default_tax_rate !== undefined) {
        // Handle removing tax (0 or null)
        updateData.default_tax_rate = params.default_tax_rate === 0 ? null : params.default_tax_rate;
      }
      if (params.tax_name !== undefined) {
        // Handle "None" as empty tax name
        updateData.tax_name = params.tax_name === 'None' ? '' : params.tax_name;
      }
      if (params.tax_number !== undefined) {
        updateData.tax_number = params.tax_number || null;
      }
      if (params.auto_apply_tax !== undefined) {
        updateData.auto_apply_tax = params.auto_apply_tax;
      }

      let result;
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('business_settings')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Create new settings
        updateData.created_at = new Date().toISOString();
        result = await supabase
          .from('business_settings')
          .insert(updateData)
          .select()
          .single();
      }

      if (result.error) {
        throw new Error(`Failed to update tax settings: ${result.error.message}`);
      }

      // Build success message showing what was updated
      const updatedFields = [];
      if (params.default_tax_rate !== undefined) {
        if (params.default_tax_rate === 0 || params.default_tax_rate === null) {
          updatedFields.push('Removed tax rate');
        } else {
          updatedFields.push(`Tax rate set to ${params.default_tax_rate}%`);
        }
      }
      if (params.tax_name !== undefined) {
        if (params.tax_name === 'None' || params.tax_name === '') {
          updatedFields.push('Removed tax name');
        } else {
          updatedFields.push(`Tax name set to "${params.tax_name}"`);
        }
      }
      if (params.tax_number !== undefined) {
        if (params.tax_number) {
          updatedFields.push(`Tax number set to "${params.tax_number}"`);
        } else {
          updatedFields.push('Removed tax number');
        }
      }
      if (params.auto_apply_tax !== undefined) {
        updatedFields.push(`Auto-apply tax ${params.auto_apply_tax ? 'enabled' : 'disabled'}`);
      }

      const message = `✅ Tax settings updated successfully!\n\n${updatedFields.map(field => `• ${field}`).join('\n')}`;

      // Add helpful context based on what was changed
      let additionalInfo = '';
      if (params.auto_apply_tax === false) {
        additionalInfo = '\n\nTax will no longer be automatically added to new invoices. You can still add tax manually when creating each invoice.';
      } else if (params.default_tax_rate === 0 || params.default_tax_rate === null) {
        additionalInfo = '\n\nTax has been removed from your default settings. New invoices will not include tax unless you add it manually.';
      }

      return {
        success: true,
        data: result.data,
        message: message + additionalInfo
      };
    } catch (error) {
      console.error('Error updating tax settings:', error);
      return {
        success: false,
        message: 'Failed to update tax settings. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getTaxSettingsNavigation(params: {}, userId: string): Promise<FunctionResult> {
    try {
      const navigationMessage = `📱 **How to access Tax & Currency Settings:**

1. **Go to Settings Tab**
   - Tap the "Settings" tab at the bottom of your screen (gear icon)

2. **Find Tax & Currency**
   - Look for "Tax & Currency" in the list of settings
   - It has a coins icon (💰)
   - Tap on it to open

3. **In Tax & Currency Settings, you can:**
   • **Change Currency** - Select your business currency (USD, EUR, GBP, etc.)
   • **Set Tax Rate** - Enter your default tax percentage (e.g., 20 for 20%)
   • **Choose Tax Name** - Select VAT, GST, Sales Tax, or enter a custom name
   • **Add Tax Number** - Enter your VAT/GST/Tax ID number
   • **Toggle Auto-Apply Tax** - Turn on/off automatic tax on new invoices

4. **Save Your Changes**
   - After making changes, tap the "Save Settings" button at the bottom

💡 **Quick tip:** I can also update these settings for you directly! Just tell me what you'd like to change, for example:
- "Set my tax rate to 20%"
- "Change tax name to VAT"
- "Disable auto-apply tax"
- "Remove tax from invoices"`;

      return {
        success: true,
        message: navigationMessage
      };
    } catch (error) {
      console.error('Error getting tax settings navigation:', error);
      return {
        success: false,
        message: 'Failed to get navigation instructions.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Design Options Functions
  private static async getDesignOptions(params: {}, userId: string): Promise<FunctionResult> {
    try {
      const designOptions = {
        designs: [
          {
            id: 'classic',
            name: 'Classic',
            displayName: 'Classic',
            description: 'Traditional business invoice with blue accents',
            aiDescription: 'Professional and traditional design. Perfect for established businesses, formal industries (law, finance, consulting), and corporate clients who value trust and reliability.',
            personality: ['professional', 'trustworthy', 'traditional', 'formal', 'established'],
            industries: ['legal', 'finance', 'consulting', 'corporate', 'accounting', 'real estate'],
            colorScheme: { primary: '#2563EB', accent: '#3B82F6' },
            layoutFeatures: ['clean header', 'standard sections', 'business-focused', 'formal structure'],
            bestFor: 'Traditional businesses, formal client relationships, professional services',
            avoid: 'Creative industries, casual businesses, very modern startups'
          },
          {
            id: 'modern',
            name: 'Modern',
            displayName: 'Modern',
            description: 'Clean and contemporary with green accents',
            aiDescription: 'Contemporary and fresh design. Ideal for tech companies, creative agencies, modern businesses, and companies that want to appear innovative and forward-thinking.',
            personality: ['modern', 'innovative', 'fresh', 'contemporary', 'forward-thinking'],
            industries: ['technology', 'creative', 'marketing', 'design', 'startups', 'digital agencies'],
            colorScheme: { primary: '#059669', accent: '#10B981' },
            layoutFeatures: ['centered header', 'side-by-side sections', 'clean lines', 'contemporary spacing'],
            bestFor: 'Tech companies, creative agencies, modern businesses, innovative services',
            avoid: 'Very traditional industries, formal legal/finance (unless specifically modern)'
          },
          {
            id: 'clean',
            name: 'Clean',
            displayName: 'Clean',
            description: 'Minimalist design with accent color header and clean lines',
            aiDescription: 'Minimalist and professional. Great for businesses that value simplicity, clean aesthetics, and want their content to be the focus without distraction.',
            personality: ['minimalist', 'clean', 'focused', 'professional', 'efficient'],
            industries: ['consulting', 'professional services', 'healthcare', 'education', 'non-profit'],
            colorScheme: { primary: '#059669', accent: '#10B981' },
            layoutFeatures: ['accent header', 'alternating rows', 'minimal design', 'content-focused'],
            bestFor: 'Professional services, consultants, businesses wanting clean aesthetics',
            avoid: 'Creative industries that need more personality, very formal corporate'
          },
          {
            id: 'simple',
            name: 'Simple',
            displayName: 'Simple',
            description: 'Straightforward design with minimal styling',
            aiDescription: 'Straightforward and no-nonsense design. Perfect for small businesses, personal services, or anyone who wants a clean, simple invoice without complex styling.',
            personality: ['simple', 'straightforward', 'honest', 'accessible', 'practical'],
            industries: ['small business', 'personal services', 'trades', 'local services', 'freelancers'],
            colorScheme: { primary: '#000000', accent: '#374151' },
            layoutFeatures: ['split header', 'standard layout', 'minimal styling', 'practical focus'],
            bestFor: 'Small businesses, personal services, trades, straightforward invoicing',
            avoid: 'Large corporations, businesses needing strong brand presence'
          }
        ],
        categories: {
          professional: ['classic', 'clean'],
          modern: ['modern'],
          simple: ['simple', 'clean'],
          creative: ['modern'],
          traditional: ['classic']
        }
      };

      return {
        success: true,
        data: designOptions,
        message: 'Available invoice design templates with detailed descriptions and recommendations.'
      };
    } catch (error) {
      console.error('Error getting design options:', error);
      return {
        success: false,
        message: 'Failed to get design options.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getColorOptions(params: {}, userId: string): Promise<FunctionResult> {
    try {
      const colorOptions = {
        colors: [
          {
            name: 'Navy Blue',
            hex: '#1E40AF',
            psychology: 'Trust, stability, professionalism, reliability',
            industries: ['finance', 'legal', 'healthcare', 'insurance', 'consulting'],
            personality: ['professional', 'trustworthy', 'stable', 'conservative', 'reliable'],
            aiDescription: 'Deep blue that conveys trust and professionalism. Perfect for financial services, law firms, healthcare, and established businesses where trust is paramount.',
            emotions: ['trust', 'security', 'stability', 'confidence'],
            avoid: 'Creative industries wanting playful/energetic feel'
          },
          {
            name: 'Bright Blue',
            hex: '#3B82F6',
            psychology: 'Communication, openness, clarity, innovation',
            industries: ['technology', 'communication', 'education', 'software'],
            personality: ['open', 'communicative', 'innovative', 'approachable', 'modern'],
            aiDescription: 'Bright blue that suggests clarity and innovation. Great for tech companies, educational services, and businesses focused on communication.',
            emotions: ['clarity', 'innovation', 'openness', 'communication'],
            avoid: 'Very traditional industries, luxury brands'
          },
          {
            name: 'Purple',
            hex: '#8B5CF6',
            psychology: 'Creativity, luxury, innovation, sophistication',
            industries: ['creative', 'design', 'luxury', 'beauty', 'entertainment'],
            personality: ['creative', 'sophisticated', 'innovative', 'unique', 'premium'],
            aiDescription: 'Rich purple that represents creativity and sophistication. Perfect for design agencies, luxury brands, creative services, and businesses wanting to stand out.',
            emotions: ['creativity', 'luxury', 'sophistication', 'uniqueness'],
            avoid: 'Very conservative industries, traditional finance/legal'
          },
          {
            name: 'Green',
            hex: '#10B981',
            psychology: 'Growth, nature, freshness, prosperity, harmony',
            industries: ['environmental', 'health', 'finance', 'organic', 'sustainability'],
            personality: ['growing', 'natural', 'fresh', 'prosperous', 'balanced'],
            aiDescription: 'Fresh green that suggests growth and prosperity. Excellent for environmental businesses, health services, financial growth, and organic/natural brands.',
            emotions: ['growth', 'prosperity', 'freshness', 'harmony'],
            avoid: 'Industries where green might seem unprofessional'
          },
          {
            name: 'Orange',
            hex: '#F59E0B',
            psychology: 'Energy, enthusiasm, warmth, creativity, confidence',
            industries: ['creative', 'food', 'entertainment', 'sports', 'energy'],
            personality: ['energetic', 'enthusiastic', 'warm', 'confident', 'bold'],
            aiDescription: 'Vibrant orange that conveys energy and enthusiasm. Great for creative agencies, food businesses, entertainment, and brands wanting to appear energetic and approachable.',
            emotions: ['energy', 'enthusiasm', 'warmth', 'confidence'],
            avoid: 'Very professional services, legal, healthcare (unless specifically energetic brand)'
          },
          {
            name: 'Red',
            hex: '#EF4444',
            psychology: 'Power, urgency, passion, strength, attention',
            industries: ['emergency', 'automotive', 'sports', 'entertainment', 'urgency-based'],
            personality: ['powerful', 'urgent', 'passionate', 'strong', 'bold'],
            aiDescription: 'Bold red that commands attention and suggests urgency or power. Best for businesses that need to convey strength, urgency, or passion.',
            emotions: ['power', 'urgency', 'passion', 'strength'],
            avoid: 'Calming services (healthcare/wellness), conservative professional services'
          },
          {
            name: 'Pink',
            hex: '#EC4899',
            psychology: 'Compassion, care, femininity, creativity, approachability',
            industries: ['beauty', 'wellness', 'childcare', 'creative', 'personal services'],
            personality: ['caring', 'approachable', 'creative', 'gentle', 'personal'],
            aiDescription: 'Warm pink that suggests care and approachability. Perfect for beauty services, wellness, childcare, personal services, and businesses with a caring, personal touch.',
            emotions: ['compassion', 'care', 'approachability', 'gentleness'],
            avoid: 'Traditional masculine industries, very professional corporate services'
          }
        ],
        colorCategories: {
          professional: ['#1E40AF', '#374151', '#000000', '#10B981'],
          creative: ['#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'],
          trustworthy: ['#1E40AF', '#3B82F6', '#10B981'],
          energetic: ['#EF4444', '#F59E0B', '#EC4899'],
          natural: ['#10B981', '#059669', '#84CC16'],
          luxury: ['#8B5CF6', '#1E40AF', '#000000'],
          modern: ['#3B82F6', '#8B5CF6', '#10B981'],
          traditional: ['#1E40AF', '#374151', '#000000']
        },
        recommendations: {
          'first_time_user': '#1E40AF',
          'creative_business': '#8B5CF6',
          'professional_service': '#1E40AF',
          'tech_company': '#3B82F6',
          'healthcare': '#10B981',
          'finance': '#1E40AF',
          'legal': '#1E40AF',
          'design_agency': '#8B5CF6'
        }
      };

      return {
        success: true,
        data: colorOptions,
        message: 'Available accent colors with psychology, industry associations, and personality traits.'
      };
    } catch (error) {
      console.error('Error getting color options:', error);
      return {
        success: false,
        message: 'Failed to get color options.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateInvoiceDesign(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, design_id, apply_to_defaults = false, reasoning } = params;

      // Validate design_id
      const validDesigns = ['classic', 'modern', 'clean', 'simple'];
      if (!validDesigns.includes(design_id)) {
        return {
          success: false,
          message: `Invalid design ID: ${design_id}. Available designs: ${validDesigns.join(', ')}`,
          error: 'Invalid design ID'
        };
      }

      let updatedInvoice = null;
      let updatedDefaults = null;

      // Update specific invoice if provided
      if (invoice_number) {
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .update({ 
            invoice_design: design_id,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('invoice_number', invoice_number)
          .select()
          .single();

        if (invoiceError || !invoice) {
          return {
            success: false,
            message: `Invoice ${invoice_number} not found or could not be updated.`,
            error: 'Invoice not found'
          };
        }
        updatedInvoice = invoice;
      }

      // Update business defaults if requested or no specific invoice
      if (apply_to_defaults || !invoice_number) {
        const { data: settings, error: settingsError } = await supabase
          .from('business_settings')
          .update({ 
            default_invoice_design: design_id,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (settingsError) {
          console.error('Error updating business defaults:', settingsError);
        } else {
          updatedDefaults = settings;
        }
      }

      // Build success message
      const designName = design_id.charAt(0).toUpperCase() + design_id.slice(1);
      let message = '';
      
      if (updatedInvoice && updatedDefaults) {
        message = `✅ Updated ${invoice_number} design to **${designName}** and set as your business default.`;
      } else if (updatedInvoice) {
        message = `✅ Updated ${invoice_number} design to **${designName}**.`;
      } else if (updatedDefaults) {
        message = `✅ Set **${designName}** as your default invoice design for future invoices.`;
      }

      if (reasoning) {
        message += `\n\n💡 **Why ${designName}?** ${reasoning}`;
      }

      return {
        success: true,
        data: {
          invoice: updatedInvoice,
          businessDefaults: updatedDefaults,
          design_id,
          design_name: designName
        },
        message
      };
    } catch (error) {
      console.error('Error updating invoice design:', error);
      return {
        success: false,
        message: 'Failed to update invoice design.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateInvoiceColor(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, accent_color, apply_to_defaults = false, reasoning } = params;

      // Validate hex color format
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexColorRegex.test(accent_color)) {
        return {
          success: false,
          message: `Invalid color format: ${accent_color}. Please use hex format like #3B82F6`,
          error: 'Invalid color format'
        };
      }

      let updatedInvoice = null;
      let updatedDefaults = null;

      // Update specific invoice if provided
      if (invoice_number) {
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .update({ 
            accent_color: accent_color,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('invoice_number', invoice_number)
          .select()
          .single();

        if (invoiceError || !invoice) {
          return {
            success: false,
            message: `Invoice ${invoice_number} not found or could not be updated.`,
            error: 'Invoice not found'
          };
        }
        updatedInvoice = invoice;
      }

      // Update business defaults if requested or no specific invoice
      if (apply_to_defaults || !invoice_number) {
        const { data: settings, error: settingsError } = await supabase
          .from('business_settings')
          .update({ 
            default_accent_color: accent_color,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (settingsError) {
          console.error('Error updating business defaults:', settingsError);
        } else {
          updatedDefaults = settings;
        }
      }

      // Build success message
      let message = '';
      
      if (updatedInvoice && updatedDefaults) {
        message = `🎨 Updated ${invoice_number} accent color to **${accent_color}** and set as your business default.`;
      } else if (updatedInvoice) {
        message = `🎨 Updated ${invoice_number} accent color to **${accent_color}**.`;
      } else if (updatedDefaults) {
        message = `🎨 Set **${accent_color}** as your default accent color for future invoices.`;
      }

      if (reasoning) {
        message += `\n\n💡 **Color Choice:** ${reasoning}`;
      }

      return {
        success: true,
        data: {
          invoice: updatedInvoice,
          businessDefaults: updatedDefaults,
          accent_color,
          color_preview: accent_color
        },
        message
      };
    } catch (error) {
      console.error('Error updating invoice color:', error);
      return {
        success: false,
        message: 'Failed to update invoice color.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateInvoiceAppearance(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, design_id, accent_color, apply_to_defaults = false, reasoning } = params;

      // Validate inputs
      if (design_id) {
        const validDesigns = ['classic', 'modern', 'clean', 'simple'];
        if (!validDesigns.includes(design_id)) {
          return {
            success: false,
            message: `Invalid design ID: ${design_id}. Available designs: ${validDesigns.join(', ')}`,
            error: 'Invalid design ID'
          };
        }
      }

      if (accent_color) {
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!hexColorRegex.test(accent_color)) {
          return {
            success: false,
            message: `Invalid color format: ${accent_color}. Please use hex format like #3B82F6`,
            error: 'Invalid color format'
          };
        }
      }

      let updatedInvoice = null;
      let updatedDefaults = null;

      // Prepare update data
      const invoiceUpdateData: any = { updated_at: new Date().toISOString() };
      const businessUpdateData: any = { updated_at: new Date().toISOString() };

      if (design_id) {
        invoiceUpdateData.invoice_design = design_id;
        businessUpdateData.default_invoice_design = design_id;
      }
      
      if (accent_color) {
        invoiceUpdateData.accent_color = accent_color;
        businessUpdateData.default_accent_color = accent_color;
      }

      // Update specific invoice if provided
      if (invoice_number) {
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .update(invoiceUpdateData)
          .eq('user_id', userId)
          .eq('invoice_number', invoice_number)
          .select()
          .single();

        if (invoiceError || !invoice) {
          return {
            success: false,
            message: `Invoice ${invoice_number} not found or could not be updated.`,
            error: 'Invoice not found'
          };
        }
        updatedInvoice = invoice;
      }

      // Update business defaults if requested or no specific invoice
      if (apply_to_defaults || !invoice_number) {
        const { data: settings, error: settingsError } = await supabase
          .from('business_settings')
          .update(businessUpdateData)
          .eq('user_id', userId)
          .select()
          .single();

        if (settingsError) {
          console.error('Error updating business defaults:', settingsError);
        } else {
          updatedDefaults = settings;
        }
      }

      // Build success message
      const designName = design_id ? design_id.charAt(0).toUpperCase() + design_id.slice(1) : null;
      const changes = [];
      
      if (designName) changes.push(`**${designName}** design`);
      if (accent_color) changes.push(`**${accent_color}** accent color`);
      
      let message = '';
      
      if (updatedInvoice && updatedDefaults) {
        message = `✨ Updated ${invoice_number} with ${changes.join(' and ')} and set as your business defaults.`;
      } else if (updatedInvoice) {
        message = `✨ Updated ${invoice_number} with ${changes.join(' and ')}.`;
      } else if (updatedDefaults) {
        message = `✨ Set ${changes.join(' and ')} as your business defaults for future invoices.`;
      }

      if (reasoning) {
        message += `\n\n💡 **Design Choices:** ${reasoning}`;
      }

      return {
        success: true,
        data: {
          invoice: updatedInvoice,
          businessDefaults: updatedDefaults,
          design_id,
          accent_color,
          changes: changes
        },
        message
      };
    } catch (error) {
      console.error('Error updating invoice appearance:', error);
      return {
        success: false,
        message: 'Failed to update invoice appearance.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 