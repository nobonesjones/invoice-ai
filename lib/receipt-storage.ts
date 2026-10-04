import { supabase } from '@/lib/supabase';

export interface ReceiptUploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Generates a standardized path for receipt images
 * Format: {user_id}/receipts/{expense_id}_{timestamp}.{extension}
 */
export function generateReceiptPath(
  userId: string, 
  expenseId: string, 
  extension: string = 'jpg'
): string {
  const timestamp = Date.now();
  return `${userId}/receipts/${expenseId}_${timestamp}.${extension}`;
}

/**
 * Uploads a receipt image to Supabase storage
 */
export async function uploadReceiptImage(
  file: File | Blob,
  userId: string,
  expenseId: string,
  fileName?: string
): Promise<ReceiptUploadResult> {
  try {
    // Get file extension from filename or default to jpg
    const extension = fileName ? fileName.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
    
    // Validate file type
    const allowedTypes = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowedTypes.includes(extension)) {
      return {
        success: false,
        error: 'Invalid file type. Please use JPG, PNG, or WebP images.'
      };
    }

    // Generate the storage path
    const storagePath = generateReceiptPath(userId, expenseId, extension);

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('receipt-images')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true // Allow overwriting existing files
      });

    if (error) {
      console.error('Storage upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('receipt-images')
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path
    };

  } catch (error) {
    console.error('Receipt upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload receipt'
    };
  }
}

/**
 * Deletes a receipt image from storage
 */
export async function deleteReceiptImage(imagePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('receipt-images')
      .remove([imagePath]);

    if (error) {
      console.error('Storage delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Receipt delete error:', error);
    return false;
  }
}

/**
 * Gets a signed URL for a receipt image (for private access)
 */
export async function getSignedReceiptUrl(imagePath: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('receipt-images')
      .createSignedUrl(imagePath, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Receipt signed URL error:', error);
    return null;
  }
}

/**
 * Updates an expense record with the receipt image URL
 */
export async function updateExpenseReceiptUrl(
  expenseId: string,
  receiptImageUrl: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('expenses')
      .update({ receipt_image_url: receiptImageUrl })
      .eq('id', expenseId);

    if (error) {
      console.error('Database update error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Expense update error:', error);
    return false;
  }
}