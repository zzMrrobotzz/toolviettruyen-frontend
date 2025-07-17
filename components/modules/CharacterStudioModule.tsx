import React from 'react';
import { CharacterStudioModuleState } from '../../types';
import { HOOK_LANGUAGE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { useAppContext } from '../../AppContext';

interface CharacterStudioModuleProps {
  moduleState: CharacterStudioModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<CharacterStudioModuleState>>;
}

const CharacterStudioModule: React.FC<CharacterStudioModuleProps> = ({ moduleState, setModuleState }) => {
  const { updateCredit } = useAppContext(); // Lấy updateCredit
  const {
    characterName, characterAge, characterGender, characterCountry, characterProfession,
    characterKeyFeatures, inputLanguage, outputLanguage, generatedBaseCharacterPrompt,
    isLoadingBasePrompt, errorBasePrompt, progressMessageBasePrompt,
    refinementInstructionForBasePrompt, isLoadingRefinementForBasePrompt, errorRefinementForBasePrompt,
    characterAction, generatedCompleteImagePrompt, isLoadingCompletePrompt, errorCompletePrompt,
    progressMessageCompletePrompt
  } = moduleState;

  const updateState = (updates: Partial<CharacterStudioModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const handleGenerateBasePrompt = async () => {
    // Bỏ consumeCredit
    updateState({ isLoadingBasePrompt: true, errorBasePrompt: null, progressMessageBasePrompt: 'Đang tạo prompt nhân vật...' });
    const prompt = `...`; // Logic prompt không đổi
    try {
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      if (!result.success) throw new Error(result.error || 'AI generation failed');
      updateState({ generatedBaseCharacterPrompt: result.text || '' });
    } catch (e) {
      updateState({ errorBasePrompt: (e as Error).message });
    } finally {
      updateState({ isLoadingBasePrompt: false, progressMessageBasePrompt: null });
    }
  };

  const handleRefineBasePrompt = async () => {
    // Bỏ consumeCredit
    updateState({ isLoadingRefinementForBasePrompt: true, errorRefinementForBasePrompt: null });
    const prompt = `...`; // Logic prompt không đổi
    try {
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      if (!result.success) throw new Error(result.error || 'AI generation failed');
      updateState({ generatedBaseCharacterPrompt: result.text || '' });
    } catch (e) {
      updateState({ errorRefinementForBasePrompt: (e as Error).message });
    } finally {
      updateState({ isLoadingRefinementForBasePrompt: false });
    }
  };

  const handleGenerateCompletePrompt = async () => {
    // Bỏ consumeCredit
    updateState({ isLoadingCompletePrompt: true, errorCompletePrompt: null, progressMessageCompletePrompt: 'Đang tạo prompt hoàn chỉnh...' });
    const prompt = `...`; // Logic prompt không đổi
    try {
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      if (!result.success) throw new Error(result.error || 'AI generation failed');
      updateState({ generatedCompleteImagePrompt: result.text || '' });
    } catch (e) {
      updateState({ errorCompletePrompt: (e as Error).message });
    } finally {
      updateState({ isLoadingCompletePrompt: false, progressMessageCompletePrompt: null });
    }
  };

  // ... (Phần render JSX không đổi)
  return (
    <ModuleContainer title="👩‍🎨 Studio Nhân Vật">
      {/* ... JSX ... */}
    </ModuleContainer>
  );
};

export default CharacterStudioModule;