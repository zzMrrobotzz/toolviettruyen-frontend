
import React, { useState, useCallback, useEffect } from 'react';
import { ApiSettings, ElevenLabsApiKey, ElevenLabsVoice, SuperAgentModuleState } from '../../types'; // Character import removed
import { ASPECT_RATIO_OPTIONS, SUPER_AGENT_WORD_COUNT_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend, generateImageViaBackend } from '../../services/aiProxyService';
import { useAppContext } from '../../AppContext';
import { fetchElevenLabsVoices, generateElevenLabsSpeech } from '../../services/elevenLabsService';
import { delay } from '../../utils'; // Added delay import

interface SuperAgentModuleProps {
  apiSettings: ApiSettings;
  // characters: Character[]; // Removed
  elevenLabsApiKeys: ElevenLabsApiKey[];
  setElevenLabsApiKeys: (keys: ElevenLabsApiKey[]) => void;
  moduleState: SuperAgentModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<SuperAgentModuleState>>;
}

const SuperAgentModule: React.FC<SuperAgentModuleProps> = ({ 
  apiSettings, /*characters,*/ elevenLabsApiKeys, setElevenLabsApiKeys, moduleState, setModuleState 
}) => {
  const {
    sourceText, wordCount, imageCount, aspectRatio, // selectedCharacterId removed
    selectedTtsApiKey, availableVoices, selectedTtsVoiceId,
    generatedStory, generatedImages, generatedAudioUrl, ttsError, error
  } = moduleState;

  const { consumeCredit } = useAppContext();
  
  const updateState = (updates: Partial<SuperAgentModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const [isLoadingProcess, setIsLoadingProcess] = useState(false); 
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [isFetchingVoicesLocal, setIsFetchingVoicesLocal] = useState(false); 
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);

  const generateTextLocal = async (prompt: string, systemInstruction?: string, useJsonOutput?: boolean, apiSettings?: ApiSettings, signal?: AbortSignal) => {
    const request = {
      prompt,
      provider: apiSettings?.provider || 'gemini',
      model: apiSettings?.model,
      temperature: apiSettings?.temperature,
      maxTokens: apiSettings?.maxTokens,
    };

    const result = await generateTextViaBackend(request, (newCredit) => {
      // Update credit if needed
    }, signal);

    if (!result.success) {
      throw new Error(result.error || 'AI generation failed');
    }

    return { text: result.text || '' };
  };

  const generateImageLocal = async (prompt: string, aspectRatio: string = "16:9", apiSettings?: ApiSettings, signal?: AbortSignal) => {
    const request = {
      prompt,
      aspectRatio,
      provider: apiSettings?.provider || 'gemini',
    };

    const result = await generateImageViaBackend(request, (newCredit) => {
      // Update credit if needed
    }, signal);

    if (!result.success) {
      throw new Error(result.error || 'Image generation failed');
    }

    return { base64Image: result.base64Image || '' };
  };

  const handleFetchVoices = useCallback(async () => {
    if (!selectedTtsApiKey) {
      updateState({ ttsError: "Vui lòng chọn một API Key của ElevenLabs.", availableVoices: [] });
      return;
    }
    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    setIsFetchingVoicesLocal(true);
    updateState({ ttsError: null });
    try {
      const voices = await fetchElevenLabsVoices(selectedTtsApiKey, abortController.signal);
      if (abortController.signal.aborted) {
        updateState({ ttsError: "Tải giọng đọc đã bị hủy.", availableVoices: [] });
        return;
      }
      updateState({ availableVoices: voices, selectedTtsVoiceId: voices.length > 0 ? voices[0].voice_id : '' });
      if (voices.length === 0) {
        updateState({ ttsError: "Không tìm thấy giọng đọc nào cho API Key này." });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ ttsError: "Tải giọng đọc đã bị hủy.", availableVoices: [] });
      } else {
        updateState({ ttsError: `Lỗi khi tải giọng đọc: ${(e as Error).message}`, availableVoices: [] });
      }
    } finally {
      setIsFetchingVoicesLocal(false);
      setCurrentAbortController(null);
    }
  }, [selectedTtsApiKey, updateState]);

  const handleCancel = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      setLoadingMessage("Đang hủy...");
      // setIsLoadingProcess will be set to false in the finally block of handleSubmit
    }
  };

  const handleSubmit = async () => {
    if (!sourceText) {
      updateState({ error: 'Vui lòng nhập Tiêu Đề hoặc Dàn Ý.' });
      return;
    }
    
    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    
    updateState({ error: null, generatedStory: '', generatedImages: [], generatedAudioUrl: null, ttsError: null });
    setIsLoadingProcess(true);
    setLoadingMessage(null); // Clear previous messages

    try {
      setLoadingMessage('Bước 1/4: Đang viết truyện...');
      let storyPrompt: string;
      const isLikelyOutline = sourceText.length > 150 || sourceText.includes('\n') || sourceText.toLowerCase().includes("dàn ý:") || sourceText.toLowerCase().includes("outline:");

      if (isLikelyOutline) {
        storyPrompt = `Dựa vào dàn ý sau, hãy viết một câu chuyện hoàn chỉnh khoảng ${wordCount} từ. Chỉ trả về câu chuyện hoàn chỉnh:\n\n${sourceText}`;
      } else {
        setLoadingMessage('Bước 1/4 (P1): Đang tạo dàn ý từ tiêu đề...');
        const outlineResult = await generateTextLocal(`Hãy viết một dàn ý chi tiết cho truyện ngắn với tiêu đề: "${sourceText}".`, undefined, undefined, apiSettings, abortController.signal);
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        await delay(1000, abortController.signal); 
        setLoadingMessage('Bước 1/4 (P2): Đang viết truyện từ dàn ý...');
        storyPrompt = `Dựa vào dàn ý sau, hãy viết một câu chuyện hoàn chỉnh khoảng ${wordCount} từ. Chỉ trả về câu chuyện hoàn chỉnh:\n\n${outlineResult.text}`;
      }
      
      const storyResult = await generateTextLocal(storyPrompt, undefined, undefined, apiSettings, abortController.signal);
      if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ generatedStory: storyResult.text });
      await delay(1000, abortController.signal); 

      setLoadingMessage(`Bước 2/4: Đang tạo ${imageCount} prompt ảnh...`);
      
      const imagePromptsQuery = `Dựa trên câu chuyện sau, hãy tạo ra ${imageCount} prompt ảnh bằng tiếng Anh để minh họa cho các cảnh quan trọng. Mỗi prompt phải chi tiết, sống động, thích hợp cho model text-to-image Imagen3. Mỗi prompt trên một dòng riêng biệt, không có đầu mục "Prompt X:".\n\nTRUYỆN (chỉ dùng phần đầu để tham khảo nếu truyện quá dài):\n${storyResult.text.substring(0, 3000)}`;
      const imagePromptsResult = await generateTextLocal(imagePromptsQuery, undefined, undefined, apiSettings, abortController.signal);
      if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const prompts = imagePromptsResult.text.split('\n').filter(p => p.trim() !== '').slice(0, imageCount);
      await delay(1000, abortController.signal); 

      const images: string[] = [];
      for (let i = 0; i < prompts.length; i++) {
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        setLoadingMessage(`Bước 3/4: Đang tạo ảnh ${i + 1}/${prompts.length}...`);
        if (i > 0) await delay(1500, abortController.signal); 
        const imageResult = await generateImageLocal(prompts[i], aspectRatio, apiSettings, abortController.signal);
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        images.push(imageResult.base64Image);
        updateState({ generatedImages: [...images] }); 
      }
      
      if (selectedTtsApiKey && selectedTtsVoiceId) {
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        await delay(1000, abortController.signal); 
        setLoadingMessage('Bước 4/4: Đang tạo audio đọc truyện...');
        try {
          const storyForTts = storyResult.text.length > 4800 ? storyResult.text.substring(0, 4800) : storyResult.text;
          const audioBlob = await generateElevenLabsSpeech(selectedTtsApiKey, storyForTts, selectedTtsVoiceId, undefined);
          if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          updateState({ generatedAudioUrl: URL.createObjectURL(audioBlob) });
        } catch (e: any) {
          if (e.name === 'AbortError') throw e;
          updateState({ ttsError: `Lỗi tạo audio: ${(e as Error).message}` });
        }
      } else if (selectedTtsApiKey && !selectedTtsVoiceId) {
        updateState({ ttsError: 'Đã chọn API Key nhưng chưa chọn giọng đọc hoặc chưa tải danh sách giọng đọc.' });
      } else {
         updateState({ ttsError: 'Đã bỏ qua bước tạo audio vì chưa chọn API Key hoặc giọng đọc của ElevenLabs.' });
      }
      setLoadingMessage("Hoàn thành!");
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ error: `Quy trình đã bị hủy.`, generatedStory: generatedStory || '', generatedImages: generatedImages || [] }); // Keep partial results
        setLoadingMessage("Đã hủy.");
      } else {
        updateState({ error: `Quy trình đã dừng do lỗi: ${e.message}` });
        setLoadingMessage("Lỗi.");
      }
    } finally {
      setIsLoadingProcess(false);
      setCurrentAbortController(null);
      // Keep "Đã hủy" or "Lỗi" message for a bit before clearing
      if(loadingMessage === "Đã hủy." || loadingMessage === "Lỗi." || loadingMessage === "Hoàn thành!") {
        setTimeout(() => {
            if (!isLoadingProcess) setLoadingMessage(null); // Only clear if not immediately restarted
        }, 3000);
      }
    }
  };
  
  const getApiKeyDisplayValue = (apiKey: ElevenLabsApiKey) => {
    const keyInApp = elevenLabsApiKeys.find(k => k.id === apiKey.id || k.key === apiKey.key); 
     if (!keyInApp) return `Key (ID: ...${apiKey.id.slice(-4)}) - ...${apiKey.key.slice(-4)})`;

    const keyIdentifier = `Key (ID: ...${keyInApp.id.slice(-4)})`;
    if (keyInApp.key && keyInApp.key.length > 4) {
      return `${keyIdentifier} - ...${keyInApp.key.slice(-4)}`;
    }
    return keyIdentifier;
  };
  
  return (
    <ModuleContainer title="🚀 Siêu Trợ Lý AI: Từ Ý Tưởng Đến Sản Phẩm">
      <InfoBox>
        <strong>💡 Hướng dẫn:</strong> Nhập ý tưởng, thiết lập các tùy chọn và để Siêu Trợ Lý tự động thực hiện toàn bộ quy trình. Dàn ý từ "Xây Dựng Truyện" sẽ được tự động điền vào đây.
      </InfoBox>

      <div className="space-y-6">
        <div>
          <label htmlFor="superAgentSource" className="block text-sm font-medium text-gray-700 mb-1">1. Nhập Tiêu Đề hoặc Dàn Ý:</label>
          <textarea
            id="superAgentSource"
            value={sourceText}
            onChange={(e) => updateState({ sourceText: e.target.value })}
            placeholder="Dán dàn ý từ module 'Xây Dựng Truyện' hoặc nhập ý tưởng của bạn..."
            rows={4}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoadingProcess}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label htmlFor="superAgentWordCount" className="block text-sm font-medium text-gray-700 mb-1">2. Mục tiêu số từ:</label>
            <select id="superAgentWordCount" value={wordCount} onChange={(e) => updateState({ wordCount: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingProcess}>
              {SUPER_AGENT_WORD_COUNT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="superAgentImageCount" className="block text-sm font-medium text-gray-700 mb-1">3. Số lượng ảnh (1-5):</label>
            <input type="number" id="superAgentImageCount" value={imageCount} onChange={(e) => updateState({ imageCount: Math.max(1, Math.min(5, parseInt(e.target.value)))})} min="1" max="5" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingProcess}/>
          </div>
          <div>
            <label htmlFor="superAgentAspectRatio" className="block text-sm font-medium text-gray-700 mb-1">4. Tỷ lệ ảnh:</label>
            <select id="superAgentAspectRatio" value={aspectRatio} onChange={(e) => updateState({ aspectRatio: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingProcess}>
              {ASPECT_RATIO_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
            <div>
                <label htmlFor="superAgentTtsKey" className="block text-sm font-medium text-gray-700 mb-1">5. API Key ElevenLabs (trước đây là 6):</label>
                <select 
                    id="superAgentTtsKey" 
                    value={selectedTtsApiKey} 
                    onChange={(e) => updateState({ selectedTtsApiKey: e.target.value, availableVoices: [], selectedTtsVoiceId: '' })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                    disabled={isLoadingProcess || isFetchingVoicesLocal}
                >
                    <option value="">-- Bỏ qua tạo audio --</option>
                    {elevenLabsApiKeys.filter(k => k.key && k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0).map(k => (
                        <option key={k.id} value={k.key}>{getApiKeyDisplayValue(k)} (Còn: {k.charsLeft?.toLocaleString()})</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="superAgentTtsVoice" className="block text-sm font-medium text-gray-700 mb-1">6. Giọng Đọc (trước đây là 7):</label>
                <div className="flex gap-2">
                    <select 
                        id="superAgentTtsVoice" 
                        value={selectedTtsVoiceId} 
                        onChange={(e) => updateState({ selectedTtsVoiceId: e.target.value })} 
                        disabled={!selectedTtsApiKey || isFetchingVoicesLocal || availableVoices.length === 0 || isLoadingProcess}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm disabled:bg-gray-100"
                    >
                        <option value="">{isFetchingVoicesLocal ? "Đang tải..." : (selectedTtsApiKey ? (availableVoices.length === 0 && !isFetchingVoicesLocal ? "Nhấn 'Tải giọng'" : "-- Chọn giọng --") : "-- Chọn Key --")}</option>
                        {availableVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.labels.gender}, {v.labels.accent})</option>)}
                    </select>
                    <button 
                        onClick={handleFetchVoices} 
                        disabled={!selectedTtsApiKey || isFetchingVoicesLocal || isLoadingProcess}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-300 whitespace-nowrap"
                    >
                        {isFetchingVoicesLocal ? "Đang tải..." : "Tải giọng"}
                    </button>
                </div>
            </div>
        </div>

        {isLoadingProcess ? (
          <div className="flex space-x-3">
            <button
              disabled 
              className="w-2/3 bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md cursor-not-allowed"
            >
              {loadingMessage || "Đang xử lý..."}
            </button>
            <button
              onClick={handleCancel}
              className="w-1/3 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md"
              aria-label="Hủy tác vụ hiện tại"
            >
              Hủy ⏹️
            </button>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity"
          >
            🚀 Bắt Đầu Quy Trình
          </button>
        )}


        {(!isLoadingProcess && loadingMessage && (loadingMessage.includes("Hoàn thành") || loadingMessage.includes("Đã hủy") || loadingMessage.includes("Lỗi"))) && 
            <p className={`text-center font-medium my-2 ${loadingMessage.includes("Lỗi") ? 'text-red-600' : (loadingMessage.includes("Đã hủy") ? 'text-yellow-600' : 'text-green-600')}`}>
                {loadingMessage}
            </p>
        }
        {error && <ErrorAlert message={error} />}

        {(generatedStory || generatedImages.length > 0 || generatedAudioUrl || ttsError) && (
          <div className="mt-8 space-y-6">
            {generatedStory && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">✍️ Truyện Hoàn Chỉnh:</h3>
                <textarea
                  value={generatedStory}
                  readOnly
                  rows={15}
                  className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"
                />
              </div>
            )}
            {generatedImages.length > 0 && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">🖼️ Ảnh Minh Họa Đã Tạo:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {generatedImages.map((imgB64, index) => (
                    <img key={index} src={`data:image/png;base64,${imgB64}`} alt={`Generated Illustration ${index + 1}`} className="w-full h-auto rounded-md shadow-sm object-contain"/>
                  ))}
                </div>
              </div>
            )}
             {(generatedAudioUrl || ttsError) && (
                <div className="p-4 border rounded-lg bg-gray-50">
                    <h3 className="text-lg font-semibold mb-2 text-gray-700">🎙️ Audio Đọc Truyện (ElevenLabs):</h3>
                    {ttsError && !generatedAudioUrl && <ErrorAlert message={ttsError} />}
                    {generatedAudioUrl && (
                    <div className="text-center">
                        <audio controls src={generatedAudioUrl} className="w-full mt-2">
                        Your browser does not support the audio element.
                        </audio>
                    </div>
                    )}
                </div>
            )}
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default SuperAgentModule;
