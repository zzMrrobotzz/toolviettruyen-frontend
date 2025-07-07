import React, { useState, useEffect } from 'react';
import { ApiSettings, WriteStoryModuleState, WriteStoryActiveTab, BatchOutlineItem } from '../../types'; // Removed GeneratedBatchStoryItem
import { 
    WRITING_STYLE_OPTIONS, HOOK_LANGUAGE_OPTIONS, HOOK_STYLE_OPTIONS, 
    HOOK_LENGTH_OPTIONS, STORY_LENGTH_OPTIONS, 
    LESSON_LENGTH_OPTIONS, LESSON_WRITING_STYLE_OPTIONS,
    HOOK_STRUCTURE_OPTIONS // Added
} from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateText } from '../../services/geminiService';
import { delay } from '../../utils'; // Added delay import
import axios from 'axios';
import CreditAlertBox from '../CreditAlertBox';

interface WriteStoryModuleProps {
  apiSettings: ApiSettings;
  moduleState: WriteStoryModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<WriteStoryModuleState>>;
  retrievedViralOutlineFromAnalysis: string | null;
  currentKey: string;
}

const WriteStoryModule: React.FC<WriteStoryModuleProps> = ({ apiSettings, moduleState, setModuleState, retrievedViralOutlineFromAnalysis, currentKey }) => {
  const {
    activeWriteTab,
    // Common settings
    targetLength, writingStyle, customWritingStyle, outputLanguage, referenceViralStoryForStyle,
    // Single Story tab
    storyOutline, generatedStory, keyElementsFromSingleStory, hasSingleStoryBeenEditedSuccessfully, storyError, storyProgress, storyLoadingMessage, singleStoryEditProgress,
    // Hook Generator tab
    storyInputForHook, // New field
    hookLanguage, hookStyle, customHookStyle, hookLength, hookCount, ctaChannel, hookStructure, // Added hookStructure
    generatedHooks, hookError, hookLoadingMessage,
    // Lesson Generator tab
    storyInputForLesson, lessonTargetLength, lessonWritingStyle, customLessonWritingStyle, 
    ctaChannelForLesson, // Added
    generatedLesson, lessonError, lessonLoadingMessage,
    // Batch Story fields removed from destructuring
  } = moduleState;

  const [isSingleOutlineExpanded, setIsSingleOutlineExpanded] = useState(true);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const [credit, setCredit] = useState<number | null>(null);

  const geminiApiKeyForService = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;

  const updateState = (updates: Partial<WriteStoryModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const handleCancelOperation = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      // Update specific loading message based on active tab
      if (activeWriteTab === 'singleStory') {
        updateState({ storyLoadingMessage: "Đang hủy viết truyện..." });
      } else if (activeWriteTab === 'hookGenerator') {
        updateState({ hookLoadingMessage: "Đang hủy tạo hook..." });
      } else if (activeWriteTab === 'lessonGenerator') {
        updateState({ lessonLoadingMessage: "Đang hủy tạo bài học..." });
      }
    }
  };

  const handleUseViralOutline = () => {
    if (retrievedViralOutlineFromAnalysis && retrievedViralOutlineFromAnalysis.trim()) {
        updateState({
            storyOutline: retrievedViralOutlineFromAnalysis,
            generatedStory: '',
            keyElementsFromSingleStory: null,
            hasSingleStoryBeenEditedSuccessfully: false,
            generatedHooks: '',
            storyError: null,
            hookError: null,
            lessonError: null,
            storyLoadingMessage: null,
            singleStoryEditProgress: null,
            hookLoadingMessage: null,
            lessonLoadingMessage: null,
            storyProgress: 0,
            activeWriteTab: 'singleStory' // Switch to single story tab
        });
        setIsSingleOutlineExpanded(true);
    }
  };

  const handleGenerateHooks = async () => {
    let currentHookGenStyle = hookStyle;
    if (hookStyle === 'custom') {
      if (!customHookStyle.trim()) {
        updateState({ hookError: 'Vui lòng nhập phong cách hook tùy chỉnh!' });
        return;
      }
      currentHookGenStyle = customHookStyle.trim();
    }
    if (!storyInputForHook.trim()) { 
      updateState({ hookError: 'Vui lòng nhập Nội dung truyện để tạo hook!' });
      return;
    }
    
    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);
    updateState({ hookError: null, generatedHooks: '', hookLoadingMessage: 'Đang tạo hooks...' });
    
    let ctaInstructionSegment = ctaChannel.trim() ? `\n- If a Call To Action (CTA) is appropriate for the chosen hook structure (e.g., as part of 'Action' in AIDA, or at the end), incorporate a compelling CTA to like, comment, and subscribe to the channel "${ctaChannel.trim()}".` : "";
    const selectedHookLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === hookLanguage)?.label || hookLanguage;

    let structureInstructionSegment = '';
    let structuralExplanationRequirement = '';
    if (hookStructure !== 'default' && hookStructure) {
        const structureOption = HOOK_STRUCTURE_OPTIONS.find(opt => opt.value === hookStructure);
        const structureName = structureOption ? structureOption.label.split(' (')[0] : hookStructure; // "AIDA", "PAS", etc.

        structureInstructionSegment = `\n- The structure of the hooks MUST follow the ${structureName} model.`;
        structuralExplanationRequirement = `
        \n- For EACH hook generated, append a brief, parenthesized explanation of how it applies the ${structureName} model's components.
        \n  Example for AIDA: "1. [Hook Text including CTA if relevant]. (AIDA: Attention - ...; Interest - ...; Desire - ...; Action - ...)"
        \n  Example for PAS: "2. [Hook Text including CTA if relevant]. (PAS: Problem - ...; Agitate - ...; Solution - ...)"
        \n  Adapt this explanation format for other chosen structures, clearly labeling each part of the structure applied in the hook. The explanation must be concise and in the same language as the hook (${selectedHookLangLabel}).`;
    }
    
    const prompt = `Based on the following story content, generate ${hookCount} compelling opening hooks in ${selectedHookLangLabel}.
    \n**Instructions:**
    \n- The style of the hooks should be: **${currentHookGenStyle}**.
    \n- Each hook should be approximately **${hookLength} words** long.${structureInstructionSegment}${ctaInstructionSegment}${structuralExplanationRequirement}
    \n- Format the output with each hook on a new line, numbered like "1. [Hook Content][ (Structural Explanation if applicable)]".
    \n**Story Content (this may be in a different language than the desired hook language, use its meaning for generation in ${selectedHookLangLabel}):**
    \n---
    \n${storyInputForHook.trim()}
    \n---`;

    try {
      const result = await generateText(prompt, undefined, undefined, geminiApiKeyForService);
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ generatedHooks: result.text, hookLoadingMessage: "Tạo hook hoàn tất!" });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ hookError: 'Tạo hook đã bị hủy.', hookLoadingMessage: 'Đã hủy.' });
      } else {
        updateState({ hookError: `Đã xảy ra lỗi khi tạo hook: ${e.message}`, hookLoadingMessage: "Lỗi tạo hook." });
      }
    } finally {
      setCurrentAbortController(null);
      setTimeout(() => setModuleState(prev => (prev.hookLoadingMessage?.includes("hoàn tất") || prev.hookLoadingMessage?.includes("Lỗi") || prev.hookLoadingMessage?.includes("Đã hủy")) ? {...prev, hookLoadingMessage: null} : prev), 3000);
    }
  };

  const handleWriteStory = async () => {
    if (!storyOutline.trim()) {
      updateState({ storyError: 'Vui lòng nhập dàn ý truyện!' });
      return;
    }
    let currentStoryStyle = writingStyle;
    if (writingStyle === 'custom') {
      if (!customWritingStyle.trim()) {
        updateState({ storyError: 'Vui lòng nhập phong cách viết truyện tùy chỉnh!' });
        return;
      }
      currentStoryStyle = customWritingStyle.trim();
    } else {
      currentStoryStyle = WRITING_STYLE_OPTIONS.find(opt => opt.value === writingStyle)?.label || writingStyle;
    }

    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);

    updateState({ 
        storyError: null, 
        generatedStory: '', 
        storyProgress: 0, 
        storyLoadingMessage: 'Đang chuẩn bị...', 
        keyElementsFromSingleStory: null,
        hasSingleStoryBeenEditedSuccessfully: false, 
        singleStoryEditProgress: null 
    });
    const CHUNK_WORD_COUNT = 1000; 
    const currentTargetLengthNum = parseInt(targetLength);
    const numChunks = Math.ceil(currentTargetLengthNum / CHUNK_WORD_COUNT);
    let fullStory = '';
    const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    let referenceStoryStylePromptSegment = referenceViralStoryForStyle?.trim() ? `
        \n**Truyện Viral Tham Khảo (CHỈ DÙNG ĐỂ HỌC VĂN PHONG VIẾT - TUYỆT ĐỐI KHÔNG DÙNG NỘI DUNG/NHÂN VẬT TỪ ĐÂY CHO TRUYỆN MỚI):**
        \n---
        \n${referenceViralStoryForStyle.trim()}
        \n---
        \n**Yêu cầu BẮT BUỘC Về Văn Phong (Áp dụng cho câu chuyện bạn sắp viết từ DÀN Ý CHÍNH):**
        \n1.  **Phân Tích Văn Phong:** Phân tích kỹ lưỡng các yếu tố văn phong của "Truyện Viral Tham Khảo" ở trên.
        \n2.  **Áp Dụng CHỈ Văn Phong:** Khi bạn viết câu chuyện mới dựa trên "Dàn ý tổng thể", hãy áp dụng các yếu tố VĂN PHONG bạn vừa học được.
        \n3.  **NGHIÊM CẤM Sao Chép Nội Dung/Nhân Vật Từ Truyện Tham Khảo.** Câu chuyện mới PHẢI được phát triển hoàn toàn và CHỈ từ "Dàn ý tổng thể".
        \n4.  **Ưu Tiên Văn Phong Học Được:** Văn phong học từ truyện tham khảo sẽ được ưu tiên hơn so với phong cách "${currentStoryStyle}".` : '';
    let capturedKeyElements: string | null = null;
    try {
      for (let i = 0; i < numChunks; i++) {
        if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        updateState({ storyLoadingMessage: `Đang viết phần ${i + 1}/${numChunks} của truyện (mục tiêu tổng: ~${currentTargetLengthNum} từ) bằng ${outputLanguageLabel}...`, storyProgress: Math.round(((i + 1) / numChunks) * 100) });
        const context = fullStory.length > 2000 ? '...\n' + fullStory.slice(-2000) : fullStory;
        let prompt = `Bạn là một nhà văn đa ngôn ngữ. Viết tiếp câu chuyện BẰNG NGÔN NGỮ ${outputLanguageLabel}, dựa HOÀN TOÀN vào "Dàn ý tổng thể".
        \nƯớc tính độ dài cho PHẦN NÀY: khoảng ${CHUNK_WORD_COUNT} từ. Tổng độ dài mục tiêu của TOÀN BỘ truyện là ${currentTargetLengthNum} từ.
        \nVIỆC KIỂM SOÁT ĐỘ DÀI CỦA TỪNG PHẦN LÀ RẤT QUAN TRỌNG. CỐ GẮNG GIỮ PHẦN NÀY KHÔNG VƯỢT QUÁ ${Math.round(CHUNK_WORD_COUNT * 1.15)} TỪ VÀ KHÔNG NGẮN HƠN ${Math.round(CHUNK_WORD_COUNT * 0.85)} TỪ.
        \n**Dàn ý tổng thể (NGUỒN DUY NHẤT CHO NỘI DUNG TRUYỆN):**\n${storyOutline}`;
        if (i === 0) {
          prompt += `
        \n**Yêu cầu RẤT QUAN TRỌNG Trước Khi Viết Phần 1:**
        \n1.  **Phân tích Dàn Ý.**
        \n2.  **Xác định Yếu Tố Cốt Lõi:** Tên nhân vật chính/phụ, địa điểm chính.
        \n3.  **Xuất Yếu Tố Cốt Lõi:** Sau khi viết xong phần 1, thêm vào CUỐI CÙNG một dòng ĐẶC BIỆT theo định dạng: [KEY_ELEMENTS]Tên nhân vật 1, Tên nhân vật 2; Địa điểm A, Địa điểm B[/KEY_ELEMENTS]. Chỉ xuất thẻ này 1 LẦN DUY NHẤT trong toàn bộ quá trình viết truyện. Dòng này phải tách biệt và là dòng cuối cùng của phản hồi cho phần 1.`;
        } else if (capturedKeyElements) {
          prompt += `\n**YẾU TỐ CỐT LÕI (NHÂN VẬT & ĐỊA ĐIỂM) - BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT:**\n${capturedKeyElements}\nTUYỆT ĐỐI không thay đổi hoặc giới thiệu tên mới không có trong danh sách này, trừ khi dàn ý yêu cầu rõ ràng.`;
        }
        prompt += `
        \n**Nội dung đã viết (ngữ cảnh${i === 0 ? " - trống cho phần 1" : ""}):**\n${context}${referenceStoryStylePromptSegment}
        \n**Yêu cầu hiện tại (Phần ${i + 1}/${numChunks}):**
        \n- Viết phần tiếp theo, liền mạch, TRUNG THÀNH với "Dàn ý tổng thể".
        \n- ${i === 0 ? 'SỬ DỤNG NHẤT QUÁN các tên nhân vật/địa điểm bạn vừa xác định và sẽ xuất ra ở cuối phần 1.' : 'ĐẶC BIỆT CHÚ Ý sử dụng đúng "YẾU TỐ CỐT LÕI" đã được xác định trước đó.'}
        \n- Văn phong: "${currentStoryStyle}" (hoặc ưu tiên văn phong học từ truyện tham khảo).
        \n- VIẾT TOÀN BỘ BẰNG NGÔN NGỮ ${outputLanguageLabel}. Không dùng ngôn ngữ khác.
        \n- Chỉ viết nội dung phần tiếp theo, không lặp lại, không tiêu đề.
        \nBắt đầu viết phần tiếp theo (bằng ${outputLanguageLabel}):`;

        if (i > 0) await delay(1000, abortCtrl.signal); 
        const result = await generateText(prompt, undefined, undefined, geminiApiKeyForService);
        if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        let currentChunkText = result.text;
        if (i === 0) {
            const keyElementsMatch = currentChunkText.match(/\[KEY_ELEMENTS\]([\s\S]*?)\[\/KEY_ELEMENTS\]/);
            if (keyElementsMatch && keyElementsMatch[1]) {
                capturedKeyElements = keyElementsMatch[1].trim();
                updateState({ keyElementsFromSingleStory: capturedKeyElements });
                currentChunkText = currentChunkText.replace(keyElementsMatch[0], '').trim();
            }
        }
        fullStory += (fullStory ? '\n\n' : '') + currentChunkText;
        updateState({ generatedStory: fullStory });
      }
      updateState({ storyLoadingMessage: 'Hoàn thành viết truyện! Chuẩn bị biên tập độ dài.' });
      
      await delay(1000, abortCtrl.signal); 
      if(fullStory.trim()){
          await handleEditStory(fullStory, storyOutline, capturedKeyElements, undefined, abortCtrl); // Pass abortCtrl
      } else {
        updateState({ storyError: "Không thể tạo nội dung truyện.", storyLoadingMessage: null, storyProgress: 0 });
      }

      // Sau khi tạo xong bài viết hoàn chỉnh
      try {
        await axios.post(`${apiSettings.apiBase}/keys/use-credit`, { key: currentKey });
        // Sau khi trừ credit, gọi lại API /validate để lấy số credit mới nhất
        const res = await axios.post(`${apiSettings.apiBase}/validate`, { key: currentKey });
        if (res.data?.keyInfo?.credit !== undefined) {
          setCredit(res.data.keyInfo.credit);
        }
      } catch (err) {
        alert('Hết credit hoặc lỗi khi trừ credit!');
        setCredit(0);
        return;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ storyError: `Viết truyện đã bị hủy.`, storyLoadingMessage: 'Đã hủy.', storyProgress: 0 });
      } else {
        updateState({ storyError: `Đã xảy ra lỗi khi viết truyện: ${e.message}`, storyLoadingMessage: null, storyProgress: 0 });
      }
    } finally {
      setCurrentAbortController(null);
      // Let editStory's finally block handle clearing the "Đã hủy" if it's the one that sets it
      if (storyLoadingMessage !== 'Đã hủy biên tập.') {
        setTimeout(() => setModuleState(prev => (prev.storyLoadingMessage === 'Đã hủy.' || prev.storyLoadingMessage === 'Hoàn thành viết truyện! Chuẩn bị biên tập độ dài.' || (prev.storyError && !prev.storyLoadingMessage?.includes("Đã hủy"))) ? {...prev, storyLoadingMessage: null} : prev), 3000);
      }
    }
  };

  const handleEditStory = async (
    storyToEdit: string, 
    originalOutlineParam: string, 
    keyElementsInstruction?: string | null, 
    itemIndex?: number, // Not used for single story edit here
    externalAbortController?: AbortController // Accept controller from calling function
  ) => {
    const abortCtrl = externalAbortController || new AbortController();
    if (!externalAbortController) { // If called directly, manage its own controller
        setCurrentAbortController(abortCtrl);
    }

    if (!storyToEdit.trim()) {
      updateState({ storyError: 'Không có truyện để biên tập.', singleStoryEditProgress: null, storyLoadingMessage: null, hasSingleStoryBeenEditedSuccessfully: false });
      if (!externalAbortController) setCurrentAbortController(null);
      return;
    }

    const currentTargetLengthNum = parseInt(targetLength);
    const minLength = Math.round(currentTargetLengthNum * 0.9);
    const maxLength = Math.round(currentTargetLengthNum * 1.1);
    const estimatedCurrentWordCount = storyToEdit.split(/\s+/).filter(Boolean).length;

    let actionVerb = "";
    let diffDescription = "";
    if (estimatedCurrentWordCount > maxLength) {
        actionVerb = "RÚT NGẮN";
        diffDescription = `khoảng ${estimatedCurrentWordCount - currentTargetLengthNum} từ`;
    } else if (estimatedCurrentWordCount < minLength) {
        actionVerb = "MỞ RỘNG";
        diffDescription = `khoảng ${currentTargetLengthNum - estimatedCurrentWordCount} từ`;
    }

    const editingLoadingMessage = `AI đang biên tập truyện (hiện tại ~${estimatedCurrentWordCount} từ, mục tiêu ${minLength}-${maxLength} từ)...`;
    updateState({ 
        storyLoadingMessage: editingLoadingMessage, 
        singleStoryEditProgress: 30, 
        hasSingleStoryBeenEditedSuccessfully: false,
        storyError: null // Clear previous story errors
    });
    
    const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    
    let prompt = `Bạn là một biên tập viên truyện chuyên nghiệp. Nhiệm vụ của bạn là biên tập lại toàn bộ "Truyện Gốc" dưới đây để đáp ứng các yêu cầu sau:
    \n**YÊU CẦU QUAN TRỌNG NHẤT VÀ ĐẦU TIÊN: ĐỘ DÀI CUỐI CÙNG CỦA TRUYỆN SAU KHI BIÊN TẬP PHẢI nằm trong khoảng từ ${minLength} đến ${maxLength} từ. MỤC TIÊU LÝ TƯỞNG là khoảng ${currentTargetLengthNum} từ.**
    \nTruyện gốc bạn nhận được hiện có khoảng ${estimatedCurrentWordCount} từ.
    \n${actionVerb ? `Yêu cầu Điều chỉnh Rõ ràng: Bạn cần ${actionVerb} ${diffDescription} cho truyện này.` : "Truyện đang trong khoảng độ dài chấp nhận được, hãy tập trung vào chất lượng."}

    \n**CÁCH THỨC ĐIỀU CHỈNH ĐỘ DÀI (Nếu cần):**
    \n- **Nếu truyện quá dài (hiện tại ${estimatedCurrentWordCount} > ${maxLength} từ):** BẠN BẮT BUỘC PHẢI RÚT NGẮN NÓ. TUYỆT ĐỐI KHÔNG LÀM NÓ DÀI THÊM.
        \n  1.  Cô đọng văn phong: Loại bỏ từ ngữ thừa, câu văn rườm rà, diễn đạt súc tích hơn.
        \n  2.  Tóm lược các đoạn mô tả chi tiết không ảnh hưởng LỚN đến cốt truyện hoặc cảm xúc chính.
        \n  3.  Nếu vẫn còn quá dài, xem xét gộp các cảnh phụ ít quan trọng hoặc cắt tỉa tình tiết không thiết yếu.
        \n  4.  **DỪNG LẠI KHI ĐẠT GẦN MỤC TIÊU:** Khi truyện đã được rút ngắn và có độ dài ước tính gần ${maxLength} (nhưng vẫn trên ${minLength}), hãy chuyển sang tinh chỉnh nhẹ nhàng để đạt được khoảng ${currentTargetLengthNum} từ. **TUYỆT ĐỐI KHÔNG CẮT QUÁ TAY** làm truyện ngắn hơn ${minLength} từ.
    \n- **Nếu truyện quá ngắn (hiện tại ${estimatedCurrentWordCount} < ${minLength} từ):** BẠN BẮT BUỘC PHẢI MỞ RỘNG NÓ. TUYỆT ĐỐI KHÔNG LÀM NÓ NGẮN ĐI.
        \n  1.  Thêm chi tiết mô tả (cảm xúc nhân vật, không gian, thời gian, hành động nhỏ).
        \n  2.  Kéo dài các đoạn hội thoại quan trọng, thêm phản ứng, suy nghĩ của nhân vật.
        \n  3.  Mở rộng các cảnh hành động hoặc cao trào bằng cách mô tả kỹ hơn các diễn biến.
        \n  4.  **DỪNG LẠI KHI ĐẠT GẦN MỤC TIÊU:** Khi truyện đã được mở rộng và có độ dài ước tính gần ${minLength} (nhưng vẫn dưới ${maxLength}), hãy chuyển sang tinh chỉnh nhẹ nhàng để đạt được khoảng ${currentTargetLengthNum} từ. **TUYỆT ĐỐI KHÔNG KÉO DÀI QUÁ TAY** làm truyện dài hơn ${maxLength} từ.
    \n- **Nếu truyện đã trong khoảng ${minLength}-${maxLength} từ:** Tập trung vào việc tinh chỉnh văn phong, làm rõ ý, đảm bảo mạch lạc.

    \n**YÊU CẦU VỀ CHẤT LƯỢNG (SAU KHI ĐẢM BẢO ĐỘ DÀI):**
    \n1.  **Tính Nhất Quán:** Kiểm tra và đảm bảo tính logic của cốt truyện, sự nhất quán của nhân vật (tên, tính cách, hành động, mối quan hệ), bối cảnh, và mạch truyện.
    \n    ${keyElementsInstruction ? `**YẾU TỐ CỐT LÕI (NHÂN VẬT & ĐỊA ĐIỂM) - BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT KHI BIÊN TẬP:**\n    ${keyElementsInstruction}\n    Tuyệt đối không thay đổi tên nhân vật/địa điểm đã được xác định này.` : ''}
    \n2.  **Mạch Lạc & Hấp Dẫn:** Đảm bảo câu chuyện trôi chảy, dễ hiểu, và giữ được sự hấp dẫn.
    \n3.  **Bám sát Dàn Ý Gốc:** Việc biên tập không được làm thay đổi các NÚT THẮT, CAO TRÀO QUAN TRỌNG, hoặc Ý NGHĨA CHÍNH của câu chuyện được mô tả trong "Dàn Ý Gốc".
    \n**DÀN Ý GỐC (Để đối chiếu khi biên tập, KHÔNG được viết lại dàn ý):**
    \n---
    \n${originalOutlineParam}
    \n---
    \n**TRUYỆN GỐC CẦN BIÊN TẬP (được cung cấp bằng ${outputLanguageLabel}):**
    \n---
    \n${storyToEdit}
    \n---
    \nHãy trả về TOÀN BỘ câu chuyện đã được biên tập hoàn chỉnh bằng ngôn ngữ ${outputLanguageLabel}.
    ĐẢM BẢO ĐỘ DÀI CUỐI CÙNG nằm trong khoảng ${minLength} đến ${maxLength} từ.
    Không thêm bất kỳ lời bình, giới thiệu, hay tiêu đề nào.`;

    try {
      const result = await generateText(prompt, undefined, undefined, geminiApiKeyForService);
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const editedStory = result.text;
      updateState({ 
        generatedStory: editedStory, 
        storyLoadingMessage: '✅ ĐÃ BIÊN TẬP XONG 100%!', 
        singleStoryEditProgress: 100,
        hasSingleStoryBeenEditedSuccessfully: true
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
         updateState({ storyError: 'Biên tập truyện đã bị hủy.', storyLoadingMessage: 'Đã hủy biên tập.', singleStoryEditProgress: null, hasSingleStoryBeenEditedSuccessfully: false });
      } else {
        const editErrorMsg = `Lỗi khi biên tập truyện: ${e.message}`;
        updateState({ 
            storyError: editErrorMsg, 
            storyLoadingMessage: 'Lỗi biên tập.', 
            singleStoryEditProgress: null,
            hasSingleStoryBeenEditedSuccessfully: false
        });
      }
    } finally {
        if (!externalAbortController) setCurrentAbortController(null);
        setTimeout(() => setModuleState(prev => (prev.storyLoadingMessage?.includes("ĐÃ BIÊN TẬP XONG") || prev.storyLoadingMessage?.includes("Lỗi biên tập") || prev.storyLoadingMessage?.includes("Đã hủy biên tập")) ? {...prev, storyLoadingMessage: null, singleStoryEditProgress: null} : prev), 3000);
    }
  };


  const handleGenerateLesson = async () => {
    if (!storyInputForLesson.trim()) {
      updateState({ lessonError: 'Vui lòng nhập Truyện để đúc kết bài học!' });
      return;
    }
    let currentLessonStyle = lessonWritingStyle;
    if (lessonWritingStyle === 'custom') {
      if (!customLessonWritingStyle.trim()) {
        updateState({ lessonError: 'Vui lòng nhập phong cách viết bài học tùy chỉnh!' });
        return;
      }
      currentLessonStyle = customLessonWritingStyle.trim();
    }

    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);
    updateState({ lessonError: null, generatedLesson: '', lessonLoadingMessage: 'Đang đúc kết bài học...' });
    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    
    let ctaLessonSegment = ctaChannelForLesson.trim() ? `\n- If appropriate, naturally weave in a call to action at the end of the lesson, encouraging viewers to engage with the channel "${ctaChannelForLesson.trim()}". For example: "Hãy chia sẻ suy nghĩ của bạn và đừng quên theo dõi kênh ${ctaChannelForLesson.trim()} để khám phá thêm nhiều câu chuyện ý nghĩa nhé!"` : "";

    const prompt = `Based on the following story, extract a meaningful lesson for the audience.
    \n**Story:**
    \n---
    \n${storyInputForLesson.trim()}
    \n---
    \n**Instructions:**
    \n- The lesson should be approximately **${lessonTargetLength} words** long.
    \n- The writing style for the lesson should be: **${currentLessonStyle}**.
    \n- The lesson must be written in **${selectedOutputLangLabel}**. ${ctaLessonSegment}
    \n- Return only the lesson text. No introductions or other text.`;
    try {
      const result = await generateText(prompt, undefined, undefined, geminiApiKeyForService);
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ generatedLesson: result.text, lessonLoadingMessage: "Đúc kết bài học hoàn tất!" });
    } catch (e: any) {
       if (e.name === 'AbortError') {
        updateState({ lessonError: 'Tạo bài học đã bị hủy.', lessonLoadingMessage: 'Đã hủy.' });
      } else {
        updateState({ lessonError: `Đã xảy ra lỗi khi đúc kết bài học: ${e.message}`, lessonLoadingMessage: "Lỗi đúc kết bài học." });
      }
    } finally {
       setCurrentAbortController(null);
       setTimeout(() => setModuleState(prev => (prev.lessonLoadingMessage?.includes("hoàn tất") || prev.lessonLoadingMessage?.includes("Lỗi") || prev.lessonLoadingMessage?.includes("Đã hủy")) ? {...prev, lessonLoadingMessage: null} : prev), 3000);
    }
  };

  const copyToClipboard = (text: string, buttonId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(buttonId);
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Đã sao chép!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  };
  
  const TabButton: React.FC<{ tabId: WriteStoryActiveTab; label: string, icon: string }> = ({ tabId, label, icon }) => (
    <button
      onClick={() => {
        if (currentAbortController) currentAbortController.abort(); // Cancel any ongoing operation before switching tabs
        setCurrentAbortController(null);
        updateState({
            activeWriteTab: tabId,
            storyError: tabId === 'singleStory' ? moduleState.storyError : null,
            hookError: tabId === 'hookGenerator' ? moduleState.hookError : null,
            lessonError: tabId === 'lessonGenerator' ? moduleState.lessonError : null,
            storyLoadingMessage: null, 
            hookLoadingMessage: null,
            lessonLoadingMessage: null,
            singleStoryEditProgress: null,
        });
      }}
      className={`px-4 py-3 font-medium rounded-t-lg text-base transition-colors flex items-center space-x-2
                  ${activeWriteTab === tabId 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
      aria-selected={activeWriteTab === tabId}
      role="tab"
      disabled={!!(storyLoadingMessage || hookLoadingMessage || lessonLoadingMessage || singleStoryEditProgress)}
    >
        <span>{icon}</span>
        <span>{label}</span>
    </button>
  );
  
  const anyLoadingOperation = storyLoadingMessage !== null || hookLoadingMessage !== null || lessonLoadingMessage !== null || singleStoryEditProgress !== null; 
  const feedbackContainerMinHeight = "60px"; 
  const spinnerFeedbackContainerHeight = "h-20"; 

  const currentLoadingMessage = activeWriteTab === 'singleStory' ? storyLoadingMessage :
                                activeWriteTab === 'hookGenerator' ? hookLoadingMessage :
                                activeWriteTab === 'lessonGenerator' ? lessonLoadingMessage : null;

  // Định nghĩa fetchCredit trước renderCreditBox
  const fetchCredit = async () => {
    if (!currentKey) return;
    try {
      const res = await axios.post(`${apiSettings.apiBase}/validate`, { key: currentKey });
      if (res.data?.keyInfo?.credit !== undefined) {
        setCredit(res.data.keyInfo.credit);
      }
    } catch {
      setCredit(null);
    }
  };
  useEffect(() => { fetchCredit(); }, [currentKey, apiSettings.apiBase]);
  const isOutOfCredit = credit !== null && credit <= 0;

  // UI: Credit box + refresh
  const renderCreditBox = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
      <div style={{ background: isOutOfCredit ? '#fff1f0' : '#e6fffb', color: isOutOfCredit ? '#ff4d4f' : '#1890ff', border: `1.5px solid ${isOutOfCredit ? '#ff4d4f' : '#1890ff'}`, borderRadius: 12, padding: '8px 20px', fontWeight: 600, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>💳</span>
        Credit còn lại: <span style={{ fontWeight: 700 }}>{credit !== null ? credit : '...'}</span>
        <button onClick={fetchCredit} style={{ marginLeft: 12, background: '#fff', border: '1px solid #1890ff', color: '#1890ff', borderRadius: 6, padding: '2px 10px', fontWeight: 500, cursor: 'pointer' }}>Làm mới</button>
      </div>
    </div>
  );

  const renderMainButton = () => {
    let buttonText = "";
    let actionHandler: () => void = () => {};
    let disabled = anyLoadingOperation;

    if (activeWriteTab === 'singleStory') {
      buttonText = "✍️ Viết & Biên Tập Truyện";
      actionHandler = handleWriteStory;
      disabled = disabled || !storyOutline.trim();
    } else if (activeWriteTab === 'hookGenerator') {
      buttonText = "💡 Tạo Hooks";
      actionHandler = handleGenerateHooks;
      disabled = disabled || !storyInputForHook.trim();
    } else if (activeWriteTab === 'lessonGenerator') {
      buttonText = "🧐 Tạo Bài Học";
      actionHandler = handleGenerateLesson;
      disabled = disabled || !storyInputForLesson.trim();
    }

    if (anyLoadingOperation) {
      return (
        <div className="flex space-x-3">
          <button
            disabled
            className="w-2/3 bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md cursor-not-allowed"
          >
            {currentLoadingMessage || "Đang xử lý..."}
          </button>
          <button
            onClick={handleCancelOperation}
            className="w-1/3 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md"
            aria-label="Hủy tác vụ hiện tại"
          >
            Hủy ⏹️
          </button>
        </div>
      );
    }

    return (
      <>
        {isOutOfCredit && (
          <div style={{ color: '#ff4d4f', fontWeight: 600, marginBottom: 8, textAlign: 'center', fontSize: 18 }}>
            Hết credit! Vui lòng nạp thêm để tiếp tục sử dụng chức năng này.
          </div>
        )}
      <button 
        onClick={actionHandler} 
          disabled={isOutOfCredit || disabled}
          className="w-full bg-gradient-to-r from-indigo-700 to-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-xl hover:opacity-90 transition-opacity disabled:opacity-60 text-lg"
      >
          {currentLoadingMessage || buttonText}
      </button>
      </>
    );
  };

  // Định nghĩa CreditAlertBox giống style module Viết Lại Hàng Loạt
  const CreditAlertBox = () => (
    <div style={{
      background: '#f8fff3',
      border: '2px solid #ff4d4f',
      borderRadius: 12,
      padding: '12px 32px',
      color: '#ff4d4f',
      fontWeight: 700,
      fontSize: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '18px auto 24px auto',
      maxWidth: 340
    }}>
      <span style={{ fontSize: 28, marginRight: 10 }}>💳</span>
      Credit còn lại: {credit !== null ? credit : '...'}
    </div>
  );

  return (
    <ModuleContainer title="✍️ Viết Truyện">
      {/* Ô credit alert dưới tiêu đề */}
      <CreditAlertBox />
        <InfoBox>
            <p><strong>📌 Quy trình Tạo Truyện Hoàn Chỉnh:</strong></p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm mt-2">
                <li>
                    <strong>Cài đặt chung:</strong> Đầu tiên, hãy thiết lập các tùy chọn trong phần "Cài đặt chung" (Độ dài, Phong cách viết, Ngôn ngữ, Truyện Viral Tham Khảo). Các cài đặt này sẽ áp dụng cho các tab tương ứng.
                </li>
                <li>
                    <strong>Tab "✍️ Viết Truyện Đơn":</strong>
                    <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li><strong>Nhập Dàn Ý:</strong> Cung cấp "Dàn ý truyện". Bạn có thể nhập/dán trực tiếp, hoặc sử dụng nút "Sử dụng Dàn Ý Viral từ Phân Tích" nếu có. Dàn ý từ Module "Xây Dựng Truyện" cũng sẽ tự động chuyển sang đây.</li>
                        <li><strong>Tạo Truyện:</strong> Nhấn nút "✍️ Viết & Biên Tập Truyện".</li>
                        <li>
                            <strong>Quá trình Tự động:</strong> AI sẽ:
                            <ul className="list-['-_'] list-inside ml-5 mt-0.5">
                                <li>Viết truyện theo từng phần dựa trên dàn ý.</li>
                                <li>Tự động Biên Tập & Tối Ưu Độ Dài: Sau khi viết xong, AI sẽ tự động biên tập lại toàn bộ truyện để đảm bảo tính nhất quán, logic và cố gắng đạt mục tiêu độ dài (±10%). Bạn sẽ thấy thông báo "✅ ĐÃ BIÊN TẬP XONG 100%!" khi hoàn tất.</li>
                            </ul>
                        </li>
                        <li><strong>Kết quả:</strong> Truyện hoàn chỉnh, đã được tối ưu, sẵn sàng để bạn sao chép hoặc tinh chỉnh thêm nếu cần.</li>
                    </ul>
                </li>
                <li>
                    <strong>Tab "💡 Tạo Hooks":</strong>
                     <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Nhập "Nội dung truyện" trực tiếp hoặc dùng nút "Sử dụng Truyện Vừa Viết" từ tab 'Viết Truyện Đơn'.</li>
                        <li>Điều chỉnh các cài đặt riêng cho Hooks (Ngôn ngữ, Phong cách, Độ dài, Số lượng, Kênh CTA, Cấu trúc Hook).</li>
                        <li>Nhấn "💡 Tạo Hooks" để nhận các hook mở đầu hấp dẫn theo cấu trúc đã chọn.</li>
                    </ul>
                </li>
                <li>
                    <strong>Tab "🧐 Đúc Kết Bài Học":</strong>
                     <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Nhập "Nội dung truyện cần đúc kết" (có thể dùng nút "Sử dụng Truyện Vừa Viết").</li>
                        <li>Chọn các cài đặt cho Bài học (Mục tiêu số từ, Phong cách viết, Kênh CTA). Ngôn ngữ sẽ theo "Cài đặt chung".</li>
                        <li>Nhấn "🧐 Tạo Bài Học" để nhận bài học ý nghĩa từ truyện.</li>
                    </ul>
                </li>
            </ol>
            <p className="mt-2 text-sm text-orange-600">
                <strong>Cập nhật (QUAN TRỌNG):</strong> Khả năng giữ tính nhất quán cho tên nhân vật, địa điểm và kiểm soát độ dài truyện (±10% mục tiêu) đã được cải thiện thông qua quy trình biên tập tự động sau khi viết. Thông báo biên tập 100% sẽ hiển thị rõ ràng.
            </p>
        </InfoBox>

      <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cài đặt chung (Cho các tab Viết Truyện, Đúc Kết Bài Học)</h3>
        <div className="grid md:grid-cols-3 gap-6">
            <div>
                <label htmlFor="wsTargetLength" className="block text-sm font-medium text-gray-700 mb-1">Độ dài truyện (mục tiêu):</label>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-indigo-600">{parseInt(targetLength).toLocaleString()} từ</span>
                </div>
                <input 
                    type="range" 
                    id="wsTargetLength" 
                    min={STORY_LENGTH_OPTIONS[0].value} 
                    max={STORY_LENGTH_OPTIONS[STORY_LENGTH_OPTIONS.length - 1].value} 
                    step="500" 
                    value={targetLength} 
                    onChange={(e) => updateState({ targetLength: e.target.value })} 
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    disabled={anyLoadingOperation}
                />
                 <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Ngắn</span>
                    <span>Dài</span>
                </div>
                 <p className="text-xs text-gray-500 mt-1">Truyện sẽ được biên tập để đạt ~{parseInt(targetLength).toLocaleString()} từ (±10%).</p>
            </div>
            <div>
                <label htmlFor="wsWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết truyện (chung):</label>
                <select id="wsWritingStyle" value={writingStyle} onChange={(e) => updateState({ writingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                    {WRITING_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             {writingStyle === 'custom' && (
                <div>
                    <label htmlFor="wsCustomWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết truyện tùy chỉnh (chung):</label>
                    <input type="text" id="wsCustomWritingStyle" value={customWritingStyle} onChange={(e) => updateState({ customWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Kịch tính, hồi hộp, plot twist" disabled={anyLoadingOperation}/>
                </div>
            )}
            <div>
                <label htmlFor="wsOutputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Truyện & Bài học:</label>
                <select id="wsOutputLanguage" value={outputLanguage} onChange={(e) => updateState({ outputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                    {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             <div className="md:col-span-3">
                <label htmlFor="wsRefViralStory" className="block text-sm font-medium text-gray-700 mb-1">Truyện Viral Tham Khảo (học văn phong - Không bắt buộc):</label>
                <textarea id="wsRefViralStory" value={referenceViralStoryForStyle} onChange={(e) => updateState({ referenceViralStoryForStyle: e.target.value })} rows={4} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Dán một câu chuyện viral mẫu vào đây. AI sẽ cố gắng học văn phong viết từ nó và áp dụng vào truyện mới của bạn (với nhân vật, tình huống từ dàn ý của bạn)." disabled={anyLoadingOperation}></textarea>
                <p className="text-xs text-gray-500 mt-1">Lưu ý: Truyện mới vẫn sẽ dựa trên "Dàn ý" bạn cung cấp. Văn phong học được sẽ được ưu tiên hơn "Phong cách viết truyện" đã chọn nếu có mâu thuẫn.</p>
            </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b-2 border-gray-300" role="tablist" aria-label="Chức năng Viết">
        <TabButton tabId="singleStory" label="Viết Truyện Đơn" icon="✍️"/>
        <TabButton tabId="hookGenerator" label="Tạo Hooks" icon="💡"/>
        <TabButton tabId="lessonGenerator" label="Đúc Kết Bài Học" icon="🧐"/>
      </div>

      {activeWriteTab === 'singleStory' && (
         <div role="tabpanel" id="single-story-panel" className="animate-fadeIn space-y-6">
            <div className="flex justify-between items-center">
                <label htmlFor="storyOutline" className="text-lg font-semibold text-gray-700">
                    Dàn ý truyện (Bước 1: Nhập dàn ý):
                </label>
                <button onClick={() => setIsSingleOutlineExpanded(!isSingleOutlineExpanded)} className="text-sm text-indigo-600 hover:text-indigo-800" disabled={anyLoadingOperation}>
                    {isSingleOutlineExpanded ? 'Thu gọn Dàn Ý' : 'Mở rộng Dàn Ý'}
                </button>
            </div>
            <textarea 
                id="storyOutline" 
                value={storyOutline} 
                onChange={(e) => updateState({ 
                    storyOutline: e.target.value,
                    hasSingleStoryBeenEditedSuccessfully: false,
                    generatedStory: '',
                    keyElementsFromSingleStory: null,
                    storyLoadingMessage: null,
                    singleStoryEditProgress: null,
                    storyProgress: 0,
                    storyError: null,
                })} 
                rows={isSingleOutlineExpanded ? 10 : 3} 
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nhập dàn ý của bạn hoặc dàn ý từ Module Xây Dựng Truyện sẽ tự động xuất hiện ở đây..."
                disabled={anyLoadingOperation}
            />
            {retrievedViralOutlineFromAnalysis && (
                <button 
                    onClick={handleUseViralOutline} 
                    className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                    disabled={anyLoadingOperation}
                >
                    📝 Sử dụng Dàn Ý Viral từ Phân Tích
                </button>
            )}
            {renderMainButton()}
            <div className={`feedback-container flex flex-col justify-center items-center`} style={{ minHeight: feedbackContainerMinHeight }}>
                {storyLoadingMessage && storyProgress > 0 && storyProgress < 100 && !storyLoadingMessage.toLowerCase().includes("biên tập") && !storyLoadingMessage.toLowerCase().includes("hoàn thành") && !storyLoadingMessage.toLowerCase().includes("lỗi") && !storyLoadingMessage.toLowerCase().includes("hủy") && (
                <div className="w-full bg-gray-200 rounded-full h-6">
                    <div className="bg-indigo-600 h-6 rounded-full text-xs font-medium text-blue-100 text-center p-1 leading-none" style={{ width: `${storyProgress}%` }}>
                    {`${storyProgress}% (${storyLoadingMessage})`}
                    </div>
                </div>
                )}
                {storyLoadingMessage && storyLoadingMessage.toLowerCase().includes("biên tập") && singleStoryEditProgress !== null && singleStoryEditProgress >=0 && singleStoryEditProgress < 100 && !storyLoadingMessage.toLowerCase().includes("hủy") && (
                    <div className="w-full bg-gray-200 rounded-full h-6">
                        <div className="bg-purple-600 h-6 rounded-full text-xs font-medium text-purple-100 text-center p-1 leading-none" style={{ width: `${singleStoryEditProgress}%` }}>
                            {`${singleStoryEditProgress}% (${storyLoadingMessage})`}
                        </div>
                    </div>
                )}
                {storyLoadingMessage && (!storyLoadingMessage.toLowerCase().includes("biên tập") && (storyProgress === 0 || storyProgress === 100) || storyLoadingMessage.toLowerCase().includes("hoàn thành") || storyLoadingMessage.toLowerCase().includes("lỗi") || storyLoadingMessage.toLowerCase().includes("hủy")) && !storyLoadingMessage.startsWith("✅ ĐÃ BIÊN TẬP XONG 100%!") && (
                    <p className={`text-center font-medium ${storyLoadingMessage.includes("Lỗi") ? 'text-red-600' : (storyLoadingMessage.includes("hủy") ? 'text-yellow-600' : 'text-indigo-600')}`}>
                        {storyLoadingMessage}
                    </p>
                )}
                {hasSingleStoryBeenEditedSuccessfully && storyLoadingMessage === '✅ ĐÃ BIÊN TẬP XONG 100%!' && (
                    <p className="text-center text-2xl font-bold text-green-600 p-3 bg-green-100 border-2 border-green-500 rounded-lg">
                        {storyLoadingMessage}
                    </p>
                )}
            </div>
            {storyError && <ErrorAlert message={storyError} />}
            {generatedStory && (
                <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                    <h3 className={`text-lg font-semibold mb-2 ${hasSingleStoryBeenEditedSuccessfully ? 'text-green-600' : 'text-gray-700'}`}>
                        {hasSingleStoryBeenEditedSuccessfully ? '✅ Truyện Đã Được Biên Tập & Tối Ưu Độ Dài:' : 'Truyện hoàn chỉnh (chưa biên tập đầy đủ):'}
                         <span className="text-sm font-normal text-gray-500"> (bằng {HOOK_LANGUAGE_OPTIONS.find(l=>l.value === outputLanguage)?.label || outputLanguage})</span>
                    </h3>
                    <textarea value={generatedStory} readOnly rows={15} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                    <div className="mt-3 space-x-2">
                        <button id="copyStoryBtn" onClick={() => copyToClipboard(generatedStory, "copyStoryBtn")} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" disabled={anyLoadingOperation}>
                        📋 Sao chép Truyện
                        </button>
                        <button 
                            onClick={() => handleEditStory(generatedStory, storyOutline, keyElementsFromSingleStory)} 
                            disabled={anyLoadingOperation || !generatedStory.trim()}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                        >
                            ✨ Biên Tập Lại (Nếu cần)
                        </button>
                    </div>
                </div>
            )}
         </div>
      )}

      {activeWriteTab === 'hookGenerator' && (
         <div role="tabpanel" id="hook-generator-panel" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">💡 Tạo Hooks Mở Đầu</h3>
             <InfoBox>
                <p>Nhập trực tiếp nội dung truyện của bạn vào ô bên dưới để tạo hooks. Bạn cũng có thể sử dụng truyện đã được tạo ở tab 'Viết Truyện Đơn' bằng cách nhấn nút "Sử dụng Truyện Vừa Viết".</p>
                <p className="mt-1"><strong>Mới:</strong> Chọn "Cấu trúc Hook (Nâng cao)" để AI tạo hook theo các mô hình nổi tiếng và giải thích cách áp dụng.</p>
            </InfoBox>
            <div>
                <label htmlFor="storyInputForHook" className="block text-sm font-medium text-gray-700 mb-1">Nội dung truyện (để tạo hook):</label>
                <textarea 
                    id="storyInputForHook" 
                    value={storyInputForHook} 
                    onChange={(e) => updateState({ storyInputForHook: e.target.value })} 
                    rows={8} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Dán toàn bộ truyện hoặc tóm tắt truyện vào đây..."
                    disabled={anyLoadingOperation}
                />
                {generatedStory.trim() && (
                    <button 
                        onClick={() => updateState({ storyInputForHook: generatedStory })} 
                        className="mt-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm"
                        disabled={anyLoadingOperation}
                    >
                        Sử dụng Truyện Vừa Viết từ tab 'Viết Truyện Đơn'
                    </button>
                )}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                    <label htmlFor="hookLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Hook:</label>
                    <select id="hookLanguage" value={hookLanguage} onChange={(e) => updateState({ hookLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="hookStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách Hook (Chung):</label>
                    <select id="hookStyle" value={hookStyle} onChange={(e) => updateState({ hookStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {HOOK_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                {hookStyle === 'custom' && (
                    <div>
                        <label htmlFor="customHookStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách Hook tùy chỉnh:</label>
                        <input type="text" id="customHookStyle" value={customHookStyle} onChange={(e) => updateState({ customHookStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Kinh dị kiểu Mỹ" disabled={anyLoadingOperation}/>
                    </div>
                )}
                 <div>
                    <label htmlFor="hookLength" className="block text-sm font-medium text-gray-700 mb-1">Độ dài Hook:</label>
                    <select id="hookLength" value={hookLength} onChange={(e) => updateState({ hookLength: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {HOOK_LENGTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-2"> {/* Span 2 columns on large screens for hook structure */}
                    <label htmlFor="hookStructure" className="block text-sm font-medium text-gray-700 mb-1">Cấu trúc Hook (Nâng cao):</label>
                    <select id="hookStructure" value={hookStructure} onChange={(e) => updateState({ hookStructure: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {HOOK_STRUCTURE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="hookCount" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Hook (1-10):</label>
                    <input type="number" id="hookCount" value={hookCount} onChange={(e) => updateState({ hookCount: parseInt(e.target.value)})} min="1" max="10" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}/>
                </div>
                <div>
                    <label htmlFor="ctaChannel" className="block text-sm font-medium text-gray-700 mb-1">Kênh CTA (Không bắt buộc):</label>
                    <input type="text" id="ctaChannel" value={ctaChannel} onChange={(e) => updateState({ ctaChannel: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Đức Đại Đẹp Zai" disabled={anyLoadingOperation}/>
                </div>
            </div>
            {renderMainButton()}
            <div className={`feedback-container flex flex-col justify-center items-center ${spinnerFeedbackContainerHeight}`}>
              {hookLoadingMessage && <LoadingSpinner message={hookLoadingMessage} noMargins={true} />}
            </div>
            {hookError && <ErrorAlert message={hookError} />}
            {generatedHooks && (
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Hooks Đã Tạo (bằng {HOOK_LANGUAGE_OPTIONS.find(l => l.value === hookLanguage)?.label || hookLanguage}):</h3>
                <textarea value={generatedHooks} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                <button id="copyHooksBtn" onClick={() => copyToClipboard(generatedHooks, "copyHooksBtn")} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" disabled={anyLoadingOperation}>
                    📋 Sao chép Hooks
                </button>
              </div>
            )}
         </div>
      )}

      {activeWriteTab === 'lessonGenerator' && (
         <div role="tabpanel" id="lesson-generator-panel" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">🧐 Đúc Kết Bài Học Từ Truyện</h3>
            <div>
                <label htmlFor="storyInputForLesson" className="block text-sm font-medium text-gray-700 mb-1">Nội dung truyện cần đúc kết bài học:</label>
                <textarea id="storyInputForLesson" value={storyInputForLesson} onChange={(e) => updateState({ storyInputForLesson: e.target.value })} rows={8} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Dán toàn bộ truyện vào đây..." disabled={anyLoadingOperation}></textarea>
                {generatedStory.trim() && (
                    <button 
                        onClick={() => updateState({ storyInputForLesson: generatedStory })} 
                        className="mt-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm"
                        disabled={anyLoadingOperation}
                    >
                        Sử dụng Truyện Vừa Viết ở Tab 'Viết Truyện Đơn'
                    </button>
                )}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                 <div>
                    <label htmlFor="lessonTargetLength" className="block text-sm font-medium text-gray-700 mb-1">Mục tiêu số từ cho Bài học:</label>
                    <select id="lessonTargetLength" value={lessonTargetLength} onChange={(e) => updateState({ lessonTargetLength: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {LESSON_LENGTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="lessonWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết Bài học:</label>
                    <select id="lessonWritingStyle" value={lessonWritingStyle} onChange={(e) => updateState({ lessonWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {LESSON_WRITING_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                {lessonWritingStyle === 'custom' && (
                     <div className="md:col-span-2">
                        <label htmlFor="customLessonWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết Bài học tùy chỉnh:</label>
                        <input type="text" id="customLessonWritingStyle" value={customLessonWritingStyle} onChange={(e) => updateState({ customLessonWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Hài hước mà sâu cay" disabled={anyLoadingOperation}/>
                    </div>
                )}
                <div className="md:col-span-2">
                    <label htmlFor="ctaChannelForLesson" className="block text-sm font-medium text-gray-700 mb-1">Kênh CTA (cho Bài học - Không bắt buộc):</label>
                    <input type="text" id="ctaChannelForLesson" value={ctaChannelForLesson} onChange={(e) => updateState({ ctaChannelForLesson: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Kênh Truyện Ý Nghĩa" disabled={anyLoadingOperation}/>
                </div>
            </div>
             {renderMainButton()}
            <div className={`feedback-container flex flex-col justify-center items-center ${spinnerFeedbackContainerHeight}`}>
              {lessonLoadingMessage && <LoadingSpinner message={lessonLoadingMessage} noMargins={true} />}
            </div>
            {lessonError && <ErrorAlert message={lessonError} />}
            {generatedLesson && (
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Bài học Đã Đúc Kết (bằng {HOOK_LANGUAGE_OPTIONS.find(l => l.value === outputLanguage)?.label || outputLanguage}):</h3>
                <textarea value={generatedLesson} readOnly rows={4} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                 <button id="copyLessonBtn" onClick={() => copyToClipboard(generatedLesson, "copyLessonBtn")} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" disabled={anyLoadingOperation}>
                    📋 Sao chép Bài học
                </button>
              </div>
            )}
         </div>
      )}
      
    </ModuleContainer>
  );
};

export default WriteStoryModule;