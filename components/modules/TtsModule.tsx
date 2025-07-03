import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ApiSettings, ElevenLabsApiKey, ElevenLabsVoice, TtsModuleState, GeneratedAudioChunk } from '../../types';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { fetchElevenLabsVoices, generateElevenLabsSpeech, checkElevenLabsBalance } from '../../services/elevenLabsService';
import { delay } from '../../utils';

interface TtsModuleProps {
  apiSettings: ApiSettings; 
  elevenLabsApiKeys: ElevenLabsApiKey[]; // Global list from App
  setElevenLabsApiKeys: React.Dispatch<React.SetStateAction<ElevenLabsApiKey[]>>;
  moduleState: TtsModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<TtsModuleState>>;
}

const ALL_KEYS_SEQUENTIAL_ID = "__USE_ALL_SEQUENTIALLY__";
const MAX_CHUNK_LENGTH = 4400; // Max characters per chunk for ElevenLabs

const splitTextIntoChunks = (text: string, maxLength: number): string[] => {
  const chunks: string[] = [];
  let remainingText = text.trim();

  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    let chunkEnd = maxLength;
    let bestBreak = -1;

    let tempBreak = remainingText.substring(0, maxLength).lastIndexOf('\n\n');
    if (tempBreak > maxLength * 0.5) bestBreak = tempBreak + 2; 
    
    if (bestBreak === -1) {
        const sentenceChars = ['.', '!', '?'];
        for (const char of sentenceChars) {
            tempBreak = remainingText.substring(0, maxLength).lastIndexOf(char + ' ');
             if (tempBreak === -1) tempBreak = remainingText.substring(0, maxLength).lastIndexOf(char + '\n');
            
            if (tempBreak > maxLength * 0.5 && tempBreak + (char.length + 1) > bestBreak) {
                bestBreak = tempBreak + (char.length + 1) ; 
            }
        }
    }
    
    if (bestBreak === -1) {
        tempBreak = remainingText.substring(0, maxLength).lastIndexOf('\n');
        if (tempBreak > maxLength * 0.5) bestBreak = tempBreak + 1;
    }
    
    if (bestBreak !== -1) {
        chunkEnd = bestBreak;
    } else {
        tempBreak = remainingText.substring(0, maxLength).lastIndexOf(' ');
        if (tempBreak > maxLength * 0.75) { 
            chunkEnd = tempBreak + 1; 
        } else {
            chunkEnd = maxLength;
        }
    }
    
    chunks.push(remainingText.substring(0, chunkEnd).trim());
    remainingText = remainingText.substring(chunkEnd).trim();
  }
  return chunks.filter(chunk => chunk.length > 0);
};


const TtsModule: React.FC<TtsModuleProps> = ({ 
  elevenLabsApiKeys, setElevenLabsApiKeys, moduleState, setModuleState 
}) => {
  const {
    selectedApiKey, voices, selectedVoiceId, textToSpeak,
    generatedAudioChunks, 
    totalCharsLeft, error, loadingMessage
  } = moduleState;

  const [bulkApiKeysInput, setBulkApiKeysInput] = useState('');
  const [isCheckingAllBalances, setIsCheckingAllBalances] = useState(false);

  const updateModuleState = (updates: Partial<TtsModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const [voiceSearchTerm, setVoiceSearchTerm] = useState(''); 
  
  const latestGeneratedAudioChunksRef = useRef(generatedAudioChunks);

  useEffect(() => {
    latestGeneratedAudioChunksRef.current = generatedAudioChunks;
  }, [generatedAudioChunks]);

  useEffect(() => {
    return () => {
      latestGeneratedAudioChunksRef.current.forEach(chunk => {
        URL.revokeObjectURL(chunk.url);
      });
    };
  }, []);


  const updateTotalCharsDisplay = useCallback(() => {
    let total = 0;
    elevenLabsApiKeys.forEach(key => { 
        if (key.checked && typeof key.charsLeft === 'number' && key.charsLeft > 0) {
            total += key.charsLeft;
        }
    });
    updateModuleState({ totalCharsLeft: total });
  }, [elevenLabsApiKeys, updateModuleState]); 

  useEffect(() => {
    updateTotalCharsDisplay();
  }, [elevenLabsApiKeys, updateTotalCharsDisplay]);
  

  const addApiKeyField = () => {
    const newKey: ElevenLabsApiKey = { id: Date.now().toString(), key: '', charsLeft: 'Chưa kiểm tra', checked: false };
    setElevenLabsApiKeys([...elevenLabsApiKeys, newKey]);
  };

  const updateIndividualGlobalApiKey = useCallback((id: string, updates: Partial<Omit<ElevenLabsApiKey, 'id'>>) => {
    setElevenLabsApiKeys(prevKeys => 
      prevKeys.map(k => (k.id === id ? { ...k, ...updates } : k))
    );
  }, [setElevenLabsApiKeys]);
  
  const removeApiKeyField = (id: string) => {
    const updatedKeys = elevenLabsApiKeys.filter(k => k.id !== id);
    setElevenLabsApiKeys(updatedKeys);
    if (moduleState.selectedApiKey && !updatedKeys.find(k => k.key === moduleState.selectedApiKey) && moduleState.selectedApiKey !== ALL_KEYS_SEQUENTIAL_ID) {
        const firstValidKey = updatedKeys.find(k => k.key && k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0);
        updateModuleState({ 
            selectedApiKey: firstValidKey ? firstValidKey.key : (updatedKeys.length > 0 ? ALL_KEYS_SEQUENTIAL_ID : ''), 
            voices: [], 
            selectedVoiceId: ''
        });
    } else if (updatedKeys.length === 0 && moduleState.selectedApiKey === ALL_KEYS_SEQUENTIAL_ID) {
        updateModuleState({ selectedApiKey: '', voices: [], selectedVoiceId: '' });
    }
  };

  const handleCheckBalance = useCallback(async (keyIdToCheck: string, suppressIndividualLoadingMessage = false) => {
    const keyIndex = elevenLabsApiKeys.findIndex(k => k.id === keyIdToCheck);
    if (keyIndex === -1) {
        console.error("Key not found for balance check:", keyIdToCheck);
        return;
    }

    const keyData = elevenLabsApiKeys[keyIndex];
    if (!keyData.key) {
        updateIndividualGlobalApiKey(keyIdToCheck, { charsLeft: 'Lỗi Key', checked: false });
        return;
    }
    
    // Only set 'Đang KT...' if not suppressed (i.e., not part of a "check all" operation)
    if (!suppressIndividualLoadingMessage) {
      updateIndividualGlobalApiKey(keyIdToCheck, { charsLeft: 'Đang KT...', checked: false });
    }


    let finalCharsLeftValue: number | string = 'Lỗi Key';
    let finalCheckedStatus = false;

    try {
        const balanceData = await checkElevenLabsBalance(keyData.key);
        finalCharsLeftValue = balanceData.character_limit - balanceData.character_count;
        finalCheckedStatus = true;
    } catch (e) {
        finalCharsLeftValue = 'Lỗi Key';
        finalCheckedStatus = false;
        console.error(`Error checking balance for key ${keyData.key.slice(0,5)}...: ${(e as Error).message}`);
    }

    setElevenLabsApiKeys(prevKeys => 
        prevKeys.map(k => 
            k.id === keyIdToCheck ? { ...k, charsLeft: finalCharsLeftValue, checked: finalCheckedStatus } : k
        )
    );
    
    if (moduleState.selectedApiKey === keyData.key && !finalCheckedStatus) {
        // This logic might need adjustment if a "check all" makes the current key invalid
        const currentGlobalKeys = [...elevenLabsApiKeys]; // Create a mutable copy
        const updatedKeyIndex = currentGlobalKeys.findIndex(k => k.id === keyIdToCheck);
        if (updatedKeyIndex !== -1) {
            currentGlobalKeys[updatedKeyIndex] = { ...currentGlobalKeys[updatedKeyIndex], charsLeft: finalCharsLeftValue, checked: finalCheckedStatus };
        }
        
        const firstValidKeyFromList = currentGlobalKeys.find(k => k.key && k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0);
        
        updateModuleState({
            selectedApiKey: firstValidKeyFromList ? firstValidKeyFromList.key : (currentGlobalKeys.some(k => k.key && k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0) ? ALL_KEYS_SEQUENTIAL_ID : ''),
            voices: [], 
            selectedVoiceId: ''
        });
    }
  }, [elevenLabsApiKeys, moduleState.selectedApiKey, updateIndividualGlobalApiKey, setElevenLabsApiKeys, updateModuleState]);


  const handleFetchVoices = async () => {
    let apiKeyToUseForFetchingVoices = selectedApiKey;

    if (selectedApiKey === ALL_KEYS_SEQUENTIAL_ID) {
      const firstValidKey = elevenLabsApiKeys.find(
        k => k.key && k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0
      );
      if (firstValidKey) {
        apiKeyToUseForFetchingVoices = firstValidKey.key;
      } else {
        updateModuleState({ error: "Chế độ dùng tuần tự: Không có API Key hợp lệ nào để lấy danh sách giọng đọc.", loadingMessage: null });
        return;
      }
    }

    if (!apiKeyToUseForFetchingVoices) {
      updateModuleState({ error: "Vui lòng chọn một API Key từ danh sách hoặc đảm bảo có key hợp lệ cho chế độ tuần tự.", loadingMessage: null });
      return;
    }

    updateModuleState({ error: null, voices: [], selectedVoiceId: '', loadingMessage: "Đang tải danh sách giọng đọc..." });
    setVoiceSearchTerm('');
    try {
      const fetchedVoices = await fetchElevenLabsVoices(apiKeyToUseForFetchingVoices);
      updateModuleState({ 
        voices: fetchedVoices, 
        selectedVoiceId: fetchedVoices.length > 0 ? fetchedVoices[0].voice_id : '',
        loadingMessage: "Tải giọng đọc hoàn tất!"
      });
      if (fetchedVoices.length === 0) {
        updateModuleState({ error: "Không tìm thấy giọng đọc nào cho API Key đã chọn (hoặc Key dùng để lấy giọng)." , loadingMessage: "Không tìm thấy giọng đọc."});
      }
    } catch (e) {
      updateModuleState({ error: `Không thể lấy danh sách giọng đọc: ${(e as Error).message}`, loadingMessage: "Lỗi tải giọng đọc." });
    } finally {
      setTimeout(() => {
        setModuleState((prev: TtsModuleState) => 
          (prev.loadingMessage?.includes("hoàn tất") || prev.loadingMessage?.includes("Lỗi") || prev.loadingMessage?.includes("Không tìm thấy")) 
          ? {...prev, loadingMessage: null} 
          : prev
        )
      }, 3000);
    }
  };

 const handleGenerateSpeech = async () => {
    if ((!selectedApiKey || (selectedApiKey === ALL_KEYS_SEQUENTIAL_ID && !elevenLabsApiKeys.some(k => k.key && k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0))) || !textToSpeak.trim() || !selectedVoiceId) {
      updateModuleState({ error: 'Vui lòng chọn API Key (hoặc đảm bảo có key hợp lệ cho chế độ tuần tự), chọn giọng đọc và nhập văn bản.' });
      return;
    }
    
    moduleState.generatedAudioChunks.forEach(chunk => {
        URL.revokeObjectURL(chunk.url);
    });
    updateModuleState({ error: null, generatedAudioChunks: [], loadingMessage: "Đang chuẩn bị tạo audio..." });


    const textChunks = splitTextIntoChunks(textToSpeak.trim(), MAX_CHUNK_LENGTH);
    if (textChunks.length === 0) {
      updateModuleState({ error: 'Không có nội dung văn bản để chuyển đổi.', loadingMessage: null });
      return;
    }

    let overallSuccess = true;
    let successfulChunksCount = 0;
    const currentGeneratedChunksAccumulator: GeneratedAudioChunk[] = []; 

    for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
      const chunk = textChunks[chunkIndex];
      let chunkSuccess = false;
      updateModuleState({ loadingMessage: `Đang xử lý đoạn ${chunkIndex + 1}/${textChunks.length}...` });

      if (selectedApiKey === ALL_KEYS_SEQUENTIAL_ID) {
        const validKeysToTry = elevenLabsApiKeys.filter(k => k.key && k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0)
                                            .sort((a,b) => (b.charsLeft as number) - (a.charsLeft as number)); 
        if (validKeysToTry.length === 0) {
          updateModuleState({ error: `Chế độ dùng tuần tự: Không có API Key nào hợp lệ để thử cho đoạn ${chunkIndex + 1}.`});
          overallSuccess = false; break;
        }

        for (let keyTryIndex = 0; keyTryIndex < validKeysToTry.length; keyTryIndex++) {
          const currentKeyToTry = validKeysToTry[keyTryIndex];
          const keyDisplayGlobalIndex = elevenLabsApiKeys.findIndex(k => k.id === currentKeyToTry.id) + 1;
          updateModuleState({ loadingMessage: `Đoạn ${chunkIndex + 1}/${textChunks.length}: Đang thử Key #${keyDisplayGlobalIndex} (${currentKeyToTry.key.slice(0,5)}...)` });
          
          try {
            const blob = await generateElevenLabsSpeech(currentKeyToTry.key, chunk, selectedVoiceId);
            const newChunkData: GeneratedAudioChunk = { 
              id: `${Date.now()}-${chunkIndex}-${keyTryIndex}`, 
              name: `Đoạn ${chunkIndex + 1} / ${textChunks.length}`, 
              blob: blob, 
              url: URL.createObjectURL(blob) 
            };
            currentGeneratedChunksAccumulator.push(newChunkData);
            setModuleState(prev => ({ ...prev, generatedAudioChunks: [...currentGeneratedChunksAccumulator] })); 
            chunkSuccess = true;
            successfulChunksCount++;
            await handleCheckBalance(currentKeyToTry.id, true); // Suppress individual loading message
            break; 
          } catch (e) {
            const error = e as any;
            const isQuotaOrAuthError = error.statusCode === 401 || error.statusCode === 402 || error.statusCode === 429 ||
                (typeof error.message === 'string' && (
                    error.message.toLowerCase().includes("quota") ||
                    error.message.toLowerCase().includes("limit exceeded") ||
                    error.message.toLowerCase().includes("insufficient balance") ||
                    error.message.toLowerCase().includes("unauthorized") ||
                    error.message.toLowerCase().includes("api key is invalid") ||
                    error.message.toLowerCase().includes("permission denied")
                ));
            
            if (isQuotaOrAuthError) {
              console.warn(`Key #${keyDisplayGlobalIndex} (${currentKeyToTry.key.slice(0,5)}...) lỗi hoặc hết hạn ngạch cho đoạn ${chunkIndex + 1}. ${error.message}`);
              updateIndividualGlobalApiKey(currentKeyToTry.id, { charsLeft: 0, checked: false }); 
              if (keyTryIndex < validKeysToTry.length - 1) {
                updateModuleState({ loadingMessage: `Đoạn ${chunkIndex + 1}: Key #${keyDisplayGlobalIndex} lỗi, đang thử key tiếp theo...`});
              } else {
                 updateModuleState({ error: `Tất cả API Key đã thử đều lỗi hoặc hết hạn ngạch cho đoạn ${chunkIndex + 1}. Lỗi cuối: ${error.message}` });
              }
            } else {
              updateModuleState({ error: `Lỗi tạo audio cho đoạn ${chunkIndex + 1} với Key #${keyDisplayGlobalIndex}: ${error.message}` });
              chunkSuccess = false; 
              break;
            }
          }
        } 
        if (!chunkSuccess) { overallSuccess = false; break; }

      } else { 
        updateModuleState({ loadingMessage: `Đang xử lý đoạn ${chunkIndex + 1}/${textChunks.length} với key ${selectedApiKey.slice(0,5)}...` });
        try {
          const blob = await generateElevenLabsSpeech(selectedApiKey, chunk, selectedVoiceId);
          const newChunkData: GeneratedAudioChunk = { 
            id: `${Date.now()}-${chunkIndex}`, 
            name: `Đoạn ${chunkIndex + 1} / ${textChunks.length}`, 
            blob: blob, 
            url: URL.createObjectURL(blob) 
          };
          currentGeneratedChunksAccumulator.push(newChunkData);
          setModuleState(prev => ({ ...prev, generatedAudioChunks: [...currentGeneratedChunksAccumulator] })); 
          successfulChunksCount++;
          const keyUsed = elevenLabsApiKeys.find(k => k.key === selectedApiKey);
          if(keyUsed) await handleCheckBalance(keyUsed.id, true); // Suppress individual loading message
        } catch (e) {
          updateModuleState({ error: `Lỗi tạo audio cho đoạn ${chunkIndex + 1}: ${(e as Error).message}`});
          overallSuccess = false; break;
        }
      }
    } 

    let finalUserDisplayMessage = "";
    if (overallSuccess && successfulChunksCount > 0 && successfulChunksCount === textChunks.length) {
        finalUserDisplayMessage = `Hoàn thành tạo ${textChunks.length} đoạn audio. Bạn có thể tải về từng đoạn.`;
    } else if (successfulChunksCount > 0 && !overallSuccess) {
        finalUserDisplayMessage = `Hoàn thành ${successfulChunksCount}/${textChunks.length} đoạn. Một số đoạn bị lỗi. Các đoạn thành công có thể tải về.`;
    } else if (textChunks.length > 0 && successfulChunksCount === 0) {
        finalUserDisplayMessage = "Lỗi: Không thể tạo audio cho bất kỳ đoạn nào.";
        setModuleState(prev => ({ ...prev, error: (prev.error ? prev.error + "\n" : "") + finalUserDisplayMessage }));
    } else if (textChunks.length === 0) {
        finalUserDisplayMessage = "Không có văn bản để xử lý.";
         setModuleState(prev => ({ ...prev, error: null }));
    } else {
        finalUserDisplayMessage = "Quá trình xử lý đã kết thúc.";
    }
    
    updateModuleState({ loadingMessage: finalUserDisplayMessage });

    setTimeout(() => {
        setModuleState(prev => {
            if (prev.loadingMessage === finalUserDisplayMessage) {
                return { ...prev, loadingMessage: null };
            }
            return prev;
        });
    }, 7000); 
  };
  
 const getApiKeyDisplayValue = (apiKeyData: ElevenLabsApiKey) => {
    const keyIndex = elevenLabsApiKeys.findIndex(k => k.id === apiKeyData.id);
    const keyIdentifier = `Key #${keyIndex !== -1 ? keyIndex + 1 : 'N/A'}`;
    if (apiKeyData.key && apiKeyData.key.length > 4) {
      return `${keyIdentifier} (...${apiKeyData.key.slice(-4)})`;
    }
    return keyIdentifier;
  };

  const filteredVoices = voices.filter(voice => {
    if (!voiceSearchTerm.trim()) return true;
    const searchTermLower = voiceSearchTerm.toLowerCase();
    const nameMatch = voice.name.toLowerCase().includes(searchTermLower);
    const labelsMatch = Object.values(voice.labels).some(label => 
        label && typeof label === 'string' && label.toLowerCase().includes(searchTermLower)
    );
    return nameMatch || labelsMatch;
  });
  
  const handleProcessBulkApiKeys = () => {
    const newKeysRaw = bulkApiKeysInput.split('\n').map(k => k.trim()).filter(k => k);
    if (newKeysRaw.length === 0) {
      updateModuleState({ error: 'Vui lòng nhập API Key vào ô.' });
      return;
    }
    
    const existingKeyStrings = new Set(elevenLabsApiKeys.map(k => k.key));
    const keysToAdd: ElevenLabsApiKey[] = [];
    
    newKeysRaw.forEach(rawKey => {
      if (!existingKeyStrings.has(rawKey)) {
        keysToAdd.push({
          id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9), // more unique ID
          key: rawKey,
          charsLeft: 'Chưa kiểm tra',
          checked: false
        });
        existingKeyStrings.add(rawKey); // Add to set to prevent duplicates within the bulk input itself
      }
    });

    if (keysToAdd.length > 0) {
      setElevenLabsApiKeys(prevKeys => [...prevKeys, ...keysToAdd]);
    }
    setBulkApiKeysInput(''); // Clear textarea
    updateModuleState({ error: null, loadingMessage: `${keysToAdd.length} key mới đã được thêm. Bạn có thể kiểm tra số dư cho từng key hoặc tất cả.` });
    setTimeout(() => {
        setModuleState(prev => (prev.loadingMessage && prev.loadingMessage.includes("key mới đã được thêm")) ? {...prev, loadingMessage: null} : prev );
    }, 4000);
  };

  const handleCheckAllBalances = async () => {
    const keysToCheck = elevenLabsApiKeys.filter(k => k.key && k.charsLeft !== 'Đang KT...');
    if (keysToCheck.length === 0) {
        updateModuleState({ loadingMessage: 'Không có API Key nào để kiểm tra hoặc tất cả đang được kiểm tra.' });
        setTimeout(() => setModuleState(prev => prev.loadingMessage && prev.loadingMessage.includes("Không có API Key nào") ? {...prev, loadingMessage: null} : prev), 3000);
        return;
    }

    setIsCheckingAllBalances(true);
    updateModuleState({ loadingMessage: `Đang kiểm tra ${keysToCheck.length} API Key...` });

    for (let i = 0; i < keysToCheck.length; i++) {
        const key = keysToCheck[i];
        updateModuleState({ loadingMessage: `Đang kiểm tra Key ${i + 1}/${keysToCheck.length} (${key.key.slice(0,5)}...)` });
        // Set individual key to "Đang KT..." before calling handleCheckBalance
        updateIndividualGlobalApiKey(key.id, { charsLeft: 'Đang KT...', checked: false });
        await handleCheckBalance(key.id, true); // true to suppress individual 'Đang KT...' message from handleCheckBalance
        await delay(500); // Small delay between API calls
    }

    setIsCheckingAllBalances(false);
    updateModuleState({ loadingMessage: 'Hoàn tất kiểm tra tất cả API Key.' });
    setTimeout(() => setModuleState(prev => prev.loadingMessage === 'Hoàn tất kiểm tra tất cả API Key.' ? {...prev, loadingMessage: null} : prev), 3000);
  };


  const isAnyLoadingOperation = !!loadingMessage || isCheckingAllBalances;


  return (
    <ModuleContainer title="🎙️ Module: Chuyển văn bản thành giọng nói (TTS)">
      <InfoBox variant="info">
        <p><strong>💡 Hướng dẫn:</strong> Quản lý API Key, chọn giọng đọc, nhập văn bản. </p>
        <p className="mt-1">Văn bản dài sẽ được tự động chia thành các đoạn nhỏ để xử lý. Bạn có thể tải về từng đoạn audio sau khi tạo.</p>
        <p className="mt-1">Truy cập <a href="https://elevenlabs.io/" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">ElevenLabs</a> để thêm giọng đọc (nếu cần).</p>
      </InfoBox>
      <InfoBox variant="warning">
        <p><strong>🔒 Lưu ý Bảo mật:</strong> API Key ElevenLabs của bạn sẽ được lưu trong Local Storage của trình duyệt này để tiện sử dụng. Hãy đảm bảo bạn đang dùng máy tính cá nhân và an toàn. Bạn hoàn toàn chịu trách nhiệm về các API Key này.</p>
      </InfoBox>

      <div className="space-y-6 mt-6">
        <div className="p-4 border-2 border-gray-200 rounded-lg bg-white shadow">
          <h4 className="text-lg font-semibold mb-4 text-gray-800">Quản lý API Key ElevenLabs</h4>
          
          {/* Bulk API Key Input */}
          <div className="mb-6 p-4 border border-dashed border-indigo-300 rounded-lg bg-indigo-50">
            <h5 className="text-md font-semibold text-indigo-700 mb-2">Thêm API Key Hàng Loạt</h5>
            <textarea
              value={bulkApiKeysInput}
              onChange={(e) => setBulkApiKeysInput(e.target.value)}
              rows={4}
              className="w-full p-2 border-gray-300 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Dán danh sách API Key, mỗi key một dòng..."
              disabled={isAnyLoadingOperation}
            />
            <button
              onClick={handleProcessBulkApiKeys}
              disabled={isAnyLoadingOperation || !bulkApiKeysInput.trim()}
              className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              Xử Lý & Thêm Keys Từ Danh Sách
            </button>
          </div>

          <div className="space-y-3 mb-4">
            {elevenLabsApiKeys.map((apiKeyData, index) => (
              <div key={apiKeyData.id} className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 items-center p-3 border rounded-md bg-gray-50">
                <label htmlFor={`apiKey-${apiKeyData.id}`} className="block text-sm font-medium text-gray-700 md:col-span-2 whitespace-nowrap">Key #{index + 1}:</label>
                <input 
                    type="password" 
                    id={`apiKey-${apiKeyData.id}`}
                    value={apiKeyData.key} 
                    onChange={(e) => updateIndividualGlobalApiKey(apiKeyData.id, { key: e.target.value, checked: false, charsLeft: 'Chưa KT' })} 
                    placeholder="Dán API Key ElevenLabs" 
                    className="p-2 border-gray-300 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 md:col-span-4"
                    aria-label={`API Key ${index + 1}`}
                    disabled={isAnyLoadingOperation}
                />
                <div className="text-sm md:col-span-3 md:text-left text-center">
                  Còn lại: <strong className={apiKeyData.checked && typeof apiKeyData.charsLeft === 'number' && apiKeyData.charsLeft > 0 ? 'text-green-600' : (apiKeyData.charsLeft === 'Chưa kiểm tra' || apiKeyData.charsLeft === 'Đang KT...' ? 'text-gray-600' : 'text-red-600')}>{typeof apiKeyData.charsLeft === 'number' ? apiKeyData.charsLeft.toLocaleString() : apiKeyData.charsLeft}</strong>
                </div>
                <div className="flex gap-2 md:col-span-3">
                    <button 
                        onClick={() => handleCheckBalance(apiKeyData.id)} 
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-60"
                        disabled={!apiKeyData.key || apiKeyData.charsLeft === 'Đang KT...' || isAnyLoadingOperation}
                        aria-label={`Kiểm tra Key ${index + 1}`}
                    >
                        {apiKeyData.charsLeft === 'Đang KT...' ? 'Đang KT...' : 'Kiểm tra'}
                    </button>
                    <button 
                        onClick={() => removeApiKeyField(apiKeyData.id)} 
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-60"
                        aria-label={`Xóa Key ${index + 1}`}
                         disabled={isAnyLoadingOperation}
                    >
                        Xóa
                    </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button 
                onClick={addApiKeyField} 
                disabled={isAnyLoadingOperation}
                className="px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 disabled:opacity-50"
            >
                + Thêm API Key Thủ Công
            </button>
            <button
                onClick={handleCheckAllBalances}
                disabled={isAnyLoadingOperation || elevenLabsApiKeys.filter(k => k.key).length === 0}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50 disabled:opacity-50"
            >
                Kiểm Tra Số Dư Tất Cả Keys
            </button>
          </div>
          <div className="mt-4 font-semibold text-sm text-gray-800">
            Tổng số ký tự khả dụng (từ các key hợp lệ): <span className="text-green-700">{typeof totalCharsLeft === 'number' ? totalCharsLeft.toLocaleString() : '0'}</span>
          </div>
        </div>

        <div className="p-4 border-2 border-gray-200 rounded-lg bg-white shadow">
            <h4 className="text-lg font-semibold mb-1 text-gray-800">Cấu hình sử dụng</h4>
            <div className="mt-4">
                <label htmlFor="ttsKeySelect" className="block text-sm font-medium text-gray-700 mb-1">Sử dụng API Key (Ưu tiên ban đầu):</label>
                <div className="relative">
                    <select 
                        id="ttsKeySelect" 
                        value={selectedApiKey} 
                        onChange={(e) => {
                            const newSelectedKey = e.target.value;
                            updateModuleState({selectedApiKey: newSelectedKey, voices: [], selectedVoiceId: '', error: null});
                        }}
                        className="w-full p-3 pr-10 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 appearance-none disabled:bg-gray-100" 
                        disabled={elevenLabsApiKeys.filter(k => k.key).length === 0 || isAnyLoadingOperation}
                        aria-label="Chọn API Key để sử dụng"
                    >
                        <option value="">
                        {elevenLabsApiKeys.filter(k => k.key).length === 0
                            ? "-- Thêm API Key để sử dụng --"
                            : "-- Chọn API Key --"}
                        </option>
                        {elevenLabsApiKeys.some(k => k.key && k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0) && (
                            <option value={ALL_KEYS_SEQUENTIAL_ID}>Dùng Lần Lượt Tất Cả Key Hợp Lệ</option>
                        )}
                        {elevenLabsApiKeys.filter(k => k.key).map((k) => { 
                            const keyDisplay = getApiKeyDisplayValue(k); 
                            const charsDisplay = (k.checked && typeof k.charsLeft === 'number') 
                                                ? `(Còn: ${k.charsLeft.toLocaleString()})` 
                                                : (k.charsLeft !== "Chưa kiểm tra" && k.charsLeft !== "Đang KT..." ? ` (${k.charsLeft})` : '');
                            return <option key={k.id} value={k.key}>{keyDisplay} {charsDisplay}</option>;
                        })}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>

            <div className="mt-4">
              <label htmlFor="voiceSearch" className="block text-sm font-medium text-gray-700 mb-1">Tìm kiếm giọng đọc (tên, accent, gender...):</label>
              <input 
                type="text"
                id="voiceSearch"
                value={voiceSearchTerm}
                onChange={(e) => setVoiceSearchTerm(e.target.value)}
                placeholder="Nhập từ khóa để lọc giọng..."
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                disabled={(!selectedApiKey && selectedApiKey !== ALL_KEYS_SEQUENTIAL_ID) || voices.length === 0 || isAnyLoadingOperation}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-x-4 gap-y-2 mt-4 items-end">
                <div className="md:col-span-2">
                    <label htmlFor="ttsVoice" className="block text-sm font-medium text-gray-700 mb-1">Chọn giọng đọc:</label>
                    <select 
                        id="ttsVoice" 
                        value={selectedVoiceId} 
                        onChange={(e) => updateModuleState({ selectedVoiceId: e.target.value })} 
                        disabled={(!selectedApiKey && selectedApiKey !== ALL_KEYS_SEQUENTIAL_ID) || (loadingMessage && loadingMessage.startsWith("Đang tải danh sách giọng đọc...")) || (voices.length > 0 && filteredVoices.length === 0) || (loadingMessage && loadingMessage.startsWith("Đang tạo audio")) || isAnyLoadingOperation} 
                        className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                        aria-label="Chọn giọng đọc"
                    >
                    <option value="">
                        {loadingMessage && loadingMessage.startsWith("Đang tải danh sách giọng đọc...")
                            ? "Đang tải..."
                            : (!selectedApiKey && selectedApiKey !== ALL_KEYS_SEQUENTIAL_ID)
                            ? "-- Chọn API Key trước --"
                            : (selectedApiKey === ALL_KEYS_SEQUENTIAL_ID && !elevenLabsApiKeys.some(k => k.checked && typeof k.charsLeft === 'number' && k.charsLeft > 0))
                            ? "Chế độ tuần tự: Không có key hợp lệ"
                            : voices.length === 0 && !(loadingMessage && loadingMessage.startsWith("Đang tải danh sách giọng đọc..."))
                                ? "Nhấn 'Lấy giọng đọc'"
                                : filteredVoices.length === 0 && voiceSearchTerm
                                    ? "Không tìm thấy giọng phù hợp"
                                    : (voices.length > 0 ? "-- Chọn giọng --" : "Chưa có giọng nào") 
                        }
                    </option>
                    {filteredVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.labels.gender}, {v.labels.accent})</option>)}
                    </select>
                </div>
                <button 
                    onClick={handleFetchVoices} 
                    disabled={(!selectedApiKey && selectedApiKey !== ALL_KEYS_SEQUENTIAL_ID) || isAnyLoadingOperation} 
                    className="px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:opacity-50 disabled:bg-gray-300 whitespace-nowrap"
                >
                    {(loadingMessage && loadingMessage.startsWith("Đang tải danh sách giọng đọc...")) ? "Đang tải..." : "Lấy giọng đọc từ Key"}
                </button>
            </div>
        
            <div className="mt-4">
                <label htmlFor="ttsText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản cần đọc:</label>
                <textarea 
                    id="ttsText" 
                    value={textToSpeak} 
                    onChange={(e) => updateModuleState({ textToSpeak: e.target.value })} 
                    rows={8} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Dán nội dung truyện hoặc bất kỳ văn bản nào vào đây..."
                    aria-label="Văn bản cần chuyển đổi thành giọng nói"
                    disabled={isAnyLoadingOperation}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">Số ký tự: {textToSpeak.length}</p>
            </div>

            <button 
                onClick={handleGenerateSpeech} 
                disabled={isAnyLoadingOperation || (!selectedApiKey && selectedApiKey !== ALL_KEYS_SEQUENTIAL_ID) || !selectedVoiceId || !textToSpeak.trim() || (selectedApiKey === ALL_KEYS_SEQUENTIAL_ID && !elevenLabsApiKeys.some(k=>k.checked && typeof k.charsLeft ==='number' && k.charsLeft >0 ) )} 
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
                🎙️ Chuyển đổi
            </button>
        </div>

        {isAnyLoadingOperation && loadingMessage && loadingMessage.startsWith("Đang") && <LoadingSpinner message={loadingMessage} />}
        {loadingMessage && !loadingMessage.startsWith("Đang") && (
             <p className={`text-center font-medium my-2 ${loadingMessage.includes("Lỗi") || loadingMessage.includes("Không thể") ? 'text-red-600' : (loadingMessage.includes("Hoàn thành") || loadingMessage.includes("key mới đã được thêm") ? 'text-green-600' : 'text-indigo-600')}`}>
                {loadingMessage}
            </p>
        )}
        {error && <ErrorAlert message={error} />}

        {generatedAudioChunks.length > 0 && !(loadingMessage && loadingMessage.startsWith("Đang")) && (
          <div className="mt-6 p-4 border-2 border-gray-200 rounded-lg bg-white shadow">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">🔊 Các đoạn audio đã tạo:</h3>
            <ul className="space-y-3">
              {generatedAudioChunks.map((chunk, index) => (
                <li key={chunk.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-md bg-gray-50 shadow-sm">
                  <div className="mb-2 sm:mb-0">
                    <span className="font-medium text-gray-700">{chunk.name}</span>
                    <audio controls src={chunk.url} className="w-full sm:w-auto mt-1 sm:mt-0" aria-label={`Audio cho ${chunk.name}`}/>
                  </div>
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = chunk.url;
                      const fileExtension = chunk.blob.type.split('/')[1] || 'mp3';
                      const safeChunkName = `doan_${index + 1}_${textToSpeak.substring(0,20).replace(/[^a-zA-Z0-9]/g, '_')}`;
                      a.download = `${safeChunkName}.${fileExtension}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 w-full sm:w-auto"
                  >
                    Tải {chunk.name.replace(" / ", "/")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default TtsModule;
