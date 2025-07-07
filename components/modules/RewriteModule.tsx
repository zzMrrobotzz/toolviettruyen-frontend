
import React, { useState, useEffect, useCallback } from 'react';
import { 
    ApiSettings, 
    RewriteModuleState
} from '../../types'; 
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateText } from '../../services/geminiService';
import { delay } from '../../utils'; // Added delay import

interface RewriteModuleProps {
  apiSettings: ApiSettings;
  moduleState: RewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<RewriteModuleState>>;
}

const RewriteModule: React.FC<RewriteModuleProps> = ({ apiSettings, moduleState, setModuleState }) => {
  const {
    // Common
    rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
    // Single
    singleOriginalText, singleRewrittenText, singleError, singleProgress, singleLoadingMessage,
    isEditingSingleRewrite, singleRewriteEditError, singleRewriteEditLoadingMessage, hasSingleRewriteBeenEdited
  } = moduleState;

  const updateState = (updates: Partial<RewriteModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    if (targetLanguage !== sourceLanguage) {
      updateState({ adaptContext: true }); 
    } else {
      updateState({ adaptContext: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLanguage, sourceLanguage]);

  const userLevelDescriptions: { [key: number]: string } = {
    0: "Chỉ sửa lỗi chính tả và ngữ pháp cơ bản. Giữ nguyên 100% nội dung và văn phong gốc.",
    25: "Làm mới văn bản bằng cách thay đổi một số từ ngữ và cấu trúc câu. Giữ nguyên ý nghĩa, nhân vật, bối cảnh và cốt truyện chính. Thay đổi nhẹ nhàng.",
    50: "Viết lại vừa phải từ ngữ và văn phong. Có thể thay đổi cấu trúc câu, từ vựng, một số chi tiết mô tả nhỏ (tuổi tác nhân vật, đồ vật, đặc điểm phụ của nhân vật thứ yếu). Tên nhân vật chính, các điểm cốt truyện chính, nghề nghiệp chính và bối cảnh chính PHẢI được giữ nguyên.",
    75: "Sáng tạo lại câu chuyện một cách đáng kể. Có thể thay đổi tên nhân vật, nghề nghiệp, bối cảnh. Cốt truyện có thể có những phát triển mới nhưng PHẢI giữ được tinh thần, thông điệp và những điểm hấp dẫn nhất của kịch bản gốc.",
    100: "Viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại 'linh hồn' (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc. Mọi thứ khác như tên nhân vật, bối cảnh, nghề nghiệp, và thậm chí một số tình tiết phụ đều PHẢI hoàn toàn mới."
  };

  // Core rewrite logic for a single text item
  const performSingleRewriteTask = async (
    textToRewrite: string,
    currentRewriteLevel: number,
    currentSourceLanguage: string,
    currentTargetLanguage: string,
    currentRewriteStyleSettingValue: string, // 'custom' or the descriptive label of a predefined style
    userProvidedCustomInstructions: string, // Actual custom instructions text, or empty if not 'custom'
    currentAdaptContext: boolean,
    onProgressUpdate?: (progress: number, message: string) => void
  ): Promise<string> => {
    const CHUNK_REWRITE_CHAR_COUNT = 4000; 
    const numChunks = Math.ceil(textToRewrite.length / CHUNK_REWRITE_CHAR_COUNT);
    let fullRewrittenStory = '';
    let characterMap = ''; 

    const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === currentSourceLanguage)?.label || currentSourceLanguage;
    const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === currentTargetLanguage)?.label || currentTargetLanguage;
    
    const systemInstructionForRewrite = "You are an expert multilingual text rewriting AI. Your primary function is to transform input text according to precise instructions, ensuring that when a rewrite is requested (degree of change > 0%), the output is a modified version of the input, not the original input itself.";


    for (let i = 0; i < numChunks; i++) {
      const currentProgressChunk = Math.round(((i + 1) / numChunks) * 100);
      if (onProgressUpdate) {
        onProgressUpdate(currentProgressChunk, `Đang viết lại phần ${i + 1}/${numChunks}...`);
      }

      const chunkStart = i * CHUNK_REWRITE_CHAR_COUNT;
      const chunkEnd = chunkStart + CHUNK_REWRITE_CHAR_COUNT;
      const textChunk = textToRewrite.substring(chunkStart, chunkEnd);

      const levelDescriptions: {[key: number]: string} = {
          0: 'only fix spelling and grammar. Keep the original story 100%. The output MUST be the full text of the chunk after applying these fixes (if any).',
          25: 'make some changes to words and sentence structures to refresh the text, while strictly preserving the original meaning, characters, settings, and plot. The goal is a light refreshment. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these revisions*. Do not return the original text if changes, however minor, are instructed.',
          50: 'moderately rewrite the wording and style. You can change sentence structures, vocabulary, and some minor descriptive details (e.g., character\'s age, specific objects, minor traits of secondary characters). However, you MUST keep the main character names, core plot points, main occupations, and primary settings of the original text. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these revisions*, even if the revisions seem moderate rather than extensive. Do not return the original text.',
          75: 'creatively reimagine the story. You can change character names, occupations, and settings. The plot may have new developments, but it MUST retain the spirit, message, and most appealing points of the original script. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these creative revisions*. Do not return the original text.',
          100: 'completely rewrite into a new script. Only retain the "soul" (core idea, main theme) of the original story. Everything else, such as character names, settings, professions, and even some subplots, must be completely new. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied this complete rewrite*. Do not return the original text.'
      };
      const descriptionKey = Math.round(currentRewriteLevel / 25) * 25;
      const levelDescription = levelDescriptions[descriptionKey];
      
      let localizationRequest = '';
      if (currentTargetLanguage !== currentSourceLanguage && currentAdaptContext) {
          localizationRequest = `\n- **Cultural Localization Required:** Do not just translate. Deeply adapt the cultural context, social norms, proper names, and other details to make the story feel natural and appropriate for a ${selectedTargetLangLabel}-speaking audience.`;
      }

      let rewriteStyleInstructionPromptSegment = '';
      if (currentRewriteStyleSettingValue === 'custom') {
        rewriteStyleInstructionPromptSegment = `Apply the following custom rewrite instructions. These instructions are PARAMOUNT and OVERRIDE the general rules of the 'Degree of Change Required' when there is a direct conflict.
 - For example, if the 'Degree of Change' for 50% says 'keep main character names', but your custom instruction says 'change the main character's name to Dra. Carmen Valdés', you MUST change the name to 'Dra. Carmen Valdés'.
 - Similarly, if the text mentions '20 years of experience' and your custom instruction is to maintain persona details, you MUST keep '20 years of experience' unless explicitly told to change it.
Your Custom Instructions: "${userProvidedCustomInstructions}"`;
      } else {
        rewriteStyleInstructionPromptSegment = `The desired rewrite style is: ${currentRewriteStyleSettingValue}.`;
      }
      
      const lengthFidelityInstruction = `\n- **GUIDANCE ON OUTPUT LENGTH:** Your primary task is to REWRITE according to the 'Degree of Change Required'. The rewritten chunk should generally reflect the narrative scope and detail of the original.
    \n  - For Degree of Change 0-25%: Aim for the output length to be reasonably close (e.g., +/-15%) to the original chunk's character count. However, making the required textual changes (even if minimal) as per the degree's description is MORE IMPORTANT than strictly adhering to this length if a conflict arises. DO NOT return original text if 'Degree of Change Required' is greater than 0.
    \n  - For Degree of Change 50%: Aim for a length within +/-25% of the original. Focus on meaningful rewriting as per the degree.
    \n  - For Degree of Change 75-100%: Length can vary significantly based on the creative changes, but the output must be a developed narrative segment. A 100% rewrite may be shorter if it's a thematic reinterpretation.
    \n  In all cases where 'Degree of Change Required' is greater than 0%, prioritize executing the rewrite as instructed over returning an unchanged text due to length concerns. Avoid drastic, unexplained shortening unless it's a 100% rewrite or explicitly instructed by custom rewrite instructions.`;


      let characterConsistencyInstructions = `
          \n  - **ABSOLUTE CHARACTER NAME CONSISTENCY (FOR ALL CHARACTERS):**
              \n    - **General Rule:** Once a name is established for ANY character (main, secondary, minor, recurring) in the \`${selectedTargetLangLabel}\` output of THIS SPECIFIC REWRITE SESSION, that name MUST be used with 100% consistency for that character throughout ALL subsequent parts of this same story. DO NOT change it later.
              \n    - **If Target Language Differs from Source Language AND Rewrite Level < 75%:** For each character, you MUST choose ONE consistent form in \`${selectedTargetLangLabel}\` (either a standard direct translation or the original name if more appropriate phonetically) upon their first appearance in the rewritten text, AND THEN USE THAT CHOSEN FORM WITH ABSOLUTE CONSISTENCY. No random variations.
              \n    - **(Specific rules for Character Map at Level >= 75% are detailed below).**`;

      let prompt = `**Primary Objective:** Your main goal is to actively REWRITE the input text chunk. The extent and nature of the rewrite are determined by the 'Degree of Change Required' and the 'Rewrite Style Application' instructions below. You MUST produce a rewritten version. Only if the 'Degree of Change Required' is 0% AND the text has absolutely no errors to fix, should you return the original text verbatim. For any other degree of change, a rewritten output is mandatory.

      \n**CRITICAL NARRATIVE INTEGRITY (SINGLE TRUTH MANDATE):** You are rewriting ONE SINGLE STORY. All details regarding characters (names, roles, relationships, established traits), plot points, events, locations, and timelines MUST remain ABSOLUTELY CONSISTENT with what has been established in previously rewritten chunks of THIS SAME STORY (provided as \`fullRewrittenStory\` context, which is THE CANON for this session) and the initial setup of the current chunk. DO NOT introduce conflicting information or alter established facts. Maintain ONE UNIFIED AND LOGICAL NARRATIVE THREAD.

      \n**Your Task:** Rewrite the provided text chunk.
      \n**Critical Output Requirement:** Your response for this task MUST BE ONLY the rewritten text itself, in the specified Target Language. NO other text, introductions, explanations, or meta-comments are allowed.
      \n**Rewrite Instructions:**
      \n- **Source Language (of the input text):** ${selectedSourceLangLabel}
      \n- **Target Language (for the output text):** ${selectedTargetLangLabel}
      \n- **Degree of Change Required:** ${currentRewriteLevel}%. This means you should ${levelDescription}. Ensure your changes strictly adhere to the permissions of this level (e.g., if the level states 'main character names...MUST be kept', then they MUST NOT be changed).
      ${lengthFidelityInstruction}
      \n- **Rewrite Style Application:** ${rewriteStyleInstructionPromptSegment}
      \n- **Timestamp Handling:** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.
      ${localizationRequest}
      \n- **Overall Story Coherence (CRITICAL - Builds on Narrative Integrity):**
          \n  - **Persona Consistency:** Pay close attention to key details that define a character's persona, such as their stated years of experience, specific titles (Dr., Prof.), or recurring personal details. These details MUST be maintained with 100% consistency throughout the entire rewritten text, unless a custom instruction explicitly directs you to change them.
          \n  - **Logical Flow:** The rewritten chunk MUST maintain logical consistency internally and with \`fullRewrittenStory\`.
          \n  - **Character Consistency (General Behavior & Names):** ${characterConsistencyInstructions}
          \n  - **Event, Setting & Situation Coherence:** Ensure events, locations, and plot-relevant objects are plausible and consistent with established facts (from \`fullRewrittenStory\` and the original chunk's premise), respecting the "Degree of Change". Once a setting or event detail is established in the rewrite, stick to it.
      \n- **Context from Previous Chunks (THE CANON - must be in ${selectedTargetLangLabel}):**
          \n  \`${fullRewrittenStory || "This is the first chunk. No previous context."}\`
      `;
      
      if (i === 0 && currentRewriteLevel >= 75) {
          prompt += ` \n\n**Character Mapping (MANDATORY for First Chunk if Level >= 75%):**
          \nYour primary goal for character names is consistency in the ${selectedTargetLangLabel} output.
          \nIdentify ALL character names (main, secondary, recurring) that YOU, the AI, are PURPOSEFULLY and CREATIVELY altering from their form in the ${selectedSourceLangLabel} text to a new, distinct form in your ${selectedTargetLangLabel} rewritten text for THIS CHUNK. This includes significant re-spellings, translations that are creative choices rather than direct equivalents, or entirely new names. For each such change, record it.
          \nAt the VERY END of your entire response for THIS CHUNK, append these changes in the format:
          \n"[CHARACTER_MAP]Tên Gốc (trong ${selectedSourceLangLabel}): Original Name 1 -> Tên Mới (trong ${selectedTargetLangLabel}): New Name 1; Tên Gốc (trong ${selectedSourceLangLabel}): Original Name 2 -> Tên Mới (trong ${selectedTargetLangLabel}): New Name 2[/CHARACTER_MAP]"
          \nIf you make NO such purposeful creative changes to ANY character names (i.e., they are kept original, or receive only direct, standard translations that will be applied consistently per the general character consistency rule), you MUST append:
          \n"[CHARACTER_MAP]Không có thay đổi tên nhân vật chính nào được map[/CHARACTER_MAP]"
          \nThis map (or the 'no change' signal) is VITAL for consistency in subsequent chunks. This instruction and its output are ONLY for this first chunk and MUST be outside the main rewritten story text.`;
      } else if (characterMap && currentRewriteLevel >= 75) {
          prompt += `\n- **ABSOLUTE CHARACTER CONSISTENCY MANDATE (Based on Character Map for Level >= 75%):**
          \n  You are provided with a Character Map: \`${characterMap}\`. You MUST adhere to this with 100% accuracy.
          \n  - If the map provides \`Tên Gốc (trong ${selectedSourceLangLabel}): [Tên A] -> Tên Mới (trong ${selectedTargetLangLabel}): [Tên B]\` pairs: Use the 'New Name' \`[Tên B]\` EXACTLY AS SPECIFIED for every instance (explicit or implied) of the 'Original Name' \`[Tên A]\`.
          \n  - If the map states \`Không có thay đổi tên nhân vật chính nào được map\`: You MUST continue using the exact naming convention for ALL characters as established in the first rewritten chunk.
          \n  - **FOR ALL CHARACTERS (mapped or not): Once a name is used for a character in the \`${selectedTargetLangLabel}\` output for this story, IT MUST NOT CHANGE for that character in subsequent parts of this same story.** DO NOT re-translate, vary, or introduce alternative names for any character already named.
          \n  - **Handling Unmapped Names (if map exists and is not "no change"):** For ANY character name encountered in the original text that is NOT explicitly listed in the Character Map (and the map is not 'Không có thay đổi...'), you MUST: 1. Check if this character has already appeared in previously rewritten chunks (\`fullRewrittenStory\`). If yes, use the EXACT SAME name (in \`${selectedTargetLangLabel}\`) as used before. 2. If it's a new character not in the map and not seen before, apply a consistent, direct translation to \`${selectedTargetLangLabel}\` or maintain the original name if phonetically suitable, and then USE THIS CHOSEN FORM CONSISTENTLY for all future appearances of this character.`;
      }

      prompt += `\n**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
      \n---
      \n${textChunk}
      \n---
      \n**IMPORTANT FINAL INSTRUCTION FOR THIS CHUNK:**
      \nRegardless of the complexity or perceived difficulty of the rewrite task based on the 'Degree of Change Required' and other constraints, if 'Degree of Change Required' is greater than 0%, your output for THIS CHUNK ABSOLUTELY MUST BE A REWRITTEN VERSION. It CANNOT be an identical copy of the 'Original Text Chunk to Rewrite' provided above. Make your best effort to apply the changes as instructed. If the 'Degree of Change Required' is 0%, only fix basic spelling/grammar and return the full text; otherwise, you must rewrite.
      \n**Perform the rewrite for THIS CHUNK ONLY in ${selectedTargetLangLabel}. Adhere strictly to all instructions. Remember, ONLY the rewritten story text.**`;
      
      if (i > 0) await delay(750); // Delay between chunk rewrites
      const result = await generateText(prompt, systemInstructionForRewrite);
      let partResultText = result.text || ""; 

      if (i === 0 && currentRewriteLevel >= 75) {
          const mapMatch = partResultText.match(/\[CHARACTER_MAP\]([\s\S]*?)\[\/CHARACTER_MAP\]/);
          if (mapMatch && mapMatch[1]) { 
              if (mapMatch[1].trim().toLowerCase() !== 'no change' && mapMatch[1].trim().toLowerCase() !== 'no main character name changes mapped' && mapMatch[1].trim().toLowerCase() !== 'không có thay đổi tên nhân vật chính nào được map') {
                   characterMap = mapMatch[1].trim();
              } else {
                  characterMap = "Không có thay đổi tên nhân vật chính nào được map"; 
              }
              partResultText = partResultText.replace(mapMatch[0], ''); 
          }
      }
      partResultText = partResultText.trim(); 

      if (fullRewrittenStory && partResultText) { 
          fullRewrittenStory += "\n\n" + partResultText;
      } else if (partResultText) { 
          fullRewrittenStory = partResultText;
      }
    }
    return fullRewrittenStory.trim();
  };


  const handleSingleRewrite = async () => {
    if (!singleOriginalText.trim()) {
      updateState({ singleError: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
      return;
    }
    
    let effectiveRewriteStyleForPrompt = ''; 
    let customInstructionsForPrompt = '';

    if (moduleState.rewriteStyle === 'custom') {
        if (!moduleState.customRewriteStyle.trim()) {
            updateState({ singleError: 'Lỗi: Vui lòng nhập hướng dẫn viết lại tùy chỉnh!' });
            return;
        }
        effectiveRewriteStyleForPrompt = 'custom'; 
        customInstructionsForPrompt = moduleState.customRewriteStyle.trim();
    } else {
        const selectedStyleOption = REWRITE_STYLE_OPTIONS.find(opt => opt.value === moduleState.rewriteStyle);
        effectiveRewriteStyleForPrompt = selectedStyleOption ? selectedStyleOption.label : moduleState.rewriteStyle; 
    }

    updateState({ 
      singleError: null, singleRewrittenText: '', singleProgress: 0, singleLoadingMessage: 'Đang chuẩn bị...',
      isEditingSingleRewrite: false, singleRewriteEditError: null, singleRewriteEditLoadingMessage: null, hasSingleRewriteBeenEdited: false
    });
    
    try {
      const rewritten = await performSingleRewriteTask(
        singleOriginalText,
        rewriteLevel,
        sourceLanguage,
        targetLanguage,
        effectiveRewriteStyleForPrompt, 
        customInstructionsForPrompt,    
        adaptContext,
        (progress, message) => updateState({ singleProgress: progress, singleLoadingMessage: message })
      );
      updateState({ singleRewrittenText: rewritten, singleLoadingMessage: 'Hoàn thành!', singleProgress: 100 });
      setTimeout(() => setModuleState(prev => prev.singleLoadingMessage === 'Hoàn thành!' ? {...prev, singleLoadingMessage: null} : prev), 3000);
    } catch (e) {
      updateState({ singleError: `Đã xảy ra lỗi trong quá trình viết lại: ${(e as Error).message}`, singleLoadingMessage: 'Đã xảy ra lỗi.', singleProgress: 0 });
      setTimeout(() => setModuleState(prev => prev.singleLoadingMessage === 'Đã xảy ra lỗi.' ? {...prev, singleLoadingMessage: null} : prev), 3000);
    }
  };

  const handlePostRewriteEdit = async (
    textToEdit: string, 
    originalSourceTextToCompare: string
  ) => {
    if (!textToEdit.trim()) {
      updateState({ singleRewriteEditError: 'Không có văn bản để tinh chỉnh.', isEditingSingleRewrite: false, hasSingleRewriteBeenEdited: false });
      return;
    }

    const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === sourceLanguage)?.label || sourceLanguage;
    const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === targetLanguage)?.label || targetLanguage;
    let currentRewriteStyleLabel = REWRITE_STYLE_OPTIONS.find(opt => opt.value === rewriteStyle)?.label || rewriteStyle;
    if (rewriteStyle === 'custom') {
        currentRewriteStyleLabel = customRewriteStyle || "Tùy chỉnh không có mô tả";
    }

    const editPrompt = `Bạn là một biên tập viên truyện chuyên nghiệp, cực kỳ tỉ mỉ và có khả năng tinh chỉnh văn phong xuất sắc. Nhiệm vụ của bạn là đọc kỹ "Văn Bản Đã Viết Lại" dưới đây. Mục tiêu chính của bạn là BIÊN TẬP và TINH CHỈNH văn bản này để nó trở nên mạch lạc, logic, nhất quán, và ĐẶC BIỆT là loại bỏ mọi sự trùng lặp, thừa thãi, đồng thời cải thiện văn phong cho súc tích và hấp dẫn hơn. Bạn sẽ SO SÁNH, ĐỐI CHIẾU "Văn Bản Đã Viết Lại" với "Văn Bản Gốc Ban Đầu" CHỦ YẾU để đảm bảo các yếu tố cốt lõi (nhân vật, tình tiết chính) được giữ lại một cách hợp lý theo "Mức Độ Thay Đổi Yêu Cầu" của lần viết lại trước, chứ KHÔNG phải để đưa văn bản trở lại y hệt bản gốc.

    **QUAN TRỌNG: Văn bản "Đã Viết Lại" có thể đã được thay đổi ở một mức độ nhất định so với "Văn Bản Gốc" (dựa trên Mức Độ Thay Đổi Yêu Cầu). Việc biên tập của bạn KHÔNG PHẢI là đưa nó trở lại giống hệt bản gốc, mà là đảm bảo BÊN TRONG chính "Văn Bản Đã Viết Lại" đó phải nhất quán và logic, đồng thời vẫn tôn trọng những thay đổi có chủ đích đã được thực hiện (nếu có) so với bản gốc trong phạm vi cho phép của mức độ viết lại.**

    **THÔNG TIN CHO BỐI CẢNH BIÊN TẬP:**
    - Ngôn ngữ Văn Bản Gốc: ${selectedSourceLangLabel}
    - Ngôn ngữ Văn Bản Đã Viết Lại (và ngôn ngữ đầu ra của bạn): ${selectedTargetLangLabel}
    - Mức Độ Thay Đổi Yêu Cầu (của lần viết lại trước): ${rewriteLevel}%
    - Phong Cách Viết Lại Yêu Cầu (của lần viết lại trước): ${currentRewriteStyleLabel}
    - Có yêu cầu bản địa hóa khi viết lại: ${adaptContext ? 'Có' : 'Không'}

    **VĂN BẢN GỐC BAN ĐẦU (để đối chiếu logic và các yếu tố gốc):**
    ---
    ${originalSourceTextToCompare}
    ---

    **VĂN BẢN ĐÃ VIẾT LẠI (Cần bạn biên tập và tinh chỉnh):**
    ---
    ${textToEdit}
    ---

    **HƯỚNG DẪN BIÊN TẬP CHI TIẾT:**
    1.  **Tính nhất quán (Consistency):**
        *   **Tên Nhân Vật (QUAN TRỌNG NHẤT):** Rà soát kỹ TOÀN BỘ "Văn Bản Đã Viết Lại". Đảm bảo MỖI nhân vật (dù chính hay phụ, dù được giới thiệu ở đâu) chỉ sử dụng MỘT TÊN DUY NHẤT và nhất quán trong toàn bộ văn bản bằng ngôn ngữ ${selectedTargetLangLabel}. Nếu có sự nhầm lẫn, thay đổi tên giữa chừng (ví dụ: nhân vật A lúc đầu tên là X, sau lại là Y), hãy sửa lại cho đúng một tên duy nhất đã được thiết lập (ưu tiên tên xuất hiện nhiều hơn hoặc hợp lý hơn).
        *   **Đặc Điểm/Vai Trò Nhân Vật:** Đặc điểm ngoại hình, tính cách, vai trò, mối quan hệ của nhân vật có được duy trì nhất quán từ đầu đến cuối không? Có hành động nào của nhân vật mâu thuẫn với những gì đã được thiết lập về họ trong "Văn Bản Đã Viết Lại" không?
        *   **Logic Cốt Truyện và Sự Kiện:** Các sự kiện có diễn ra hợp lý, tuần tự và logic không? Có tình tiết nào trong "Văn Bản Đã Viết Lại" bị vô lý, mâu thuẫn với các sự kiện trước đó trong chính nó, hoặc tạo ra "plot hole" không? Dòng thời gian có nhất quán không?
        *   **Tính nhất quán Địa Điểm và Chi Tiết:** Địa điểm và các chi tiết bối cảnh quan trọng khác có được mô tả và duy trì nhất quán không?
    2.  **NÂNG CAO CHẤT LƯỢNG VĂN PHONG VÀ LOẠI BỎ TRÙNG LẶP (RẤT QUAN TRỌNG):**
        *   **Loại bỏ Trùng Lặp và Từ Ngữ Thừa:** Rà soát kỹ lưỡng để loại bỏ mọi sự lặp lại không cần thiết về ý tưởng, thông tin, cụm từ, hoặc mô tả. Nếu một chi tiết, sự kiện, hoặc suy nghĩ của nhân vật đã được nêu rõ, tránh diễn đạt lại theo cách tương tự hoặc mô tả lại các chi tiết không cần thiết ở những đoạn văn/câu sau, trừ khi có mục đích nhấn mạnh nghệ thuật đặc biệt và hiệu quả. Tìm cách cô đọng các đoạn văn dài dòng, loại bỏ từ ngữ thừa, câu văn rườm rà để nội dung súc tích và mạch lạc hơn.
        *   **Cải thiện Luồng Chảy và Mạch Lạc (Flow and Cohesion):** Đảm bảo các đoạn văn và câu chuyện chuyển tiếp mượt mà, tự nhiên. Sử dụng từ nối, cụm từ chuyển tiếp một cách hợp lý và đa dạng nếu cần. Sắp xếp lại câu hoặc đoạn văn nếu điều đó cải thiện tính mạch lạc và dễ đọc tổng thể.
        *   **Đa dạng hóa Cấu trúc Câu:** Tránh việc lặp đi lặp lại cùng một kiểu cấu trúc câu đơn điệu (ví dụ: liên tục các câu bắt đầu bằng chủ ngữ - động từ). Hãy thay đổi độ dài câu (ngắn, dài, trung bình) và các kiểu câu (đơn, ghép, phức) để tạo nhịp điệu và làm cho văn bản hấp dẫn, dễ theo dõi hơn.
        *   **Tinh chỉnh Lựa chọn Từ ngữ (Word Choice):** Ưu tiên sử dụng từ ngữ chính xác, giàu hình ảnh, và có sức biểu cảm cao. Tránh các từ ngữ chung chung, sáo rỗng hoặc yếu nghĩa.
        *   **Duy trì Giọng điệu và Phong cách Gốc (của bản viết lại):** Trong quá trình tinh chỉnh, cố gắng duy trì giọng điệu (ví dụ: căng thẳng, hài hước, trang trọng) và phong cách văn chương chung đã được thiết lập trong "Văn Bản Đã Viết Lại". Các chỉnh sửa về văn phong nên nhằm mục đích làm cho nó tốt hơn, không phải thay đổi hoàn toàn bản chất của nó.
    3.  **Mạch Lạc và Dễ Hiểu Chung (Overall Clarity):** Sau các bước trên, đọc lại toàn bộ để đảm bảo văn bản cuối cùng mạch lạc, dễ hiểu, các ý được diễn đạt rõ ràng.
    4.  **Độ Dài:** Cố gắng duy trì độ dài TƯƠNG TỰ như "Văn Bản Đã Viết Lại" được cung cấp. Việc chỉnh sửa chủ yếu tập trung vào logic, nhất quán và chất lượng văn phong, không phải thay đổi độ dài đáng kể, trừ khi thực sự cần thiết để sửa lỗi logic nghiêm trọng hoặc do việc loại bỏ trùng lặp/thừa thãi một cách tự nhiên dẫn đến thay đổi.

    **ĐẦU RA:**
    - Chỉ trả về TOÀN BỘ nội dung văn bản đã được biên tập và tinh chỉnh hoàn chỉnh, bằng ngôn ngữ ${selectedTargetLangLabel}.
    - Không thêm bất kỳ lời bình luận, giải thích hay tiêu đề nào.`;
    
    const systemInstructionForEdit = "You are a meticulous story editor. Your task is to refine and polish a given text, ensuring consistency, logical flow, and improved style, while respecting previous rewrite intentions.";


    updateState({ isEditingSingleRewrite: true, singleRewriteEditError: null, singleRewriteEditLoadingMessage: 'Đang phân tích và tinh chỉnh logic...', hasSingleRewriteBeenEdited: false });
    
    await delay(1000); // Delay before edit API call
    try {
      const result = await generateText(editPrompt, systemInstructionForEdit);
      updateState({ singleRewrittenText: result.text, isEditingSingleRewrite: false, singleRewriteEditLoadingMessage: 'Tinh chỉnh hoàn tất!', hasSingleRewriteBeenEdited: true });
      setTimeout(() => setModuleState(prev => prev.singleRewriteEditLoadingMessage === 'Tinh chỉnh hoàn tất!' ? {...prev, singleRewriteEditLoadingMessage: null} : prev), 3000);
    } catch (e) {
      const errorMsg = `Lỗi khi tinh chỉnh: ${(e as Error).message}`;
      updateState({ singleRewriteEditError: errorMsg, isEditingSingleRewrite: false, singleRewriteEditLoadingMessage: 'Lỗi tinh chỉnh.', hasSingleRewriteBeenEdited: false });
      setTimeout(() => setModuleState(prev => prev.singleRewriteEditLoadingMessage === 'Lỗi tinh chỉnh.' ? {...prev, singleRewriteEditLoadingMessage: null} : prev), 3000);
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

  const getCurrentLevelDescription = () => {
    const key = Math.round(rewriteLevel / 25) * 25;
    return userLevelDescriptions[key] || "Di chuyển thanh trượt để xem mô tả.";
  }

  const anyLoading = !!singleLoadingMessage || isEditingSingleRewrite;

  return (
    <ModuleContainer title="🔄 Viết Lại & Bản Địa Hóa">
      <InfoBox>
        <strong>💡 Hướng dẫn:</strong> Nhập kịch bản, chọn mức độ thay đổi và ngôn ngữ đầu ra. Chọn "Tùy chỉnh..." để đưa ra hướng dẫn viết lại cụ thể.
        <br/><strong>Mới:</strong> Sau khi viết lại, bạn có thể dùng nút "✍️ Biên Tập & Tinh Chỉnh Lại" để AI phân tích và sửa lỗi logic, nhất quán, đồng thời AI sẽ cố gắng loại bỏ các đoạn văn bị lặp lại, trùng lặp không cần thiết.
      </InfoBox>

      {/* --- Common Settings --- */}
      <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cài đặt Chung</h3>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="rewriteSliderCommon" className="text-sm font-medium text-gray-700">Mức độ thay đổi:</label>
            <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">{rewriteLevel}%</span>
          </div>
          <input type="range" id="rewriteSliderCommon" min="0" max="100" step="25" value={rewriteLevel} onChange={(e) => updateState({ rewriteLevel: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={anyLoading}/>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Chỉnh sửa nhẹ</span>
            <span>Sáng tạo lại</span>
          </div>
          <div className="mt-2 text-sm text-gray-600 bg-indigo-50 p-3 rounded-md border border-indigo-200">
            <strong>Giải thích mức {rewriteLevel}%:</strong> {getCurrentLevelDescription()}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label htmlFor="rewriteSourceLanguageCommon" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ gốc:</label>
            <select id="rewriteSourceLanguageCommon" value={sourceLanguage} onChange={(e) => updateState({ sourceLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoading}>
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rewriteTargetLanguageCommon" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
            <select id="rewriteTargetLanguageCommon" value={targetLanguage} onChange={(e) => updateState({ targetLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoading}>
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rewriteStyleSelectCommon" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại:</label>
            <select 
                id="rewriteStyleSelectCommon" 
                value={rewriteStyle} 
                onChange={(e) => updateState({ rewriteStyle: e.target.value, customRewriteStyle: e.target.value === 'custom' ? customRewriteStyle : '' })} 
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                disabled={anyLoading}
            >
              {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
        
        {rewriteStyle === 'custom' && (
            <div className="mt-2">
                <label htmlFor="customRewriteStyleCommon" className="block text-sm font-medium text-gray-700 mb-1">
                Nhập hướng dẫn viết lại tùy chỉnh:
                </label>
                <textarea
                id="customRewriteStyleCommon"
                value={customRewriteStyle}
                onChange={(e) => updateState({ customRewriteStyle: e.target.value })}
                rows={3}
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                placeholder="Ví dụ: Viết lại theo phong cách hài hước, châm biếm, sử dụng nhiều từ lóng hiện đại..."
                disabled={anyLoading}
                />
            </div>
        )}
        
        {targetLanguage !== sourceLanguage && (
            <div className="flex items-center">
                <input type="checkbox" id="adaptContextCommon" checked={adaptContext} onChange={(e) => updateState({ adaptContext: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" disabled={anyLoading}/>
                <label htmlFor="adaptContextCommon" className="ml-2 block text-sm text-gray-700">
                    Bản địa hóa (Điều chỉnh bối cảnh, văn hóa cho phù hợp với khán giả {HOOK_LANGUAGE_OPTIONS.find(l => l.value === targetLanguage)?.label})
                </label>
            </div>
        )}
      </div>
      
      {/* --- Single Rewrite Content --- */}
        <div role="tabpanel" id="single-rewrite-panel" aria-labelledby="single-rewrite-tab" className="animate-fadeIn space-y-6">
            <div>
            <label htmlFor="singleOriginalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
            <textarea id="singleOriginalText" value={singleOriginalText} onChange={(e) => updateState({ singleOriginalText: e.target.value, hasSingleRewriteBeenEdited: false })} rows={6} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Nhập kịch bản hoặc câu chuyện cần viết lại..." disabled={anyLoading}></textarea>
            </div>
            <button 
              onClick={handleSingleRewrite} 
              disabled={anyLoading || !singleOriginalText.trim()} 
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
            🔄 Viết lại Văn bản
            </button>

            {singleLoadingMessage && singleProgress > 0 && !singleLoadingMessage.toLowerCase().includes("hoàn thành") && !singleLoadingMessage.toLowerCase().includes("lỗi") && (
            <div className="w-full bg-gray-200 rounded-full h-6 my-4">
                <div className="bg-indigo-600 h-6 rounded-full text-xs font-medium text-blue-100 text-center p-1 leading-none" style={{ width: `${singleProgress}%` }}>
                 {`${singleProgress}% (${singleLoadingMessage})`}
                </div>
            </div>
            )}
            {singleLoadingMessage && (singleProgress === 0 || singleLoadingMessage.toLowerCase().includes("hoàn thành") || singleLoadingMessage.toLowerCase().includes("lỗi")) && <p className="text-center text-indigo-600 font-medium my-2">{singleLoadingMessage}</p>}
            
            {isEditingSingleRewrite && singleRewriteEditLoadingMessage && <LoadingSpinner message={singleRewriteEditLoadingMessage} />}
            {singleRewriteEditLoadingMessage && !isEditingSingleRewrite && <p className="text-center font-medium my-2">{singleRewriteEditLoadingMessage}</p>}


            {singleError && <ErrorAlert message={singleError} />}
            {singleRewriteEditError && <ErrorAlert message={singleRewriteEditError} />}


            {singleRewrittenText && (
            <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h3 className={`text-lg font-semibold mb-2 ${hasSingleRewriteBeenEdited ? 'text-green-600' : 'text-gray-700'}`}>
                    {hasSingleRewriteBeenEdited ? 'Văn bản đã Viết Lại & Tinh Chỉnh:' : 'Văn bản đã viết lại:'}
                     <span className="text-sm font-normal text-gray-500"> (bằng {HOOK_LANGUAGE_OPTIONS.find(l=>l.value === targetLanguage)?.label || targetLanguage})</span>
                </h3>
                <textarea value={singleRewrittenText} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                <div className="mt-3 space-x-2">
                    <button id="copyRewriteSingleBtn" onClick={() => copyToClipboard(singleRewrittenText, "copyRewriteSingleBtn")} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" disabled={anyLoading}>
                    📋 Sao chép
                    </button>
                    <button 
                        onClick={() => handlePostRewriteEdit(singleRewrittenText, singleOriginalText)} 
                        disabled={anyLoading || !singleRewrittenText.trim()}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                    >
                        ✍️ Biên Tập & Tinh Chỉnh Lại
                    </button>
                </div>
            </div>
            )}
        </div>
    </ModuleContainer>
  );
};

export default RewriteModule;
