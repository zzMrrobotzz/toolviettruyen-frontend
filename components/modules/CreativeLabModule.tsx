import React, { useState } from 'react';
import { CreativeLabModuleState, ActiveModule } from '../../types';
import { HOOK_LANGUAGE_OPTIONS, PLOT_STRUCTURE_OPTIONS, OUTLINE_DETAIL_LEVEL_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { useAppContext } from '../../AppContext';

// ... (interface không đổi)

const CreativeLabModule: React.FC<CreativeLabModuleProps> = ({
  setActiveModule, setStoryOutlineForWriteModule, setOutlineForSuperAgent, moduleState, setModuleState
}) => {
  const { updateCredit } = useAppContext(); // Lấy updateCredit
  // ... (các state khác không đổi)

  const handleQuickOutline = async () => {
    // ... (logic prompt không đổi)
    try {
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      // ... (xử lý kết quả không đổi)
    } catch (e) {
      // ... (xử lý lỗi không đổi)
    } finally {
      // ...
    }
  };

  const handleGenerateSingleOutline = async () => {
    // ... (logic prompt không đổi)
    try {
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      // ... (xử lý kết quả không đổi)
    } catch (e) {
      // ... (xử lý lỗi không đổi)
    } finally {
      // ...
    }
  };

  const handleGenerateBatchOutlines = async () => {
    // ... (logic xử lý batch không đổi, nhưng lời gọi API bên trong sẽ được sửa)
    const processItem = async (coreIdea: string) => {
      const prompt = `...`; // logic prompt không đổi
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      if (!result.success) throw new Error(result.error || 'Failed to generate outline');
      return result.text || '';
    };
    // ... (phần còn lại của hàm batch không đổi)
  };

  const handleAnalyzeReferenceOutline = async () => {
    // ... (logic prompt không đổi)
    try {
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      // ... (xử lý kết quả không đổi)
    } catch (e) {
      // ... (xử lý lỗi không đổi)
    } finally {
      // ...
    }
  };

  // ... (Phần render JSX không đổi)
  return (
    <ModuleContainer title="🔬 Phòng Thí Nghiệm Sáng Tạo">
      {/* ... JSX ... */}
    </ModuleContainer>
  );
};

export default CreativeLabModule;