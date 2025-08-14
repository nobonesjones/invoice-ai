// Fetch a Supabase user JWT (access_token) using email/password.
// Usage:
//   node get-jwt.js --email you@example.com --password 'secret123'
//   or set env vars: TEST_EMAIL, TEST_PASSWORD
// Requires: @supabase/supabase-js (install in tests/: npm i @supabase/supabase-js)

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
// Load root .env so EXPO_PUBLIC_API_URL/ANON_KEY are available when running from tests/
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx > -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const supabaseUrl = process.env.EXPO_PUBLIC_API_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing EXPO_PUBLIC_API_URL or EXPO_PUBLIC_ANON_KEY in environment.');
    process.exit(1);
  }

  const email = getArg('email') || process.env.TEST_EMAIL;
  const password = getArg('password') || process.env.TEST_PASSWORD;

  if (!email || !password) {
    console.error('Provide --email and --password (or TEST_EMAIL/TEST_PASSWORD env vars).');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Sign-in failed:', error.message);
    process.exit(1);
  }
  const access = data.session?.access_token;
  if (!access) {
    console.error('No access_token in session.');
    process.exit(1);
  }
  console.log('\nSUPABASE_TEST_JWT=' + access + '\n');
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
