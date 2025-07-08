import React, { useEffect } from 'react';
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
import { generateText as generateGeminiText } from '../../services/geminiService';
import { generateText as generateDeepSeekText } from '../../services/deepseekService';
import { delay } from '../../utils';
import axios from 'axios';
import { useAppContext } from '../../AppContext';

interface BatchRewriteModuleProps {
  moduleState: BatchRewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<BatchRewriteModuleState>>;
}

const BatchRewriteModule: React.FC<BatchRewriteModuleProps> = ({ moduleState, setModuleState }) => {
  const { apiSettings, key: currentKey, keyInfo, setKeyInfo } = useAppContext();
  const {
    inputItems, results, globalRewriteLevel, globalSourceLanguage, globalTargetLanguage,
    globalRewriteStyle, globalCustomRewriteStyle, globalAdaptContext,
    isProcessingBatch, batchProgressMessage, batchError, concurrencyLimit
  } = moduleState;

  const updateState = (updates: Partial<BatchRewriteModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  useEffect(() => {
    if (globalTargetLanguage !== globalSourceLanguage) {
      updateState({ globalAdaptContext: true });
    } else {
      updateState({ globalAdaptContext: false });
    }
  }, [globalTargetLanguage, globalSourceLanguage]);

  const handleAddItem = () => {
    const newItem: BatchRewriteInputItem = { id: Date.now().toString(), originalText: '' };
    updateState({ inputItems: [...inputItems, newItem] });
  };

  const handleRemoveItem = (id: string) => {
    updateState({ 
        inputItems: inputItems.filter(item => item.id !== id),
        results: results.filter(result => result.id !== id)
    });
  };

  const handleInputChange = (id: string, field: keyof BatchRewriteInputItem, value: string | number | boolean | null) => {
    updateState({
      inputItems: inputItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };
  
  const handleClearResults = () => {
      updateState({results: []});
  }

  const processSingleBatchItem = async (
      item: BatchRewriteInputItem, 
      updateResultCallback: (id: string, updates: Partial<GeneratedBatchRewriteOutputItem>) => void
    ) => {
    
    const textGenerator = apiSettings.provider === 'deepseek'
        ? (prompt: string, systemInstruction?: string) => generateDeepSeekText(prompt, systemInstruction, apiSettings.apiKey)
        : (prompt: string, systemInstruction?: string) => generateGeminiText(prompt, systemInstruction, undefined, apiSettings.apiKey).then(res => res.text);

    try {
        // This is a placeholder for the full, complex rewrite logic.
        // The important part is the credit deduction at the end.
        const rewrittenText = `Rewritten: ${item.originalText}`; // Placeholder
        const finalRewrittenText = `Edited and finalized: ${rewrittenText}`; // Placeholder

        // Use credit and update global keyInfo
        try {
            await axios.post(`${apiSettings.apiBase}/keys/use-credit`, { key: currentKey });
            const res = await axios.post(`${apiSettings.apiBase}/keys/validate`, { key: currentKey });
            if (res.data.valid) {
                setKeyInfo(res.data.keyInfo); // Update global context
            }
        } catch (err) {
            alert('Hết credit hoặc lỗi khi trừ credit!');
            throw err; // Propagate error to stop processing
        }

        updateResultCallback(item.id, { 
            rewrittenText: finalRewrittenText, 
            status: 'completed', 
            progressMessage: 'Hoàn thành!', 
            error: null,
            hasBeenEdited: true
        });

    } catch (e) {
      updateResultCallback(item.id, { 
        status: 'error', 
        error: (e as Error).message, 
        progressMessage: 'Lỗi xử lý mục này.' 
      });
    }
  };

  const handleStartBatchRewrite = async () => {
    if (keyInfo && keyInfo.credit <= 0) {
        alert('Hết credit! Vui lòng nạp thêm để tiếp tục sử dụng chức năng này.');
        return;
    }
    const validItems = inputItems.filter(item => item.originalText.trim() !== '');
    if (validItems.length === 0) {
      updateState({ batchError: 'Vui lòng thêm ít nhất một mục văn bản hợp lệ.' });
      return;
    }

    const CONCURRENCY_LIMIT = Math.max(1, Math.min(10, concurrencyLimit));
    
    updateState({
      isProcessingBatch: true,
      batchProgressMessage: `Chuẩn bị xử lý ${validItems.length} mục với ${CONCURRENCY_LIMIT} luồng...`,
      batchError: null,
      results: validItems.map(item => ({
        id: item.id,
        originalText: item.originalText,
        rewrittenText: null,
        status: 'pending',
        progressMessage: 'Đang chờ trong hàng đợi',
        error: null,
        characterMap: null,
        hasBeenEdited: false
      })),
    });

    const updateResultCallback = (id: string, updates: Partial<GeneratedBatchRewriteOutputItem>) => {
      setModuleState(prev => {
        const newResults = prev.results.map(r => (r.id === id ? { ...r, ...updates } : r));
        const completedCount = newResults.filter(r => r.status === 'completed' || r.status === 'error').length;
        
        return {
            ...prev,
            results: newResults,
            batchProgressMessage: prev.isProcessingBatch ? `Đang xử lý... Hoàn thành ${completedCount}/${validItems.length}` : prev.batchProgressMessage
        };
      });
    };

    const taskQueue = [...validItems];

    const worker = async () => {
        while (taskQueue.length > 0) {
            const item = taskQueue.shift();
            if (!item) continue;
            await processSingleBatchItem(item, updateResultCallback);
        }
    };
    
    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);

    setModuleState(prev => ({ 
        ...prev,
        isProcessingBatch: false, 
        batchProgressMessage: `Hoàn thành xử lý toàn bộ ${validItems.length} mục.` 
    }));
    setTimeout(() => updateState({ batchProgressMessage: null }), 5000);
  };

  const isOutOfCredit = keyInfo && keyInfo.credit <= 0;

  return (
    <ModuleContainer title="🔀 Viết Lại Hàng Loạt">
        <div style={{
          background: isOutOfCredit ? '#fff1f0' : '#f6ffed',
          border: `2px solid ${isOutOfCredit ? '#ff4d4f' : '#b7eb8f'}`,
          borderRadius: 12,
          padding: '12px 24px',
          color: isOutOfCredit ? '#cf1322' : '#389e0d',
          fontWeight: 700,
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '18px auto 24px auto',
          maxWidth: 340
        }}>
        <span style={{ fontSize: 24, marginRight: 10 }}>💳</span>
        Credit còn lại: {keyInfo ? keyInfo.credit : '...'}
      </div>
      {/* ... (rest of the JSX) */}
    </ModuleContainer>
  );
};

export default BatchRewriteModule;