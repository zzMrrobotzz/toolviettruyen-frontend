
import React, { useState, useCallback, useEffect } from 'react';
import { ApiSettings, ElevenLabsApiKey, ElevenLabsVoice, SuperAgentModuleState } from '../../types';
import { ASPECT_RATIO_OPTIONS, SUPER_AGENT_WORD_COUNT_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateAiContent } from '../../services/keyService'; // SỬA LẠI: Dùng service chính
import { fetchElevenLabsVoices, generateElevenLabsSpeech } from '../../services/elevenLabsService';
import { delay } from '../../utils';
import { useAppContext } from '../../AppContext';

interface SuperAgentModuleProps {
  elevenLabsApiKeys: ElevenLabsApiKey[];
  setElevenLabsApiKeys: (keys: ElevenLabsApiKey[]) => void;
  moduleState: SuperAgentModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<SuperAgentModuleState>>;
}

const SuperAgentModule: React.FC<SuperAgentModuleProps> = ({
  elevenLabsApiKeys, setElevenLabsApiKeys, moduleState, setModuleState
}) => {
  const { keyInfo, consumeCredit } = useAppContext(); // SỬA LẠI: Lấy keyInfo và consumeCredit
  const {
    sourceText, wordCount, imageCount, aspectRatio,
    selectedTtsApiKey, availableVoices, selectedTtsVoiceId,
    generatedStory, generatedImages, generatedAudioUrl, ttsError, error
  } = moduleState;

  const updateState = (updates: Partial<SuperAgentModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const [isLoadingProcess, setIsLoadingProcess] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [isFetchingVoicesLocal, setIsFetchingVoicesLocal] = useState(false);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);

  const handleFetchVoices = useCallback(async () => {
    // ... (giữ nguyên)
  }, [selectedTtsApiKey, updateState]);

  const handleCancel = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      setLoadingMessage("Đang hủy...");
    }
  };

  const handleSubmit = async () => {
    if (!sourceText) {
      updateState({ error: 'Vui lòng nhập Tiêu Đề hoặc Dàn Ý.' });
      return;
    }
    
    // SỬA LẠI: Kiểm tra credit trước khi bắt đầu
    const hasCredits = await consumeCredit(1 + imageCount); // 1 credit cho truyện, 1 cho mỗi ảnh
    if (!hasCredits) {
      updateState({ error: 'Không đủ credit để thực hiện quy trình này.' });
      return;
    }

    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    
    updateState({ error: null, generatedStory: '', generatedImages: [], generatedAudioUrl: null, ttsError: null });
    setIsLoadingProcess(true);
    setLoadingMessage(null);

    try {
      setLoadingMessage('Bước 1/3: Đang viết truyện...');
      let storyPrompt: string;
      const isLikelyOutline = sourceText.length > 150 || sourceText.includes('\n');

      if (isLikelyOutline) {
        storyPrompt = `Dựa vào dàn ý sau, hãy viết một câu chuyện hoàn chỉnh khoảng ${wordCount} từ. Chỉ trả về câu chuyện hoàn chỉnh:\n\n${sourceText}`;
      } else {
        // ... (logic tạo dàn ý có thể thêm lại sau)
        storyPrompt = `Từ tiêu đề sau: "${sourceText}", hãy viết một câu chuyện hoàn chỉnh khoảng ${wordCount} từ.`;
      }
      
      // SỬA LẠI: Gọi API qua proxy với key thật
      const storyResult = await generateAiContent(storyPrompt, 'gemini', keyInfo.key);
      
      if (!storyResult.success || !storyResult.text) {
        throw new Error(storyResult.error || 'Failed to generate story via backend.');
      }
      if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ generatedStory: storyResult.text });
      
      // Tạm thời vô hiệu hóa tạo ảnh và TTS để tập trung sửa lỗi chính
      setLoadingMessage('Tạo truyện thành công! Chức năng tạo ảnh và TTS đang được nâng cấp.');
      
      // ... (Phần code tạo ảnh và TTS sẽ được sửa sau)

      setLoadingMessage("Hoàn thành!");
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ error: `Quy trình đã bị hủy.` });
        setLoadingMessage("Đã hủy.");
      } else {
        updateState({ error: `Quy trình đã dừng do lỗi: ${e.message}` });
        setLoadingMessage("Lỗi.");
      }
    } finally {
      setIsLoadingProcess(false);
      setCurrentAbortController(null);
      setTimeout(() => {
          if (!isLoadingProcess) setLoadingMessage(null);
      }, 3000);
    }
  };

  
  const getApiKeyDisplayValue = (apiKey: ElevenLabsApiKey) => {
    const keyInApp = elevenLabsApiKeys.find(k => k.id === apiKey.id || k.key === apiKey.key); 
     if (!keyInApp) return `Key (ID: ...${apiKey.id.slice(-4)}) - ...${apiKey.key.slice(-4)}`;

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