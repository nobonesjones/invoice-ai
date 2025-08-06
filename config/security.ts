// Security Configuration Service
// ⚠️  This is a development-only configuration
// 🚨 For production, move sensitive keys to backend services

interface SecurityConfig {
  // Client-safe keys (designed for client-side usage)
  clientSafe: {
    supabase: {
      url: string;
      anonKey: string;
    };
    payments: {
      superwall: string;
      revenueCat: string;
    };
  };
  
  // ⚠️  Development only - these should be server-side in production
  developmentOnly: {
    ai: {
      openai: string;
      gemini: string;
    };
    supabase: {
      serviceRoleKey: string; // 🚨 CRITICAL: Never use in production client
    };
  };
}

class SecurityService {
  private config: SecurityConfig;
  
  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }
  
  private loadConfiguration(): SecurityConfig {
    return {
      clientSafe: {
        supabase: {
          url: process.env.EXPO_PUBLIC_API_URL || '',
          anonKey: process.env.EXPO_PUBLIC_API_KEY || '',
        },
        payments: {
          superwall: process.env.EXPO_PUBLIC_SUPERWALL_API_KEY || '',
          revenueCat: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '',
        }
      },
      developmentOnly: {
        ai: {
          openai: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
          gemini: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
        },
        supabase: {
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        }
      }
    };
  }
  
  private validateConfiguration() {
    const missing: string[] = [];
    
    // Check client-safe required keys
    if (!this.config.clientSafe.supabase.url) missing.push('EXPO_PUBLIC_API_URL');
    if (!this.config.clientSafe.supabase.anonKey) missing.push('EXPO_PUBLIC_API_KEY');
    
    if (missing.length > 0) {
      console.warn('⚠️  Missing required environment variables:', missing.join(', '));
    }
    
    // Security warnings for production
    if (__DEV__) {
      if (this.config.developmentOnly.supabase.serviceRoleKey) {
        console.warn('🚨 SECURITY WARNING: Service role key detected in client code. This should be server-side only in production!');
      }
      
      if (this.config.developmentOnly.ai.openai || this.config.developmentOnly.ai.gemini) {
        console.warn('⚠️  COST WARNING: AI API keys detected in client code. Consider moving to backend to prevent abuse.');
      }
    }
  }
  
  // Safe getters for client-side keys
  getSupabaseConfig() {
    return this.config.clientSafe.supabase;
  }
  
  getPaymentConfig() {
    return this.config.clientSafe.payments;
  }
  
  // 🚨 Development only - do not use in production
  getDevelopmentAIKeys() {
    if (!__DEV__) {
      throw new Error('AI keys should not be accessed in production build');
    }
    return this.config.developmentOnly.ai;
  }
  
  // 🚨 CRITICAL: This should never be called in production
  getDevelopmentServiceKey() {
    if (!__DEV__) {
      throw new Error('Service role key should never be accessed in production build');
    }
    console.error('🚨 CRITICAL: Service role key accessed in client code!');
    return this.config.developmentOnly.supabase.serviceRoleKey;
  }
  
  // Security status check
  getSecurityStatus() {
    return {
      isProduction: !__DEV__,
      hasServiceRoleKey: !!this.config.developmentOnly.supabase.serviceRoleKey,
      hasAIKeys: !!(this.config.developmentOnly.ai.openai || this.config.developmentOnly.ai.gemini),
      securityLevel: __DEV__ ? 'DEVELOPMENT_ONLY' : 'PRODUCTION',
      recommendations: this.getSecurityRecommendations()
    };
  }
  
  private getSecurityRecommendations() {
    const recommendations: string[] = [];
    
    if (this.config.developmentOnly.supabase.serviceRoleKey) {
      recommendations.push('Move Supabase service role key to backend server');
    }
    
    if (this.config.developmentOnly.ai.openai) {
      recommendations.push('Move OpenAI API calls to backend server');
    }
    
    if (this.config.developmentOnly.ai.gemini) {
      recommendations.push('Move Gemini API calls to backend server');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Current configuration follows client-side security best practices');
    }
    
    return recommendations;
  }
}

export const securityService = new SecurityService();
export default securityService;