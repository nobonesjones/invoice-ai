const { createClient } = require('@supabase/supabase-js');

// Read environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupReceiptStorage() {
  try {
    console.log('Setting up receipt image storage...');

    // Create storage bucket
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('receipt-images', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('Error creating bucket:', bucketError);
      return;
    }

    console.log('✅ Storage bucket created or already exists');

    // Execute the SQL parts manually
    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create RLS policies for receipt images storage
        CREATE POLICY IF NOT EXISTS "Users can upload their own receipt images" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = 'receipt-images' AND
          auth.uid()::text = (storage.foldername(name))[1]
        );

        CREATE POLICY IF NOT EXISTS "Users can view their own receipt images" ON storage.objects
        FOR SELECT USING (
          bucket_id = 'receipt-images' AND
          auth.uid()::text = (storage.foldername(name))[1]
        );

        CREATE POLICY IF NOT EXISTS "Users can update their own receipt images" ON storage.objects
        FOR UPDATE USING (
          bucket_id = 'receipt-images' AND
          auth.uid()::text = (storage.foldername(name))[1]
        );

        CREATE POLICY IF NOT EXISTS "Users can delete their own receipt images" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'receipt-images' AND
          auth.uid()::text = (storage.foldername(name))[1]
        );

        -- Add an index for faster queries on expenses with receipt images
        CREATE INDEX IF NOT EXISTS idx_expenses_receipt_image_url ON public.expenses(receipt_image_url) 
        WHERE receipt_image_url IS NOT NULL;
      `
    });

    if (sqlError) {
      console.error('Error executing SQL:', sqlError);
    } else {
      console.log('✅ Storage policies and indexes created');
    }

    console.log('✅ Receipt storage setup complete!');

  } catch (error) {
    console.error('Setup error:', error);
  }
}

// Execute the function directly since this isn't an RPC
async function setupStorageDirect() {
  try {
    console.log('Setting up receipt image storage...');

    // Create storage bucket
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('receipt-images', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('Error creating bucket:', bucketError);
      return;
    }

    console.log('✅ Storage bucket created or already exists');

    // We'll need to use the SQL editor in Supabase dashboard for the policies
    console.log('Please run the following SQL in your Supabase SQL editor:');
    console.log(`
-- Create RLS policies for receipt images storage
CREATE POLICY IF NOT EXISTS "Users can upload their own receipt images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'receipt-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can view their own receipt images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'receipt-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can update their own receipt images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'receipt-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can delete their own receipt images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'receipt-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add an index for faster queries on expenses with receipt images
CREATE INDEX IF NOT EXISTS idx_expenses_receipt_image_url ON public.expenses(receipt_image_url) 
WHERE receipt_image_url IS NOT NULL;
    `);

  } catch (error) {
    console.error('Setup error:', error);
  }
}

setupStorageDirect();