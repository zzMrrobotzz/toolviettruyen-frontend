
import { ElevenLabsVoice } from '../types';
import { ELEVENLABS_API_URL } from '../constants';

export const fetchElevenLabsVoices = async (apiKey: string, signal?: AbortSignal): Promise<ElevenLabsVoice[]> => {
  if (!apiKey) throw new Error("ElevenLabs API Key is required.");
  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: { 'xi-api-key': apiKey },
    signal: signal,
  });
  if (!response.ok) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const errorData = await response.json().catch(() => ({}));
    const customError = new Error(`Failed to fetch ElevenLabs voices: ${response.status} ${response.statusText}. ${errorData.detail?.message || ''}`) as any;
    customError.statusCode = response.status;
    customError.details = errorData.detail;
    throw customError;
  }
  const data = await response.json();
  return data.voices as ElevenLabsVoice[];
};

export const generateElevenLabsSpeech = async (apiKey: string, text: string, voiceId: string, signal?: AbortSignal): Promise<Blob> => {
  if (!apiKey) throw new Error("ElevenLabs API Key is required.");
  if (!text) throw new Error("Text to speak is required.");
  if (!voiceId) throw new Error("Voice ID is required.");

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2", // or other models as needed
      // voice_settings: { stability: 0.5, similarity_boost: 0.75 } // Optional
    }),
    signal: signal,
  });

  if (!response.ok) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const errorData = await response.json().catch(() => ({})); 
    let message = `ElevenLabs TTS failed: ${response.status} ${response.statusText}.`;
    if (errorData && errorData.detail && errorData.detail.message) {
        message += ` Details: ${errorData.detail.message}`;
    } else if (errorData && errorData.detail && typeof errorData.detail === 'string') {
        message += ` Details: ${errorData.detail}`;
    }
    const customError = new Error(message) as any;
    customError.statusCode = response.status;
    customError.details = errorData.detail;
    throw customError;
  }
  return response.blob();
};

export const checkElevenLabsBalance = async (apiKey: string, signal?: AbortSignal): Promise<{character_limit: number, character_count: number, character_left?: number}> => {
    if (!apiKey) throw new Error("ElevenLabs API Key is required.");
    const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
        headers: { 'xi-api-key': apiKey },
        signal: signal,
    });
    if (!response.ok) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const errorData = await response.json().catch(() => ({}));
        const customError = new Error(`Failed to fetch ElevenLabs balance: ${response.status} ${response.statusText}. ${errorData.detail?.message || ''}`) as any;
        customError.statusCode = response.status;
        customError.details = errorData.detail;
        throw customError;
    }
    const data = await response.json();
    return {
      ...data,
      character_left: data.character_limit - data.character_count
    };
};