// API Configuration with wrapper support
const USE_PAYMENT_WRAPPER = false; // Set to false to use fixed backend

const ORIGINAL_BACKEND = "https://key-manager-backend.onrender.com/api";
const PAYMENT_WRAPPER_URL = "https://your-wrapper-url.railway.app"; // Update this after deployment

// Use Netlify proxy to avoid CORS issues
const API_BASE_URL = "/api";

// Main API URL for most endpoints
const MAIN_API_URL = "/api";

// Payment API URL (can be wrapper or original)
const PAYMENT_API_URL = USE_PAYMENT_WRAPPER ? PAYMENT_WRAPPER_URL : "/api";

export { 
  API_BASE_URL, 
  MAIN_API_URL, 
  PAYMENT_API_URL,
  USE_PAYMENT_WRAPPER 
};