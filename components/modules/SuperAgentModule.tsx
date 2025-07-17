
import React, { useState } from 'react';
import { SuperAgentModuleState } from '../../types';
import { ASPECT_RATIO_OPTIONS, SUPER_AGENT_WORD_COUNT_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend, generateImageViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { useAppContext } from '../../AppContext';

interface SuperAgentModuleProps {
  moduleState: SuperAgentModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<SuperAgentModuleState>>;
}

const SuperAgentModule: React.FC<SuperAgentModuleProps> = ({
  moduleState, setModuleState
}) => {
  const { updateCredit } = useAppContext(); // Lấy hàm updateCredit mới
  const {
    sourceText, wordCount, imageCount, aspectRatio,
    generatedStory, generatedImages, error
  } = moduleState;

  const updateState = (updates: Partial<SuperAgentModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const [isLoadingProcess, setIsLoadingProcess] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);

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
    
    // XÓA BỎ LOGIC CŨ
    // const totalCost = 1 + (imageCount * 2);
    // const hasCredits = await consumeCredit(totalCost);
    // if (!hasCredits) {
    //   updateState({ error: `Không đủ credit! Cần ${totalCost} credit (1 truyện + ${imageCount}x2 ảnh).` });
    //   return;
    // }

    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    
    updateState({ error: null, generatedStory: '', generatedImages: [] });
    setIsLoadingProcess(true);
    setLoadingMessage(null);

    try {
      // Step 1: Generate Story
      setLoadingMessage('Bước 1/2: Đang viết truyện...');
      let storyPrompt: string;
      const isLikelyOutline = sourceText.length > 150 || sourceText.includes('\n');

      if (isLikelyOutline) {
        storyPrompt = `Dựa vào dàn ý sau, hãy viết một câu chuyện hoàn chỉnh khoảng ${wordCount} từ. Chỉ trả về câu chuyện hoàn chỉnh:\n\n${sourceText}`;
      } else {
        storyPrompt = `Từ tiêu đề sau: "${sourceText}", hãy viết một câu chuyện hoàn chỉnh khoảng ${wordCount} từ.`;
      }
      
      const storyResult = await generateTextViaBackend(
        {
          prompt: storyPrompt,
          provider: 'gemini',
        },
        updateCredit // Truyền hàm updateCredit vào
      );
      
      if (!storyResult.success || !storyResult.text) {
        throw new Error(storyResult.error || 'Failed to generate story');
      }
      if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ generatedStory: storyResult.text });
      
      // Step 2: Generate Images (Logic này cần được xem xét lại vì nó không trừ credit)
      if (imageCount > 0) {
        setLoadingMessage(`Bước 2/2: Đang tạo ${imageCount} ảnh minh họa...`);
        await delay(1000);
        
        const images: string[] = [];
        for (let i = 0; i < imageCount; i++) {
          if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          
          setLoadingMessage(`Bước 2/2: Đang tạo ảnh ${i + 1}/${imageCount}...`);
          
          const imagePrompt = `Minh họa cho câu chuyện: ${storyResult.text.substring(0, 300)}...`;
          
          // Tạm thời chưa xử lý credit cho ảnh, sẽ cần một API riêng
          const imageResult = await generateImageViaBackend(imagePrompt, aspectRatio, 'gemini');
          
          if (imageResult.success && imageResult.imageData) {
            images.push(imageResult.imageData);
          } else {
            console.warn(`Failed to generate image ${i + 1}: ${imageResult.error}`);
          }
          
          if (i < imageCount - 1) await delay(2000); // Delay between images
        }
        
        updateState({ generatedImages: images });
      }

      setLoadingMessage("✅ Hoàn thành!");
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
  
  return (
    <ModuleContainer title="🚀 Siêu Trợ Lý AI: Từ Ý Tưởng Đến Sản Phẩm">
      <InfoBox>
        <strong>💡 Thông báo:</strong> Module đã được nâng cấp để sử dụng backend proxy. 
        Tất cả API keys được quản lý qua webadmin. Chi phí: 1 credit/truyện + 2 credit/ảnh.
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
            <label htmlFor="superAgentImageCount" className="block text-sm font-medium text-gray-700 mb-1">3. Số lượng ảnh (0-5):</label>
            <input type="number" id="superAgentImageCount" value={imageCount} onChange={(e) => updateState({ imageCount: Math.max(0, Math.min(5, parseInt(e.target.value)))})} min="0" max="5" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingProcess}/>
          </div>
          <div>
            <label htmlFor="superAgentAspectRatio" className="block text-sm font-medium text-gray-700 mb-1">4. Tỷ lệ ảnh:</label>
            <select id="superAgentAspectRatio" value={aspectRatio} onChange={(e) => updateState({ aspectRatio: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingProcess}>
              {ASPECT_RATIO_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-blue-50">
          <h4 className="text-md font-semibold text-blue-700 mb-2">💰 Chi Phí Ước Tính:</h4>
          <p className="text-sm text-blue-600">
            • Viết truyện: 1 credit<br/>
            • Tạo ảnh: {imageCount} × 2 = {imageCount * 2} credit<br/>
            <strong>Tổng: {1 + (imageCount * 2)} credit</strong>
          </p>
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
            disabled={!sourceText.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            🚀 Bắt Đầu Quy Trình
          </button>
        )}

        {isLoadingProcess && <LoadingSpinner message={loadingMessage || "Đang xử lý..."} />}

        {(!isLoadingProcess && loadingMessage && (loadingMessage.includes("Hoàn thành") || loadingMessage.includes("Đã hủy") || loadingMessage.includes("Lỗi"))) && 
            <p className={`text-center font-medium my-2 ${loadingMessage.includes("Lỗi") ? 'text-red-600' : (loadingMessage.includes("Đã hủy") ? 'text-yellow-600' : 'text-green-600')}`}>
                {loadingMessage}
            </p>
        }
        {error && <ErrorAlert message={error} />}

        {(generatedStory || generatedImages.length > 0) && (
          <div className="mt-8 space-y-6">
            {generatedStory && (
              <div className="p-4 border rounded-lg bg-green-50">
                <h3 className="text-lg font-semibold mb-2 text-green-700">✍️ Truyện Hoàn Chỉnh:</h3>
                <div className="max-h-96 overflow-y-auto bg-white p-4 border rounded">
                  <div className="whitespace-pre-wrap">{generatedStory}</div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedStory)}
                  className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  📋 Sao chép truyện
                </button>
              </div>
            )}
            {generatedImages.length > 0 && (
              <div className="p-4 border rounded-lg bg-purple-50">
                <h3 className="text-lg font-semibold mb-2 text-purple-700">🖼️ Ảnh Minh Họa Đã Tạo:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {generatedImages.map((imgB64, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={`data:image/png;base64,${imgB64}`} 
                        alt={`Generated Illustration ${index + 1}`} 
                        className="w-full h-48 object-cover rounded-md shadow-sm"
                      />
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `data:image/png;base64,${imgB64}`;
                          link.download = `illustration-${index + 1}.png`;
                          link.click();
                        }}
                        className="absolute bottom-2 right-2 px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                      >
                        📥 Tải về
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 p-4 border rounded-lg bg-yellow-50">
          <h4 className="text-md font-semibold text-yellow-700 mb-2">🚧 Tính Năng Đang Phát Triển</h4>
          <ul className="text-sm text-yellow-600 space-y-1">
            <li>• TTS (Text-to-Speech) sẽ được tích hợp sau</li>
            <li>• Tùy chọn phong cách viết truyện</li>
            <li>• Tạo ảnh với nhiều style</li>
            <li>• Export combo story + images</li>
          </ul>
        </div>
      </div>
    </ModuleContainer>
  );
};

export default SuperAgentModule;