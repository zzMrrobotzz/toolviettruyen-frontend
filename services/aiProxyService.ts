import { API_BASE_URL } from '../config';

// Fallback to direct backend URL when proxy fails
const DIRECT_BACKEND_URL = "https://key-manager-backend.onrender.com/api";

export interface AIRequest {
  prompt: string;
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  useGoogleSearch?: boolean;
  options?: any;
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
  remainingCredits?: number;
}

// Utility function for retry with exponential backoff and fallback
const retryWithBackoffAndFallback = async <T>(
  fn: (apiUrl: string) => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError;
  const apiUrls = [API_BASE_URL, DIRECT_BACKEND_URL];
  
  for (const apiUrl of apiUrls) {
    console.log(`Trying API: ${apiUrl}`);
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn(apiUrl);
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.message?.includes('unauthorized') || error.message?.includes('forbidden')) {
          throw error;
        }
        
        // If this was the last attempt for this URL, try next URL
        if (i === maxRetries) {
          console.log(`Failed with ${apiUrl} after ${maxRetries + 1} attempts`);
          break;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`Retrying request... Attempt ${i + 2}/${maxRetries + 1} with ${apiUrl}`);
      }
    }
  }
  
  throw new Error(`All API endpoints failed. Last error: ${lastError?.message}`);
};

// Hàm chính để gọi AI qua webadmin backend
export const generateTextViaBackend = async (
  request: AIRequest,
  updateCreditFunction: (newCredit: number) => void,
  signal?: AbortSignal // Thêm tham số signal tùy chọn
): Promise<AIResponse> => {
  return retryWithBackoffAndFallback(async (apiUrl: string) => {
    // Nếu signal đã bị hủy trước khi bắt đầu, hãy dừng lại ngay
    if (signal?.aborted) {
      throw new DOMException('Request aborted by user', 'AbortError');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

    // Lắng nghe sự kiện abort từ signal bên ngoài
    signal?.addEventListener('abort', () => controller.abort());

    try {
      const response = await fetch(`${apiUrl}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        // Handle non-JSON responses (like HTML error pages from proxy)
        if (response.status === 504) {
          throw new Error('Server timeout - please try again in a moment');
        }
        throw new Error(`Server error (${response.status}): ${response.statusText}`);
      }

      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Server timeout - please try again in a moment');
        }
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }

      if (data.success && typeof data.remainingCredits === 'number') {
        updateCreditFunction(data.remainingCredits);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error('Request timeout:', error);
        throw new Error('Request timeout - please try again');
      }
      
      console.error('Error calling AI via backend:', error);
      throw error;
    }
  }, 1); // Retry once per endpoint
};

// Wrapper function để tương thích với các module cũ
export const generateText = async (
  prompt: string,
  systemInstruction?: string,
  useJsonOutput?: boolean,
  apiSettings?: any
): Promise<{ text: string }> => {
  const request: AIRequest = {
    prompt,
    systemInstruction,
    provider: apiSettings?.provider || 'gemini',
    model: apiSettings?.model,
    temperature: apiSettings?.temperature,
    maxTokens: apiSettings?.maxTokens,
    useGoogleSearch: false,
    options: {
      useJsonOutput
    }
  };

  const result = await generateTextViaBackend(request, (newCredit) => {
    // Update credit if needed
  });

  if (!result.success) {
    throw new Error(result.error || 'AI generation failed');
  }

  return { text: result.text || '' };
};

// Wrapper function để tương thích với các module cũ
export const generateTextWithJsonOutput = async <T,>(
  prompt: string,
  systemInstruction?: string,
  apiSettings?: any
): Promise<T> => {
  const request: AIRequest = {
    prompt,
    systemInstruction,
    provider: apiSettings?.provider || 'gemini',
    model: apiSettings?.model,
    temperature: apiSettings?.temperature,
    maxTokens: apiSettings?.maxTokens,
    useGoogleSearch: false,
    options: {
      useJsonOutput: true
    }
  };

  const result = await generateTextViaBackend(request, (newCredit) => {
    // Update credit if needed
  });

  if (!result.success) {
    throw new Error(result.error || 'AI generation failed');
  }

  // Try to parse as JSON
  try {
    return JSON.parse(result.text || '{}');
  } catch (e) {
    throw new Error('Failed to parse JSON response');
  }
};

export const generateImageViaBackend = async (
  prompt: string, 
  aspectRatio: string = "16:9",
  provider: 'gemini' | 'stability' = 'gemini'
): Promise<{ success: boolean; imageData?: string; error?: string }> => {
  return retryWithBackoffAndFallback(async (apiUrl: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout for images

    try {
      const response = await fetch(`${apiUrl}/ai/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
        },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          provider,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Image generation timeout - please try again');
        }
        
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${response.statusText}`);
        }
        
        throw new Error(errorData.message || 'Image generation failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error('Image generation timeout:', error);
        throw new Error('Image generation timeout - please try again');
      }
      
      console.error('Error calling image generation via backend:', error);
      throw error;
    }
  }, 0); // No retry for images, just try both endpoints once
}; 