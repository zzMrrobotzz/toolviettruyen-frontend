import React, { useState } from 'react';
import { 
    BatchStoryWritingModuleState, 
    BatchStoryInputItem, 
    GeneratedBatchStoryOutputItem, 
    EditStoryAnalysisReport 
} from '../../types';
import { 
    STORY_LENGTH_OPTIONS, 
    WRITING_STYLE_OPTIONS, 
    HOOK_LANGUAGE_OPTIONS 
} from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { useAppContext } from '../../AppContext';

interface BatchStoryWritingModuleProps {
  moduleState: BatchStoryWritingModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<BatchStoryWritingModuleState>>;
}

const BatchStoryWritingModule: React.FC<BatchStoryWritingModuleProps> = ({ 
    moduleState, setModuleState 
}) => {
    const { updateCredit } = useAppContext(); // Lấy updateCredit
    const {
    inputItems, results, globalTargetLength, globalWritingStyle, globalCustomWritingStyle,
    outputLanguage, referenceViralStoryForStyle, isProcessingBatch,
    batchProgressMessage, batchError, concurrencyLimit
  } = moduleState;

  const updateState = (updates: Partial<BatchStoryWritingModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  // ... (các hàm khác không đổi)

  const generateSingleStoryForBatch = async (
    item: BatchStoryInputItem,
    updateItemProgress: (updates: Partial<GeneratedBatchStoryOutputItem>) => void
  ): Promise<Omit<GeneratedBatchStoryOutputItem, 'id' | 'originalOutline'>> => {
    
    const textGenerator = async (prompt: string): Promise<string> => {
      const result = await generateTextViaBackend(
        { prompt, provider: 'gemini' },
        updateCredit // Truyền hàm updateCredit
      );
      if (!result.success) throw new Error(result.error || 'Failed to generate text');
      return result.text || "";
    };

    const generateJsonViaBackend = async <T,>(prompt: string): Promise<T> => {
        const result = await generateTextViaBackend(
            { prompt, provider: 'gemini' },
            updateCredit // Truyền hàm updateCredit
        );
        if (!result.success) throw new Error(result.error || 'Failed to generate JSON');
        try {
            return JSON.parse(result.text || '{}') as T;
        } catch (e) {
            throw new Error('Invalid JSON response');
        }
    };

    // ... (logic còn lại của hàm không đổi, vì nó đã sử dụng textGenerator và generateJsonViaBackend đã được sửa)
  };

  const handleStartBatchWriting = async () => {
    // Bỏ consumeCredit
    // const hasCredits = await consumeCredit(totalEstimatedCost);
    // if (!hasCredits) { ... }

    // ... (phần còn lại của hàm không đổi)
  };
  
  // ... (các hàm render không đổi)
};

export default BatchStoryWritingModule;