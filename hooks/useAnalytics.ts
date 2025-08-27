/**
 * useAnalytics Hook
 * Easy-to-use React hook for analytics tracking
 */

import { useEffect, useRef } from 'react';
import analytics from '@/services/analyticsService';

export const useAnalytics = () => {
  console.log('[useAnalytics] 🎯 Hook called/instantiated');
  const isInitialized = useRef(false);

  useEffect(() => {
    // Initialize analytics service once
    console.log('[useAnalytics] Hook useEffect called, isInitialized.current:', isInitialized.current);
    if (!isInitialized.current) {
      console.log('[useAnalytics] 🚀 Calling analytics.initialize()...');
      analytics.initialize().then(() => {
        console.log('[useAnalytics] ✅ analytics.initialize() completed successfully');
      }).catch((error) => {
        console.error('[useAnalytics] ❌ analytics.initialize() failed:', error);
      });
      isInitialized.current = true;
      console.log('[useAnalytics] ✅ analytics.initialize() called, isInitialized.current now:', isInitialized.current);
    } else {
      console.log('[useAnalytics] ⚠️ Already initialized, skipping');
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
    
    // Manual flush for debugging
    flush: analytics.flush.bind(analytics),
    
    // Emergency debug test
    emergencyDebugTest: analytics.emergencyDebugTest.bind(analytics),
  };
};