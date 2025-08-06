-- Create a webhook to call our Edge Function when a new user signs up
-- This will trigger the create-user-defaults function automatically

-- First, let's create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Call the Edge Function via HTTP request
  -- Note: This requires the http extension to be enabled
  PERFORM
    net.http_post(
      url := 'https://wzpuzqzsjdizmpiobsuo.functions.supabase.co/create-user-defaults',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'users',
        'schema', 'auth',
        'record', row_to_json(NEW),
        'old_record', null
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger that calls our function when a new user is inserted
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Alternative approach: Create a simpler trigger that directly inserts the data
-- This doesn't require the Edge Function and is more reliable

CREATE OR REPLACE FUNCTION public.create_user_defaults_direct()
RETURNS trigger AS $$
BEGIN
  -- Create default payment_options row
  INSERT INTO public.payment_options (
    user_id,
    paypal_enabled,
    paypal_email,
    stripe_enabled,
    bank_transfer_enabled,
    bank_details,
    invoice_terms_notes
  ) VALUES (
    NEW.id,
    false,
    null,
    false,
    false,
    null,
       null
  );

  -- Create default business_settings row
  INSERT INTO public.business_settings (
    user_id,
    business_name,
    business_address,
    business_email,
    business_phone,
    business_website,
    currency_code,
    tax_name,
    default_tax_rate,
    business_logo_url,
    default_invoice_design,
    default_accent_color
  ) VALUES (
    NEW.id,
    null,
    null,
    NEW.email, -- Use the user's signup email as default
    null,
    null,
    'USD', -- Default currency
    'Tax',
    0, -- 0% default tax rate
    null,
    'clean', -- Set default template to clean
    '#1E40AF' -- Set default color to navy
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create default settings for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the direct trigger (preferred approach)
DROP TRIGGER IF EXISTS on_auth_user_created_direct ON auth.users;
CREATE TRIGGER on_auth_user_created_direct
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_defaults_direct(); 