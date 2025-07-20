// API Configuration with wrapper support
const USE_PAYMENT_WRAPPER = true; // Set to true to use payment wrapper

const ORIGINAL_BACKEND = "https://key-manager-backend.onrender.com/api";
const PAYMENT_WRAPPER_URL = "https://your-wrapper-url.railway.app"; // Update this after deployment

// Use wrapper for payment endpoints, original for others
const API_BASE_URL = USE_PAYMENT_WRAPPER && (
  window.location.pathname === '/payment' || 
  document.referrer.includes('payment')
) ? PAYMENT_WRAPPER_URL : ORIGINAL_BACKEND;

// Main API URL for most endpoints
const MAIN_API_URL = ORIGINAL_BACKEND;

// Payment API URL (can be wrapper or original)
const PAYMENT_API_URL = USE_PAYMENT_WRAPPER ? PAYMENT_WRAPPER_URL : ORIGINAL_BACKEND;

export { 
  API_BASE_URL, 
  MAIN_API_URL, 
  PAYMENT_API_URL,
  USE_PAYMENT_WRAPPER 
};