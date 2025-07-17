import React, { useState, useEffect } from 'react';
import { WriteStoryModuleState, WriteStoryActiveTab, BatchOutlineItem } from '../../types';
import { 
    WRITING_STYLE_OPTIONS, HOOK_LANGUAGE_OPTIONS, HOOK_STYLE_OPTIONS, 
    HOOK_LENGTH_OPTIONS, STORY_LENGTH_OPTIONS, 
    LESSON_LENGTH_OPTIONS, LESSON_WRITING_STYLE_OPTIONS,
    HOOK_STRUCTURE_OPTIONS 
} from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { useAppContext } from '../../AppContext';

interface WriteStoryModuleProps {
  moduleState: WriteStoryModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<WriteStoryModuleState>>;
  retrievedViralOutlineFromAnalysis: string | null;
}

const WriteStoryModule: React.FC<WriteStoryModuleProps> = ({ moduleState, setModuleState, retrievedViralOutlineFromAnalysis }) => {
  const { apiSettings, updateCredit } = useAppContext(); // Lấy updateCredit
  const {
    activeWriteTab,
    targetLength, writingStyle, customWritingStyle, outputLanguage, referenceViralStoryForStyle,
    storyOutline, generatedStory, keyElementsFromSingleStory, hasSingleStoryBeenEditedSuccessfully, storyError, storyProgress, storyLoadingMessage, singleStoryEditProgress,
    storyInputForHook,
    hookLanguage, hookStyle, customHookStyle, hookLength, hookCount, ctaChannel, hookStructure,
    generatedHooks, hookError, hookLoadingMessage,
    storyInputForLesson, lessonTargetLength, lessonWritingStyle, customLessonWritingStyle, 
    ctaChannelForLesson,
    generatedLesson, lessonError, lessonLoadingMessage,
  } = moduleState;

  const [isSingleOutlineExpanded, setIsSingleOutlineExpanded] = useState(true);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);

  const updateState = (updates: Partial<WriteStoryModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const handleCancelOperation = () => {
    if (currentAbortController) {
      currentAbortController.abort();
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
            activeWriteTab: 'singleStory'
        });
        setIsSingleOutlineExpanded(true);
    }
  };

  const handleGenerateHooks = async () => {
    let currentHookGenStyle = hookStyle === 'custom' ? customHookStyle.trim() : hookStyle;
    if (hookStyle === 'custom' && !currentHookGenStyle) {
      updateState({ hookError: 'Vui lòng nhập phong cách hook tùy chỉnh!' });
      return;
    }
    if (!storyInputForHook.trim()) { 
      updateState({ hookError: 'Vui lòng nhập Nội dung truyện để tạo hook!' });
      return;
    }
    
    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);
    updateState({ hookError: null, generatedHooks: '', hookLoadingMessage: 'Đang tạo hooks...' });
    
    const ctaInstructionSegment = ctaChannel.trim() ? `\n- If a Call To Action (CTA) is appropriate, incorporate a compelling CTA to engage with the channel "${ctaChannel.trim()}".` : "";
    const selectedHookLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === hookLanguage)?.label || hookLanguage;
    const structureInstructionSegment = hookStructure !== 'default' ? `\n- The structure of the hooks MUST follow the ${hookStructure.toUpperCase()} model.` : "";
    
    const prompt = `...`; // Prompt logic remains the same

    try {
      const result = await generateTextViaBackend(
        { prompt, provider: apiSettings.provider as 'gemini' },
        updateCredit
      );
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!result.success) throw new Error(result.error || 'AI generation failed');
      updateState({ generatedHooks: result.text || '', hookLoadingMessage: "Tạo hook hoàn tất!" });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ hookError: 'Tạo hook đã bị hủy.', hookLoadingMessage: 'Đã hủy.' });
      } else {
        updateState({ hookError: `Đã xảy ra lỗi khi tạo hook: ${e.message}`, hookLoadingMessage: "Lỗi tạo hook." });
      }
    } finally {
      setCurrentAbortController(null);
      setTimeout(() => setModuleState(prev => ({...prev, hookLoadingMessage: null})), 3000);
    }
  };

  const handleWriteStory = async () => {
    if (!storyOutline.trim()) {
      updateState({ storyError: 'Vui lòng nhập dàn ý truyện!' });
      return;
    }

    let currentStoryStyle = writingStyle === 'custom' ? customWritingStyle.trim() : WRITING_STYLE_OPTIONS.find(opt => opt.value === writingStyle)?.label || writingStyle;
    if (writingStyle === 'custom' && !currentStoryStyle) {
        updateState({ storyError: 'Vui lòng nhập phong cách viết truyện tùy chỉnh!' });
        return;
    }

    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);
    updateState({ storyError: null, generatedStory: '', storyProgress: 0, storyLoadingMessage: 'Đang chuẩn bị...' });
    
    let fullStory = '';
    let capturedKeyElements: string | null = null;
    const numChunks = Math.ceil(parseInt(targetLength) / 1000);

    try {
      for (let i = 0; i < numChunks; i++) {
        // ... (Prompt generation logic remains the same)
        const prompt = `...`;
        
        const result = await generateTextViaBackend(
          { prompt, provider: apiSettings.provider as 'gemini' },
          updateCredit
        );
        if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!result.success) throw new Error(result.error || 'AI generation failed');
        
        let currentChunkText = result.text || '';
        if (i === 0) {
            const keyElementsMatch = currentChunkText.match(/\[KEY_ELEMENTS\]([\s\S]*?)\[\/KEY_ELEMENTS\]/);
            if (keyElementsMatch && keyElementsMatch[1]) {
                capturedKeyElements = keyElementsMatch[1].trim();
                updateState({ keyElementsFromSingleStory: capturedKeyElements });
                currentChunkText = currentChunkText.replace(keyElementsMatch[0], '').trim();
            }
        }
        fullStory += (fullStory ? '\n\n' : '') + currentChunkText;
        updateState({ generatedStory: fullStory, storyProgress: Math.round(((i + 1) / numChunks) * 100) });
      }
      
      updateState({ storyLoadingMessage: 'Hoàn thành viết truyện! Chuẩn bị biên tập...' });
      await delay(1000, abortCtrl.signal);
      if (fullStory.trim()) {
          await handleEditStory(fullStory, storyOutline, capturedKeyElements, undefined, abortCtrl);
      } else {
        updateState({ storyError: "Không thể tạo nội dung truyện." });
      }
    } catch (e: any) {
      // ... (Error handling)
    } finally {
      if (!storyLoadingMessage?.includes('biên tập')) {
        setCurrentAbortController(null);
        setTimeout(() => setModuleState(prev => ({...prev, storyLoadingMessage: null})), 3000);
      }
    }
  };

  const handleEditStory = async (storyToEdit: string, originalOutlineParam: string, keyElementsInstruction?: string | null, itemIndex?: number, externalAbortController?: AbortController) => {
    const abortCtrl = externalAbortController || new AbortController();
    if (!externalAbortController) {
        setCurrentAbortController(abortCtrl);
    }
    if (!storyToEdit.trim()) {
      updateState({ storyError: 'Không có truyện để biên tập.' });
      return;
    }
    
    // ... (Prompt generation logic remains the same)
    const prompt = `...`;

    try {
      const result = await generateTextViaBackend(
        { prompt, provider: apiSettings.provider as 'gemini' },
        updateCredit
      );
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!result.success) throw new Error(result.error || 'AI generation failed');
      updateState({ generatedStory: result.text || '', storyLoadingMessage: '✅ ĐÃ BIÊN TẬP XONG 100%!', hasSingleStoryBeenEditedSuccessfully: true });
    } catch (e: any) {
      // ... (Error handling)
    } finally {
        if (!externalAbortController) setCurrentAbortController(null);
        setTimeout(() => setModuleState(prev => ({...prev, storyLoadingMessage: null, singleStoryEditProgress: null})), 3000);
    }
  };

  const handleGenerateLesson = async () => {
    if (!storyInputForLesson.trim()) {
      updateState({ lessonError: 'Vui lòng nhập Truyện để đúc kết bài học!' });
      return;
    }
    
    // ... (Prompt generation logic remains the same)
    const prompt = `...`;

    try {
      const result = await generateTextViaBackend(
        { prompt, provider: apiSettings.provider as 'gemini' },
        updateCredit
      );
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!result.success) throw new Error(result.error || 'AI generation failed');
      updateState({ generatedLesson: result.text || '', lessonLoadingMessage: "Đúc kết bài học hoàn tất!" });
    } catch (e: any) {
      // ... (Error handling)
    } finally {
       setCurrentAbortController(null);
       setTimeout(() => setModuleState(prev => ({...prev, lessonLoadingMessage: null})), 3000);
    }
  };

  // ... (Render logic remains the same)
  return (
    // ... JSX
  );
};

export default WriteStoryModule;