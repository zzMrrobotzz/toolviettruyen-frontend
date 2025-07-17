import React, { useState, useEffect, useCallback } from 'react';
import { 
    BatchRewriteModuleState, 
    BatchRewriteInputItem, 
    GeneratedBatchRewriteOutputItem 
} from '../../types';
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { useAppContext } from '../../AppContext';

interface BatchRewriteModuleProps {
  moduleState: BatchRewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<BatchRewriteModuleState>>;
}

const BatchRewriteModule: React.FC<BatchRewriteModuleProps> = ({ moduleState, setModuleState }) => {
  const { apiSettings, updateCredit } = useAppContext(); // Lấy updateCredit
  const {
    inputItems, results, globalRewriteLevel, globalSourceLanguage, globalTargetLanguage,
    globalRewriteStyle, globalCustomRewriteStyle, globalAdaptContext,
    isProcessingBatch, batchProgressMessage, batchError, concurrencyLimit
  } = moduleState;

  const updateState = (updates: Partial<BatchRewriteModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  // ... (các hàm khác không đổi)

  const performSingleItemRewrite = async (
    // ... (tham số không đổi)
    textGenerator: (prompt: string, systemInstruction?: string) => Promise<string>
  ): Promise<{ rewrittenText: string, characterMapUsed: string | null }> => {
    // ... (logic bên trong không đổi, vì nó đã nhận textGenerator)
  };
  
  const performSingleItemPostEdit = async (
    // ... (tham số không đổi)
    textGenerator: (prompt: string, systemInstruction?: string) => Promise<string>
  ): Promise<string> => {
    // ... (logic bên trong không đổi, vì nó đã nhận textGenerator)
  };

  const processSingleBatchItem = async (
      item: BatchRewriteInputItem, 
      index: number, 
      totalItems: number,
      updateResultCallback: (id: string, updates: Partial<GeneratedBatchRewriteOutputItem>) => void
    ) => {
    
    // Bọc generateTextViaBackend để truyền updateCredit
    const textGeneratorWithCreditUpdate = (prompt: string, systemInstruction?: string) => {
        return generateTextViaBackend(
            { prompt, provider: 'gemini', systemInstruction },
            updateCredit
        ).then(res => {
            if (!res.success) throw new Error(res.error || 'AI generation failed');
            return res.text || "";
        });
    };

    // ... (logic còn lại của hàm không đổi, chỉ cần truyền textGeneratorWithCreditUpdate vào các hàm con)
    
    try {
      const { rewrittenText, characterMapUsed } = await performSingleItemRewrite(
        // ...,
        textGeneratorWithCreditUpdate
      );
      
      // ...

      const finalRewrittenText = await performSingleItemPostEdit(
        // ...,
        textGeneratorWithCreditUpdate
      );

      // ...
    } catch (e) {
      // ...
    }
  };

  const handleStartBatchRewrite = async () => {
    // Bỏ consumeCredit
    // const hasCredits = await consumeCredit(totalCreditsNeeded);
    // if (!hasCredits) { ... }

    // ... (phần còn lại của hàm không đổi)
  };
  
  const handleRefineSingleResult = async (resultId: string) => {
    // Bỏ consumeCredit
    // const hasCredits = await consumeCredit(1);
    // if (!hasCredits) { ... }

    // ... (phần còn lại của hàm không đổi)
  };

  // ... (các hàm render không đổi)
};

export default BatchRewriteModule;