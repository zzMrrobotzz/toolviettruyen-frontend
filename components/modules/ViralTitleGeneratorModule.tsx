
import React from 'react'; 
import { ApiSettings, ViralTitleGeneratorModuleState, ViralTitleGeneratorActiveTabType, GroundingChunk } from '../../types';
import { HOOK_LANGUAGE_OPTIONS, VARIATION_GOAL_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { useAppContext } from '../../AppContext';

interface ViralTitleGeneratorModuleProps {
  moduleState: ViralTitleGeneratorModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<ViralTitleGeneratorModuleState>>;
}

const ViralTitleGeneratorModule: React.FC<ViralTitleGeneratorModuleProps> = ({ moduleState, setModuleState }) => {
  const { apiSettings } = useAppContext(); // Use context
  const {
    activeTab, resultText, outputLanguage, loadingMessage, error,
    // Generate Variations Tab
    baseTitle, fixedPrefix, numVariations, viralKeywords, variationGoal, newContextTheme, generateVariationsExplanation,
    // Series Tab
    existingViralTitles, numNewSeriesTitles,
    // Script Tab
    scriptContent, channelViralTitles, numSuggestions,
    // Analyze Trend Tab
    analyzeInputType, analyzeUrls, analyzeTitles, analyzeChannelTheme,
    analysisReport, viralFormulas, applicationSuggestions,
    analyzeLoadingMessage, analyzeError, groundingSourcesAnalysis
  } = moduleState;

  const updateState = (updates: Partial<ViralTitleGeneratorModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const getSelectedLanguageLabel = () => HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
  const geminiApiKeyForService = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;

  const handleSubmit = async () => {
    let currentLoadingMessageGeneral = "Đang xử lý yêu cầu...";
    if (activeTab === 'generate') currentLoadingMessageGeneral = "Đang tạo biến thể tiêu đề...";
    else if (activeTab === 'series') currentLoadingMessageGeneral = "Đang phân tích & tạo tiêu đề series...";
    else if (activeTab === 'script') currentLoadingMessageGeneral = "Đang gợi ý tiêu đề từ kịch bản...";

    updateState({ error: null, resultText: '', loadingMessage: currentLoadingMessageGeneral });
    
    let prompt = '';
    const langLabel = getSelectedLanguageLabel();
    let actionCompletedMessage = "Hoàn thành!";
    let actionErrorMessage = "Lỗi!";

    try {
      if (activeTab === 'generate') {
        if (!baseTitle.trim()) {
            updateState({ error: 'Vui lòng nhập Tiêu đề Cơ sở.', loadingMessage: null });
            return;
        }
        const selectedVariationGoalLabel = VARIATION_GOAL_OPTIONS.find(opt => opt.value === variationGoal)?.label || "Mặc định";
        
        prompt = `Bạn là chuyên gia tạo tiêu đề video viral. Hãy tạo ${numVariations} biến thể tiêu đề hấp dẫn dựa trên thông tin sau. Các tiêu đề phải được viết bằng ngôn ngữ ${langLabel}.
        - Tiêu đề Cơ sở: "${baseTitle}"
        - Tiền tố Cố định (nếu có, thêm vào đầu mỗi biến thể): "${fixedPrefix || 'Không có'}"
        - Từ khóa/Chủ đề Viral cần nhấn mạnh (nếu có): "${viralKeywords || 'Không có'}"
        - Mục tiêu Biến tấu: "${selectedVariationGoalLabel}". Hãy ưu tiên mục tiêu này.
        - Ngữ cảnh/Chủ đề Mới (nếu có, AI sẽ cố gắng "xoáy" tiêu đề gốc sang chủ đề này nhưng giữ "gen" viral): "${newContextTheme || 'Không có'}"
        
        Yêu cầu: 
        1. Trả về danh sách các biến thể, mỗi biến thể trên một dòng, có đánh số.
        2. Sau danh sách, thêm một dòng giải thích ngắn gọn về cách bạn đã áp dụng "Mục tiêu Biến tấu" và "Ngữ cảnh/Chủ đề Mới" (nếu có) trong quá trình tạo các biến thể. Đặt phần giải thích này trong cặp thẻ [EXPLANATION]...[/EXPLANATION]. Ví dụ: [EXPLANATION]Tôi đã tập trung vào việc tăng tính tò mò bằng cách đặt câu hỏi và sử dụng từ ngữ bí ẩn, đồng thời lồng ghép chủ đề "du lịch vũ trụ" vào các gợi ý.[/EXPLANATION]`;
        actionCompletedMessage = "Tạo biến thể hoàn tất!";
        actionErrorMessage = "Lỗi tạo biến thể.";

      } else if (activeTab === 'series') {
        if (!existingViralTitles.trim()) {
            updateState({ error: 'Vui lòng nhập Danh sách Tiêu đề Viral Hiện có.', loadingMessage: null });
            return;
        }
        prompt = `Bạn là chuyên gia phân tích và sáng tạo tiêu đề series. 
        Đầu tiên, hãy phân tích các tiêu đề viral hiện có sau đây để nắm bắt phong cách, giọng điệu, và các yếu tố thu hút của chúng:\n"${existingViralTitles}"
        Sau đó, dựa trên phân tích đó, hãy tạo ra ${numNewSeriesTitles} tiêu đề mới cho một series tiếp theo, duy trì phong cách và sự hấp dẫn tương tự. Các tiêu đề mới phải được viết bằng ngôn ngữ ${langLabel}.
        Yêu cầu: Trả về danh sách các tiêu đề mới, mỗi tiêu đề trên một dòng, có đánh số.`;
        actionCompletedMessage = "Phân tích & tạo series hoàn tất!";
        actionErrorMessage = "Lỗi tạo series.";
      } else if (activeTab === 'script') {
        if (!scriptContent.trim()) {
            updateState({ error: 'Vui lòng nhập Kịch bản hoặc Tóm tắt truyện.', loadingMessage: null });
            return;
        }
        prompt = `Bạn là một nhà biên kịch và chuyên gia đặt tiêu đề. Hãy đọc kỹ kịch bản/tóm tắt truyện dưới đây.
        Kịch bản/Tóm tắt: "${scriptContent}"
        ${channelViralTitles.trim() ? `Tham khảo thêm các tiêu đề viral của kênh này để học phong cách (nếu có):\n"${channelViralTitles}"` : ''}
        Dựa vào nội dung và phong cách (nếu có), hãy gợi ý ${numSuggestions} tiêu đề video hấp dẫn, có khả năng viral cao. Các tiêu đề gợi ý phải được viết bằng ngôn ngữ ${langLabel}.
        Yêu cầu: Trả về danh sách các tiêu đề gợi ý, mỗi tiêu đề trên một dòng, có đánh số.`;
        actionCompletedMessage = "Gợi ý tiêu đề hoàn tất!";
        actionErrorMessage = "Lỗi gợi ý tiêu đề.";
      }

      if (prompt) {
        const result = await generateText(prompt, undefined, false, geminiApiKeyForService);
        let mainResultText = result.text;
        let explanationText = null;

        if (activeTab === 'generate') {
            const explanationMatch = result.text.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
            if (explanationMatch && explanationMatch[1]) {
                explanationText = explanationMatch[1].trim();
                mainResultText = result.text.replace(explanationMatch[0], '').trim();
            }
        }
        updateState({ resultText: mainResultText, generateVariationsExplanation: explanationText, loadingMessage: actionCompletedMessage });
      } else {
        updateState({ error: 'Không thể xác định hành động cho tab hiện tại.', loadingMessage: null });
      }
    } catch (e) {
      updateState({ error: `Đã xảy ra lỗi: ${(e as Error).message}`, loadingMessage: actionErrorMessage });
    } finally {
      setTimeout(() => {
        setModuleState(prev => 
          (prev.loadingMessage === actionCompletedMessage || prev.loadingMessage === actionErrorMessage) 
          ? {...prev, loadingMessage: null} 
          : prev
        )
      }, 3000);
    }
  };
  
  const handleAnalyzeTrend = async () => {
    if (analyzeInputType === 'urls' && !analyzeUrls.trim()) {
        updateState({ analyzeError: 'Vui lòng nhập ít nhất một URL video YouTube.', analyzeLoadingMessage: null });
        return;
    }
    if (analyzeInputType === 'titles' && !analyzeTitles.trim()) {
        updateState({ analyzeError: 'Vui lòng nhập ít nhất một tiêu đề viral.', analyzeLoadingMessage: null });
        return;
    }

    updateState({
        analyzeError: null,
        analysisReport: '',
        viralFormulas: '',
        applicationSuggestions: '',
        groundingSourcesAnalysis: [],
        analyzeLoadingMessage: 'Đang phân tích trend và đối thủ...'
    });

    const langLabel = getSelectedLanguageLabel();
    const inputData = analyzeInputType === 'urls' ? `URLs:\n${analyzeUrls}` : `Titles:\n${analyzeTitles}`;
    const channelThemeInfo = analyzeChannelTheme.trim() ? `\nChủ đề kênh người dùng (để tham khảo khi đưa ra gợi ý áp dụng): "${analyzeChannelTheme.trim()}"` : '';

    const prompt = `Bạn là một chuyên gia phân tích chiến lược nội dung YouTube và tiêu đề viral. 
Nhiệm vụ của bạn là phân tích sâu sắc các ${analyzeInputType === 'urls' ? 'video YouTube từ các URL được cung cấp' : 'tiêu đề video được cung cấp'} để xác định các yếu tố và công thức tạo nên sự viral. 
Sử dụng Google Search nếu đầu vào là URL để thu thập thông tin.
Ngôn ngữ đầu ra cho toàn bộ phân tích, công thức, và gợi ý phải là ${langLabel}.

Đầu vào:
---
${inputData}
---
${channelThemeInfo}

Yêu cầu phân tích và đầu ra (toàn bộ bằng ${langLabel}):
1.  **Báo cáo Phân tích Chi tiết (Đặt trong thẻ [ANALYSIS_REPORT_START]...[ANALYSIS_REPORT_END]):**
    *   Loại hình tiêu đề phổ biến (Câu hỏi, So sánh, Cảnh báo, Hướng dẫn, Kể chuyện, Top list, Thử thách, v.v.)
    *   Các yếu tố Cảm xúc chính được khai thác (Tò mò, Sợ hãi, Ngạc nhiên, Vui vẻ, Đồng cảm, Phẫn nộ, v.v.)
    *   Từ khóa Chính & Phụ nổi bật.
    *   Cấu trúc Ngữ pháp & Độ dài trung bình/hiệu quả.
    *   Việc sử dụng Con số, Ký tự đặc biệt, Emoji (nếu có và hiệu quả).
    *   Yếu tố Call to Action (ngầm hoặc rõ ràng).
    *   Nếu có nhiều tiêu đề/URL, so sánh điểm chung và điểm khác biệt nổi bật.
2.  **"Công thức Viral" Suy luận (Đặt trong thẻ [VIRAL_FORMULAS_START]...[/VIRAL_FORMULAS_END]):**
    *   Dựa trên phân tích, hãy suy luận và đưa ra 1-3 "công thức" hoặc "khuôn mẫu" tiêu đề mà bạn nhận thấy từ các ví dụ thành công.
    *   Ví dụ công thức: "[Con số] + [Tính từ Gây Sốc] + [Hành động] + [Kết quả Bất ngờ]" hoặc "Làm thế nào để [Đạt được điều gì đó] mà không cần [Khó khăn thường gặp]?".
3.  **Gợi ý Áp dụng (Đặt trong thẻ [APPLICATION_SUGGESTIONS_START]...[/APPLICATION_SUGGESTIONS_END]):**
    *   Gợi ý 2-3 cách cụ thể mà người dùng có thể áp dụng những "công thức viral" này cho kênh của họ (dựa trên ${analyzeChannelTheme.trim() ? `chủ đề kênh đã cung cấp: "${analyzeChannelTheme.trim()}"` : 'một chủ đề kể chuyện chung chung'}).

CHỈ TRẢ VỀ NỘI DUNG BÊN TRONG CÁC THẺ ĐÃ ĐỊNH NGHĨA. Ví dụ:
[ANALYSIS_REPORT_START]
Nội dung báo cáo...
[ANALYSIS_REPORT_END]
[VIRAL_FORMULAS_START]
Công thức 1: ...
Công thức 2: ...
[VIRAL_FORMULAS_END]
[APPLICATION_SUGGESTIONS_START]
Gợi ý 1: ...
Gợi ý 2: ...
[APPLICATION_SUGGESTIONS_END]
`;

    try {
        const result = await generateText(prompt, undefined, analyzeInputType === 'urls', geminiApiKeyForService);
        const text = result.text;
        const groundingChunks = result.groundingChunks || [];

        const reportMatch = text.match(/\[ANALYSIS_REPORT_START\]([\s\S]*?)\[ANALYSIS_REPORT_END\]/);
        const formulasMatch = text.match(/\[VIRAL_FORMULAS_START\]([\s\S]*?)\[VIRAL_FORMULAS_END\]/);
        const suggestionsMatch = text.match(/\[APPLICATION_SUGGESTIONS_START\]([\s\S]*?)\[APPLICATION_SUGGESTIONS_END\]/);

        updateState({
            analysisReport: reportMatch ? reportMatch[1].trim() : "Không tìm thấy báo cáo phân tích.",
            viralFormulas: formulasMatch ? formulasMatch[1].trim() : "Không tìm thấy công thức viral.",
            applicationSuggestions: suggestionsMatch ? suggestionsMatch[1].trim() : "Không tìm thấy gợi ý áp dụng.",
            groundingSourcesAnalysis: groundingChunks,
            analyzeLoadingMessage: "Phân tích trend và đối thủ hoàn tất!",
            analyzeError: null
        });

    } catch (e) {
        updateState({ analyzeError: `Lỗi khi phân tích trend: ${(e as Error).message}`, analyzeLoadingMessage: "Lỗi phân tích trend." });
    } finally {
      setTimeout(() => {
        setModuleState(prev => 
          (prev.analyzeLoadingMessage?.includes("hoàn tất") || prev.analyzeLoadingMessage?.includes("Lỗi")) 
          ? {...prev, analyzeLoadingMessage: null} 
          : prev
        )
      }, 3000);
    }
  };

  const isProcessingGeneral = loadingMessage && loadingMessage.startsWith("Đang");
  const isProcessingAnalyze = analyzeLoadingMessage && analyzeLoadingMessage.startsWith("Đang");


  const renderTabContent = () => {
    switch (activeTab) {
      case 'generate':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="baseTitle" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề Cơ sở (*):</label>
              <textarea id="baseTitle" value={baseTitle} onChange={(e) => updateState({ baseTitle: e.target.value })} rows={2} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: Chồng tôi và bí mật trong chiếc điện thoại" disabled={isProcessingGeneral || isProcessingAnalyze}></textarea>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fixedPrefix" className="block text-sm font-medium text-gray-700 mb-1">Tiền tố Cố định (Không bắt buộc):</label>
                <input type="text" id="fixedPrefix" value={fixedPrefix} onChange={(e) => updateState({ fixedPrefix: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: [TẬP X] - Câu Chuyện Đêm Khuya:" disabled={isProcessingGeneral || isProcessingAnalyze}/>
              </div>
              <div>
                <label htmlFor="numVariations" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Biến thể (1-20):</label>
                <input type="number" id="numVariations" value={numVariations} onChange={(e) => updateState({ numVariations: Math.max(1, Math.min(20, parseInt(e.target.value)))})} min="1" max="20" className="w-full p-2 border border-gray-300 rounded-md shadow-sm" disabled={isProcessingGeneral || isProcessingAnalyze}/>
              </div>
            </div>
            <div>
              <label htmlFor="viralKeywords" className="block text-sm font-medium text-gray-700 mb-1">Từ khóa/Chủ đề Viral (cách nhau bằng dấu phẩy - Không bắt buộc):</label>
              <input type="text" id="viralKeywords" value={viralKeywords} onChange={(e) => updateState({ viralKeywords: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: drama, ngoại tình, bất ngờ, trả thù" disabled={isProcessingGeneral || isProcessingAnalyze}/>
            </div>
            {/* New fields for generate tab */}
            <div>
              <label htmlFor="variationGoal" className="block text-sm font-medium text-gray-700 mb-1">Mục tiêu Biến tấu:</label>
              <select id="variationGoal" value={variationGoal} onChange={(e) => updateState({ variationGoal: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" disabled={isProcessingGeneral || isProcessingAnalyze}>
                {VARIATION_GOAL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="newContextTheme" className="block text-sm font-medium text-gray-700 mb-1">Ngữ cảnh/Chủ đề Mới (Tùy chọn - để "xoáy" tiêu đề):</label>
              <input type="text" id="newContextTheme" value={newContextTheme} onChange={(e) => updateState({ newContextTheme: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: chủ đề du lịch vũ trụ, cho lứa tuổi học sinh" disabled={isProcessingGeneral || isProcessingAnalyze}/>
            </div>
            <button onClick={handleSubmit} disabled={isProcessingGeneral || isProcessingAnalyze} className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
              Tạo Biến Thể
            </button>
             {generateVariationsExplanation && !isProcessingGeneral && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                    <p className="font-semibold text-green-700">Giải thích của AI về cách tạo biến thể:</p>
                    <p className="text-gray-600 mt-1 whitespace-pre-line">{generateVariationsExplanation}</p>
                </div>
            )}
          </div>
        );
      case 'series':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="existingViralTitles" className="block text-sm font-medium text-gray-700 mb-1">Danh sách Tiêu đề Viral Hiện có (mỗi tiêu đề một dòng, để AI học phong cách) (*):</label>
              <textarea id="existingViralTitles" value={existingViralTitles} onChange={(e) => updateState({ existingViralTitles: e.target.value })} rows={5} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ:\nCHỒNG TÔI NGOẠI TÌNH VỚI CÔ HÀNG XÓM VÀ CÁI KẾT\nCON DÂU BỊ MẸ CHỒNG HÃM HẠI VÀ MÀN TRẢ THÙ CỰC GẮT" disabled={isProcessingGeneral || isProcessingAnalyze}></textarea>
            </div>
            <div>
              <label htmlFor="numNewSeriesTitles" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Tiêu đề Series Mới (1-20):</label>
              <input type="number" id="numNewSeriesTitles" value={numNewSeriesTitles} onChange={(e) => updateState({ numNewSeriesTitles: Math.max(1, Math.min(20, parseInt(e.target.value)))})} min="1" max="20" className="w-full p-2 border border-gray-300 rounded-md shadow-sm" disabled={isProcessingGeneral || isProcessingAnalyze}/>
            </div>
            <button onClick={handleSubmit} disabled={isProcessingGeneral || isProcessingAnalyze} className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
              Phân Tích & Tạo Mới
            </button>
          </div>
        );
      case 'script':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="scriptContent" className="block text-sm font-medium text-gray-700 mb-1">Kịch bản hoặc Tóm tắt truyện (*):</label>
              <textarea id="scriptContent" value={scriptContent} onChange={(e) => updateState({ scriptContent: e.target.value })} rows={5} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Dán toàn bộ kịch bản hoặc tóm tắt chi tiết vào đây..." disabled={isProcessingGeneral || isProcessingAnalyze}></textarea>
            </div>
            <div>
              <label htmlFor="channelViralTitles" className="block text-sm font-medium text-gray-700 mb-1">Các Tiêu đề Viral của Kênh Bạn (mỗi tiêu đề một dòng, để AI học phong cách kênh - Không bắt buộc):</label>
              <textarea id="channelViralTitles" value={channelViralTitles} onChange={(e) => updateState({ channelViralTitles: e.target.value })} rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Cung cấp các tiêu đề thành công trên kênh của bạn để AI học theo phong cách..." disabled={isProcessingGeneral || isProcessingAnalyze}></textarea>
            </div>
            <div>
              <label htmlFor="numSuggestions" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Tiêu đề Gợi ý (1-10):</label>
              <input type="number" id="numSuggestions" value={numSuggestions} onChange={(e) => updateState({ numSuggestions: Math.max(1, Math.min(10, parseInt(e.target.value)))})} min="1" max="10" className="w-full p-2 border border-gray-300 rounded-md shadow-sm" disabled={isProcessingGeneral || isProcessingAnalyze}/>
            </div>
            <button onClick={handleSubmit} disabled={isProcessingGeneral || isProcessingAnalyze} className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
              Gợi ý Tiêu đề
            </button>
          </div>
        );
       case 'analyzeTrend':
        return (
          <div className="space-y-4">
            <div className="flex space-x-4 mb-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="analyzeInputType" value="urls" checked={analyzeInputType === 'urls'} onChange={() => updateState({ analyzeInputType: 'urls' })} className="form-radio text-indigo-600" disabled={isProcessingAnalyze || isProcessingGeneral}/>
                    <span className="text-sm font-medium text-gray-700">Phân tích từ URLs YouTube</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="analyzeInputType" value="titles" checked={analyzeInputType === 'titles'} onChange={() => updateState({ analyzeInputType: 'titles' })} className="form-radio text-indigo-600" disabled={isProcessingAnalyze || isProcessingGeneral}/>
                    <span className="text-sm font-medium text-gray-700">Phân tích từ Danh sách Tiêu đề</span>
                </label>
            </div>
            {analyzeInputType === 'urls' && (
                <div>
                    <label htmlFor="analyzeUrls" className="block text-sm font-medium text-gray-700 mb-1">Danh sách URLs Video YouTube (mỗi URL một dòng):</label>
                    <textarea id="analyzeUrls" value={analyzeUrls} onChange={(e) => updateState({ analyzeUrls: e.target.value })} rows={4} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: https://www.youtube.com/watch?v=VIDEO_ID_1..." disabled={isProcessingAnalyze || isProcessingGeneral}></textarea>
                </div>
            )}
            {analyzeInputType === 'titles' && (
                <div>
                    <label htmlFor="analyzeTitles" className="block text-sm font-medium text-gray-700 mb-1">Danh sách Tiêu đề Viral (mỗi tiêu đề một dòng):</label>
                    <textarea id="analyzeTitles" value={analyzeTitles} onChange={(e) => updateState({ analyzeTitles: e.target.value })} rows={4} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: TÔI ĐÃ KIẾM 100 TRIỆU TRONG 1 NGÀY NHƯ THẾ NÀO?" disabled={isProcessingAnalyze || isProcessingGeneral}></textarea>
                </div>
            )}
             <div>
                <label htmlFor="analyzeChannelTheme" className="block text-sm font-medium text-gray-700 mb-1">Chủ đề Kênh của Bạn (Không bắt buộc - để AI gợi ý áp dụng tốt hơn):</label>
                <input type="text" id="analyzeChannelTheme" value={analyzeChannelTheme} onChange={(e) => updateState({ analyzeChannelTheme: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: truyện ma, kể chuyện lịch sử, review phim..." disabled={isProcessingAnalyze || isProcessingGeneral}/>
            </div>
            <button onClick={handleAnalyzeTrend} disabled={isProcessingAnalyze || isProcessingGeneral} className="w-full bg-teal-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-teal-700 disabled:opacity-50">
              🔬 Phân Tích Trend & Đối Thủ
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tabId: ViralTitleGeneratorActiveTabType; label: string, icon?: string }> = ({ tabId, label, icon }) => (
    <button
      onClick={() => updateState({ activeTab: tabId, resultText: '', error: null, loadingMessage: null, analyzeError: null, analyzeLoadingMessage: null, analysisReport: '', viralFormulas: '', applicationSuggestions: '', groundingSourcesAnalysis: []  })}
      className={`flex items-center px-3 py-2 font-medium rounded-md text-sm transition-colors
                  ${activeTab === tabId ? 'bg-indigo-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
      disabled={isProcessingGeneral || isProcessingAnalyze}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {label}
    </button>
  );

  return (
    <ModuleContainer title="🔥 Module: Tạo Tiêu Đề Viral">
      <InfoBox>
        <p><strong>💡 Hướng dẫn:</strong> Module này giúp bạn tạo các tiêu đề có khả năng lan truyền cao cho video hoặc truyện của bạn.</p>
        <ul className="list-disc list-inside ml-4 mt-1 text-sm">
          <li><strong>Tạo Biến Thể Tiêu Đề:</strong> Nhập một tiêu đề cơ sở, chọn "Mục tiêu Biến tấu", và AI sẽ tạo ra nhiều biến thể hấp dẫn.</li>
          <li><strong>Phân Tích & Tạo Tiêu Đề Series:</strong> Cung cấp danh sách các tiêu đề viral hiện có. AI sẽ phân tích phong cách và tạo các tiêu đề mới theo dạng series.</li>
          <li><strong>Gợi ý Tiêu Đề từ Kịch bản:</strong> Dán kịch bản và các tiêu đề viral của kênh bạn. AI sẽ gợi ý các tiêu đề phù hợp.</li>
          <li><strong>Phân Tích Trend & Đối Thủ:</strong> Nhập URL hoặc tiêu đề của đối thủ/video trend. AI sẽ phân tích, đưa ra công thức viral và gợi ý áp dụng.</li>
        </ul>
        <p className="mt-1 text-sm">Ví dụ về từ khóa viral: "drama gia đình", "ngoại tình", "bị phản bội", "sự thật gây sốc", "cái kết bất ngờ", "bí mật động trời"...</p>
      </InfoBox>

      <div className="mb-6 flex space-x-1 sm:space-x-2 border-b border-gray-200 pb-3 flex-wrap">
        <TabButton tabId="generate" label="1. Tạo Biến Thể Tiêu Đề" icon="✨"/>
        <TabButton tabId="series" label="2. Phân Tích & Tạo Tiêu Đề Series" icon="📊"/>
        <TabButton tabId="script" label="3. Gợi ý Tiêu Đề từ Kịch bản" icon="📜"/>
        <TabButton tabId="analyzeTrend" label="4. Phân Tích Trend & Đối Thủ" icon="🔬"/>
      </div>
      
      <div className="mb-4">
        <label htmlFor="outputLanguageTitles" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Tiêu đề/Phân tích Đầu ra:</label>
        <select 
            id="outputLanguageTitles" 
            value={outputLanguage} 
            onChange={(e) => updateState({ outputLanguage: e.target.value })} 
            className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md shadow-sm"
            disabled={isProcessingGeneral || isProcessingAnalyze}
        >
            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {renderTabContent()}

      {isProcessingGeneral && <LoadingSpinner message={loadingMessage!} />}
      {loadingMessage && !isProcessingGeneral && (
            <p className={`text-center font-medium my-2 ${loadingMessage.includes("Lỗi") ? 'text-red-600' : 'text-indigo-600'}`}>
                {loadingMessage}
            </p>
      )}
      {error && <ErrorAlert message={error} />}

      {resultText && !isProcessingGeneral && activeTab !== 'analyzeTrend' && (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Kết quả (bằng {getSelectedLanguageLabel()}):</h3>
          <textarea value={resultText} readOnly rows={10} className="w-full p-2 border border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
        </div>
      )}

      {/* Display area for Analyze Trend Tab */}
      {activeTab === 'analyzeTrend' && !isProcessingAnalyze && (
        <>
            {analyzeLoadingMessage && <LoadingSpinner message={analyzeLoadingMessage} />}
            {!analyzeLoadingMessage && analyzeError && <ErrorAlert message={analyzeError} />}
            {!analyzeLoadingMessage && !analyzeError && (analysisReport || viralFormulas || applicationSuggestions) && (
                 <div className="mt-6 space-y-6">
                    {analysisReport && (
                        <div className="p-4 border rounded-lg bg-sky-50 border-sky-200">
                            <h3 className="text-lg font-semibold text-sky-700 mb-2">Báo cáo Phân tích Chi tiết:</h3>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap p-2 bg-white rounded">{analysisReport}</div>
                        </div>
                    )}
                    {viralFormulas && (
                        <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                            <h3 className="text-lg font-semibold text-green-700 mb-2">"Công thức Viral" Suy luận:</h3>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap p-2 bg-white rounded">{viralFormulas}</div>
                        </div>
                    )}
                    {applicationSuggestions && (
                        <div className="p-4 border rounded-lg bg-purple-50 border-purple-200">
                            <h3 className="text-lg font-semibold text-purple-700 mb-2">Gợi ý Áp dụng cho Kênh của Bạn:</h3>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap p-2 bg-white rounded">{applicationSuggestions}</div>
                        </div>
                    )}
                    {groundingSourcesAnalysis.length > 0 && (
                        <div className="p-4 border rounded-lg bg-gray-100">
                            <h3 className="text-md font-semibold text-gray-600 mb-2">Nguồn Tham Khảo (Google Search):</h3>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                {groundingSourcesAnalysis.map((source, index) => (
                                    source.web && (
                                        <li key={index}>
                                            <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" title={source.web.title}>
                                                {source.web.title || source.web.uri}
                                            </a>
                                        </li>
                                    )
                                ))}
                            </ul>
                        </div>
                    )}
                 </div>
            )}
        </>
      )}
    </ModuleContainer>
  );
};

export default ViralTitleGeneratorModule;