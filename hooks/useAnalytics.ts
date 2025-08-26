/**
 * useAnalytics Hook
 * Easy-to-use React hook for analytics tracking
 */

import { useEffect, useRef } from 'react';
import analytics from '@/services/analyticsService';

export const useAnalytics = () => {
  const isInitialized = useRef(false);

  useEffect(() => {
    // Initialize analytics service once
    if (!isInitialized.current) {
      analytics.initialize();
      isInitialized.current = true;
    }
  }, []);

  return {
    // Your planned events
    trackSignUp: analytics.trackSignUp.bind(analytics),
    trackLandingPage: analytics.trackLandingPage.bind(analytics),
    trackAIChatUsage: analytics.trackAIChatUsage.bind(analytics),
    trackIndustryAdded: analytics.trackIndustryAdded.bind(analytics),
    trackInvoiceCreatedManually: analytics.trackInvoiceCreatedManually.bind(analytics),
    trackEstimateCreatedManually: analytics.trackEstimateCreatedManually.bind(analytics),
    
    // Additional useful events
    trackInvoiceCreatedViaAI: analytics.trackInvoiceCreatedViaAI.bind(analytics),
    trackEstimateCreatedViaAI: analytics.trackEstimateCreatedViaAI.bind(analytics),
    trackPaymentReceived: analytics.trackPaymentReceived.bind(analytics),
    
    // Generic tracking
    trackEvent: analytics.trackEvent.bind(analytics),
    
    // User management
    identifyUser: analytics.identifyUser.bind(analytics),
    setUserProperties: analytics.setUserProperties.bind(analytics),
    incrementUserProperty: analytics.incrementUserProperty.bind(analytics),
    setSuperProperties: analytics.setSuperProperties.bind(analytics),
  };
};