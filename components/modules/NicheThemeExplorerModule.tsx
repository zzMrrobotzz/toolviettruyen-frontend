
import React from 'react';
import { 
    NicheThemeExplorerModuleState, 
    NicheThemeAnalysisResult 
} from '../../types';
import { HOOK_LANGUAGE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { useAppContext } from '../../AppContext';

interface NicheThemeExplorerModuleProps {
  moduleState: NicheThemeExplorerModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<NicheThemeExplorerModuleState>>;
}

const NicheThemeExplorerModule: React.FC<NicheThemeExplorerModuleProps> = ({ 
    moduleState, setModuleState 
}) => {
  const { consumeCredit } = useAppContext(); // Use context
  const {
    inputTitles, inputLanguage, outputLanguage, numNichesToSuggest,
    analysisResults, isLoading, error, progressMessage
  } = moduleState;

  const updateState = (updates: Partial<NicheThemeExplorerModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const generateJsonViaBackend = async <T,>(prompt: string): Promise<T> => {
    const result = await generateTextViaBackend({
      prompt,
      provider: 'gemini',
      systemInstruction: 'You are a helpful assistant that returns valid JSON.',
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate content');
    }
    
    try {
      return JSON.parse(result.text) as T;
    } catch (e) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error('Invalid JSON response from backend');
    }
  };

  const handleAnalyzeAndExploreNiches = async () => {
    if (!inputTitles.trim()) {
      updateState({ error: 'Vui lòng nhập danh sách các tiêu đề video.' });
      return;
    }

    const hasCredits = await consumeCredit(1);
    if (!hasCredits) {
      updateState({ error: 'Không đủ credit để phân tích ngách chủ đề.', isLoading: false });
      return;
    }

    updateState({ 
        isLoading: true, 
        error: null, 
        progressMessage: 'Đang phân tích tiêu đề và khám phá ngách chủ đề...', 
        analysisResults: [] 
    });

    const selectedInputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === inputLanguage)?.label || inputLanguage;
    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;

    const prompt = `
You are an AI expert in content strategy and niche theme identification.
Based on the list of video titles provided in ${selectedInputLangLabel}, your task is to analyze them and suggest ${numNichesToSuggest} distinct niche story themes.
All your output, including niche names, descriptions, reasoning, content suggestions, and keywords, MUST be in ${selectedOutputLangLabel}.

Input Video Titles (in ${selectedInputLangLabel}):
---
${inputTitles.trim()}
---

For each suggested niche, provide the following information in a JSON object:
- "nicheName": A concise name for the niche theme (in ${selectedOutputLangLabel}).
- "nicheDescription": A detailed description of the niche, including its core essence, potential target audience, and key emotional or dramatic elements (in ${selectedOutputLangLabel}).
- "reasoning": An explanation of why this niche was identified from the input titles, highlighting common patterns, keywords, or sentiments observed (in ${selectedOutputLangLabel}).
- "contentSuggestions": An array of 2-3 example video/story ideas that fit this niche (strings, in ${selectedOutputLangLabel}).
- "relatedKeywords": An array of 3-5 relevant keywords for this niche (strings, in ${selectedOutputLangLabel}).

Return your entire response as a single JSON array, where each element of the array is an object structured as described above.
Example of one element in the array (ensure all text content within is in ${selectedOutputLangLabel}):
{
  "nicheName": "Tên Ngách Mẫu bằng ${selectedOutputLangLabel}",
  "nicheDescription": "Mô tả chi tiết bằng ${selectedOutputLangLabel}...",
  "reasoning": "Lý do dựa trên tiêu đề bằng ${selectedOutputLangLabel}...",
  "contentSuggestions": ["Gợi ý 1 bằng ${selectedOutputLangLabel}", "Gợi ý 2 bằng ${selectedOutputLangLabel}"],
  "relatedKeywords": ["Từ khóa A bằng ${selectedOutputLangLabel}", "Từ khóa B bằng ${selectedOutputLangLabel}"]
}

Ensure the output is ONLY the JSON array. Do not include any introductory text, explanations, or markdown backticks around the JSON itself.
    `;

    try {
      const resultsArray = await generateJsonViaBackend<NicheThemeAnalysisResult[]>(prompt);
      if (Array.isArray(resultsArray)) {
        updateState({ 
            analysisResults: resultsArray, 
            isLoading: false, 
            progressMessage: `Phân tích hoàn tất! Đã tìm thấy ${resultsArray.length} ngách chủ đề.`, 
            error: null 
        });
      } else {
        throw new Error("Kết quả trả về không phải là một mảng các ngách chủ đề.");
      }
    } catch (e) {
      updateState({ 
          error: `Lỗi khi phân tích: ${(e as Error).message}`, 
          isLoading: false, 
          progressMessage: 'Đã xảy ra lỗi.' 
      });
    } finally {
        setTimeout(() => {
            setModuleState(prev => 
                (prev.progressMessage?.includes("hoàn tất") || prev.progressMessage?.includes("lỗi")) 
                ? {...prev, progressMessage: null} 
                : prev
            )
        }, 5000);
    }
  };

  return (
    <ModuleContainer title="🔍 Xoáy Và Mở Rộng Chủ Đề">
      <InfoBox>
        <p><strong>💡 Hướng dẫn:</strong></p>
        <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-sm">
          <li>Nhập một danh sách các tiêu đề video (mỗi tiêu đề một dòng). Đây có thể là tiêu đề từ các video thành công hoặc các video bạn thấy thú vị.</li>
          <li>Chọn ngôn ngữ của các tiêu đề bạn vừa nhập.</li>
          <li>Chọn ngôn ngữ bạn muốn AI trả về kết quả phân tích.</li>
          <li>Chọn số lượng ngách chủ đề bạn muốn AI gợi ý.</li>
          <li>Nhấn "Phân Tích & Khám Phá Ngách". AI sẽ phân tích và đề xuất các ngách chủ đề tiềm năng.</li>
        </ul>
      </InfoBox>

      <div className="space-y-6 mt-6">
        <div>
          <label htmlFor="nteInputTitles" className="block text-sm font-medium text-gray-700 mb-1">
            Danh sách Tiêu đề Video (mỗi tiêu đề một dòng):
          </label>
          <textarea
            id="nteInputTitles"
            value={inputTitles}
            onChange={(e) => updateState({ inputTitles: e.target.value })}
            rows={8}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Ví dụ:\nChồng Giấu Quỹ Đen Nuôi Bồ Nhí Và Cái Kết\nMẹ Chồng Độc Ác Hãm Hại Con Dâu\nBí Mật Động Trời Của Gia Đình Bị Phanh Phui"
            disabled={isLoading}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label htmlFor="nteInputLanguage" className="block text-sm font-medium text-gray-700 mb-1">
              Ngôn ngữ của Tiêu đề Đầu vào:
            </label>
            <select
              id="nteInputLanguage"
              value={inputLanguage}
              onChange={(e) => updateState({ inputLanguage: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="nteOutputLanguage" className="block text-sm font-medium text-gray-700 mb-1">
              Ngôn ngữ Kết quả Phân tích:
            </label>
            <select
              id="nteOutputLanguage"
              value={outputLanguage}
              onChange={(e) => updateState({ outputLanguage: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="nteNumNiches" className="block text-sm font-medium text-gray-700 mb-1">
              Số lượng Ngách Gợi ý (1-5):
            </label>
            <input
              type="number"
              id="nteNumNiches"
              value={numNichesToSuggest}
              onChange={(e) => updateState({ numNichesToSuggest: Math.max(1, Math.min(5, parseInt(e.target.value))) })}
              min="1"
              max="5"
              className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            />
          </div>
        </div>

        <button
          onClick={handleAnalyzeAndExploreNiches}
          disabled={isLoading || !inputTitles.trim()}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Phân Tích & Khám Phá Ngách
        </button>

        {isLoading && progressMessage && <LoadingSpinner message={progressMessage} />}
        {!isLoading && progressMessage && <p className={`text-center font-medium my-3 ${progressMessage.includes("Lỗi") ? 'text-red-600' : 'text-green-600'}`}>{progressMessage}</p>}
        {error && <ErrorAlert message={error} />}

        {analysisResults.length > 0 && !isLoading && (
          <div className="mt-8 space-y-6">
            <h3 className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-4">
              Kết Quả Khám Phá Ngách Chủ Đề ({analysisResults.length} ngách)
            </h3>
            {analysisResults.map((result, index) => (
              <details key={index} className="p-6 border-2 border-indigo-200 rounded-xl bg-indigo-50 shadow-lg group" open={analysisResults.length === 1 || index === 0}>
                <summary className="font-bold text-xl text-indigo-700 cursor-pointer group-hover:text-indigo-900 transition-colors">
                  Ngách #{index + 1}: {result.nicheName}
                </summary>
                <div className="mt-4 space-y-3 text-gray-700">
                  <div>
                    <h4 className="font-semibold text-md text-indigo-600 mb-1">📜 Mô tả Ngách:</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-md border border-indigo-100">{result.nicheDescription}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-md text-indigo-600 mb-1">🔍 Lý do Đề xuất (Dựa trên phân tích tiêu đề):</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-md border border-indigo-100">{result.reasoning}</p>
                  </div>
                  {result.contentSuggestions && result.contentSuggestions.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-md text-indigo-600 mb-1">💡 Gợi ý Phát triển Nội dung:</h4>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-sm bg-white p-3 rounded-md border border-indigo-100">
                        {result.contentSuggestions.map((suggestion, sIdx) => (
                          <li key={sIdx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.relatedKeywords && result.relatedKeywords.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-md text-indigo-600 mb-1">🔑 Từ khóa Liên quan:</h4>
                      <div className="flex flex-wrap gap-2 text-sm bg-white p-3 rounded-md border border-indigo-100">
                        {result.relatedKeywords.map((keyword, kIdx) => (
                          <span key={kIdx} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">{keyword}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default NicheThemeExplorerModule;
