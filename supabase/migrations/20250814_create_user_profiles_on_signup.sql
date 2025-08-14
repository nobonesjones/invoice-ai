-- Create user_profiles row automatically when a new auth user is created

-- Function: create a default user_profiles entry
CREATE OR REPLACE FUNCTION public.create_user_profile_on_signup()
RETURNS trigger AS $$
BEGIN
  -- Only insert if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = NEW.id
  ) THEN
    INSERT INTO public.user_profiles (
      id,
      onboarding_completed,
      industry,
      region,
      business_logo_url,
      invoice_count,
      sent_invoice_count,
      subscription_tier,
      free_limit,
      subscription_expires_at,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      false,
      NULL,
      NULL,
      NULL,
      0,
      0,
      'free',   -- default tier
      3,        -- default free send limit
      NULL,
      NOW(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: run after a user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_user_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_user_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile_on_signup();

-- Comment for documentation
COMMENT ON FUNCTION public.create_user_profile_on_signup() IS
  'Ensures every auth user has a corresponding row in public.user_profiles with free defaults.';

