// Chuẩn hoá 2 hàm FE cho YoutubeSeoModule
// Hàm generateText: trả về { text: string }
export const generateText = async (
  prompt: string,
  systemInstruction?: string,
  apiSettings?: any
): Promise<{ text: string }> => {
  const response = await fetch('/api/ai/generate-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
    },
    body: JSON.stringify({ prompt, systemInstruction, ...apiSettings }),
  });
  if (!response.ok) throw new Error('AI proxy error');
  return await response.json();
};

// Hàm generateTextWithJsonOutput: trả về JSON object
export const generateTextWithJsonOutput = async <T,>(
  prompt: string,
  systemInstruction?: string,
  apiSettings?: any
): Promise<T> => {
  const response = await fetch('/api/ai/generate-text-json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
    },
    body: JSON.stringify({ prompt, systemInstruction, ...apiSettings }),
  });
  if (!response.ok) throw new Error('AI proxy error');
  return await response.json();
};
import { API_BASE_URL } from '../config';

export interface AIRequest {
  prompt: string;
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
  remainingCredits?: number;
}

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

export const generateImageViaBackend = async (
  prompt: string, 
  aspectRatio: string = "16:9",
  provider: 'gemini' | 'stability' = 'gemini'
): Promise<{ success: boolean; imageData?: string; error?: string }> => {
  try {
    const response = await fetch('/api/ai/generate-image', {
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