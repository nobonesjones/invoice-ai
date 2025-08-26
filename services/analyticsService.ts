/**
 * Analytics Service for Invoice AI
 * Centralized Mixpanel analytics tracking
 */

import { Mixpanel } from 'mixpanel-react-native';

class AnalyticsService {
  private mixpanel: Mixpanel | null = null;
  private isInitialized = false;
  private eventQueue: Array<{ eventName: string; properties?: any }> = [];

  // Your Mixpanel project token
  private readonly PROJECT_TOKEN = '16d86d8fa0dd77452a8f81d7a256e527';

  async initialize() {
    try {
      console.log('[Analytics] Initializing Mixpanel...');
      
      // Initialize Mixpanel
      const trackAutomaticEvents = false; // We'll track manually for more control
      this.mixpanel = new Mixpanel(this.PROJECT_TOKEN, trackAutomaticEvents);
      await this.mixpanel.init();
      
      this.isInitialized = true;
      console.log('[Analytics] ✅ Mixpanel initialized successfully');

      // Process any queued events
      this.processEventQueue();
      
    } catch (error) {
      console.error('[Analytics] ❌ Failed to initialize Mixpanel:', error);
    }
  }

  /**
   * Process events that were queued before initialization
   */
  private processEventQueue() {
    if (this.eventQueue.length > 0) {
      console.log(`[Analytics] Processing ${this.eventQueue.length} queued events`);
      
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
      if (!this.isInitialized && allowQueue) {
        // Queue event for when Mixpanel is ready
        console.log(`[Analytics] 📝 Queueing event: ${eventName}`);
        this.eventQueue.push({ eventName, properties });
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

      console.log(`[Analytics] 📊 Tracking: ${eventName}`, enrichedProperties);
      this.mixpanel.track(eventName, enrichedProperties);
      
    } catch (error) {
      console.error(`[Analytics] ❌ Failed to track event ${eventName}:`, error);
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

      console.log(`[Analytics] 👤 Identifying user: ${userId}`);
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
export default analytics;