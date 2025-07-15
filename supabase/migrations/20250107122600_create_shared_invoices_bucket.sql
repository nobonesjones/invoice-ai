-- Create storage bucket for shared invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-invoices', 'shared-invoices', true);

-- Create policy to allow authenticated users to upload PDFs
CREATE POLICY "Users can upload their own invoice PDFs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'shared-invoices' 
  AND auth.role() = 'authenticated'
);

-- Create policy to allow public access to shared invoice PDFs
CREATE POLICY "Public access to shared invoice PDFs" ON storage.objects
FOR SELECT USING (bucket_id = 'shared-invoices');

-- Create policy to allow users to update their own PDFs
CREATE POLICY "Users can update their own invoice PDFs" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'shared-invoices' 
  AND auth.role() = 'authenticated'
);

-- Create policy to allow users to delete their own PDFs
CREATE POLICY "Users can delete their own invoice PDFs" ON storage.objects
FOR DELETE USING (
  bucket_id = 'shared-invoices' 
  AND auth.role() = 'authenticated'
); 