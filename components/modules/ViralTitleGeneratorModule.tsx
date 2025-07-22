import React from 'react'; 
import { ApiSettings, ViralTitleGeneratorModuleState, ViralTitleGeneratorActiveTabType, GroundingChunk } from '../../types';
import { HOOK_LANGUAGE_OPTIONS, VARIATION_GOAL_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';

interface ViralTitleGeneratorModuleProps {
  apiSettings: ApiSettings;
  moduleState: ViralTitleGeneratorModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<ViralTitleGeneratorModuleState>>;
}

const ViralTitleGeneratorModule: React.FC<ViralTitleGeneratorModuleProps> = ({ apiSettings, moduleState, setModuleState }) => {
  const {
    activeTab, resultText, outputLanguage, loadingMessage, error,
    // Tab: Generate Variations
    baseTitle, fixedPrefix, numVariations, viralKeywords, variationGoal, newContextTheme, generateVariationsExplanation,
    // Tab: Series Analysis & Generation
    existingViralTitles, numNewSeriesTitles,
    // Tab: Script to Title
    scriptContent, channelViralTitles, numSuggestions,
    // Tab: Analyze Trend
    analyzeInputType, analyzeUrls, analyzeTitles, analyzeChannelTheme,
    analysisReport, viralFormulas, applicationSuggestions,
    analyzeLoadingMessage, analyzeError, groundingSourcesAnalysis
  } = moduleState;

  const updateState = (updates: Partial<ViralTitleGeneratorModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const generateText = async (prompt: string, systemInstruction?: string, useSearch?: boolean) => {
    const request = {
      prompt,
      provider: apiSettings?.provider || 'gemini',
      model: apiSettings?.model,
      temperature: apiSettings?.temperature,
      maxTokens: apiSettings?.maxTokens,
      useSearch
    };

    const result = await generateTextViaBackend(request, (newCredit) => {
      // Update credit if needed
    });

    if (!result.success) {
      throw new Error(result.error || 'AI generation failed');
    }

    return { text: result.text || '' };
  };

  const generateTextWithJsonOutput = async <T,>(prompt: string, systemInstruction?: string, useSearch?: boolean): Promise<T> => {
    const request = {
      prompt,
      provider: apiSettings?.provider || 'gemini',
      model: apiSettings?.model,
      temperature: apiSettings?.temperature,
      maxTokens: apiSettings?.maxTokens,
      useSearch
    };

    const result = await generateTextViaBackend(request, (newCredit) => {
      // Update credit if needed
    });

    if (!result.success) {
      throw new Error(result.error || 'AI generation failed');
    }

    try {
      return JSON.parse(result.text || '{}');
    } catch (e) {
      throw new Error('Failed to parse JSON response');
    }
  };

  const handleGenerateVariations = async () => {
    if (!baseTitle.trim()) {
      updateState({ error: 'Vui lòng nhập tiêu đề gốc.' });
      return;
    }
    
    updateState({ error: null, resultText: '', loadingMessage: 'Đang tạo biến thể tiêu đề...' });
    
    const selectedOutputLangLabel = outputLanguage;
    
    try {
      let prompt = `Create ${numVariations} viral title variations based on this title: "${baseTitle}".`;
      
      if (fixedPrefix.trim()) {
        prompt += ` Each variation MUST start with: "${fixedPrefix.trim()}"`;
      }
      
      if (viralKeywords.trim()) {
        prompt += ` Include these keywords: ${viralKeywords}`;
      }
      
      if (variationGoal && variationGoal !== 'general') {
        const goalDescriptions = {
          'hook_stronger': 'Make the hook more compelling and attention-grabbing',
          'emotional_impact': 'Increase emotional impact and relatability',
          'curiosity_gap': 'Create stronger curiosity gaps',
          'urgency_scarcity': 'Add urgency or scarcity elements'
        };
        prompt += ` Focus on: ${goalDescriptions[variationGoal as keyof typeof goalDescriptions] || variationGoal}`;
      }
      
      if (newContextTheme.trim()) {
        prompt += ` Adapt to this context/theme: ${newContextTheme}`;
      }
      
      prompt += ` Output in ${selectedOutputLangLabel}. Number each variation (1, 2, 3, etc.).`;
      
      const result = await generateText(prompt);
      updateState({ 
        resultText: result.text.trim(), 
        loadingMessage: 'Hoàn thành!' 
      });
    } catch (e) {
      updateState({ 
        error: `Lỗi: ${(e as Error).message}`, 
        loadingMessage: 'Lỗi!' 
      });
    } finally {
      setTimeout(() => updateState({ loadingMessage: null }), 3000);
    }
  };

  const handleGenerateSeriesTitles = async () => {
    if (!existingViralTitles.trim()) {
      updateState({ error: 'Vui lòng nhập danh sách tiêu đề viral hiện có.' });
      return;
    }
    
    updateState({ error: null, resultText: '', loadingMessage: 'Đang phân tích và tạo tiêu đề series...' });
    
    const selectedOutputLangLabel = outputLanguage;
    
    try {
      const prompt = `Analyze these viral titles and create ${numNewSeriesTitles} new titles in the same style:

Existing titles:
${existingViralTitles}

Create ${numNewSeriesTitles} new titles that:
1. Match the viral patterns and style
2. Are in ${selectedOutputLangLabel}
3. Follow similar structure and hooks
4. Are numbered (1, 2, 3, etc.)`;

      const result = await generateText(prompt);
      updateState({ 
        resultText: result.text.trim(), 
        loadingMessage: 'Hoàn thành!' 
      });
    } catch (e) {
      updateState({ 
        error: `Lỗi: ${(e as Error).message}`, 
        loadingMessage: 'Lỗi!' 
      });
    } finally {
      setTimeout(() => updateState({ loadingMessage: null }), 3000);
    }
  };

  const handleScriptToTitle = async () => {
    if (!scriptContent.trim()) {
      updateState({ error: 'Vui lòng nhập nội dung kịch bản.' });
      return;
    }
    
    updateState({ error: null, resultText: '', loadingMessage: 'Đang tạo tiêu đề từ kịch bản...' });
    
    const selectedOutputLangLabel = outputLanguage;
    
    try {
      let prompt = `Based on this script content, suggest ${numSuggestions} viral titles:

Script:
${scriptContent}

Generate ${numSuggestions} titles that:
1. Capture the main theme/hook of the content
2. Are viral and attention-grabbing
3. Are in ${selectedOutputLangLabel}
4. Are numbered (1, 2, 3, etc.)`;

      if (channelViralTitles.trim()) {
        prompt += `\n\nReference style from these channel titles:\n${channelViralTitles}`;
      }

      const result = await generateText(prompt);
      updateState({ 
        resultText: result.text.trim(), 
        loadingMessage: 'Hoàn thành!' 
      });
    } catch (e) {
      updateState({ 
        error: `Lỗi: ${(e as Error).message}`, 
        loadingMessage: 'Lỗi!' 
      });
    } finally {
      setTimeout(() => updateState({ loadingMessage: null }), 3000);
    }
  };

  const handleAnalyzeTrend = async () => {
    const inputData = analyzeInputType === 'urls' ? analyzeUrls : analyzeTitles;
    
    if (!inputData.trim()) {
      updateState({ analyzeError: analyzeInputType === 'urls' ? 'Vui lòng nhập URLs cần phân tích.' : 'Vui lòng nhập tiêu đề cần phân tích.' });
      return;
    }
    
    updateState({ 
      analyzeError: null, 
      analysisReport: '', 
      viralFormulas: '', 
      applicationSuggestions: '',
      analyzeLoadingMessage: 'Đang phân tích xu hướng viral...', 
      groundingSourcesAnalysis: [] 
    });
    
    const selectedOutputLangLabel = outputLanguage;
    
    try {
      let prompt = `Analyze viral patterns from this data and provide insights in ${selectedOutputLangLabel}:

${analyzeInputType === 'urls' ? 'URLs to analyze:' : 'Titles to analyze:'}
${inputData}`;

      if (analyzeChannelTheme.trim()) {
        prompt += `\n\nChannel theme/niche: ${analyzeChannelTheme}`;
      }

      prompt += `\n\nProvide:
1. Trend analysis and patterns
2. Viral formulas identified  
3. Application suggestions`;

      const result = await generateText(prompt, undefined, true); // Enable search for trend analysis
      
      updateState({ 
        analysisReport: result.text.trim(),
        analyzeLoadingMessage: 'Hoàn thành!' 
      });
    } catch (e) {
      updateState({ 
        analyzeError: `Lỗi: ${(e as Error).message}`, 
        analyzeLoadingMessage: 'Lỗi!' 
      });
    } finally {
      setTimeout(() => updateState({ analyzeLoadingMessage: null }), 3000);
    }
  };

  const renderGenerateTab = () => (
    <div className="space-y-6">
      <InfoBox>
        <strong>Tạo Biến Thể.</strong> Nhập tiêu đề gốc để tạo ra nhiều phiên bản viral khác nhau.
      </InfoBox>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="baseTitle" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề gốc:</label>
          <input
            type="text"
            id="baseTitle"
            value={baseTitle}
            onChange={e => updateState({ baseTitle: e.target.value })}
            className="w-full p-3 border-2 border-gray-300 rounded-lg"
            placeholder="Nhập tiêu đề cần tạo biến thể..."
          />
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fixedPrefix" className="block text-sm font-medium text-gray-700 mb-1">Tiền tố cố định (tùy chọn):</label>
            <input
              type="text"
              id="fixedPrefix"
              value={fixedPrefix}
              onChange={e => updateState({ fixedPrefix: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="VD: Tại sao..."
            />
          </div>
          
          <div>
            <label htmlFor="numVariations" className="block text-sm font-medium text-gray-700 mb-1">Số lượng biến thể:</label>
            <input
              type="number"
              id="numVariations"
              value={numVariations}
              onChange={e => updateState({ numVariations: parseInt(e.target.value) || 5 })}
              min="1"
              max="20"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="viralKeywords" className="block text-sm font-medium text-gray-700 mb-1">Từ khóa viral (tùy chọn):</label>
          <input
            type="text"
            id="viralKeywords"
            value={viralKeywords}
            onChange={e => updateState({ viralKeywords: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Từ khóa cần đưa vào tiêu đề..."
          />
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="variationGoal" className="block text-sm font-medium text-gray-700 mb-1">Mục tiêu biến thể:</label>
            <select
              id="variationGoal"
              value={variationGoal}
              onChange={e => updateState({ variationGoal: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {VARIATION_GOAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="outputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
            <select
              id="outputLanguage"
              value={outputLanguage}
              onChange={e => updateState({ outputLanguage: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {HOOK_LANGUAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div>
          <label htmlFor="newContextTheme" className="block text-sm font-medium text-gray-700 mb-1">Chủ đề/bối cảnh mới (tùy chọn):</label>
          <input
            type="text"
            id="newContextTheme"
            value={newContextTheme}
            onChange={e => updateState({ newContextTheme: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Thay đổi bối cảnh của tiêu đề..."
          />
        </div>
      </div>
      
      <button
        onClick={handleGenerateVariations}
        disabled={!baseTitle.trim()}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50"
      >
        Tạo Biến Thể
      </button>
    </div>
  );

  const renderSeriesTab = () => (
    <div className="space-y-6">
      <InfoBox>
        <strong>Phân Tích Series.</strong> Phân tích các tiêu đề viral hiện có để tạo ra những tiêu đề mới cùng phong cách.
      </InfoBox>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="existingViralTitles" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề viral hiện có:</label>
          <textarea
            id="existingViralTitles"
            value={existingViralTitles}
            onChange={e => updateState({ existingViralTitles: e.target.value })}
            rows={6}
            className="w-full p-3 border-2 border-gray-300 rounded-lg"
            placeholder="Nhập danh sách các tiêu đề viral (mỗi tiêu đề một dòng)..."
          />
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="numNewSeriesTitles" className="block text-sm font-medium text-gray-700 mb-1">Số tiêu đề mới:</label>
            <input
              type="number"
              id="numNewSeriesTitles"
              value={numNewSeriesTitles}
              onChange={e => updateState({ numNewSeriesTitles: parseInt(e.target.value) || 3 })}
              min="1"
              max="20"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="outputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
            <select
              id="outputLanguage"
              value={outputLanguage}
              onChange={e => updateState({ outputLanguage: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {HOOK_LANGUAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <button
        onClick={handleGenerateSeriesTitles}
        disabled={!existingViralTitles.trim()}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50"
      >
        Tạo Tiêu Đề Series
      </button>
    </div>
  );

  const renderScriptTab = () => (
    <div className="space-y-6">
      <InfoBox>
        <strong>Từ Kịch Bản Ra Tiêu Đề.</strong> Tạo tiêu đề viral dựa trên nội dung kịch bản của bạn.
      </InfoBox>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="scriptContent" className="block text-sm font-medium text-gray-700 mb-1">Nội dung kịch bản:</label>
          <textarea
            id="scriptContent"
            value={scriptContent}
            onChange={e => updateState({ scriptContent: e.target.value })}
            rows={6}
            className="w-full p-3 border-2 border-gray-300 rounded-lg"
            placeholder="Nhập nội dung kịch bản..."
          />
        </div>
        
        <div>
          <label htmlFor="channelViralTitles" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề viral tham khảo (tùy chọn):</label>
          <textarea
            id="channelViralTitles"
            value={channelViralTitles}
            onChange={e => updateState({ channelViralTitles: e.target.value })}
            rows={4}
            className="w-full p-3 border-2 border-gray-300 rounded-lg"
            placeholder="Các tiêu đề viral của kênh để tham khảo phong cách..."
          />
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="numSuggestions" className="block text-sm font-medium text-gray-700 mb-1">Số gợi ý:</label>
            <input
              type="number"
              id="numSuggestions"
              value={numSuggestions}
              onChange={e => updateState({ numSuggestions: parseInt(e.target.value) || 5 })}
              min="1"
              max="20"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="outputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
            <select
              id="outputLanguage"
              value={outputLanguage}
              onChange={e => updateState({ outputLanguage: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {HOOK_LANGUAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <button
        onClick={handleScriptToTitle}
        disabled={!scriptContent.trim()}
        className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50"
      >
        Tạo Gợi Ý Tiêu Đề
      </button>
    </div>
  );

  const renderAnalyzeTrendTab = () => (
    <div className="space-y-6">
      <InfoBox>
        <strong>Phân Tích Xu Hướng.</strong> Phân tích URLs hoặc tiêu đề để tìm ra các pattern viral.
      </InfoBox>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Loại dữ liệu phân tích:</p>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="analyzeInputType"
                value="urls"
                checked={analyzeInputType === 'urls'}
                onChange={e => updateState({ analyzeInputType: e.target.value as 'urls' | 'titles' })}
                className="mr-2"
              />
              URLs của video/bài viết
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="analyzeInputType"
                value="titles"
                checked={analyzeInputType === 'titles'}
                onChange={e => updateState({ analyzeInputType: e.target.value as 'urls' | 'titles' })}
                className="mr-2"
              />
              Danh sách tiêu đề
            </label>
          </div>
        </div>
        
        <div>
          <label htmlFor="analyzeData" className="block text-sm font-medium text-gray-700 mb-1">
            {analyzeInputType === 'urls' ? 'URLs cần phân tích:' : 'Tiêu đề cần phân tích:'}
          </label>
          <textarea
            id="analyzeData"
            value={analyzeInputType === 'urls' ? analyzeUrls : analyzeTitles}
            onChange={e => updateState(analyzeInputType === 'urls' 
              ? { analyzeUrls: e.target.value } 
              : { analyzeTitles: e.target.value }
            )}
            rows={6}
            className="w-full p-3 border-2 border-gray-300 rounded-lg"
            placeholder={analyzeInputType === 'urls' 
              ? "Nhập URLs (mỗi URL một dòng)..." 
              : "Nhập tiêu đề (mỗi tiêu đề một dòng)..."
            }
          />
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="analyzeChannelTheme" className="block text-sm font-medium text-gray-700 mb-1">Chủ đề/ngách kênh (tùy chọn):</label>
            <input
              type="text"
              id="analyzeChannelTheme"
              value={analyzeChannelTheme}
              onChange={e => updateState({ analyzeChannelTheme: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="VD: Tài chính cá nhân, Công nghệ..."
            />
          </div>
          
          <div>
            <label htmlFor="outputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
            <select
              id="outputLanguage"
              value={outputLanguage}
              onChange={e => updateState({ outputLanguage: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {HOOK_LANGUAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <button
        onClick={handleAnalyzeTrend}
        disabled={!(analyzeInputType === 'urls' ? analyzeUrls.trim() : analyzeTitles.trim())}
        className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50"
      >
        Phân Tích Xu Hướng
      </button>
    </div>
  );

  const tabs: { id: ViralTitleGeneratorActiveTabType; label: string; component: () => JSX.Element }[] = [
    { id: 'generate', label: 'Tạo Biến Thể', component: renderGenerateTab },
    { id: 'series', label: 'Series Analysis', component: renderSeriesTab },
    { id: 'script', label: 'Script → Title', component: renderScriptTab },
    { id: 'analyzeTrend', label: 'Phân Tích Trend', component: renderAnalyzeTrendTab }
  ];

  return (
    <ModuleContainer title="🚀 Tạo Tiêu Đề Viral">
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => updateState({ activeTab: tab.id })}
              className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tabs.find(tab => tab.id === activeTab)?.component()}

        {/* Loading State */}
        {(loadingMessage || analyzeLoadingMessage) && (
          <LoadingSpinner message={loadingMessage || analyzeLoadingMessage || 'Đang xử lý...'} />
        )}

        {/* Error States */}
        {error && <ErrorAlert message={error} />}
        {analyzeError && <ErrorAlert message={analyzeError} />}

        {/* Results */}
        {resultText && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-2">Kết quả:</h3>
            <div className="whitespace-pre-wrap">{resultText}</div>
          </div>
        )}

        {analysisReport && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-2">Báo cáo phân tích:</h3>
            <div className="whitespace-pre-wrap">{analysisReport}</div>
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default ViralTitleGeneratorModule;