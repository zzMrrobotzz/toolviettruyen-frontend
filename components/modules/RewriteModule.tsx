

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
        originalText, rewrittenText, error, progress, loadingMessage,
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

    const [isProcessing, setIsProcessing] = React.useState(false);
    
    // State for Character Map tracking
    const [characterMapForSession, setCharacterMapForSession] = React.useState<string | null>(null);

    // Helper function to extract character map from AI response
    const extractCharacterMap = (aiResponse: string): string | null => {
        const mapRegex = /\[CHARACTER_MAP\](.*?)\[\/CHARACTER_MAP\]/s;
        const match = aiResponse.match(mapRegex);
        return match ? match[1].trim() : null;
    };

    // Helper function to remove character map from AI response
    const removeCharacterMapFromResponse = (aiResponse: string): string => {
        return aiResponse.replace(/\[CHARACTER_MAP\].*?\[\/CHARACTER_MAP\]/s, '').trim();
    };

    // Tất cả các onChange input/select/slider chỉ gọi updateStateInput, không reset rewrittenText
    // Khi bấm nút Viết lại Văn bản, mới reset rewrittenText
    const handleSingleRewrite = async () => {
         if (!originalText.trim()) {
            updateStateInput({ error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
            return;
        }
        setIsProcessing(true);
        // Trừ credit trước khi xử lý
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateStateInput({ error: 'Không đủ credit để thực hiện thao tác này!' });
            setIsProcessing(false);
            return;
        }
        // Chỉ reset rewrittenText ở đây và reset character map
        setModuleState(prev => ({ ...prev, quick: { ...prev.quick, rewrittenText: '', error: null, progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false } }));
        setCharacterMapForSession(null);
        
        const CHUNK_CHAR_COUNT = 4000;
        const numChunks = Math.ceil(originalText.length / CHUNK_CHAR_COUNT);
        let fullRewrittenText = '';

        try {
            for (let i = 0; i < numChunks; i++) {
                updateStateInput({ progress: Math.round(((i + 1) / numChunks) * 100), loadingMessage: `Đang viết lại phần ${i + 1}/${numChunks}...` });
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

                // Use the actual language values (English, Vietnamese, etc.) for AI consistency
                const selectedSourceLangLabel = sourceLanguage;
                const selectedTargetLangLabel = targetLanguage;

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

                // Character consistency instructions based on rewrite level and chunk position
                let characterConsistencyInstructions = '';
                if (rewriteLevel >= 75) {
                    if (i === 0) {
                        // First chunk for high-level rewrite: needs character mapping
                        characterConsistencyInstructions = `

**Character Mapping (MANDATORY for First Chunk if Level >= 75%):**
Your primary goal for character names is consistency in the ${selectedTargetLangLabel} output.
Identify ALL character names (main, secondary, recurring) that YOU, the AI, are PURPOSEFULLY and CREATIVELY altering from their form in the ${selectedSourceLangLabel} text to a new, distinct form in your ${selectedTargetLangLabel} rewritten text for THIS CHUNK. This includes significant re-spellings, translations that are creative choices rather than direct equivalents, or entirely new names. For each such change, record it.
At the VERY END of your entire response for THIS CHUNK, append these changes in the format:
"[CHARACTER_MAP]Tên Gốc (trong ${selectedSourceLangLabel}): Original Name 1 -> Tên Mới (trong ${selectedTargetLangLabel}): New Name 1; Tên Gốc (trong ${selectedSourceLangLabel}): Original Name 2 -> Tên Mới (trong ${selectedTargetLangLabel}): New Name 2[/CHARACTER_MAP]"
If you make NO such purposeful creative changes to ANY character names (i.e., they are kept original, or receive only direct, standard translations that will be applied consistently per the general character consistency rule), you MUST append:
"[CHARACTER_MAP]Không có thay đổi tên nhân vật chính nào được map[/CHARACTER_MAP]"
This map (or the 'no change' signal) is VITAL for consistency in subsequent chunks. This instruction and its output are ONLY for this first chunk and MUST be outside the main rewritten story text.`;
                    } else {
                        // Subsequent chunks for high-level rewrite: use character map
                        characterConsistencyInstructions = `

**ABSOLUTE CHARACTER CONSISTENCY MANDATE (Based on Character Map for Level >= 75%):**
You are provided with a Character Map: \`${characterMapForSession}\`. You MUST adhere to this with 100% accuracy.
- If the map provides \`Original -> New\` pairs: Use the 'New Name' EXACTLY AS SPECIFIED for every instance of the 'Original Name'.
- If the map states 'Không có thay đổi...': You MUST continue using the exact naming convention for ALL characters as established in the first rewritten chunk.
- For ANY character not in the map, you MUST maintain the name used in the first rewritten chunk.
- **DO NOT re-translate, vary, or introduce alternative names for any character already named.**`;
                    }
                } else {
                    // Low/Mid-level rewrites: strengthen consistency
                    characterConsistencyInstructions = `

**CRITICAL NARRATIVE INTEGRITY (SINGLE TRUTH MANDATE):** You are rewriting ONE SINGLE STORY. All details regarding characters (names, roles, relationships), plot points, events, and locations MUST remain ABSOLUTELY CONSISTENT with what has been established in previously rewritten chunks (provided as context, which is THE CANON for this session). DO NOT introduce conflicting information. Maintain ONE UNIFIED AND LOGICAL NARRATIVE THREAD.
- **ABSOLUTE CHARACTER NAME CONSISTENCY:** Once a name is established for ANY character in the \`${selectedTargetLangLabel}\` output, that name MUST be used with 100% consistency for that character throughout ALL subsequent parts. DO NOT change it later.`;
                }

                const prompt = `You are an expert multilingual text rewriting AI. Your task is to rewrite the provided text chunk according to the following instructions.

**Instructions:**
- **Source Language:** ${selectedSourceLangLabel}
- **Target Language:** ${selectedTargetLangLabel}
- **Degree of Change Required:** ${rewriteLevel}%. This means you should ${levelDescription}.
- **Output Length Requirement (CRITICAL):** Your rewritten output MUST be at least as long as the original text, preferably 10-20% longer. Maintain the same level of detail, narrative richness, and descriptive elements. Do NOT shorten or summarize the content.
- **Rewrite Style:** ${rewriteStyleInstructionPromptSegment}
- **Timestamp Handling (CRITICAL):** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.
- **Coherence:** The rewritten chunk MUST maintain logical consistency with the context from previously rewritten chunks.
${localizationRequest}
${characterConsistencyInstructions}

**Context from Previous Chunks (already in ${selectedTargetLangLabel}):**
---
${fullRewrittenText || "This is the first chunk."}
---

**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
---
${textChunk}
---

**Your Task:**
Provide ONLY the rewritten text for the current chunk in ${selectedTargetLangLabel}. Ensure the output is comprehensive and at least as detailed as the original. Do not include any other text, introductions, or explanations.
`;
                
                await delay(500); // Simulate API call delay
                // Gọi API với enhanced error handling
                const request = { prompt, provider: apiSettings?.provider || 'gemini' };
                let result;
                try {
                    result = await generateTextViaBackend(request, (newCredit) => {});
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
                
                let chunkResult = (result.text || '').trim();
                
                // Extract character map if this is the first chunk of a high-level rewrite
                if (i === 0 && rewriteLevel >= 75) {
                    const extractedMap = extractCharacterMap(chunkResult);
                    if (extractedMap) {
                        setCharacterMapForSession(extractedMap);
                        chunkResult = removeCharacterMapFromResponse(chunkResult);
                    }
                }
                
                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + chunkResult;
                setModuleState(prev => ({ ...prev, quick: { ...prev.quick, rewrittenText: fullRewrittenText } })); // Update UI progressively
            }
            setModuleState(prev => ({ ...prev, quick: { ...prev.quick, rewrittenText: fullRewrittenText.trim() } }));
            updateStateInput({ loadingMessage: 'Hoàn thành! Đang tự động biên tập...', progress: 100 });
            
            // Tự động biên tập để đảm bảo tính nhất quán
            await autoEditAfterRewrite(fullRewrittenText.trim());
            
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
            updateStateInput({ error: `Lỗi viết lại: ${(e as Error).message}`, loadingMessage: 'Lỗi!', progress: 0 });
        } finally {
            // Không xóa loadingMessage bằng setTimeout nữa
            updateStateInput({ loadingMessage: null });
            setIsProcessing(false);
        }
    };

    const autoEditAfterRewrite = async (textToEdit: string) => {
        try {
            updateStateInput({ loadingMessage: 'Đang tự động biên tập để đảm bảo tính nhất quán...' });
            
            const fullEditPrompt = `You are a meticulous story editor with an eidetic memory. Your task is to find and fix every single consistency error in the "Văn Bản Đã Viết Lại". You will cross-reference it against the "Văn Bản Gốc Ban Đầu" and the "Character Map" to ensure perfect logical and narrative integrity.

**CONTEXT FOR EDITING:**
- Rewrite Level Previously Applied: ${rewriteLevel}%
- Character Map Generated During Rewrite: \`${characterMapForSession || 'Không có'}\`

**VĂN BẢN GỐC BAN ĐẦU (để đối chiếu logic và các yếu tố gốc):**
---
${originalText}
---

**VĂN BẢN ĐÃ VIẾT LẠI (Cần bạn biên tập và tinh chỉnh):**
---
${textToEdit}
---

**HƯỚNG DẪN BIÊN TẬP NGHIÊM NGẶT:**
1.  **NHẤT QUÁN TÊN NHÂN VẬT (QUAN TRỌNG NHẤT):**
    - Rà soát kỹ TOÀN BỘ "Văn Bản Đã Viết Lại". Đảm bảo MỖI nhân vật chỉ sử dụng MỘT TÊN DUY NHẤT.
    - **Đối chiếu với Character Map:** Nếu map tồn tại, hãy đảm bảo mọi tên gốc trong "Văn Bản Gốc" đã được thay thế chính xác bằng tên mới từ map trong "Văn Bản Đã Viết Lại".
    - **Đối chiếu với Văn Bản Gốc (nếu không có map hoặc level < 75%):** Đảm bảo tên nhân vật trong "Văn Bản Đã Viết Lại" là bản dịch/phiên âm nhất quán của tên trong "Văn Bản Gốc". Sửa lại bất kỳ sự thay đổi ngẫu nhiên nào.
2.  **LOGIC CỐT TRUYỆN VÀ SỰ KIỆN:**
    - So sánh các sự kiện chính giữa hai phiên bản. "Văn Bản Đã Viết Lại" có tạo ra "plot hole" hoặc mâu thuẫn với các sự kiện đã được thiết lập không? Sửa lại cho hợp lý.
3.  **NHẤT QUÁN CHI TIẾT:**
    - Kiểm tra các chi tiết nhỏ nhưng quan trọng (nghề nghiệp, tuổi tác, địa điểm, mối quan hệ). Chúng có nhất quán trong toàn bộ "Văn Bản Đã Viết Lại" không?
4.  **CẢI THIỆN VĂN PHONG:**
    - Loại bỏ các đoạn văn, câu chữ bị lặp lại không cần thiết.
    - Cải thiện sự mượt mà, trôi chảy giữa các câu và đoạn văn.

**ĐẦU RA:**
- Chỉ trả về TOÀN BỘ nội dung văn bản đã được biên tập và sửa lỗi nhất quán hoàn chỉnh.
- Không thêm bất kỳ lời bình luận hay giải thích nào.
`;

            // Enhanced fallback prompt to prevent content truncation
            const fallbackEditPrompt = `You are a professional story editor. Your task is to carefully edit and improve this text while preserving its FULL length and ALL content.

**ORIGINAL TEXT FOR REFERENCE:**
---
${originalText}
---

**TEXT TO EDIT (must maintain complete length and all details):**
---
${textToEdit}
---

**CRITICAL EDITING REQUIREMENTS:**
1. **PRESERVE COMPLETE LENGTH**: The edited version MUST be approximately the same length as the input text. Do NOT shorten, summarize, or truncate any part.
2. **KEEP ALL SCENES AND DIALOGUE**: Maintain every scene, conversation, and narrative element from the text being edited.
3. **CHARACTER CONSISTENCY**: Ensure all character names remain consistent throughout the entire text.
4. **PLOT COHERENCE**: Fix any logical contradictions while keeping all story elements intact.
5. **LANGUAGE IMPROVEMENT**: Enhance grammar, flow, and readability without changing the content or length.

**ABSOLUTE REQUIREMENT**: Return the COMPLETE edited text with all original content preserved. The output must be as detailed and lengthy as the input text - do not cut anything out.`;

            let result;
            try {
                // Try full prompt first with enhanced error handling
                console.log(`🎯 Attempting auto-edit with full prompt (${fullEditPrompt.length} chars)`);
                try {
                    result = await generateTextViaBackend({ prompt: fullEditPrompt, provider: apiSettings?.provider || 'gemini' }, (newCredit) => {});
                    if (!result.success) throw new Error(result.error || 'Main prompt failed');
                } catch (networkError) {
                    const errorMsg = (networkError as Error).message;
                    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('502') || errorMsg.includes('Bad Gateway')) {
                        throw new Error('Backend connection interrupted');
                    }
                    throw networkError;
                }
            } catch (mainError) {
                const errorMsg = (mainError as Error).message;
                console.warn(`❌ Full prompt failed: ${errorMsg}`);
                
                // Only use fallback for specific errors (rate limits, token limits, network issues)
                if (errorMsg.includes('rate limit') || 
                    errorMsg.includes('token') || 
                    errorMsg.includes('too long') ||
                    errorMsg.includes('RATE_LIMIT_EXCEEDED') ||
                    errorMsg.includes('502') || 
                    errorMsg.includes('Bad Gateway') ||
                    errorMsg.includes('Failed to fetch')) {
                    
                    console.log('🔄 Using enhanced fallback due to technical limitation...');
                    updateStateInput({ loadingMessage: 'Prompt phức tạp, đang dùng phương án tối ưu...' });
                    
                    try {
                        result = await generateTextViaBackend({ prompt: fallbackEditPrompt, provider: apiSettings?.provider || 'gemini' }, (newCredit) => {});
                        if (!result.success) throw new Error(result.error || 'Fallback prompt failed');
                    } catch (fallbackNetworkError) {
                        const fallbackErrorMsg = (fallbackNetworkError as Error).message;
                        if (fallbackErrorMsg.includes('Failed to fetch') || fallbackErrorMsg.includes('502') || fallbackErrorMsg.includes('Bad Gateway')) {
                            throw new Error('Backend không khả dụng. Vui lòng thử lại sau.');
                        }
                        throw fallbackNetworkError;
                    }
                } else {
                    // For other errors, don't use fallback - just throw the original error
                    throw mainError;
                }
            }
            
            if (!result.success) throw new Error(result.error || 'AI generation failed');
            
            setModuleState(prev => ({ 
                ...prev, 
                quick: { 
                    ...prev.quick, 
                    rewrittenText: result.text || '', 
                    hasBeenEdited: true,
                    loadingMessage: 'Biên tập tự động hoàn tất!'
                } 
            }));
            
        } catch (e) {
            console.error('❌ Auto edit completely failed:', e);
            updateStateInput({ 
                loadingMessage: 'Biên tập tự động không thể thực hiện, nhưng văn bản viết lại vẫn hoàn tất!',
                editError: `Lỗi biên tập tự động: ${(e as Error).message}. Bạn có thể dùng nút "Biên Tập & Tinh Chỉnh" thủ công.` 
            });
        }
    };

    const handlePostRewriteEdit = async () => {
         if (!rewrittenText.trim()) {
            updateStateInput({ editError: 'Không có văn bản để tinh chỉnh.' });
            return;
        }
        setIsProcessing(true);
        updateStateInput({ isEditing: true, editError: null, editLoadingMessage: 'Đang tinh chỉnh logic...', hasBeenEdited: false });
        
        const editPrompt = `You are a meticulous story editor with an eidetic memory. Your task is to find and fix every single consistency error in the "Văn Bản Đã Viết Lại". You will cross-reference it against the "Văn Bản Gốc Ban Đầu" and the "Character Map" to ensure perfect logical and narrative integrity.

**CONTEXT FOR EDITING:**
- Rewrite Level Previously Applied: ${rewriteLevel}%
- Character Map Generated During Rewrite: \`${characterMapForSession || 'Không có'}\`

**VĂN BẢN GỐC BAN ĐẦU (để đối chiếu logic và các yếu tố gốc):**
---
${originalText}
---

**VĂN BẢN ĐÃ VIẾT LẠI (Cần bạn biên tập và tinh chỉnh):**
---
${rewrittenText}
---

**HƯỚNG DẪN BIÊN TẬP NGHIÊM NGẶT:**
1.  **NHẤT QUÁN TÊN NHÂN VẬT (QUAN TRỌNG NHẤT):**
    - Rà soát kỹ TOÀN BỘ "Văn Bản Đã Viết Lại". Đảm bảo MỖI nhân vật chỉ sử dụng MỘT TÊN DUY NHẤT.
    - **Đối chiếu với Character Map:** Nếu map tồn tại, hãy đảm bảo mọi tên gốc trong "Văn Bản Gốc" đã được thay thế chính xác bằng tên mới từ map trong "Văn Bản Đã Viết Lại".
    - **Đối chiếu với Văn Bản Gốc (nếu không có map hoặc level < 75%):** Đảm bảo tên nhân vật trong "Văn Bản Đã Viết Lại" là bản dịch/phiên âm nhất quán của tên trong "Văn Bản Gốc". Sửa lại bất kỳ sự thay đổi ngẫu nhiên nào.
2.  **LOGIC CỐT TRUYỆN VÀ SỰ KIỆN:**
    - So sánh các sự kiện chính giữa hai phiên bản. "Văn Bản Đã Viết Lại" có tạo ra "plot hole" hoặc mâu thuẫn với các sự kiện đã được thiết lập không? Sửa lại cho hợp lý.
3.  **NHẤT QUÁN CHI TIẾT:**
    - Kiểm tra các chi tiết nhỏ nhưng quan trọng (nghề nghiệp, tuổi tác, địa điểm, mối quan hệ). Chúng có nhất quán trong toàn bộ "Văn Bản Đã Viết Lại" không?
4.  **CẢI THIỆN VĂN PHONG:**
    - Loại bỏ các đoạn văn, câu chữ bị lặp lại không cần thiết.
    - Cải thiện sự mượt mà, trôi chảy giữa các câu và đoạn văn.

**ĐẦU RA:**
- Chỉ trả về TOÀN BỘ nội dung văn bản đã được biên tập và sửa lỗi nhất quán hoàn chỉnh.
- Không thêm bất kỳ lời bình luận hay giải thích nào.
`;
        
        try {
            let result;
            try {
                result = await generateTextViaBackend({ prompt: editPrompt, provider: apiSettings?.provider || 'gemini' }, (newCredit) => {});
                if (!result.success) throw new Error(result.error || 'AI generation failed');
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
            setModuleState(prev => ({ ...prev, quick: { ...prev.quick, rewrittenText: result.text || '', isEditing: false, editLoadingMessage: 'Tinh chỉnh hoàn tất!', hasBeenEdited: true } }));
        } catch (e) {
            updateStateInput({ editError: `Lỗi tinh chỉnh: ${(e as Error).message}`, isEditing: false, editLoadingMessage: 'Lỗi!' });
        } finally {
             // Không xóa editLoadingMessage bằng setTimeout nữa
             updateStateInput({ editLoadingMessage: null });
             setIsProcessing(false);
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
                 <button onClick={handleSingleRewrite} disabled={isProcessing || !originalText.trim()} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                    Viết lại Văn bản
                </button>
                {isProcessing && <LoadingSpinner message={loadingMessage || editLoadingMessage || 'Đang xử lý...'} />}
                {error && <ErrorAlert message={error} />}
                {editError && <ErrorAlert message={editError} />}
                {rewrittenText && !isProcessing && (
                     <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                         <h3 className="text-lg font-semibold mb-2">Văn bản đã viết lại:</h3>
                         <textarea value={rewrittenText} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white"/>
                         <div className="mt-3 flex gap-2">
                            <button onClick={() => copyToClipboard(rewrittenText)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Sao chép</button>
                            <button onClick={handlePostRewriteEdit} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">Biên Tập & Tinh Chỉnh</button>
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