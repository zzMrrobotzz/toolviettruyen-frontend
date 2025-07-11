export interface AIRequest {
  prompt: string;
  systemInstruction?: string;
  provider: 'gemini' | 'openai' | 'deepseek';
  model?: string;
  useGoogleSearch?: boolean;
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export const generateTextViaBackend = async (request: AIRequest): Promise<AIResponse> => {
  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'AI generation failed');
    }

    const data = await response.json();
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