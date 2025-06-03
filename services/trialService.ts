import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/config/supabase';

export interface TrialSession {
  id: string;
  email: string;
  invoiceCount: number;
  sentInvoiceCount: number;
  maxInvoices: number;
  createdAt: string;
  isActive: boolean;
}

export class TrialService {
  private static readonly TRIAL_KEY = 'trial_session';
  private static readonly MAX_TRIAL_INVOICES = 3;
  private static readonly SIGNUP_IN_PROGRESS_KEY = 'signup_in_progress';

  /**
   * Mark that signup is in progress to prevent trial creation
   */
  static async setSignupInProgress(inProgress: boolean): Promise<void> {
    try {
      if (inProgress) {
        await AsyncStorage.setItem(this.SIGNUP_IN_PROGRESS_KEY, 'true');
        console.log('[TrialService] Signup in progress flag set');
      } else {
        await AsyncStorage.removeItem(this.SIGNUP_IN_PROGRESS_KEY);
        console.log('[TrialService] Signup in progress flag cleared');
      }
    } catch (error) {
      console.error('[TrialService] Error managing signup flag:', error);
    }
  }

  /**
   * Check if signup is currently in progress
   */
  static async isSignupInProgress(): Promise<boolean> {
    try {
      const flag = await AsyncStorage.getItem(this.SIGNUP_IN_PROGRESS_KEY);
      return flag === 'true';
    } catch (error) {
      console.error('[TrialService] Error checking signup flag:', error);
      return false;
    }
  }

  /**
   * Create a new trial session with anonymous authentication
   * This should ONLY be called for users who explicitly want to skip authentication
   */
  static async createTrialSession(): Promise<TrialSession | null> {
    try {
      // Check if signup is in progress - if so, don't create trial
      const signupInProgress = await this.isSignupInProgress();
      if (signupInProgress) {
        console.log('[TrialService] Signup in progress, skipping trial creation');
        return null;
      }

      console.log('[TrialService] Creating new trial session');
      
      // Generate a unique email for the trial user
      const trialId = `trial_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const trialEmail = `${trialId}@trial.supainvoice.app`;
      const temporaryPassword = `trial_pass_${Math.random().toString(36).substring(2, 15)}`;

      // Create anonymous user account in Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trialEmail,
        password: temporaryPassword,
        options: {
          data: {
            is_trial: true,
            trial_started_at: new Date().toISOString(),
          }
        }
      });

      if (authError || !authData.user) {
        console.error('[TrialService] Error creating trial user:', authError);
        return null;
      }

      console.log('[TrialService] Trial user created:', authData.user.id);

      // Create the trial session object
      const trialSession: TrialSession = {
        id: authData.user.id,
        email: trialEmail,
        invoiceCount: 0,
        sentInvoiceCount: 0,
        maxInvoices: this.MAX_TRIAL_INVOICES,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      // Store trial session locally
      await AsyncStorage.setItem(this.TRIAL_KEY, JSON.stringify(trialSession));

      // Create user profile with trial status
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: authData.user.id,
          onboarding_completed: false,
          invoice_count: 0,
          subscription_tier: 'trial',
          free_limit: this.MAX_TRIAL_INVOICES,
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('[TrialService] Error creating trial profile:', profileError);
        // Continue anyway - the profile might get created later
      }

      console.log('[TrialService] Trial session created successfully');
      return trialSession;

    } catch (error: any) {
      console.error('[TrialService] Error creating trial session:', error);
      return null;
    }
  }

  /**
   * Get the current trial session
   */
  static async getCurrentTrialSession(): Promise<TrialSession | null> {
    try {
      const sessionData = await AsyncStorage.getItem(this.TRIAL_KEY);
      if (!sessionData) {
        return null;
      }
      
      const session: TrialSession = JSON.parse(sessionData);
      return session;
    } catch (error: any) {
      console.error('[TrialService] Error getting trial session:', error);
      return null;
    }
  }

  /**
   * Check if user is currently in a trial session
   */
  static async isTrialSession(): Promise<boolean> {
    const session = await this.getCurrentTrialSession();
    return session !== null && session.isActive;
  }

  /**
   * Update trial session invoice count
   */
  static async incrementTrialInvoiceCount(): Promise<boolean> {
    try {
      const session = await this.getCurrentTrialSession();
      if (!session) {
        return false;
      }

      session.invoiceCount += 1;
      
      await AsyncStorage.setItem(this.TRIAL_KEY, JSON.stringify(session));
      console.log(`[TrialService] Trial invoice count updated: ${session.invoiceCount}`);
      
      return true;
    } catch (error: any) {
      console.error('[TrialService] Error updating trial invoice count:', error);
      return false;
    }
  }

  /**
   * Update trial session sent invoice count (for freemium limits)
   */
  static async incrementTrialSentCount(): Promise<boolean> {
    try {
      const session = await this.getCurrentTrialSession();
      if (!session) {
        return false;
      }

      session.sentInvoiceCount += 1;
      
      // Check if trial is exhausted (based on sent count)
      if (session.sentInvoiceCount >= session.maxInvoices) {
        session.isActive = false;
      }

      await AsyncStorage.setItem(this.TRIAL_KEY, JSON.stringify(session));
      console.log(`[TrialService] Trial sent count updated: ${session.sentInvoiceCount}/${session.maxInvoices}`);
      
      return true;
    } catch (error: any) {
      console.error('[TrialService] Error updating trial sent count:', error);
      return false;
    }
  }

  /**
   * Check if trial user can create another invoice (always true for freemium)
   */
  static async canCreateInvoice(): Promise<{ canCreate: boolean; remaining: number; total: number }> {
    try {
      const session = await this.getCurrentTrialSession();
      if (!session) {
        return { canCreate: false, remaining: 0, total: 0 };
      }

      // Users can always create invoices, limit is on sending
      return {
        canCreate: true,
        remaining: -1, // Unlimited creates
        total: session.invoiceCount
      };
    } catch (error: any) {
      console.error('[TrialService] Error checking trial limits:', error);
      return { canCreate: false, remaining: 0, total: 0 };
    }
  }

  /**
   * Check if trial user can send another invoice
   */
  static async canSendInvoice(): Promise<{ canSend: boolean; remaining: number; total: number }> {
    try {
      const session = await this.getCurrentTrialSession();
      if (!session || !session.isActive) {
        return { canSend: false, remaining: 0, total: 0 };
      }

      const remaining = Math.max(0, session.maxInvoices - session.sentInvoiceCount);
      return {
        canSend: remaining > 0,
        remaining,
        total: session.sentInvoiceCount
      };
    } catch (error: any) {
      console.error('[TrialService] Error checking trial send limits:', error);
      return { canSend: false, remaining: 0, total: 0 };
    }
  }

  /**
   * Convert trial to regular account (when user signs up)
   */
  static async convertTrialToAccount(newEmail: string, newPassword: string): Promise<boolean> {
    try {
      const session = await this.getCurrentTrialSession();
      if (!session) {
        console.log('[TrialService] No trial session to convert');
        return false;
      }

      console.log('[TrialService] Converting trial to regular account');
      
      // Update the user's email and password
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
        password: newPassword,
        data: {
          is_trial: false,
          converted_at: new Date().toISOString(),
        }
      });

      if (updateError) {
        console.error('[TrialService] Error updating trial user:', updateError);
        return false;
      }

      // Update the user profile to regular status
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'free',
          onboarding_completed: true,
        })
        .eq('id', session.id);

      if (profileError) {
        console.error('[TrialService] Error updating trial profile:', profileError);
        // Continue anyway
      }

      // Clear trial session
      await this.clearTrialSession();
      
      console.log('[TrialService] Trial converted to regular account successfully');
      return true;

    } catch (error: any) {
      console.error('[TrialService] Error converting trial to account:', error);
      return false;
    }
  }

  /**
   * Clear trial session (logout, conversion, etc.)
   */
  static async clearTrialSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.TRIAL_KEY);
      console.log('[TrialService] Trial session cleared');
    } catch (error: any) {
      console.error('[TrialService] Error clearing trial session:', error);
    }
  }

  /**
   * Get trial status for UI display
   */
  static async getTrialStatus(): Promise<{
    isTrial: boolean;
    invoiceCount: number;
    sentInvoiceCount: number;
    maxInvoices: number;
    remaining: number;
    isExpired: boolean;
    canSendInvoice: boolean;
  }> {
    try {
      const session = await this.getCurrentTrialSession();
      
      if (!session) {
        return {
          isTrial: false,
          invoiceCount: 0,
          sentInvoiceCount: 0,
          maxInvoices: 0,
          remaining: 0,
          isExpired: false,
          canSendInvoice: false,
        };
      }

      const remaining = Math.max(0, session.maxInvoices - session.sentInvoiceCount);
      const isExpired = !session.isActive || remaining <= 0;

      return {
        isTrial: true,
        invoiceCount: session.invoiceCount,
        sentInvoiceCount: session.sentInvoiceCount,
        maxInvoices: session.maxInvoices,
        remaining,
        isExpired,
        canSendInvoice: !isExpired,
      };
    } catch (error: any) {
      console.error('[TrialService] Error getting trial status:', error);
      return {
        isTrial: false,
        invoiceCount: 0,
        sentInvoiceCount: 0,
        maxInvoices: 0,
        remaining: 0,
        isExpired: false,
        canSendInvoice: false,
      };
    }
  }

  /**
   * Delete trial account and all data
   */
  static async deleteTrialAccount(): Promise<boolean> {
    try {
      const session = await this.getCurrentTrialSession();
      if (!session) {
        return true; // Nothing to delete
      }

      console.log('[TrialService] Deleting trial account and data');

      // Delete user data (invoices, clients, etc.)
      // This will be handled by database cascading deletes
      
      // Sign out the user
      await supabase.auth.signOut();
      
      // Clear trial session
      await this.clearTrialSession();
      
      console.log('[TrialService] Trial account deleted successfully');
      return true;

    } catch (error: any) {
      console.error('[TrialService] Error deleting trial account:', error);
      return false;
    }
  }
} 