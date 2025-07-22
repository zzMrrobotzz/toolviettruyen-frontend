

import React, { useEffect, useRef, useState } from 'react';
import { 
    ApiSettings, 
    RewriteModuleState
} from '../../types'; 
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import HistoryViewer from '../HistoryViewer';
import { useAppContext } from '../../AppContext';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { addToHistory, getModuleHistory } from '../../utils/historyManager';

interface RewriteModuleProps {
  apiSettings: ApiSettings;
  moduleState: RewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<RewriteModuleState>>;
}

const RewriteModule: React.FC<RewriteModuleProps> = ({ apiSettings, moduleState, setModuleState }) => {
    // Lấy state từ moduleState.quick
    const {
        rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
        originalText, rewrittenText, error, progress, loadingMessage, isProcessing,
        isEditing, editError, editLoadingMessage, hasBeenEdited, translation
    } = moduleState.quick;

    // History management
    const [showHistory, setShowHistory] = useState(false);
    const [historyCount, setHistoryCount] = useState(0);

    // Helper: updateStateInput chỉ update các trường input, không động vào rewrittenText
    const updateStateInput = (updates: Partial<Omit<typeof moduleState.quick, 'rewrittenText'>>) => {
        setModuleState(prev => ({ ...prev, quick: { ...prev.quick, ...updates } }));
    };

    const { consumeCredit } = useAppContext();

    // Update history count when component mounts
    useEffect(() => {
        const history = getModuleHistory('rewrite');
        setHistoryCount(history.length);
    }, [showHistory]);

    useEffect(() => {
        if (targetLanguage !== sourceLanguage) {
            updateStateInput({ adaptContext: true }); 
        } else {
            updateStateInput({ adaptContext: false });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetLanguage, sourceLanguage]);

    const abortControllerRef = useRef<AbortController | null>(null);
    
    // State for Character Map tracking - REMOVED FOR SIMPLICITY
    // const [characterMapForSession, setCharacterMapForSession] = React.useState<string | null>(null);

    // Helper functions for character map - REMOVED
    
    // Tất cả các onChange input/select/slider chỉ gọi updateStateInput, không reset rewrittenText
    // Khi bấm nút Viết lại Văn bản, mới reset rewrittenText
    const handleSingleRewrite = async () => {
         if (!originalText.trim()) {
            updateStateInput({ error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
            return;
        }
        
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        updateStateInput({ isProcessing: true });
        // Trừ credit trước khi xử lý
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateStateInput({ error: 'Không đủ credit để thực hiện thao tác này!', isProcessing: false });
            return;
        }
        // Chỉ reset rewrittenText ở đây
        setModuleState(prev => ({ ...prev, quick: { ...prev.quick, rewrittenText: '', error: null, progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false } }));
        
        const CHUNK_CHAR_COUNT = 20000;
        const numChunks = Math.ceil(originalText.length / CHUNK_CHAR_COUNT);
        let fullRewrittenText = '';

        try {
            for (let i = 0; i < numChunks; i++) {
                updateStateInput({ progress: Math.round(((i + 1) / numChunks) * 100), loadingMessage: `Đang viết lại phần ${i + 1}/${numChunks}...` });
                const textChunk = originalText.substring(i * CHUNK_CHAR_COUNT, (i + 1) * CHUNK_CHAR_COUNT);
                
                const effectiveStyle = rewriteStyle === 'custom' ? customRewriteStyle : REWRITE_STYLE_OPTIONS.find(opt => opt.value === rewriteStyle)?.label || rewriteStyle;
                
                const levelDescriptions: {[key: number]: string} = {
                    0: 'chỉ sửa lỗi chính tả và ngữ pháp. Giữ nguyên 100% câu chuyện gốc.',
                    25: 'thực hiện một số thay đổi về từ ngữ và cấu trúc câu để làm mới văn bản, đồng thời giữ nguyên ý nghĩa và cốt truyện gốc.',
                    50: 'viết lại vừa phải về từ ngữ và văn phong. Bạn có thể thay đổi cấu trúc câu và từ vựng, nhưng PHẢI giữ lại tên nhân vật chính và các điểm cốt truyện cốt lõi.',
                    75: 'sáng tạo lại câu chuyện. Bạn có thể thay đổi tên nhân vật và một số bối cảnh. Cốt truyện có thể có những diễn biến mới, nhưng PHẢI giữ lại tinh thần của kịch bản gốc.',
                    100: 'viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại "linh hồn" (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc.'
                };
                const descriptionKey = Math.round(rewriteLevel / 25) * 25;
                const levelDescription = levelDescriptions[descriptionKey];

                const selectedSourceLangLabel = sourceLanguage;
                const selectedTargetLangLabel = targetLanguage;

                let localizationRequest = '';
                if (targetLanguage !== sourceLanguage && adaptContext) {
                    localizationRequest = `\n- **Bản địa hóa văn hóa:** Điều chỉnh sâu sắc bối cảnh văn hóa, chuẩn mực xã hội, tên riêng và các chi tiết khác để câu chuyện có cảm giác tự nhiên và phù hợp với khán giả nói tiếng ${selectedTargetLangLabel}.`;
                }

                // *** NEW SIMPLIFIED PROMPT ***
                const prompt = `Bạn là một AI chuyên gia viết lại văn bản đa ngôn ngữ.
Nhiệm vụ của bạn là viết lại đoạn văn bản được cung cấp theo các hướng dẫn sau.

**HƯỚNG DẪN:**
- **Ngôn ngữ nguồn:** ${selectedSourceLangLabel}
- **Ngôn ngữ đích:** ${selectedTargetLangLabel}
- **Mức độ thay đổi:** ${rewriteLevel}%. Điều này có nghĩa là bạn nên ${levelDescription}.
- **Yêu cầu về độ dài (QUAN TRỌNG):** Đầu ra đã viết lại của bạn PHẢI dài ít nhất bằng văn bản gốc. Duy trì cùng một mức độ chi tiết và sự phong phú trong tường thuật. KHÔNG rút ngắn hoặc tóm tắt nội dung.
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
                
                const request = { 
                    prompt, 
                    provider: apiSettings?.provider || 'gemini',
                    model: apiSettings?.model,
                    temperature: apiSettings?.temperature,
                    maxTokens: apiSettings?.maxTokens,
                };
                let result;
                try {
                    result = await generateTextViaBackend(request, (newCredit) => {}, signal);
                    if (!result.success) {
                        throw new Error(result.error || 'AI generation failed');
                    }
                } catch (networkError) {
                    const errorMsg = (networkError as Error).message;
                    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('502') || errorMsg.includes('Bad Gateway')) {
                        throw new Error('Kết nối backend bị gián đoạn. Vui lòng thử lại sau vài giây.');
                    }
                    if (errorMsg.includes('CORS')) {
                        throw new Error('Lỗi CORS policy. Vui lòng refresh trang và thử lại.');
                    }
                    throw networkError;
                }
                
                // Check if the process was aborted before processing the result
                if (signal.aborted) {
                    console.log("Rewrite process aborted by user.");
                    // The error will be caught in the main catch block
                    throw new DOMException('Operation aborted by user', 'AbortError');
                }

                const chunkResult = (result.text || '').trim();
                
                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + chunkResult;
                setModuleState(prev => ({ ...prev, quick: { ...prev.quick, rewrittenText: fullRewrittenText } })); // Update UI progressively
            }
            setModuleState(prev => ({ ...prev, quick: { ...prev.quick, rewrittenText: fullRewrittenText.trim() } }));
            updateStateInput({ loadingMessage: 'Hoàn thành!', progress: 100 });
            
            // REMOVED autoEditAfterRewrite call
            
            // Save to history after successful completion
            if (fullRewrittenText.trim()) {
                addToHistory('rewrite', fullRewrittenText.trim(), {
                    originalText: originalText,
                    settings: {
                        rewriteLevel,
                        sourceLanguage,
                        targetLanguage,
                        rewriteStyle,
                        customRewriteStyle,
                        adaptContext
                    }
                });
                // Update history count
                const history = getModuleHistory('rewrite');
                setHistoryCount(history.length);
            }
        } catch (e) {
            if ((e as Error).name === 'AbortError') {
                updateStateInput({ error: 'Quá trình viết lại đã bị dừng bởi người dùng.', loadingMessage: 'Đã dừng', progress: 0, isProcessing: false });
            } else {
                updateStateInput({ error: `Lỗi viết lại: ${(e as Error).message}`, loadingMessage: 'Lỗi!', progress: 0, isProcessing: false });
            }
        } finally {
            updateStateInput({ loadingMessage: null, isProcessing: false });
            abortControllerRef.current = null;
        }
    };

    // REMOVED autoEditAfterRewrite function entirely

    // REMOVED handlePostRewriteEdit function entirely
    
    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        alert("Đã sao chép!");
    };
    
    const anyLoading = (loadingMessage !== null || isEditing) && !!originalText.trim();
    const userLevelDescriptions: { [key: number]: string } = {
        0: "Chỉ sửa lỗi chính tả và ngữ pháp cơ bản. Giữ nguyên 100% nội dung và văn phong gốc.",
        25: "Làm mới văn bản bằng cách thay đổi một số từ ngữ và cấu trúc câu. Giữ nguyên ý nghĩa, nhân vật, bối cảnh và cốt truyện chính.",
        50: "Viết lại vừa phải từ ngữ và văn phong. Có thể thay đổi cấu trúc câu, từ vựng, một số chi tiết mô tả nhỏ. Tên nhân vật chính, cốt truyện chính PHẢI được giữ nguyên.",
        75: "Sáng tạo lại câu chuyện một cách đáng kể. Có thể thay đổi tên nhân vật, bối cảnh. Cốt truyện có thể có những phát triển mới nhưng PHẢI giữ được tinh thần của bản gốc.",
        100: "Viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại 'linh hồn' (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc."
    };
    const getCurrentLevelDescription = () => userLevelDescriptions[Math.round(rewriteLevel / 25) * 25];

    return (
        <>
        <ModuleContainer title="🔄 Viết Lại Nhanh">
             <div className="space-y-6 animate-fadeIn">
                <InfoBox>
                    <div className="flex justify-between items-center">
                        <div>
                            <strong>Viết Lại Nhanh.</strong> Sử dụng thanh trượt để điều chỉnh mức độ thay đổi từ chỉnh sửa nhẹ đến sáng tạo hoàn toàn. Lý tưởng cho các tác vụ viết lại nhanh chóng.
                        </div>
                        <button
                            onClick={() => setShowHistory(true)}
                            className="ml-4 px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm rounded-lg transition-colors flex items-center gap-1"
                        >
                            📚 Lịch sử ({historyCount}/5)
                        </button>
                    </div>
                </InfoBox>
                
                <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow">
                    <h3 className="text-xl font-semibold text-gray-800">Cài đặt Viết lại Nhanh</h3>
                     <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="rewriteSlider" className="text-sm font-medium text-gray-700">Mức độ thay đổi:</label>
                            <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">{rewriteLevel}%</span>
                        </div>
                        <input type="range" id="rewriteSlider" min="0" max="100" step="25" value={rewriteLevel} onChange={(e) => updateStateInput({ rewriteLevel: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={isProcessing}/>
                        <div className="mt-2 text-sm text-gray-600 bg-indigo-50 p-3 rounded-md border border-indigo-200">
                            <strong>Giải thích mức {rewriteLevel}%:</strong> {getCurrentLevelDescription()}
                        </div>
                    </div>
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="quickSourceLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ gốc:</label>
                            <select id="quickSourceLang" value={sourceLanguage} onChange={(e) => updateStateInput({ sourceLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={isProcessing}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quickTargetLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
                            <select id="quickTargetLang" value={targetLanguage} onChange={(e) => updateStateInput({ targetLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={isProcessing}>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="quickRewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại:</label>
                            <select id="quickRewriteStyle" value={rewriteStyle} onChange={(e) => updateStateInput({ rewriteStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={isProcessing}>
                            {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>
                     {rewriteStyle === 'custom' && (
                        <div>
                            <label htmlFor="quickCustomStyle" className="block text-sm font-medium text-gray-700 mb-1">Hướng dẫn tùy chỉnh:</label>
                            <textarea id="quickCustomStyle" value={customRewriteStyle} onChange={(e) => updateStateInput({ customRewriteStyle: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={isProcessing}/>
                        </div>
                    )}
                </div>
                 <div>
                    <label htmlFor="quickOriginalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
                    <textarea id="quickOriginalText" value={originalText} onChange={(e) => updateStateInput({ originalText: e.target.value })} rows={6} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Nhập văn bản..." disabled={isProcessing}></textarea>
                </div>
                 <div className="flex flex-col items-center gap-4">
                    <button onClick={handleSingleRewrite} disabled={isProcessing || !originalText.trim()} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                        Viết lại Văn bản
                    </button>
                    {isProcessing && (
                        <button onClick={handleStop} className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-700">
                            Dừng
                        </button>
                    )}
                </div>
                {isProcessing && <LoadingSpinner message={loadingMessage || editLoadingMessage || 'Đang xử lý...'} />}
                {error && <ErrorAlert message={error} />}
                {editError && <ErrorAlert message={editError} />}
                {rewrittenText && !isProcessing && (
                     <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                         <h3 className="text-lg font-semibold mb-2">Văn bản đã viết lại:</h3>
                         <textarea value={rewrittenText} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white"/>
                         <div className="mt-3 flex gap-2">
                            <button onClick={() => copyToClipboard(rewrittenText)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Sao chép</button>
                            {/* REMOVED post-edit button */}
                         </div>
                     </div>
                )}
            </div>
        </ModuleContainer>
        
        {/* History Viewer */}
        <HistoryViewer
            module="rewrite"
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
        />
        </>
    );
};


export default RewriteModule;