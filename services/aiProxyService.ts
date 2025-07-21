import { API_BASE_URL } from '../config';

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

// Hàm chính để gọi AI qua webadmin backend
export const generateTextViaBackend = async (
  request: AIRequest,
  updateCreditFunction: (newCredit: number) => void
): Promise<AIResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'AI generation failed');
    }

    if (data.success && typeof data.remainingCredits === 'number') {
      updateCreditFunction(data.remainingCredits);
    }

    return data;
  } catch (error) {
    console.error('Error calling AI via backend:', error);
    throw error;
  }
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
  try {
    const response = await fetch(`${API_BASE_URL}/ai/generate-image`, {
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
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Image generation failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling image generation via backend:', error);
    throw error;
  }
}; 