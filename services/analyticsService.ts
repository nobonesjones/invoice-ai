/**
 * Analytics Service for Invoice AI
 * Centralized Mixpanel analytics tracking
 */

import { Mixpanel } from 'mixpanel-react-native';

class AnalyticsService {
  private mixpanel: Mixpanel | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private eventQueue: Array<{ eventName: string; properties?: any }> = [];

  // Mixpanel project token from environment variable
  private readonly PROJECT_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN!;

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Allow disabling analytics during debugging to reduce noise
    if (String(process.env.EXPO_PUBLIC_DISABLE_ANALYTICS).toLowerCase() === 'true') {
      console.warn('[Analytics] ⚠️ Disabled by EXPO_PUBLIC_DISABLE_ANALYTICS');
      return;
    }

    // Check if Mixpanel token is available
    if (!process.env.EXPO_PUBLIC_MIXPANEL_TOKEN) {
      console.warn('[Analytics] ⚠️ EXPO_PUBLIC_MIXPANEL_TOKEN not set. Analytics disabled.');
      return;
    }

    try {
      // Initialize Mixpanel with proper serverURL configuration
      const trackAutomaticEvents = false; // We'll track manually for more control
      const useNative = true; // Native mode for React Native
      const serverURL = 'https://api.mixpanel.com'; // US data residency (change if EU/India)
      
      this.mixpanel = new Mixpanel(this.PROJECT_TOKEN, trackAutomaticEvents, useNative, serverURL);
      await this.mixpanel.init();
      
      // Disable debug logging for production
      this.mixpanel.setLoggingEnabled(false);
      this.isInitialized = true;
      
      this.mixpanel.track('Debug Test Event', {
        timestamp: new Date().toISOString(),
        test_event: true,
        sdk_version: 'mixpanel-react-native@3.1.2',
        platform: 'ios',
        environment: 'development'
      });
      
      // Force flush the test event immediately
      this.mixpanel.flush();

      // Process any queued events
      this.processEventQueue();
      
    } catch (error) {
      console.error('[Analytics] ❌ Failed to initialize Mixpanel:', error);
      console.error('[Analytics] ❌ Error details:', error.message);
      console.error('[Analytics] ❌ Error stack:', error.stack);
      console.error('[Analytics] ❌ Check: 1) Project token correct? 2) Data residency (US/EU/India)? 3) Network connection?');
      this.isInitialized = false; // Reset flag on failure
    }
  }

  /**
   * Process events that were queued before initialization
   */
  private processEventQueue() {
    if (this.eventQueue.length > 0) {
      this.eventQueue.forEach(({ eventName, properties }) => {
        this.trackEvent(eventName, properties, false); // Don't queue again
      });
      
      this.eventQueue = []; // Clear queue
    }
  }

  /**
   * Track an event with properties
   */
  trackEvent(eventName: string, properties?: any, allowQueue = true) {
    try {
      if (!this.isInitialized) {
        // If no token was provided, silently skip tracking
        if (!process.env.EXPO_PUBLIC_MIXPANEL_TOKEN) {
          return;
        }
        
        // Otherwise queue event for when Mixpanel is ready
        if (allowQueue) {
          this.eventQueue.push({ eventName, properties });
        }
        return;
      }

      if (!this.mixpanel) {
        console.warn('[Analytics] ⚠️ Mixpanel not initialized, skipping event:', eventName);
        return;
      }

      // Add timestamp and common properties
      const enrichedProperties = {
        ...properties,
        timestamp: new Date().toISOString(),
        app_version: '1.0.0', // You can get this from app config
        platform: 'mobile'
      };

      this.mixpanel.track(eventName, enrichedProperties);
      
      // Force flush for critical events to ensure they're sent immediately
      this.mixpanel.flush();
      
    } catch (error) {
      console.error(`[Analytics] ❌ Failed to track event ${eventName}:`, error);
      console.error(`[Analytics] ❌ Error stack:`, error.stack);
    }
  }

  /**
   * Identify a user (call on login/signup)
   */
  identifyUser(userId: string, userProperties?: any) {
    try {
      if (!this.mixpanel) {
        console.warn('[Analytics] ⚠️ Cannot identify user - Mixpanel not initialized');
        return;
      }

      this.mixpanel.identify(userId);

      if (userProperties) {
        this.setUserProperties(userProperties);
      }
      
    } catch (error) {
      console.error('[Analytics] ❌ Failed to identify user:', error);
    }
  }

  /**
   * Set user profile properties
   */
  setUserProperties(properties: any) {
    try {
      if (!this.mixpanel) {
        console.warn('[Analytics] ⚠️ Cannot set user properties - Mixpanel not initialized');
        return;
      }

      console.log('[Analytics] 📋 Setting user properties:', properties);
      this.mixpanel.getPeople().set(properties);
      
    } catch (error) {
      console.error('[Analytics] ❌ Failed to set user properties:', error);
    }
  }

  /**
   * Increment user property counters
   */
  incrementUserProperty(property: string, value: number = 1) {
    try {
      if (!this.mixpanel) {
        console.warn('[Analytics] ⚠️ Cannot increment user property - Mixpanel not initialized');
        return;
      }

      console.log(`[Analytics] ➕ Incrementing ${property} by ${value}`);
      this.mixpanel.getPeople().increment({ [property]: value });
      
    } catch (error) {
      console.error('[Analytics] ❌ Failed to increment user property:', error);
    }
  }

  /**
   * Set super properties (applied to all events)
   */
  setSuperProperties(properties: any) {
    try {
      if (!this.mixpanel) {
        console.warn('[Analytics] ⚠️ Cannot set super properties - Mixpanel not initialized');
        return;
      }

      console.log('[Analytics] 🌟 Setting super properties:', properties);
      this.mixpanel.registerSuperProperties(properties);
      
    } catch (error) {
      console.error('[Analytics] ❌ Failed to set super properties:', error);
    }
  }

  /**
   * Manually flush events (for debugging)
   */
  flush() {
    try {
      if (!this.mixpanel) {
        console.warn('[Analytics] ⚠️ Cannot flush - Mixpanel not initialized');
        return;
      }

      console.log('[Analytics] 🚽 Manually flushing events...');
      this.mixpanel.flush();
      console.log('[Analytics] ✅ Events flushed - Check Mixpanel Live View now!');
      
    } catch (error) {
      console.error('[Analytics] ❌ Failed to flush events:', error);
    }
  }

  /**
   * Emergency debug test - try different approaches
   */
  emergencyDebugTest() {
    console.log('🚨 ===== EMERGENCY MIXPANEL DEBUG =====');
    console.log('🔍 Current state:');
    console.log('  - isInitialized:', this.isInitialized);
    console.log('  - mixpanel exists:', !!this.mixpanel);
    console.log('  - Project token:', this.PROJECT_TOKEN);
    
    if (!this.mixpanel) {
      console.error('❌ Mixpanel not initialized! Call analytics.initialize() first');
      return;
    }

    console.log('📤 Sending multiple test events with different approaches...');
    
    // Test 1: Minimal event
    this.mixpanel.track('Emergency Test 1', { test: true });
    this.mixpanel.flush();
    
    // Test 2: With distinct_id
    this.mixpanel.track('Emergency Test 2', { 
      test: true,
      distinct_id: 'debug_user_123',
      timestamp: new Date().toISOString()
    });
    this.mixpanel.flush();
    
    console.log('🚨 Emergency tests sent - check Mixpanel Live View!');
    console.log('🔍 If no events appear, the project token is likely wrong');
  }

  /**
   * Force flush all queued events
   */
  flush() {
    try {
      if (!this.mixpanel) {
        console.warn('[Analytics] ⚠️ Cannot flush - Mixpanel not initialized');
        return;
      }

      console.log('[Analytics] 🔄 Flushing queued events...');
      this.mixpanel.flush();
      console.log('[Analytics] ✅ Events flushed');
      
    } catch (error) {
      console.error('[Analytics] ❌ Failed to flush events:', error);
    }
  }

  // === YOUR PLANNED EVENTS ===

  /**
   * 1. User signed up
   */
  trackSignUp(properties: {
    signup_method?: 'email' | 'google' | 'apple';
    referral_source?: 'organic' | 'ad' | 'referral';
    user_type?: 'business_owner' | 'freelancer' | 'accountant';
    country?: string;
  }) {
    this.trackEvent('Signed Up', {
      ...properties,
      signup_timestamp: new Date().toISOString()
    });
  }

  /**
   * 2. Landing page interaction
   */
  trackLandingPage(properties: {
    page_section?: 'hero' | 'features' | 'pricing' | 'testimonials';
    cta_clicked?: 'get_started' | 'learn_more' | 'demo';
    time_on_page_seconds?: number;
    scroll_depth_percentage?: number;
  }) {
    this.trackEvent('Landing page', properties);
  }

  /**
   * 3. Used AI chat - Your key engagement event
   */
  trackAIChatUsage(properties: {
    message_count_in_session?: number;
    intent_detected?: 'create_invoice' | 'create_estimate' | 'update_document' | 'general_query';
    ai_functions_called?: string[];
    response_time_ms?: number;
    user_satisfied?: boolean;
    conversation_length_minutes?: number;
  }) {
    this.trackEvent('Used AI chat', properties);
  }

  /**
   * 4. Added industry - Onboarding step
   */
  trackIndustryAdded(properties: {
    industry_selected?: string;
    onboarding_step?: number;
    time_to_complete_step_seconds?: number;
    is_custom_industry?: boolean;
  }) {
    this.trackEvent('Added industry', properties);
  }

  /**
   * 5. Created invoice manually
   */
  trackInvoiceCreatedManually(properties: {
    invoice_amount?: number;
    currency?: string;
    line_items_count?: number;
    has_discount?: boolean;
    discount_type?: 'percentage' | 'fixed';
    discount_value?: number;
    payment_methods_enabled?: string[];
    time_to_create_minutes?: number;
  }) {
    this.trackEvent('Created invoice manually', {
      ...properties,
      creation_method: 'manual'
    });
  }

  /**
   * 6. Created estimate manually
   */
  trackEstimateCreatedManually(properties: {
    estimate_amount?: number;
    currency?: string;
    validity_days?: number;
    line_items_count?: number;
    template_used?: string;
    time_to_create_minutes?: number;
    follow_up_reminder_set?: boolean;
  }) {
    this.trackEvent('Created estimate manually', {
      ...properties,
      creation_method: 'manual'
    });
  }

  // === ADDITIONAL USEFUL EVENTS ===

  /**
   * AI-created documents (to compare with manual)
   */
  trackInvoiceCreatedViaAI(properties: {
    invoice_amount?: number;
    currency?: string;
    line_items_count?: number;
    time_to_create_minutes?: number;
    ai_confidence_score?: number;
  }) {
    this.trackEvent('Created invoice via AI', {
      ...properties,
      creation_method: 'ai_assisted'
    });
  }

  trackEstimateCreatedViaAI(properties: {
    estimate_amount?: number;
    currency?: string;
    time_to_create_minutes?: number;
    ai_confidence_score?: number;
  }) {
    this.trackEvent('Created estimate via AI', {
      ...properties,
      creation_method: 'ai_assisted'
    });
  }

  /**
   * Payment tracking
   */
  trackPaymentReceived(properties: {
    invoice_number?: string;
    amount?: number;
    payment_method?: string;
    days_to_payment?: number;
    was_reminder_sent?: boolean;
  }) {
    this.trackEvent('Payment Received', properties);
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Note: Initialization now handled by useAnalytics hook to prevent race conditions
// No auto-initialization to avoid double initialization with useAnalytics hook

export default analytics;
