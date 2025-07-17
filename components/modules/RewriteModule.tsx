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
import { generateTextViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { useAppContext } from '../../AppContext';

interface RewriteModuleProps {
  moduleState: RewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<RewriteModuleState>>;
}

const RewriteModule: React.FC<RewriteModuleProps> = ({ moduleState, setModuleState }) => {
  const { updateCredit } = useAppContext(); // Lấy hàm updateCredit mới
  const {
    rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
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
  }, [targetLanguage, sourceLanguage]);

  const userLevelDescriptions: { [key: number]: string } = {
    0: "Chỉ sửa lỗi chính tả và ngữ pháp cơ bản. Giữ nguyên 100% nội dung và văn phong gốc.",
    25: "Làm mới văn bản bằng cách thay đổi một số từ ngữ và cấu trúc câu. Giữ nguyên ý nghĩa, nhân vật, bối cảnh và cốt truyện chính. Thay đổi nhẹ nhàng.",
    50: "Viết lại vừa phải từ ngữ và văn phong. Có thể thay đổi cấu trúc câu, từ vựng, một số chi tiết mô tả nhỏ. Tên nhân vật chính, các điểm cốt truyện chính và bối cảnh chính PHẢI được giữ nguyên.",
    75: "Sáng tạo lại câu chuyện một cách đáng kể. Có thể thay đổi tên nhân vật, nghề nghiệp, bối cảnh. Cốt truyện có thể có những phát triển mới nhưng PHẢI giữ được tinh thần của kịch bản gốc.",
    100: "Viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại 'linh hồn' (ý tưởng cốt lõi) của câu chuyện gốc. Mọi thứ khác đều PHẢI hoàn toàn mới."
  };

  const performSingleRewriteTask = async (
    textToRewrite: string,
    currentRewriteLevel: number,
    currentSourceLanguage: string,
    currentTargetLanguage: string,
    currentRewriteStyleSettingValue: string,
    userProvidedCustomInstructions: string,
    currentAdaptContext: boolean,
    onProgressUpdate?: (progress: number, message: string) => void
  ): Promise<string> => {
    const CHUNK_REWRITE_CHAR_COUNT = 4000; 
    const numChunks = Math.ceil(textToRewrite.length / CHUNK_REWRITE_CHAR_COUNT);
    let fullRewrittenStory = '';
    
    for (let i = 0; i < numChunks; i++) {
      if (onProgressUpdate) {
        onProgressUpdate(Math.round(((i + 1) / numChunks) * 100), `Đang viết lại phần ${i + 1}/${numChunks}...`);
      }
      
      const textChunk = textToRewrite.substring(i * CHUNK_REWRITE_CHAR_COUNT, (i + 1) * CHUNK_REWRITE_CHAR_COUNT);
      const prompt = `...`; // Prompt logic remains the same

      if (i > 0) await delay(750);
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to rewrite text chunk');
      }
      
      fullRewrittenStory += (result.text || "").trim() + "\n\n";
    }
    return fullRewrittenStory.trim();
  };

  const handleSingleRewrite = async () => {
    if (!singleOriginalText.trim()) {
      updateState({ singleError: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
      return;
    }
    
    // Bỏ logic consumeCredit cũ
    
    let effectiveRewriteStyleForPrompt = rewriteStyle === 'custom' ? 'custom' : REWRITE_STYLE_OPTIONS.find(opt => opt.value === rewriteStyle)?.label || rewriteStyle;
    let customInstructionsForPrompt = rewriteStyle === 'custom' ? customRewriteStyle.trim() : '';

    if (rewriteStyle === 'custom' && !customInstructionsForPrompt) {
        updateState({ singleError: 'Lỗi: Vui lòng nhập hướng dẫn viết lại tùy chỉnh!' });
        return;
    }

    updateState({ singleError: null, singleRewrittenText: '', singleProgress: 0, singleLoadingMessage: 'Đang chuẩn bị...' });
    
    try {
      const rewritten = await performSingleRewriteTask(
        singleOriginalText, rewriteLevel, sourceLanguage, targetLanguage,
        effectiveRewriteStyleForPrompt, customInstructionsForPrompt, adaptContext,
        (progress, message) => updateState({ singleProgress: progress, singleLoadingMessage: message })
      );
      updateState({ singleRewrittenText: rewritten, singleLoadingMessage: 'Hoàn thành!', singleProgress: 100 });
    } catch (e) {
      updateState({ singleError: `Đã xảy ra lỗi: ${(e as Error).message}`, singleLoadingMessage: 'Lỗi.' });
    } finally {
        setTimeout(() => setModuleState(prev => ({...prev, singleLoadingMessage: null})), 3000);
    }
  };

  const handlePostRewriteEdit = async (textToEdit: string, originalSourceTextToCompare: string) => {
    if (!textToEdit.trim()) {
      updateState({ singleRewriteEditError: 'Không có văn bản để tinh chỉnh.' });
      return;
    }

    // Bỏ logic consumeCredit cũ

    updateState({ isEditingSingleRewrite: true, singleRewriteEditError: null, singleRewriteEditLoadingMessage: 'Đang tinh chỉnh...' });
    
    const editPrompt = `...`; // Prompt logic remains the same

    try {
      const result = await generateTextViaBackend(
        { prompt: editPrompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to edit text');
      }
      
      updateState({ singleRewrittenText: result.text, isEditingSingleRewrite: false, singleRewriteEditLoadingMessage: 'Tinh chỉnh hoàn tất!', hasSingleRewriteBeenEdited: true });
    } catch (e) {
      updateState({ singleRewriteEditError: `Lỗi khi tinh chỉnh: ${(e as Error).message}`, isEditingSingleRewrite: false });
    } finally {
        setTimeout(() => setModuleState(prev => ({...prev, singleRewriteEditLoadingMessage: null})), 3000);
    }
  };

  // ... (Render logic remains the same)
  return (
    // ... JSX
  );
};

export default RewriteModule;