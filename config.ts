// Centralized API configuration - prevents runtime environment errors
export const API_CONFIG = {
  // These are production-safe defaults - actual keys should be injected via user settings
  GEMINI_API_KEY: 'default_gemini_key_placeholder',
  OPENAI_API_KEY: 'default_openai_key_placeholder', 
  ELEVENLABS_API_KEY: 'default_elevenlabs_key_placeholder',
  STABILITY_API_KEY: 'default_stability_key_placeholder',
  DEEPSEEK_API_KEY: 'default_deepseek_key_placeholder',
  
  // Backend configuration
  BACKEND_URL: 'https://key-manager-backend.onrender.com/api',
  
  // Runtime environment detection
  IS_BROWSER: typeof window !== 'undefined',
  IS_PRODUCTION: process.env.NODE_ENV === 'production'
};

// Helper to get API key with fallbacks
export const getApiKey = (keyName: keyof typeof API_CONFIG): string => {
  return API_CONFIG[keyName] as string;
}; 