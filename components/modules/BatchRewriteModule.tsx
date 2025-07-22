





import React, { useState, useEffect, useCallback } from 'react';
import { 
    ApiSettings, 
    BatchRewriteModuleState, 
    BatchRewriteInputItem, 
    GeneratedBatchRewriteOutputItem 
} from '../../types';
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import HistoryViewer from '../HistoryViewer';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { useAppContext } from '../../AppContext';
import { addToHistory, getModuleHistory } from '../../utils/historyManager';

interface BatchRewriteModuleProps {
  apiSettings: ApiSettings;
  moduleState: BatchRewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<BatchRewriteModuleState>>;
}

const BatchRewriteModule: React.FC<BatchRewriteModuleProps> = ({ apiSettings, moduleState, setModuleState }) => {
  const {
    inputItems, results, globalRewriteLevel, globalSourceLanguage, globalTargetLanguage,
    globalRewriteStyle, globalCustomRewriteStyle, globalAdaptContext,
    isProcessingBatch, batchProgressMessage, batchError, concurrencyLimit
  } = moduleState;

  const abortControllerRef = React.useRef<AbortController | null>(null);

  // History management
  const [showHistory, setShowHistory] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);

  const updateState = (updates: Partial<BatchRewriteModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const generateText = async (prompt: string, systemInstruction?: string, apiSettings?: ApiSettings, signal?: AbortSignal) => {
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

    return result.text || '';
  };

  const { consumeCredit } = useAppContext();

  // Update history count when component mounts
  useEffect(() => {
    const history = getModuleHistory('batch-rewrite');
    setHistoryCount(history.length);
  }, [showHistory]);

  // Sync globalAdaptContext based on global languages
  useEffect(() => {
    if (globalTargetLanguage !== globalSourceLanguage) {
      updateState({ globalAdaptContext: true });
    } else {
      updateState({ globalAdaptContext: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTargetLanguage, globalSourceLanguage]);


  const handleAddItem = () => {
    const newItem: BatchRewriteInputItem = {
      id: Date.now().toString(),
      originalText: '',
    };
    updateState({ inputItems: [...inputItems, newItem] });
  };

  const handleRemoveItem = (id: string) => {
    updateState({ 
        inputItems: inputItems.filter(item => item.id !== id),
        results: results.filter(result => result.id !== id) // Also remove corresponding result
    });
  };

  const handleInputChange = (id: string, field: keyof BatchRewriteInputItem, value: string | number | boolean | null) => {
    updateState({
      inputItems: inputItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };
  
  const handleClearResults = () => {
      updateState({results: []});
  }

  // Core rewrite logic for a single text item (adapted from RewriteModule)
  const performSingleItemRewrite = async (
    textToRewrite: string,
    currentRewriteLevel: number,
    currentSourceLanguage: string,
    currentTargetLanguage: string,
    currentRewriteStyleSettingValue: string, // 'custom' or the descriptive label of a predefined style
    userProvidedCustomInstructions: string, // Actual custom instructions text, or empty if not 'custom'
    currentAdaptContext: boolean,
    itemId: string, // For progress updates
    onProgress: (itemId: string, status: GeneratedBatchRewriteOutputItem['status'], message: string | null, charMap?: string) => void,
    textGenerator: (prompt: string, systemInstruction?: string, signal?: AbortSignal) => Promise<string>,
    signal: AbortSignal
  ): Promise<{ rewrittenText: string, characterMapUsed: string | null }> => {
    const CHUNK_REWRITE_CHAR_COUNT = 20000; 
    const numChunks = Math.ceil(textToRewrite.length / CHUNK_REWRITE_CHAR_COUNT);
    let fullRewrittenText = '';
    
    // Use the actual language values for AI consistency
    const selectedSourceLangLabel = currentSourceLanguage;
    const selectedTargetLangLabel = currentTargetLanguage;

    for (let i = 0; i < numChunks; i++) {
      onProgress(itemId, 'rewriting', `Đang viết lại phần ${i + 1}/${numChunks}...`);
      const chunkStart = i * CHUNK_REWRITE_CHAR_COUNT;
      const chunkEnd = chunkStart + CHUNK_REWRITE_CHAR_COUNT;
      const textChunk = textToRewrite.substring(chunkStart, chunkEnd);

      const effectiveStyle = currentRewriteStyleSettingValue === 'custom' ? userProvidedCustomInstructions : REWRITE_STYLE_OPTIONS.find(opt => opt.value === currentRewriteStyleSettingValue)?.label || currentRewriteStyleSettingValue;

      const levelDescriptions: {[key: number]: string} = {
          0: 'chỉ sửa lỗi chính tả và ngữ pháp. Giữ nguyên 100% câu chuyện gốc.',
          25: 'thực hiện một số thay đổi về từ ngữ và cấu trúc câu để làm mới văn bản, đồng thời giữ nguyên ý nghĩa và cốt truyện gốc.',
          50: 'viết lại vừa phải về từ ngữ và văn phong. Bạn có thể thay đổi cấu trúc câu và từ vựng, nhưng PHẢI giữ lại tên nhân vật chính và các điểm cốt truyện cốt lõi.',
          75: 'sáng tạo lại câu chuyện. Bạn có thể thay đổi tên nhân vật và một số bối cảnh. Cốt truyện có thể có những diễn biến mới, nhưng PHẢI giữ lại tinh thần của kịch bản gốc.',
          100: 'viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại "linh hồn" (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc.'
      };
      const descriptionKey = Math.round(currentRewriteLevel / 25) * 25;
      const levelDescription = levelDescriptions[descriptionKey];
      
      let localizationRequest = '';
      if (currentTargetLanguage !== currentSourceLanguage && currentAdaptContext) {
          localizationRequest = `\n- **Bản địa hóa văn hóa:** Điều chỉnh sâu sắc bối cảnh văn hóa, chuẩn mực xã hội, tên riêng và các chi tiết khác để câu chuyện có cảm giác tự nhiên và phù hợp với khán giả nói tiếng ${selectedTargetLangLabel}.`;
      }

      // *** NEW SIMPLIFIED PROMPT (ADAPTED FROM REWRITEMODULE) ***
      const prompt = `Bạn là một AI chuyên gia viết lại văn bản đa ngôn ngữ.
Nhiệm vụ của bạn là viết lại đoạn văn bản được cung cấp theo các hướng dẫn sau.

**HƯỚNG DẪN:**
- **Ngôn ngữ nguồn:** ${selectedSourceLangLabel}
- **Ngôn ngữ đích:** ${selectedTargetLangLabel}
- **Mức độ thay đổi:** ${currentRewriteLevel}%. Điều này có nghĩa là bạn nên ${levelDescription}.
- **Yêu cầu về độ dài (QUAN TRỌG):** Đầu ra đã viết lại của bạn PHẢI dài ít nhất bằng văn bản gốc. Duy trì cùng một mức độ chi tiết và sự phong phú trong tường thuật. KHÔNG rút ngắn hoặc tóm tắt nội dung.
- **Phong cách viết lại:** ${effectiveStyle}.
- **Xử lý dấu thời gian (QUAN TRỌNG):** Các dấu thời gian (ví dụ: (11:42), 06:59, HH:MM:SS) trong văn bản gốc là siêu dữ liệu và PHẢI KHÔNG được bao gồm trong đầu ra đã viết lại.
- **Tính nhất quán:** Đoạn văn được viết lại PHẢI duy trì tính nhất quán logic với ngữ cảnh từ các đoạn đã viết lại trước đó. Tên nhân vật, một khi đã được thiết lập, không được thay đổi.
${localizationRequest}

**Ngữ cảnh từ các đoạn trước (đã ở ngôn ngữ ${selectedTargetLangLabel}):**
---
${fullRewrittenText || "Đây là đoạn đầu tiên."}
---

**Đoạn văn bản gốc cần viết lại (đoạn này bằng ngôn ngữ ${selectedSourceLangLabel}):**
---
${textChunk}
---

**YÊU CẦU ĐẦU RA:**
Chỉ cung cấp văn bản đã viết lại cho đoạn hiện tại bằng ngôn ngữ ${selectedTargetLangLabel}. Đảm bảo đầu ra toàn diện và chi tiết ít nhất bằng bản gốc. Không bao gồm bất kỳ văn bản, giới thiệu, hoặc giải thích nào khác.
`;
      
      if (signal.aborted) throw new DOMException('Operation aborted', 'AbortError');
      const result = await textGenerator(prompt, undefined, signal);
      let partResultText = result || "";

      partResultText = partResultText.trim(); 

      if (fullRewrittenText && partResultText) {
          fullRewrittenText += "\n\n" + partResultText;
      } else if (partResultText) {
          fullRewrittenText = partResultText;
      }
    }
    // Return null for characterMapUsed as it's no longer part of the simplified logic
    return { rewrittenText: fullRewrittenText.trim(), characterMapUsed: null };
  };
  
  // REMOVED performSingleItemPostEdit function entirely

  const processSingleBatchItem = async (
      item: BatchRewriteInputItem, 
      index: number, 
      totalItems: number,
      updateResultCallback: (id: string, updates: Partial<GeneratedBatchRewriteOutputItem>) => void,
      textGenerator: (prompt: string, systemInstruction?: string, signal?: AbortSignal) => Promise<string>,
      signal: AbortSignal
    ) => {
    
    // Determine effective settings for the item
    const effectiveRewriteLevel = item.specificRewriteLevel ?? globalRewriteLevel;
    const effectiveSourceLanguage = item.specificSourceLanguage ?? globalSourceLanguage;
    const effectiveTargetLanguage = item.specificTargetLanguage ?? globalTargetLanguage;
    const effectiveRewriteStyleValue = item.specificRewriteStyle ?? globalRewriteStyle;
    const effectiveCustomRewriteStyle = item.specificCustomRewriteStyle ?? globalCustomRewriteStyle;
    
    let effectiveAdaptContext;
    if (item.specificAdaptContext !== null && item.specificAdaptContext !== undefined) {
        effectiveAdaptContext = item.specificAdaptContext;
    } else {
        effectiveAdaptContext = (effectiveTargetLanguage !== effectiveSourceLanguage) ? true : globalAdaptContext;
    }

    let effectiveRewriteStyleForPrompt = '';
    let customInstructionsForPrompt = '';

    if (effectiveRewriteStyleValue === 'custom') {
        if (!effectiveCustomRewriteStyle.trim()) {
            throw new Error('Phong cách viết lại tùy chỉnh không được để trống khi được chọn.');
        }
        effectiveRewriteStyleForPrompt = 'custom';
        customInstructionsForPrompt = effectiveCustomRewriteStyle.trim();
    } else {
        const selectedStyleOption = REWRITE_STYLE_OPTIONS.find(opt => opt.value === effectiveRewriteStyleValue);
        effectiveRewriteStyleForPrompt = selectedStyleOption ? selectedStyleOption.label : effectiveRewriteStyleValue;
    }

    try {
      const { rewrittenText } = await performSingleItemRewrite(
        item.originalText,
        effectiveRewriteLevel,
        effectiveSourceLanguage,
        effectiveTargetLanguage,
        effectiveRewriteStyleForPrompt,
        customInstructionsForPrompt,
        effectiveAdaptContext,
        item.id,
        (itemId, status, message) => { 
             updateResultCallback(itemId, { 
                status: status, 
                progressMessage: message,
            });
        },
        textGenerator,
        signal
      );
      
      // Removed the second 'editing' step. The process is now complete.
      updateResultCallback(item.id, { 
        rewrittenText: rewrittenText, 
        status: 'completed', 
        progressMessage: 'Hoàn thành!', 
        error: null,
        hasBeenEdited: true // Set to true as we now consider the single step as the final edit
      });

      // Save to history after successful completion
      if (rewrittenText.trim()) {
        addToHistory('batch-rewrite', rewrittenText.trim(), {
          originalText: item.originalText,
          settings: {
            effectiveRewriteLevel,
            effectiveSourceLanguage,
            effectiveTargetLanguage,
            effectiveRewriteStyleForPrompt,
            effectiveAdaptContext
          }
        });
      }

    } catch (e) {
      if ((e as Error).name === 'AbortError') {
          updateResultCallback(item.id, { 
              status: 'error', 
              error: 'Quá trình xử lý đã bị dừng.', 
              progressMessage: 'Đã dừng' 
          });
          // Rethrow to stop the worker
          throw e;
      }
      updateResultCallback(item.id, { 
        status: 'error', 
        error: (e as Error).message, 
        progressMessage: 'Lỗi xử lý mục này.' 
      });
    }
  };


  const handleStartBatchRewrite = async () => {
    const validItems = inputItems.filter(item => item.originalText.trim() !== '');
    if (validItems.length === 0) {
      updateState({ batchError: 'Vui lòng thêm ít nhất một mục văn bản hợp lệ.' });
      return;
    }
    // Trừ credit trước khi xử lý batch
    const hasCredits = await consumeCredit(validItems.length);
    if (!hasCredits) {
      updateState({ batchError: 'Không đủ credit để thực hiện batch này.' });
      return;
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const CONCURRENCY_LIMIT = Math.max(1, Math.min(10, concurrencyLimit));
    
    const textGenerator = async (prompt: string, systemInstruction?: string, signal?: AbortSignal) => {
      const request = {
        prompt,
        provider: apiSettings.provider || 'gemini',
        model: apiSettings.model,
        temperature: apiSettings.temperature,
        maxTokens: apiSettings.maxTokens,
      };

      const result = await generateTextViaBackend(request, (newCredit) => {
        // Update credit if needed
      }, signal);

      if (!result.success) {
        throw new Error(result.error || 'AI generation failed');
      }

      return result.text || '';
    };


    updateState({
      isProcessingBatch: true,
      batchProgressMessage: `Chuẩn bị xử lý ${validItems.length} mục với ${CONCURRENCY_LIMIT} luồng...`,
      batchError: null,
      results: validItems.map(item => ({
        id: item.id,
        originalText: item.originalText,
        rewrittenText: null,
        status: 'pending',
        progressMessage: 'Đang chờ trong hàng đợi',
        error: null,
        characterMap: null,
        hasBeenEdited: false
      })),
    });

    const updateResultCallback = (id: string, updates: Partial<GeneratedBatchRewriteOutputItem>) => {
      setModuleState(prev => {
        const newResults = prev.results.map(r => (r.id === id ? { ...r, ...updates } : r));
        const completedCount = newResults.filter(r => r.status === 'completed' || r.status === 'error').length;
        
        return {
            ...prev,
            results: newResults,
            batchProgressMessage: prev.isProcessingBatch ? `Đang xử lý... Hoàn thành ${completedCount}/${validItems.length}` : prev.batchProgressMessage
        };
      });
    };

    const taskQueue = [...validItems.map((item, index) => ({ item, index }))];

    const worker = async () => {
        while (taskQueue.length > 0) {
            const task = taskQueue.shift();
            if (!task || signal.aborted) continue;

            const { item, index } = task;
            try {
                await processSingleBatchItem(item, index, validItems.length, updateResultCallback, textGenerator, signal);
            } catch (e) {
                if ((e as Error).name === 'AbortError') {
                    console.log('Worker stopping due to abort signal.');
                    // Exit the loop for this worker
                    break; 
                }
            }
        }
    };
    
    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);


    setModuleState(prev => ({ 
        ...prev,
        isProcessingBatch: false, 
        batchProgressMessage: signal.aborted ? 'Quá trình đã bị dừng.' : `Hoàn thành xử lý toàn bộ ${validItems.length} mục.` 
    }));
    
    // Update history count after batch completion
    const history = getModuleHistory('batch-rewrite');
    setHistoryCount(history.length);
    
    setTimeout(() => updateState({ batchProgressMessage: null }), 5000);
  };
  
  const handleStopBatchRewrite = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
      }
  };

  const copyToClipboard = (text: string | null, buttonId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(buttonId);
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Đã sao chép!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  };

  const userLevelDescriptions: { [key: number]: string } = {
    0: "Chỉ sửa lỗi chính tả và ngữ pháp cơ bản. Giữ nguyên 100% nội dung và văn phong gốc.",
    25: "Làm mới văn bản bằng cách thay đổi một số từ ngữ và cấu trúc câu. Giữ nguyên ý nghĩa, nhân vật, bối cảnh và cốt truyện chính. Thay đổi nhẹ nhàng.",
    50: "Viết lại vừa phải từ ngữ và văn phong. Có thể thay đổi cấu trúc câu, từ vựng, một số chi tiết mô tả nhỏ. Tên nhân vật chính, các điểm cốt truyện chính, và bối cảnh chính PHẢI được giữ nguyên.",
    75: "Sáng tạo lại câu chuyện một cách đáng kể. Có thể thay đổi tên nhân vật, nghề nghiệp, bối cảnh. Cốt truyện có thể có những phát triển mới nhưng PHẢI giữ được tinh thần và những điểm hấp dẫn nhất của kịch bản gốc.",
    100: "Viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại 'linh hồn' (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc. Mọi thứ khác như tên nhân vật, bối cảnh, và thậm chí một số tình tiết phụ đề đều PHẢI hoàn toàn mới."
  };

  const getCurrentGlobalLevelDescription = () => {
    const key = Math.round(globalRewriteLevel / 25) * 25;
    return userLevelDescriptions[key] || "Di chuyển thanh trượt để xem mô tả.";
  }

  return (
    <>
    <ModuleContainer title="🔀 Viết Lại Hàng Loạt">
      <InfoBox>
        <div className="flex justify-between items-start">
          <div>
            <p><strong>💡 Hướng dẫn:</strong></p>
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-sm">
              <li>Thiết lập các tùy chọn viết lại chung (mức độ, ngôn ngữ, phong cách).</li>
              <li>Thêm từng đoạn văn bản bạn muốn viết lại. Bạn có thể tùy chỉnh các thiết lập riêng cho từng mục nếu muốn ghi đè cài đặt chung.</li>
              <li>Nhấn "Bắt Đầu Viết Lại Hàng Loạt". AI sẽ xử lý từng mục, bao gồm cả bước viết lại ban đầu và bước tinh chỉnh logic/nhất quán sau đó.</li>
              <li>Sau khi hoàn tất, bạn có thể xem lại, sao chép từng kết quả. Mỗi mục cũng sẽ có nút "Tinh Chỉnh Lại" riêng nếu bạn muốn AI xử lý lại bước tinh chỉnh cho mục đó.</li>
            </ul>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="ml-4 px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            📚 Lịch sử ({historyCount}/5)
          </button>
        </div>
      </InfoBox>

      {/* Global Settings */}
      <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cài đặt Chung cho Viết Lại Hàng Loạt</h3>
        <div>
            <div className="flex justify-between items-center mb-1">
                <label htmlFor="brwGlobalRewriteLevel" className="text-sm font-medium text-gray-700">Mức độ thay đổi (chung):</label>
                <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">{globalRewriteLevel}%</span>
            </div>
            <input type="range" id="brwGlobalRewriteLevel" min="0" max="100" step="25" value={globalRewriteLevel} onChange={(e) => updateState({ globalRewriteLevel: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={isProcessingBatch}/>
            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Chỉnh sửa nhẹ</span><span>Sáng tạo lại</span></div>
             <div className="mt-2 text-sm text-gray-600 bg-indigo-50 p-3 rounded-md border border-indigo-200"><strong>Giải thích mức {globalRewriteLevel}%:</strong> {getCurrentGlobalLevelDescription()}</div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label htmlFor="brwGlobalSourceLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ gốc (chung):</label>
            <select id="brwGlobalSourceLang" value={globalSourceLanguage} onChange={(e) => updateState({ globalSourceLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessingBatch}>
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="brwGlobalTargetLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra (chung):</label>
            <select id="brwGlobalTargetLang" value={globalTargetLanguage} onChange={(e) => updateState({ globalTargetLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessingBatch}>
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="brwGlobalRewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại (chung):</label>
            <select id="brwGlobalRewriteStyle" value={globalRewriteStyle} onChange={(e) => updateState({ globalRewriteStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessingBatch}>
              {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="brwConcurrencyLimit" className="block text-sm font-medium text-gray-700 mb-1">Số luồng xử lý đồng thời (1-10):</label>
            <input 
                type="number" 
                id="brwConcurrencyLimit" 
                value={concurrencyLimit} 
                onChange={(e) => updateState({ concurrencyLimit: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                min="1" max="10"
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                disabled={isProcessingBatch}
            />
            <p className="text-xs text-orange-600 mt-1">
                <strong>Cảnh báo:</strong> Đặt số luồng quá cao (trên 3-5) có thể gây lỗi do giới hạn của API. Mức đề xuất: 3.
            </p>
          </div>
        </div>
        {globalRewriteStyle === 'custom' && (
          <div>
            <label htmlFor="brwGlobalCustomStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách tùy chỉnh (chung):</label>
            <textarea id="brwGlobalCustomStyle" value={globalCustomRewriteStyle} onChange={(e) => updateState({ globalCustomRewriteStyle: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Mô tả phong cách tùy chỉnh..." disabled={isProcessingBatch}></textarea>
          </div>
        )}
        {globalTargetLanguage !== globalSourceLanguage && (
            <div className="flex items-center">
                <input type="checkbox" id="brwGlobalAdaptContext" checked={globalAdaptContext} onChange={(e) => updateState({ globalAdaptContext: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" disabled={isProcessingBatch}/>
                <label htmlFor="brwGlobalAdaptContext" className="ml-2 block text-sm text-gray-700">Bản địa hóa (chung)</label>
            </div>
        )}
      </div>

      {/* Input Items */}
      <div className="space-y-4 mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Danh sách Văn Bản Cần Viết Lại</h3>
        {inputItems.map((item, index) => (
          <div key={item.id} className="p-4 border-2 border-gray-200 rounded-lg bg-white shadow-sm space-y-3">
            <div className="flex justify-between items-center">
                <h4 className="text-md font-semibold text-gray-700">Mục #{index + 1}</h4>
                <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 font-medium text-sm p-2 rounded-md hover:bg-red-50" disabled={isProcessingBatch} aria-label={`Xóa mục ${index + 1}`}>
                    🗑️ Xóa
                </button>
            </div>
            <div>
              <label htmlFor={`originalText-${item.id}`} className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc (*):</label>
              <textarea id={`originalText-${item.id}`} value={item.originalText} onChange={(e) => handleInputChange(item.id, 'originalText', e.target.value)} rows={5} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Dán văn bản gốc vào đây..." disabled={isProcessingBatch}></textarea>
            </div>
            <details className="text-sm">
                <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium">Tùy chỉnh riêng cho mục này (không bắt buộc)</summary>
                <div className="mt-2 grid md:grid-cols-2 gap-x-4 gap-y-3 p-3 bg-gray-50 rounded-md border">
                    <div>
                        <label htmlFor={`specificLevel-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Mức độ thay đổi riêng:</label>
                        <input type="number" id={`specificLevel-${item.id}`} value={item.specificRewriteLevel ?? ''} onChange={(e) => handleInputChange(item.id, 'specificRewriteLevel', e.target.value ? parseInt(e.target.value) : null)} min="0" max="100" step="25" className="w-full p-2 border border-gray-300 rounded-md text-xs" placeholder={`Mặc định: ${globalRewriteLevel}%`} disabled={isProcessingBatch}/>
                    </div>
                    <div>
                        <label htmlFor={`specificSrcLang-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Ngôn ngữ gốc riêng:</label>
                        <select id={`specificSrcLang-${item.id}`} value={item.specificSourceLanguage || ""} onChange={(e) => handleInputChange(item.id, 'specificSourceLanguage', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatch}>
                            <option value="">-- Dùng cài đặt chung --</option>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`specificTgtLang-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Ngôn ngữ đầu ra riêng:</label>
                        <select id={`specificTgtLang-${item.id}`} value={item.specificTargetLanguage || ""} onChange={(e) => handleInputChange(item.id, 'specificTargetLanguage', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatch}>
                            <option value="">-- Dùng cài đặt chung --</option>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`specificStyle-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Phong cách viết lại riêng:</label>
                        <select id={`specificStyle-${item.id}`} value={item.specificRewriteStyle || ""} onChange={(e) => handleInputChange(item.id, 'specificRewriteStyle', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatch}>
                            <option value="">-- Dùng cài đặt chung --</option>
                            {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                     {(item.specificRewriteStyle ?? globalRewriteStyle) === 'custom' && (
                        <div className="md:col-span-2">
                            <label htmlFor={`specificCustomStyle-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Phong cách tùy chỉnh riêng:</label>
                            <textarea id={`specificCustomStyle-${item.id}`} value={item.specificCustomRewriteStyle || ""} onChange={(e) => handleInputChange(item.id, 'specificCustomRewriteStyle', e.target.value)} rows={2} className="w-full p-2 border border-gray-300 rounded-md text-xs" placeholder="Mô tả phong cách tùy chỉnh riêng..." disabled={isProcessingBatch}></textarea>
                        </div>
                    )}
                    {(item.specificTargetLanguage ?? globalTargetLanguage) !== (item.specificSourceLanguage ?? globalSourceLanguage) && (
                        <div className="flex items-center md:col-span-2">
                            <input type="checkbox" id={`specificAdaptCtx-${item.id}`} checked={item.specificAdaptContext ?? ((item.specificTargetLanguage ?? globalTargetLanguage) !== (item.specificSourceLanguage ?? globalSourceLanguage) ? true : globalAdaptContext)} onChange={(e) => handleInputChange(item.id, 'specificAdaptContext', e.target.checked)} className="h-3 w-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" disabled={isProcessingBatch}/>
                            <label htmlFor={`specificAdaptCtx-${item.id}`} className="ml-2 block text-xs text-gray-700">Bản địa hóa riêng</label>
                        </div>
                    )}
                </div>
            </details>
          </div>
        ))}
        <button onClick={handleAddItem} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow disabled:opacity-50" disabled={isProcessingBatch}>
          ➕ Thêm Mục
        </button>
      </div>

      {/* Action Button & Progress */}
      <div className="flex flex-col items-center gap-4">
        <button onClick={handleStartBatchRewrite} disabled={isProcessingBatch || inputItems.length === 0 || inputItems.every(it => !it.originalText.trim())} className="w-full bg-gradient-to-r from-indigo-700 to-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-xl hover:opacity-90 transition-opacity disabled:opacity-60 text-lg">
          🚀 Bắt Đầu Viết Lại Hàng Loạt ({inputItems.filter(it => it.originalText.trim()).length} mục)
        </button>
        {isProcessingBatch && (
            <button onClick={handleStopBatchRewrite} className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-700">
                Dừng Toàn Bộ
            </button>
        )}
      </div>

      {isProcessingBatch && batchProgressMessage && <LoadingSpinner message={batchProgressMessage} />}
      {!isProcessingBatch && batchProgressMessage && <p className={`text-center font-semibold my-3 ${batchProgressMessage.includes("Hoàn thành") || batchProgressMessage.includes("dừng") ? 'text-green-600' : 'text-indigo-600'}`}>{batchProgressMessage}</p>}
      {batchError && <ErrorAlert message={batchError} />}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-8 space-y-6">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-2xl font-semibold text-gray-800">Kết Quả Viết Lại Hàng Loạt</h3>
            <button onClick={handleClearResults} className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50" disabled={isProcessingBatch}>
                Xóa Tất Cả Kết Quả
            </button>
          </div>
          {results.map((result, index) => (
            <details key={result.id} className={`p-4 border-l-4 rounded-lg shadow-md bg-white 
                ${result.status === 'completed' ? (result.hasBeenEdited ? 'border-green-500' : 'border-yellow-400') : 
                  result.status === 'error' ? 'border-red-500' : 
                  (result.status === 'pending' ? 'border-gray-300' : 'border-blue-500')
                }`} open={results.length === 1 || result.status !== 'pending'}>
              <summary className="font-semibold text-lg text-gray-700 cursor-pointer flex justify-between items-center">
                <span>Mục #{inputItems.findIndex(i => i.id === result.id) + 1}: {result.originalText.substring(0, 60)}...</span>
                <span className={`text-sm px-2 py-0.5 rounded-full
                    ${result.status === 'completed' ? (result.hasBeenEdited ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') : 
                      result.status === 'error' ? 'bg-red-100 text-red-700' :
                      (result.status === 'pending' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700 animate-pulse')
                    }`}>
                    {result.status === 'pending' ? 'Sẵn sàng' : 
                     result.status === 'rewriting' ? 'Đang viết lại...' :
                     result.status === 'editing' ? 'Đang tinh chỉnh...' :
                     result.status === 'completed' ? (result.hasBeenEdited ? '✅ Hoàn thành & Đã tinh chỉnh' : '📝 Hoàn thành (Chưa tinh chỉnh)') : '⚠️ Lỗi'}
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                {(result.status !== 'pending' && result.progressMessage && result.status !== 'completed' && result.status !== 'error') && <LoadingSpinner message={result.progressMessage} noMargins={true}/>}
                {result.error && <ErrorAlert message={result.error} />}
                
                {result.rewrittenText && (
                    <div>
                        <h5 className="text-md font-semibold text-gray-600 mb-1">Văn bản đã viết lại:</h5>
                        <textarea value={result.rewrittenText} readOnly rows={8} className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 whitespace-pre-wrap leading-relaxed"></textarea>
                        <div className="mt-2 space-x-2">
                            <button id={`copyBatchRewrite-${result.id}`} onClick={() => copyToClipboard(result.rewrittenText!, `copyBatchRewrite-${result.id}`)} className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">
                                📋 Sao chép
                            </button>
                        </div>
                    </div>
                )}
                <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Xem văn bản gốc</summary>
                    <textarea value={result.originalText} readOnly rows={3} className="mt-1 w-full p-1 border border-gray-200 rounded-md bg-gray-100 whitespace-pre-wrap" disabled></textarea>
                </details>
              </div>
            </details>
          ))}
        </div>
      )}
    </ModuleContainer>
    
    {/* History Viewer */}
    <HistoryViewer
      module="batch-rewrite"
      isOpen={showHistory}
      onClose={() => setShowHistory(false)}
    />
    </>
  );
};

export default BatchRewriteModule;