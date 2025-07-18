
import React, { useEffect } from 'react';
import { 
    ApiSettings, 
    RewriteModuleState,
    QuickRewriteState
} from '../../types'; 
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { Text, GitCompareArrows } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface RewriteModuleProps {
  apiSettings: ApiSettings;
  moduleState: RewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<RewriteModuleState>>;
}

const RewriteModule: React.FC<RewriteModuleProps> = ({ apiSettings, moduleState, setModuleState }) => {
    const { consumeCredit } = useAppContext();

    const updateQuickState = (updates: Partial<QuickRewriteState>) => {
        setModuleState(prev => ({ ...prev, quick: { ...prev.quick, ...updates } }));
    };

    return (
        <ModuleContainer title="🔄 Viết Lại & Tái Cấu Trúc">
            <QuickRewriteTab
                apiSettings={apiSettings}
                state={moduleState.quick}
                updateState={updateQuickState}
            />
        </ModuleContainer>
    );
};

// =================================================================================
// Quick Rewrite Tab Component
// =================================================================================
interface QuickRewriteTabProps {
    apiSettings: ApiSettings;
    state: QuickRewriteState;
    updateState: (updates: Partial<QuickRewriteState>) => void;
}

const QuickRewriteTab: React.FC<QuickRewriteTabProps> = ({ apiSettings, state, updateState }) => {
    const { consumeCredit } = useAppContext();
    
    const {
        rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
        originalText, rewrittenText, error, progress, loadingMessage,
        isEditing, editError, editLoadingMessage, hasBeenEdited, translation
    } = state;

    const updateTranslationState = (updates: Partial<QuickRewriteState['translation']>) => {
        updateState({ translation: { ...translation, ...updates } });
    };

    // Reset toàn bộ trạng thái liên quan khi mount (trừ originalText)
    useEffect(() => {
        updateState({
            loadingMessage: null,
            progress: 0,
            error: null,
            isEditing: false,
            editError: null,
            editLoadingMessage: null,
            rewrittenText: '',
            hasBeenEdited: false,
        });
    }, []);

    useEffect(() => {
        if (targetLanguage !== sourceLanguage) {
            updateState({ adaptContext: true }); 
        } else {
            updateState({ adaptContext: false });
        }
    }, [targetLanguage, sourceLanguage]);

    // Logic xử lý - chỉ khi click button
    const handleSingleRewrite = async () => {
         if (!originalText.trim()) {
            updateState({ error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
            return;
        }
        
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ error: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }
        
        updateState({ error: null, rewrittenText: '', progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false });
        
        const CHUNK_CHAR_COUNT = 4000;
        const numChunks = Math.ceil(originalText.length / CHUNK_CHAR_COUNT);
        let fullRewrittenText = '';

        try {
            for (let i = 0; i < numChunks; i++) {
                updateState({ progress: Math.round(((i + 1) / numChunks) * 100), loadingMessage: `Đang viết lại phần ${i + 1}/${numChunks}...` });
                const textChunk = originalText.substring(i * CHUNK_CHAR_COUNT, (i + 1) * CHUNK_CHAR_COUNT);
                
                let effectiveStyle = rewriteStyle === 'custom' ? customRewriteStyle : REWRITE_STYLE_OPTIONS.find(opt => opt.value === rewriteStyle)?.label || rewriteStyle;
                
                const levelDescriptions: {[key: number]: string} = {
                    0: 'only fix spelling and grammar. Keep the original story 100%.',
                    25: 'make some changes to words and sentence structures to refresh the text, while strictly preserving the original meaning and plot.',
                    50: 'moderately rewrite the wording and style. You can change sentence structures and vocabulary, but MUST keep the main character names and core plot points.',
                    75: 'creatively reimagine the story. You can change character names and some settings. The plot may have new developments, but it MUST retain the spirit of the original script.',
                    100: 'completely rewrite into a new script. Only retain the "soul" (core idea, main theme) of the original story.'
                };
                const descriptionKey = Math.round(rewriteLevel / 25) * 25;
                const levelDescription = levelDescriptions[descriptionKey];

                const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === sourceLanguage)?.label || sourceLanguage;
                const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === targetLanguage)?.label || targetLanguage;

                let localizationRequest = '';
                if (targetLanguage !== sourceLanguage && adaptContext) {
                    localizationRequest = `\n- **Cultural Localization Required:** Deeply adapt the cultural context, social norms, proper names, and other details to make the story feel natural and appropriate for a ${selectedTargetLangLabel}-speaking audience.`;
                }

                let rewriteStyleInstructionPromptSegment = '';
                if (rewriteStyle === 'custom') {
                    rewriteStyleInstructionPromptSegment = `Apply the following custom rewrite instructions: "${customRewriteStyle}"`;
                } else {
                    rewriteStyleInstructionPromptSegment = `The desired rewrite style is: ${effectiveStyle}.`;
                }

                const prompt = `You are an expert multilingual text rewriting AI. Your task is to rewrite the provided text chunk according to the following instructions.

**Instructions:**
- **Source Language:** ${selectedSourceLangLabel}
- **Target Language:** ${selectedTargetLangLabel}
- **Degree of Change Required:** ${rewriteLevel}%. This means you should ${levelDescription}.
- **Rewrite Style:** ${rewriteStyleInstructionPromptSegment}
- **Timestamp Handling (CRITICAL):** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.
- **Coherence:** The rewritten chunk MUST maintain logical consistency with the context from previously rewritten chunks.
${localizationRequest}

**Context from Previous Chunks (already in ${selectedTargetLangLabel}):**
---
${fullRewrittenText || "This is the first chunk."}
---

**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
---
${textChunk}
---

**Your Task:**
Provide ONLY the rewritten text for the current chunk in ${selectedTargetLangLabel}. Do not include any other text, introductions, or explanations.
`;
                
                await delay(500); // Simulate API call delay
                const result = await generateTextViaBackend({ prompt, provider: apiSettings?.provider || 'gemini' }, (newCredit) => {
                    // Update credit if needed
                });
                
                if (!result.success) {
                    throw new Error(result.error || 'AI generation failed');
                }
                
                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + result.text.trim();
                updateState({ rewrittenText: fullRewrittenText }); // Update UI progressively
            }
            updateState({ rewrittenText: fullRewrittenText.trim(), loadingMessage: 'Hoàn thành!', progress: 100 });
        } catch (e) {
            updateState({ error: `Lỗi viết lại: ${(e as Error).message}`, loadingMessage: 'Lỗi!', progress: 0 });
        } finally {
            setTimeout(() => updateState({ loadingMessage: null }), 3000);
        }
    };

    const handlePostRewriteEdit = async () => {
         if (!rewrittenText.trim()) {
            updateState({ editError: 'Không có văn bản để tinh chỉnh.' });
            return;
        }
        
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ editError: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }
        
        updateState({ isEditing: true, editError: null, editLoadingMessage: 'Đang tinh chỉnh logic...', hasBeenEdited: false });
        
        const editPrompt = `You are a meticulous story editor. Your task is to refine and polish the given text, ensuring consistency, logical flow, and improved style.

**Text to Edit:**
---
${rewrittenText}
---

**Editing Instructions:**
1.  **Consistency:** Ensure character names, locations, and plot points are consistent throughout the text. Correct any contradictions.
2.  **Flow and Cohesion:** Improve the flow between sentences and paragraphs. Ensure smooth transitions.
3.  **Clarity and Conciseness:** Remove repetitive phrases and redundant words. Clarify any confusing sentences.
4.  **Grammar and Spelling:** Correct any grammatical errors or typos.
5.  **Timestamp Check (Final):** Double-check and ensure absolutely NO timestamps (e.g., (11:42)) remain in the final text. The output must be a clean narrative.

**Output:**
Return ONLY the fully edited and polished text. Do not add any commentary or explanations.
`;
        
        try {
            const result = await generateTextViaBackend({ prompt: editPrompt, provider: apiSettings?.provider || 'gemini' }, (newCredit) => {
                // Update credit if needed
            });
            
            if (!result.success) {
                throw new Error(result.error || 'AI generation failed');
            }
            
            updateState({ rewrittenText: result.text, isEditing: false, editLoadingMessage: 'Tinh chỉnh hoàn tất!', hasBeenEdited: true });
        } catch (e) {
            updateState({ editError: `Lỗi tinh chỉnh: ${(e as Error).message}`, isEditing: false, editLoadingMessage: 'Lỗi!' });
        } finally {
             setTimeout(() => updateState({ editLoadingMessage: null }), 3000);
        }
    };
    
    const resetQuickRewrite = () => {
        updateState({
            originalText: '',
            rewrittenText: '',
            error: null,
            progress: 0,
            loadingMessage: null,
            isEditing: false,
            editError: null,
            editLoadingMessage: null,
            hasBeenEdited: false,
        });
    };
    
    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        alert("Đã sao chép!");
    };
    
    const anyLoading = loadingMessage !== null || isEditing;
    const userLevelDescriptions: { [key: number]: string } = {
        0: "Chỉ sửa lỗi chính tả và ngữ pháp cơ bản. Giữ nguyên 100% nội dung và văn phong gốc.",
        25: "Làm mới văn bản bằng cách thay đổi một số từ ngữ và cấu trúc câu. Giữ nguyên ý nghĩa, nhân vật, bối cảnh và cốt truyện chính.",
        50: "Viết lại vừa phải từ ngữ và văn phong. Có thể thay đổi cấu trúc câu, từ vựng, một số chi tiết mô tả nhỏ. Tên nhân vật chính, cốt truyện chính PHẢI được giữ nguyên.",
        75: "Sáng tạo lại câu chuyện một cách đáng kể. Có thể thay đổi tên nhân vật, bối cảnh. Cốt truyện có thể có những phát triển mới nhưng PHẢI giữ được tinh thần của bản gốc.",
        100: "Viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại 'linh hồn' (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc."
    };
    const getCurrentLevelDescription = () => userLevelDescriptions[Math.round(rewriteLevel / 25) * 25];

    return (
        <div className="animate-fadeIn">
            {anyLoading && <LoadingSpinner message={loadingMessage || editLoadingMessage || 'Đang xử lý...'} />}
            {error && <ErrorAlert message={error} />}
            {editError && <ErrorAlert message={editError} />}
            {!anyLoading && !error && !editError && (
                <>
                    {!rewrittenText && (
                        <div className="space-y-6">
                            <InfoBox>
                                <strong>Viết Lại Nhanh.</strong> Sử dụng thanh trượt để điều chỉnh mức độ thay đổi từ chỉnh sửa nhẹ đến sáng tạo hoàn toàn. Lý tưởng cho các tác vụ viết lại nhanh chóng.
                            </InfoBox>
                            
                            <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow">
                                <h3 className="text-xl font-semibold text-gray-800">Cài đặt Viết lại Nhanh</h3>
                                 <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label htmlFor="rewriteSlider" className="text-sm font-medium text-gray-700">Mức độ thay đổi:</label>
                                        <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">{rewriteLevel}%</span>
                                    </div>
                                    <input type="range" id="rewriteSlider" min="0" max="100" step="25" value={rewriteLevel} onChange={(e) => updateState({ rewriteLevel: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
                                    <div className="mt-2 text-sm text-gray-600 bg-indigo-50 p-3 rounded-md border border-indigo-200">
                                        <strong>Giải thích mức {rewriteLevel}%:</strong> {getCurrentLevelDescription()}
                                    </div>
                                </div>
                                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div>
                                        <label htmlFor="quickSourceLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ gốc:</label>
                                        <select id="quickSourceLang" value={sourceLanguage} onChange={(e) => updateState({ sourceLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg">
                                        {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="quickTargetLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
                                        <select id="quickTargetLang" value={targetLanguage} onChange={(e) => updateState({ targetLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg">
                                        {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="quickRewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại:</label>
                                        <select id="quickRewriteStyle" value={rewriteStyle} onChange={(e) => updateState({ rewriteStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg">
                                        {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                 {rewriteStyle === 'custom' && (
                                    <div>
                                        <label htmlFor="quickCustomStyle" className="block text-sm font-medium text-gray-700 mb-1">Hướng dẫn tùy chỉnh:</label>
                                        <textarea id="quickCustomStyle" value={customRewriteStyle} onChange={(e) => updateState({ customRewriteStyle: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg"/>
                                    </div>
                                )}
                            </div>
                             <div>
                                <label htmlFor="quickOriginalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
                                <textarea id="quickOriginalText" value={originalText} onChange={(e) => updateState({ originalText: e.target.value })} rows={6} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Nhập văn bản..."></textarea>
                            </div>
                             <button onClick={handleSingleRewrite} disabled={!originalText.trim()} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                                Viết lại Văn bản
                            </button>
                        </div>
                    )}
                    
                    {rewrittenText && (
                        <div className="space-y-6">
                            <InfoBox variant="info">
                                <strong>Hoàn thành!</strong> Dưới đây là kết quả văn bản đã được viết lại.
                            </InfoBox>
                            <div className="grid md:grid-cols-2 gap-6">
                                 <div>
                                     <h3 className="text-lg font-semibold text-gray-700 mb-2">Văn bản Gốc</h3>
                                     <textarea value={originalText} readOnly rows={15} className="w-full p-2 border border-gray-200 bg-gray-100 rounded-md"/>
                                 </div>
                                 <div>
                                     <h3 className="text-lg font-semibold text-green-700 mb-2">Văn bản Đã Viết lại</h3>
                                     <textarea value={rewrittenText} readOnly rows={15} className="w-full p-3 border-2 border-green-300 bg-green-50 rounded-lg"/>
                                 </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => copyToClipboard(rewrittenText)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Sao chép</button>
                                <button onClick={handlePostRewriteEdit} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">Biên Tập & Tinh Chỉnh</button>
                                <button onClick={resetQuickRewrite} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                    <GitCompareArrows className="inline-block mr-2" size={20}/> Viết lại Văn bản mới
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default RewriteModule;
