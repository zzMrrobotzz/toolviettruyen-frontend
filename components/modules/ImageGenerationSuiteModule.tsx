import React, { useState, useEffect } from 'react';
import { 
    ImageGenerationSuiteModuleState, 
    GeneratedImageItem,
    ImageGenerationSuiteActiveTab,
    ApiSettings
} from '../../types';
import { ASPECT_RATIO_OPTIONS, PREDEFINED_ART_STYLES } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend, generateImageViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { useAppContext } from '../../AppContext';

interface ImageGenerationSuiteModuleProps {
  apiSettings: ApiSettings;
  moduleState: ImageGenerationSuiteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<ImageGenerationSuiteModuleState>>;
}

const ImageGenerationSuiteModule: React.FC<ImageGenerationSuiteModuleProps> = ({
  apiSettings, moduleState, setModuleState
}) => {
  const { consumeCredit } = useAppContext();
  const {
    activeTab, selectedArtStyle, aspectRatio,
    hookText, generatedSingleImages, singleImageOverallError, singleImageProgressMessage,
    promptsInput, generatedBatchImages, batchOverallError, batchProgressMessage,
    hookTextForCtxPrompts, generatedCtxPrompts, ctxPromptsError, ctxPromptsLoadingMessage,
    settingsError,
  } = moduleState;

  const updateState = (updates: Partial<ImageGenerationSuiteModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const [isProcessing, setIsProcessing] = useState(false);

  // Cleanup object URLs on unmount or when images change
  useEffect(() => {
    const allImageUrls = [...generatedSingleImages, ...generatedBatchImages]
      .map(item => item.imageUrl)
      .filter(Boolean) as string[];
    return () => {
      allImageUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [generatedSingleImages, generatedBatchImages]);

  const generateSubPrompts = async (currentHookText: string, isContextual: boolean): Promise<string[]> => {
    const styleInfo = PREDEFINED_ART_STYLES.find(s => s.value === selectedArtStyle);
    const styleKeywordForSubPromptEng = (styleInfo && styleInfo.value !== 'default') 
      ? styleInfo.value.replace(/_/g, ' ') : null;

    let contextualizationInstruction = "";
    if (isContextual) {
      contextualizationInstruction = `
      **CONTEXTUALIZATION INSTRUCTION (CRITICAL):**
      1. First, carefully identify the primary language of the "Story Hook / Content" provided below.
      2. THEN, based on the identified language, apply the following contextualization to the ENGLISH image prompts you generate:
          - **IF the primary language is Vietnamese (Tiếng Việt):** Generate English image prompts that incorporate elements reflecting Vietnamese culture, settings, characters, objects, or social customs.
          - **IF the primary language is Korean (한국어):** Generate English image prompts that incorporate elements reflecting Korean culture, settings, characters, objects, or social customs.
          - **IF the primary language is English or any other language:** Generate general English image prompts without specific cultural contextualization.
      This contextualization should be subtle and natural, fitting the story's narrative and tone.`;
    } else {
      contextualizationInstruction = `
      **CONTEXTUALIZATION INSTRUCTION:** Generate general English image prompts based on the content.`;
    }
    
    let styleInstructionForLLM = "";
    if (styleKeywordForSubPromptEng) {
      styleInstructionForLLM = `\n**CRITICAL STYLE INSTRUCTION:** For each generated prompt, you MUST incorporate the art style: "${styleKeywordForSubPromptEng}". For example, if the style is "anime style", a prompt might be "A character looking at a sunset, in an anime style".`;
    } else {
      styleInstructionForLLM = `\n**CRITICAL STYLE INSTRUCTION:** The art style is "Mặc định (AI tự quyết)". DO NOT add any specific art style keywords to the prompts; let the image model decide based on the prompt's content.`;
    }

    const subPromptsGenerationPrompt = `
    You are an AI expert at converting story hooks or full narratives into a sequence of visual image prompts.
    Analyze the following "Story Hook / Content".
    Your goal is to identify distinct visual scenes, moments, or key elements within this content.
    For these identified elements, generate a dynamic number of detailed image prompts. The number of prompts should be based on the richness and visual potential of the input content.
    Each generated image prompt MUST BE IN ENGLISH.
    ${contextualizationInstruction}
    ${styleInstructionForLLM}

    Story Hook / Content:
    ---
    ${currentHookText}
    ---

    Return your response as a JSON object with a single key "image_prompts".
    The value for "image_prompts" should be an array of strings, where each string is a complete image prompt.
    
    Example:
    {
      "image_prompts": [
        "A young woman walking through a neon-lit street at night, reflections in puddles, cinematic style",
        "A serene countryside scene with lotus pond at sunset, watercolor painting style"
      ]
    }

    Do not include any other text or explanation outside this JSON structure.
    The number of prompts in the array should reflect the visual storytelling potential of the input. Aim for 2-7 prompts.
    `;

    try {
      const request = {
        prompt: subPromptsGenerationPrompt,
        provider: apiSettings?.provider || 'gemini',
        model: apiSettings?.model,
        temperature: apiSettings?.temperature,
        maxTokens: apiSettings?.maxTokens,
        systemMessage: 'You are an AI assistant that analyzes text and generates multiple detailed image prompts in English, formatted as a JSON array.'
      };

      const result = await generateTextViaBackend(request);
      if (!result.success) {
        throw new Error(result.error || 'AI generation failed');
      }

      const jsonResponse = JSON.parse(result.text || '{}');
      if (!jsonResponse.image_prompts || !Array.isArray(jsonResponse.image_prompts)) {
        throw new Error('Invalid response format');
      }
      return jsonResponse.image_prompts;
    } catch (e) {
      throw new Error("Không thể tạo danh sách prompt con từ nội dung được cung cấp.");
    }
  };

  const executeImageGenerationFromHook = async (isContextualImageGeneratorTab: boolean) => {
    if (!hookText.trim()) {
      updateState({ singleImageOverallError: 'Vui lòng nhập đoạn Hook hoặc Nội dung truyện của bạn.' });
      return;
    }

    // Check and consume credits (estimate 1 credit for prompt generation + 2 per image)
    const estimatedCost = 3; // Conservative estimate
    const hasCredits = await consumeCredit(estimatedCost);
    if (!hasCredits) {
      updateState({ singleImageOverallError: 'Không đủ credit để tạo ảnh!' });
      return;
    }

    updateState({ 
      generatedSingleImages: [], 
      singleImageOverallError: null, 
      singleImageProgressMessage: 'Đang chuẩn bị...', 
      settingsError: null 
    });
    setIsProcessing(true);

    try {
      updateState({
        singleImageProgressMessage: `Bước 1: Đang phân tích nội dung và tạo danh sách prompt ảnh ${isContextualImageGeneratorTab ? "(Ngữ cảnh Thông minh)" : ""}...`
      });
      await delay(1000);
      const subPrompts = await generateSubPrompts(hookText, isContextualImageGeneratorTab);

      const initialImages: GeneratedImageItem[] = subPrompts.map(p => ({ 
        promptUsed: p, 
        imageUrl: null, 
        error: null, 
        engine: 'gemini' // Default to gemini for backend
      }));
      updateState({ 
        generatedSingleImages: initialImages, 
        singleImageProgressMessage: `Đã tạo ${subPrompts.length} prompt con. Bắt đầu tạo ảnh...` 
      });

      const currentGeneratedImages: GeneratedImageItem[] = [...initialImages];

      for (let i = 0; i < subPrompts.length; i++) {
        const currentSubPrompt = subPrompts[i];
        updateState({ 
          singleImageProgressMessage: `Bước ${i + 2}/${subPrompts.length + 1}: Đang tạo ảnh ${i + 1}/${subPrompts.length} (Prompt: ${currentSubPrompt.substring(0,50)}...)` 
        });
        
        if (i > 0) await delay(1500);

        try {
          const imageResult = await generateImageViaBackend(currentSubPrompt, aspectRatio, 'gemini');
          
          if (imageResult.success && imageResult.imageData) {
            const imageUrl = `data:image/png;base64,${imageResult.imageData}`;
            currentGeneratedImages[i] = { 
              ...currentGeneratedImages[i], 
              imageUrl: imageUrl, 
              error: null 
            };
          } else {
            throw new Error(imageResult.error || 'Image generation failed');
          }
        } catch (imgErr) {
          currentGeneratedImages[i] = { 
            ...currentGeneratedImages[i], 
            imageUrl: null, 
            error: `Lỗi ảnh ${i+1}: ${(imgErr as Error).message}` 
          };
        }
        updateState({ generatedSingleImages: [...currentGeneratedImages] });
      }
      updateState({ 
        singleImageProgressMessage: `Hoàn thành tạo ảnh từ hook/truyện${isContextualImageGeneratorTab ? " (Ngữ cảnh Thông minh)" : ""}!`
      });

    } catch (e) {
      const errorMessage = `Đã xảy ra lỗi: ${(e as Error).message}`;
      updateState({ singleImageOverallError: errorMessage, singleImageProgressMessage: null });
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setModuleState(prev => 
          (prev.singleImageProgressMessage?.includes("Hoàn thành tạo ảnh từ hook/truyện")) ? 
          {...prev, singleImageProgressMessage: null} : prev
        );
      }, 3000);
    }
  };
  
  const handleGenerateIntelligentContextPromptsOnly = async () => {
    if (!hookTextForCtxPrompts.trim()) {
      updateState({ ctxPromptsError: 'Vui lòng nhập đoạn Hook hoặc Nội dung truyện của bạn.' });
      return;
    }

    const hasCredits = await consumeCredit(1);
    if (!hasCredits) {
      updateState({ ctxPromptsError: 'Không đủ credit để tạo prompts!' });
      return;
    }

    updateState({ 
      generatedCtxPrompts: [], 
      ctxPromptsError: null, 
      ctxPromptsLoadingMessage: 'Đang phân tích nội dung và tạo danh sách prompt (Ngữ cảnh Thông minh)...', 
    });
    setIsProcessing(true);

    try {
      const subPrompts = await generateSubPrompts(hookTextForCtxPrompts, true);
      updateState({ 
        generatedCtxPrompts: subPrompts, 
        ctxPromptsLoadingMessage: `Hoàn thành! Đã tạo ${subPrompts.length} prompt.`,
        ctxPromptsError: null
      });
    } catch (e) {
      updateState({ 
        ctxPromptsError: `Lỗi khi tạo prompts: ${(e as Error).message}`, 
        ctxPromptsLoadingMessage: null 
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setModuleState(prev => 
          (prev.ctxPromptsLoadingMessage?.includes("Hoàn thành!") || prev.ctxPromptsError) ? 
          {...prev, ctxPromptsLoadingMessage: null} : prev
        );
      }, 3000);
    }
  };

  const handleGenerateBatchImages = async () => {
    const individualPrompts = promptsInput.split('\n').map(p => p.trim()).filter(p => p !== '');
    if (individualPrompts.length === 0) {
      updateState({ batchOverallError: 'Vui lòng nhập ít nhất một prompt (tiếng Anh).', settingsError: null });
      return;
    }

    const estimatedCost = individualPrompts.length * 2; // 2 credits per image
    const hasCredits = await consumeCredit(estimatedCost);
    if (!hasCredits) {
      updateState({ batchOverallError: `Không đủ credit để tạo ${individualPrompts.length} ảnh!` });
      return;
    }

    updateState({ 
      batchOverallError: null, 
      generatedBatchImages: [], 
      batchProgressMessage: null, 
      settingsError: null 
    });
    setIsProcessing(true);

    const initialGeneratedImages: GeneratedImageItem[] = individualPrompts.map(prompt => ({
      promptUsed: prompt, 
      imageUrl: null, 
      error: null, 
      engine: 'gemini'
    }));
    updateState({ generatedBatchImages: initialGeneratedImages });

    const styleInfo = PREDEFINED_ART_STYLES.find(s => s.value === selectedArtStyle);
    const styleKeywordForBatchEng = (styleInfo && styleInfo.value !== 'default') 
      ? styleInfo.value.replace(/_/g, ' ') : null;
    const stylePrefix = styleKeywordForBatchEng ? styleKeywordForBatchEng + ", " : "";

    const newGeneratedImages: GeneratedImageItem[] = [...initialGeneratedImages];

    for (let i = 0; i < individualPrompts.length; i++) {
      const currentPromptText = individualPrompts[i];
      updateState({ 
        batchProgressMessage: `Đang tạo ảnh ${i + 1}/${individualPrompts.length}: "${currentPromptText.substring(0, 50)}..."` 
      });
      
      if (i > 0) await delay(1500);

      const finalImagePrompt = `${stylePrefix}${currentPromptText}`.trim().replace(/,$/, '');
      newGeneratedImages[i].promptUsed = finalImagePrompt;

      try {
        const imageResult = await generateImageViaBackend(finalImagePrompt, aspectRatio, 'gemini');
        
        if (imageResult.success && imageResult.imageData) {
          const imageUrl = `data:image/png;base64,${imageResult.imageData}`;
          newGeneratedImages[i] = { 
            ...newGeneratedImages[i], 
            imageUrl: imageUrl, 
            error: null 
          };
        } else {
          throw new Error(imageResult.error || 'Image generation failed');
        }
      } catch (e) {
        const errorMessage = `Lỗi tạo ảnh cho prompt "${currentPromptText.substring(0,30)}...": ${(e as Error).message}`;
        newGeneratedImages[i] = { 
          ...newGeneratedImages[i], 
          imageUrl: null, 
          error: errorMessage 
        };
      }
      updateState({ generatedBatchImages: [...newGeneratedImages] });
    }

    updateState({ batchProgressMessage: `Hoàn thành ${individualPrompts.length}/${individualPrompts.length} ảnh.` });
    setTimeout(() => updateState({ batchProgressMessage: null }), 3000);
    setIsProcessing(false);
  };

  const TabButton: React.FC<{ tabId: ImageGenerationSuiteActiveTab; label: string, icon?: string }> = ({ tabId, label, icon }) => (
    <button
      onClick={() => { 
        updateState({ 
          activeTab: tabId, 
          singleImageOverallError: null, 
          batchOverallError: null, 
          settingsError: null, 
          ctxPromptsError: null,
          singleImageProgressMessage: null, 
          batchProgressMessage: null, 
          ctxPromptsLoadingMessage: null
        });
      }}
      className={`flex items-center space-x-2 px-4 py-3 font-medium rounded-t-lg text-base transition-colors
                  ${activeTab === tabId 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
      aria-selected={activeTab === tabId}
      role="tab"
      disabled={isProcessing}
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span>{label}</span>
    </button>
  );

  const copyToClipboard = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    alert("Đã sao chép!");
  };

  const downloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ModuleContainer title="🎨 Bộ Công Cụ Tạo Ảnh AI">
      <InfoBox>
        <strong>💡 Lưu ý:</strong> Module này hiện sử dụng Gemini AI thông qua backend proxy. 
        Tất cả API keys được quản lý qua webadmin. Chi phí: ~1-2 credit/ảnh.
      </InfoBox>

      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2" role="tablist">
          <TabButton tabId="singleImageGenerator" label="Tạo Ảnh Từ Hook" icon="🖼️" />
          <TabButton tabId="contextualImageGenerator" label="Ngữ Cảnh Thông Minh" icon="🧠" />
          <TabButton tabId="batchImageGenerator" label="Tạo Ảnh Hàng Loạt" icon="📚" />
          <TabButton tabId="contextualPromptGenerator" label="Tạo Prompt Thông Minh" icon="✨" />
        </div>

        {/* Common Settings */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-700 mb-1">
              Tỷ lệ ảnh:
            </label>
            <select
              id="aspectRatio"
              value={aspectRatio}
              onChange={(e) => updateState({ aspectRatio: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
              disabled={isProcessing}
            >
              {ASPECT_RATIO_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="selectedArtStyle" className="block text-sm font-medium text-gray-700 mb-1">
              Phong cách nghệ thuật:
            </label>
            <select
              id="selectedArtStyle"
              value={selectedArtStyle}
              onChange={(e) => updateState({ selectedArtStyle: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
              disabled={isProcessing}
            >
              {PREDEFINED_ART_STYLES.map(style => (
                <option key={style.value} value={style.value}>{style.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Content */}
        {(activeTab === 'singleImageGenerator' || activeTab === 'contextualImageGenerator') && (
          <div className="space-y-4">
            <div>
              <label htmlFor="hookText" className="block text-sm font-medium text-gray-700 mb-1">
                Hook hoặc Nội dung truyện:
              </label>
              <textarea
                id="hookText"
                value={hookText}
                onChange={(e) => updateState({ hookText: e.target.value })}
                rows={4}
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                placeholder="Nhập hook hoặc nội dung truyện để tạo ảnh minh họa..."
                disabled={isProcessing}
              />
            </div>
            <button
              onClick={() => executeImageGenerationFromHook(activeTab === 'contextualImageGenerator')}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isProcessing ? 'Đang xử lý...' : `🎨 Tạo Ảnh ${activeTab === 'contextualImageGenerator' ? '(Ngữ Cảnh Thông Minh)' : ''}`}
            </button>
          </div>
        )}

        {activeTab === 'batchImageGenerator' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="promptsInput" className="block text-sm font-medium text-gray-700 mb-1">
                Danh sách prompts (mỗi dòng một prompt):
              </label>
              <textarea
                id="promptsInput"
                value={promptsInput}
                onChange={(e) => updateState({ promptsInput: e.target.value })}
                rows={6}
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                placeholder="Nhập các prompt ảnh bằng tiếng Anh, mỗi dòng một prompt..."
                disabled={isProcessing}
              />
            </div>
            <button
              onClick={handleGenerateBatchImages}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isProcessing ? 'Đang tạo ảnh...' : '📚 Tạo Ảnh Hàng Loạt'}
            </button>
          </div>
        )}

        {activeTab === 'contextualPromptGenerator' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="hookTextForCtxPrompts" className="block text-sm font-medium text-gray-700 mb-1">
                Hook hoặc Nội dung truyện:
              </label>
              <textarea
                id="hookTextForCtxPrompts"
                value={hookTextForCtxPrompts}
                onChange={(e) => updateState({ hookTextForCtxPrompts: e.target.value })}
                rows={4}
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                placeholder="Nhập hook hoặc nội dung truyện để tạo prompt thông minh..."
                disabled={isProcessing}
              />
            </div>
            <button
              onClick={handleGenerateIntelligentContextPromptsOnly}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isProcessing ? 'Đang tạo prompts...' : '✨ Tạo Prompt Thông Minh'}
            </button>
          </div>
        )}

        {/* Progress Messages */}
        {isProcessing && (
          <LoadingSpinner message={
            singleImageProgressMessage || 
            batchProgressMessage || 
            ctxPromptsLoadingMessage || 
            'Đang xử lý...'
          } />
        )}

        {/* Errors */}
        {settingsError && <ErrorAlert message={settingsError} />}
        {singleImageOverallError && <ErrorAlert message={singleImageOverallError} />}
        {batchOverallError && <ErrorAlert message={batchOverallError} />}
        {ctxPromptsError && <ErrorAlert message={ctxPromptsError} />}

        {/* Generated Context Prompts */}
        {generatedCtxPrompts.length > 0 && (
          <div className="mt-6 p-4 border rounded-lg bg-purple-50">
            <h3 className="text-lg font-semibold mb-4 text-purple-700">✨ Prompt Thông Minh Đã Tạo:</h3>
            <div className="space-y-2">
              {generatedCtxPrompts.map((prompt, index) => (
                <div key={index} className="p-3 bg-white border border-purple-200 rounded-md">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-purple-800 flex-1">{index + 1}. {prompt}</span>
                    <button
                      onClick={() => copyToClipboard(prompt)}
                      className="ml-2 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      Sao chép
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Images */}
        {(generatedSingleImages.length > 0 || generatedBatchImages.length > 0) && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">🖼️ Ảnh Đã Tạo:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...generatedSingleImages, ...generatedBatchImages].map((item, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow-sm border">
                  {item.imageUrl ? (
                    <div className="space-y-2">
                      <img 
                        src={item.imageUrl} 
                        alt={`Generated ${index + 1}`}
                        className="w-full h-48 object-cover rounded-md"
                      />
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600 break-words">{item.promptUsed}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(item.promptUsed)}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Copy Prompt
                          </button>
                          <button
                            onClick={() => downloadImage(item.imageUrl!, `generated-image-${index + 1}.png`)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center bg-gray-100 rounded-md">
                      {item.error ? (
                        <div className="text-center p-2">
                          <p className="text-red-600 text-xs">{item.error}</p>
                          <p className="text-gray-500 text-xs mt-1">{item.promptUsed}</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                          <p className="text-gray-500 text-xs mt-1">Đang tạo...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default ImageGenerationSuiteModule;
