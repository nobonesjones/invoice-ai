-- Drop the database trigger so only the edge function runs
DROP TRIGGER IF EXISTS on_auth_user_created_direct ON auth.users;

-- Also drop the trigger function since we're not using it
DROP FUNCTION IF EXISTS public.create_user_defaults_direct();

-- Drop the old edge function trigger too if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();