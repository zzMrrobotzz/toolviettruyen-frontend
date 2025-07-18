

import React, { useEffect } from 'react';
import { 
    ApiSettings, 
    RewriteModuleState,
    RewriteActiveTab,
    RewriteGoal,
    QuickRewriteState,
    RestructureRewriteState
} from '../../types'; 
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateAiContent } from '../../src/services/keyService';
import { delay } from '../../utils';
import { Languages, Text, Wand2, Bot, Check, GitCompareArrows } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface RewriteModuleProps {
  apiSettings: ApiSettings;
  moduleState: RewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<RewriteModuleState>>;
}

const GENRE_OPTIONS = [
    'Ngôn tình lãng mạn', 'Hài hước', 'Kinh dị', 'Trinh thám', 'Khoa học viễn tưởng', 'Kỳ ảo (Fantasy)', 'Hành động', 'Lịch sử', 'Đời thường', 'Tùy chỉnh...'
];

const TabButton: React.FC<{
  tabId: RewriteActiveTab;
  activeTab: RewriteActiveTab;
  label: string;
  icon: React.ElementType;
  onClick: (tabId: RewriteActiveTab) => void;
  disabled: boolean;
}> = ({ tabId, activeTab, label, icon: Icon, onClick, disabled }) => (
    <button
        onClick={() => onClick(tabId)}
        disabled={disabled}
        className={`flex items-center space-x-2 px-4 py-3 font-medium rounded-t-lg text-base transition-colors
            ${activeTab === tabId 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
        `}
    >
        <Icon size={18} />
        <span>{label}</span>
    </button>
);

const RewriteModule: React.FC<RewriteModuleProps> = ({ apiSettings, moduleState, setModuleState }) => {

    const updateQuickState = (updates: Partial<QuickRewriteState>) => {
        setModuleState(prev => ({ ...prev, quick: { ...prev.quick, ...updates } }));
    };

    const updateRestructureState = (updates: Partial<RestructureRewriteState>) => {
        setModuleState(prev => ({ ...prev, restructure: { ...prev.restructure, ...updates } }));
    };
    
    const handleTabChange = (tabId: RewriteActiveTab) => {
        setModuleState(prev => ({
            ...prev,
            activeTab: tabId,
            quick: { ...prev.quick, error: null, loadingMessage: null, editError: null, editLoadingMessage: null },
            restructure: { ...prev.restructure, error: null, loadingMessage: null }
        }));
    };

    const anyLoading = moduleState.quick.loadingMessage !== null || moduleState.quick.isEditing || moduleState.restructure.isLoading;

    return (
        <ModuleContainer title="🔄 Viết Lại & Tái Cấu Trúc">
             <div className="mb-6 flex flex-wrap gap-1 border-b-2 border-gray-300" role="tablist" aria-label="Chế độ viết lại">
                <TabButton
                    tabId="restructure"
                    activeTab={moduleState.activeTab}
                    label="Tái Cấu Trúc & Biến Hóa"
                    icon={Wand2}
                    onClick={handleTabChange}
                    disabled={anyLoading}
                />
                <TabButton
                    tabId="quick"
                    activeTab={moduleState.activeTab}
                    label="Viết Lại Nhanh (Slider)"
                    icon={Text}
                    onClick={handleTabChange}
                    disabled={anyLoading}
                />
            </div>
            
            {moduleState.activeTab === 'restructure' && (
                <RestructureTab
                    apiSettings={apiSettings}
                    state={moduleState.restructure}
                    updateState={updateRestructureState}
                />
            )}

            {moduleState.activeTab === 'quick' && (
                <QuickRewriteTab
                    apiSettings={apiSettings}
                    state={moduleState.quick}
                    updateState={updateQuickState}
                />
            )}
        </ModuleContainer>
    );
};

// =================================================================================
// Advanced "Restructure" Tab Component
// =================================================================================

interface RestructureTabProps {
    apiSettings: ApiSettings;
    state: RestructureRewriteState;
    updateState: (updates: Partial<RestructureRewriteState>) => void;
}

const RestructureTab: React.FC<RestructureTabProps> = ({ apiSettings, state, updateState }) => {
    const { keyInfo, setKeyInfo, consumeCredit } = useAppContext();
    const { 
        step, originalText, goal, perspectiveCharacter, targetGenre, customTargetGenre, 
        targetStyle, customTargetStyle, rewritePlan, rewrittenText, 
        isLoading, loadingMessage, error 
    } = state;

    const handleGeneratePlan = async () => {
        if (!originalText.trim()) {
            updateState({ error: 'Vui lòng nhập văn bản gốc.' });
            return;
        }

        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ error: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }

        updateState({ isLoading: true, error: null, loadingMessage: 'Đang tạo kế hoạch tái cấu trúc...' });
        
        let goalDescription = `Mục tiêu là ${goal}`;
        let specificInstructions = '';
        switch(goal) {
            case 'changePerspective':
                if (!perspectiveCharacter.trim()) {
                    updateState({ error: 'Vui lòng nhập tên nhân vật cho góc nhìn mới.', isLoading: false, loadingMessage: null });
                    return;
                }
                goalDescription = `Thay đổi góc nhìn sang nhân vật '${perspectiveCharacter}'`;
                specificInstructions = `Tập trung vào suy nghĩ, cảm xúc và các sự kiện mà nhân vật '${perspectiveCharacter}' có thể biết.`;
                break;
            case 'changeGenre':
                 let genre = targetGenre;
                 if (genre === 'Tùy chỉnh...' && customTargetGenre.trim()) {
                     genre = customTargetGenre.trim();
                 } else if (genre === 'Tùy chỉnh...' && !customTargetGenre.trim()){
                     updateState({ error: 'Vui lòng nhập thể loại tùy chỉnh.', isLoading: false, loadingMessage: null });
                     return;
                 }
                 goalDescription = `Chuyển thể câu chuyện sang thể loại '${genre}'`;
                 specificInstructions = `Áp dụng các yếu tố đặc trưng của thể loại '${genre}' như không khí, tình tiết, văn phong vào câu chuyện.`;
                 break;
            case 'changeStyle':
                let style = REWRITE_STYLE_OPTIONS.find(o => o.value === targetStyle)?.label || targetStyle;
                if(targetStyle === 'custom' && customTargetStyle.trim()){
                    style = customTargetStyle.trim();
                } else if (targetStyle === 'custom' && !customTargetStyle.trim()) {
                     updateState({ error: 'Vui lòng nhập phong cách tùy chỉnh.', isLoading: false, loadingMessage: null });
                    return;
                }
                goalDescription = `Viết lại theo phong cách '${style}'`;
                specificInstructions = `Áp dụng văn phong '${style}' vào toàn bộ văn bản.`;
                break;
            case 'summarize':
                 goalDescription = `Tóm tắt câu chuyện`;
                 specificInstructions = `Cô đọng các tình tiết chính, giữ lại ý nghĩa cốt lõi.`;
                 break;
            case 'expand':
                 goalDescription = `Mở rộng và làm chi tiết câu chuyện`;
                 specificInstructions = `Thêm mô tả về không gian, nội tâm nhân vật, kéo dài hội thoại.`;
                 break;
        }

        const prompt = `Bạn là một chuyên gia biên tập và lập kế hoạch truyện. Người dùng muốn tái cấu trúc một văn bản với mục tiêu cụ thể. Nhiệm vụ của bạn là tạo ra một kế hoạch rõ ràng, từng bước mà bạn sẽ tuân theo để đạt được mục tiêu này. Kế hoạch phải ngắn gọn, bằng Tiếng Việt, dễ hiểu để người dùng phê duyệt.

**Văn bản gốc:**
---
${originalText}
---

**Mục tiêu của người dùng:** ${goalDescription}

**Hướng dẫn cụ thể cho mục tiêu:**
${specificInstructions}

**Nhiệm vụ của bạn:**
Tạo một kế hoạch viết lại bằng Tiếng Việt. Kế hoạch phải nêu rõ những thay đổi chính bạn sẽ thực hiện.
Ví dụ, nếu mục tiêu là thay đổi góc nhìn, kế hoạch có thể là:
1. Phân tích các sự kiện chính từ góc nhìn của nhân vật gốc.
2. Xác định các sự kiện mà nhân vật '${perspectiveCharacter}' có thể chứng kiến hoặc biết đến.
3. Viết lại câu chuyện từ góc nhìn của '${perspectiveCharacter}', tập trung vào suy nghĩ và cảm xúc của họ.
4. Điều chỉnh văn phong để phù hợp với tính cách của '${perspectiveCharacter}'.

Chỉ trả về kế hoạch được đánh số. Không thêm bất kỳ văn bản nào khác.`;
        
        try {
            const planResult = await generateAiContent(prompt, apiSettings?.provider || 'gemini', keyInfo.key);
            if (planResult.remainingCredits !== undefined) {
                setKeyInfo({ ...keyInfo, credit: planResult.remainingCredits });
            }
            updateState({ rewritePlan: planResult.text, step: 'reviewing', isLoading: false, loadingMessage: null });
        } catch (e) {
            updateState({ error: `Lỗi khi tạo kế hoạch: ${(e as Error).message}`, isLoading: false, loadingMessage: null });
        }
    };
    
    const handleExecutePlan = async () => {
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ error: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }
        updateState({ isLoading: true, error: null, loadingMessage: 'Đang thực thi kế hoạch và viết lại...' });
        
        const prompt = `Bạn là một nhà văn chuyên nghiệp. Bạn đã tạo ra một kế hoạch viết lại và người dùng đã phê duyệt nó. Bây giờ, bạn phải thực hiện kế hoạch đó một cách hoàn hảo.

**Văn bản gốc:**
---
${originalText}
---

**Kế hoạch viết lại đã được phê duyệt:**
---
${rewritePlan}
---

**Nhiệm vụ của bạn:**
Viết lại "Văn bản gốc" bằng cách tuân thủ chính xác "Kế hoạch viết lại đã được phê duyệt".
Đầu ra cuối cùng phải là câu chuyện hoàn chỉnh, đã được viết lại, bằng Tiếng Việt.
Chỉ trả về câu chuyện đã viết lại. Không bao gồm kế hoạch, văn bản gốc, hoặc bất kỳ giải thích nào khác.`;

        try {
            const executionResult = await generateAiContent(prompt, apiSettings?.provider || 'gemini', keyInfo.key);
            if (executionResult.remainingCredits !== undefined) {
                setKeyInfo({ ...keyInfo, credit: executionResult.remainingCredits });
            }
            updateState({ rewrittenText: executionResult.text, step: 'completed', isLoading: false, loadingMessage: null });
        } catch (e) {
             updateState({ error: `Lỗi khi thực thi kế hoạch: ${(e as Error).message}`, isLoading: false, loadingMessage: null });
        }
    };

    const resetRestructure = () => {
        updateState({
            step: 'planning',
            originalText: '',
            rewritePlan: '',
            rewrittenText: '',
            error: null,
            isLoading: false,
            loadingMessage: null
        });
    };
    
    // UI for Planning Step
    const renderPlanningStep = () => (
        <div className="space-y-6">
            <InfoBox>
                <strong>Bước 1: Lập Kế hoạch.</strong> Cung cấp văn bản gốc và chọn mục tiêu tái cấu trúc. AI sẽ tạo một kế hoạch để bạn xem xét trước khi thực hiện.
            </InfoBox>
            <div>
                <label htmlFor="restructureOriginalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
                <textarea 
                    id="restructureOriginalText" 
                    value={originalText} 
                    onChange={e => updateState({ originalText: e.target.value })} 
                    rows={10} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                    placeholder="Dán văn bản cần tái cấu trúc vào đây..."
                    disabled={isLoading}
                />
            </div>
            
             <div>
                <label htmlFor="rewriteGoal" className="block text-sm font-medium text-gray-700 mb-1">Mục tiêu Tái cấu trúc:</label>
                <select id="rewriteGoal" value={goal} onChange={e => updateState({ goal: e.target.value as RewriteGoal })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoading}>
                    <option value="changeStyle">Thay đổi Văn phong</option>
                    <option value="changePerspective">Thay đổi Góc nhìn</option>
                    <option value="summarize">Rút gọn & Tóm tắt</option>
                    <option value="expand">Mở rộng & Làm chi tiết</option>
                    <option value="changeGenre">Chuyển Thể loại</option>
                </select>
            </div>
            
            {/* Conditional Inputs */}
            {goal === 'changePerspective' && (
                <div>
                    <label htmlFor="perspectiveCharacter" className="block text-sm font-medium text-gray-700 mb-1">Tên nhân vật (cho góc nhìn mới):</label>
                    <input type="text" id="perspectiveCharacter" value={perspectiveCharacter} onChange={e => updateState({ perspectiveCharacter: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isLoading} />
                </div>
            )}
            {goal === 'changeGenre' && (
                <div className="grid md:grid-cols-2 gap-4">
                     <select value={targetGenre} onChange={e => updateState({ targetGenre: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isLoading}>
                        {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {targetGenre === 'Tùy chỉnh...' && <input type="text" value={customTargetGenre} onChange={e => updateState({ customTargetGenre: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Nhập thể loại tùy chỉnh" disabled={isLoading}/>}
                </div>
            )}
             {goal === 'changeStyle' && (
                <div className="grid md:grid-cols-2 gap-4">
                     <select value={targetStyle} onChange={e => updateState({ targetStyle: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isLoading}>
                        {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    {targetStyle === 'custom' && <input type="text" value={customTargetStyle} onChange={e => updateState({ customTargetStyle: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Nhập phong cách tùy chỉnh" disabled={isLoading}/>}
                </div>
            )}

            <button onClick={handleGeneratePlan} disabled={isLoading || !originalText.trim()} className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50">
                Tạo Kế hoạch
            </button>
        </div>
    );

    // UI for Reviewing Step
    const renderReviewingStep = () => (
        <div className="space-y-6">
            <InfoBox>
                <strong>Bước 2: Xem xét Kế hoạch.</strong> Đây là kế hoạch AI đề xuất để tái cấu trúc văn bản của bạn. Hãy xem lại và nhấn "Chấp thuận & Thực thi" để tiếp tục.
            </InfoBox>
            <div>
                 <h3 className="text-lg font-semibold text-gray-700 mb-2">Văn bản Gốc (để đối chiếu)</h3>
                 <textarea value={originalText} readOnly rows={6} className="w-full p-2 border border-gray-200 bg-gray-100 rounded-md"/>
            </div>
             <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Kế hoạch Tái cấu trúc của AI <Bot size={20} className="inline-block text-indigo-600"/></h3>
                <textarea value={rewritePlan} readOnly rows={6} className="w-full p-3 border-2 border-indigo-300 bg-indigo-50 rounded-lg shadow-sm whitespace-pre-wrap"/>
            </div>
            <div className="flex gap-4">
                <button onClick={() => updateState({step: 'planning'})} disabled={isLoading} className="w-1/3 bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-gray-600 disabled:opacity-50">
                    Quay lại
                </button>
                <button onClick={handleExecutePlan} disabled={isLoading} className="w-2/3 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50">
                    <Check className="inline-block mr-2" size={20}/>Chấp thuận & Thực thi
                </button>
            </div>
        </div>
    );
    
    // UI for Completed Step
    const renderCompletedStep = () => (
         <div className="space-y-6">
             <InfoBox variant="info">
                <strong>Hoàn thành!</strong> Dưới đây là kết quả văn bản đã được tái cấu trúc theo kế hoạch.
            </InfoBox>
            <div className="grid md:grid-cols-2 gap-6">
                 <div>
                     <h3 className="text-lg font-semibold text-gray-700 mb-2">Văn bản Gốc</h3>
                     <textarea value={originalText} readOnly rows={15} className="w-full p-2 border border-gray-200 bg-gray-100 rounded-md"/>
                 </div>
                 <div>
                     <h3 className="text-lg font-semibold text-green-700 mb-2">Văn bản Đã Tái cấu trúc</h3>
                     <textarea value={rewrittenText} readOnly rows={15} className="w-full p-3 border-2 border-green-300 bg-green-50 rounded-lg"/>
                 </div>
            </div>
             <button onClick={resetRestructure} className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700">
                <GitCompareArrows className="inline-block mr-2" size={20}/> Bắt đầu Tái cấu trúc mới
            </button>
        </div>
    );

    return (
        <div className="animate-fadeIn">
            {isLoading && <LoadingSpinner message={loadingMessage || 'Đang xử lý...'} />}
            {error && <ErrorAlert message={error} />}
            {!isLoading && !error && (
                <>
                    {step === 'planning' && renderPlanningStep()}
                    {step === 'reviewing' && renderReviewingStep()}
                    {step === 'completed' && renderCompletedStep()}
                </>
            )}
        </div>
    );
};


// =================================================================================
// Classic "Quick Rewrite" Tab Component
// =================================================================================
interface QuickRewriteTabProps {
    apiSettings: ApiSettings;
    state: QuickRewriteState;
    updateState: (updates: Partial<QuickRewriteState>) => void;
}

const QuickRewriteTab: React.FC<QuickRewriteTabProps> = ({ apiSettings, state, updateState }) => {
    const { keyInfo, setKeyInfo, consumeCredit } = useAppContext();
    
    const {
        rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
        originalText, rewrittenText, error, progress, loadingMessage,
        isEditing, editError, editLoadingMessage, hasBeenEdited, translation
    } = state;

    const updateTranslationState = (updates: Partial<QuickRewriteState['translation']>) => {
        updateState({ translation: { ...translation, ...updates } });
    };

    useEffect(() => {
        if (targetLanguage !== sourceLanguage) {
            updateState({ adaptContext: true }); 
        } else {
            updateState({ adaptContext: false });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetLanguage, sourceLanguage]);

    const handleSingleRewrite = async () => {
         if (!originalText.trim()) {
            updateState({ error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
            return;
        }
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ error: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }
        updateState({ error: null, rewrittenText: '', progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false });
        
        const CHUNK_CHAR_COUNT = 4000;
        const numChunks = Math.ceil(originalText.length / CHUNK_CHAR_COUNT);
        let fullRewrittenText = '';

        try {
            for (let i = 0; i < numChunks; i++) {
                updateState({ progress: Math.round(((i + 1) / numChunks) * 100), loadingMessage: `Đang viết lại phần ${i + 1}/${numChunks}...` });
                const textChunk = originalText.substring(i * CHUNK_CHAR_COUNT, (i + 1) * CHUNK_CHAR_COUNT);
                
                let effectiveStyle = rewriteStyle === 'custom' ? customRewriteStyle : REWRITE_STYLE_OPTIONS.find(opt => opt.value === rewriteStyle)?.label || rewriteStyle;
                
                const levelDescriptions: {[key: number]: string} = {
                    0: 'only fix spelling and grammar. Keep the original story 100%.',
                    25: 'make some changes to words and sentence structures to refresh the text, while strictly preserving the original meaning and plot.',
                    50: 'moderately rewrite the wording and style. You can change sentence structures and vocabulary, but MUST keep the main character names and core plot points.',
                    75: 'creatively reimagine the story. You can change character names and some settings. The plot may have new developments, but it MUST retain the spirit of the original script.',
                    100: 'completely rewrite into a new script. Only retain the "soul" (core idea, main theme) of the original story.'
                };
                const descriptionKey = Math.round(rewriteLevel / 25) * 25;
                const levelDescription = levelDescriptions[descriptionKey];

                const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === sourceLanguage)?.label || sourceLanguage;
                const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === targetLanguage)?.label || targetLanguage;

                let localizationRequest = '';
                if (targetLanguage !== sourceLanguage && adaptContext) {
                    localizationRequest = `\n- **Cultural Localization Required:** Deeply adapt the cultural context, social norms, proper names, and other details to make the story feel natural and appropriate for a ${selectedTargetLangLabel}-speaking audience.`;
                }

                let rewriteStyleInstructionPromptSegment = '';
                if (rewriteStyle === 'custom') {
                    rewriteStyleInstructionPromptSegment = `Apply the following custom rewrite instructions: "${customRewriteStyle}"`;
                } else {
                    rewriteStyleInstructionPromptSegment = `The desired rewrite style is: ${effectiveStyle}.`;
                }

                const prompt = `You are an expert multilingual text rewriting AI. Your task is to rewrite the provided text chunk according to the following instructions.\n\n**Instructions:**\n- **Source Language:** ${selectedSourceLangLabel}\n- **Target Language:** ${selectedTargetLangLabel}\n- **Degree of Change Required:** ${rewriteLevel}%. This means you should ${levelDescription}.\n- **Rewrite Style:** ${rewriteStyleInstructionPromptSegment}\n- **Timestamp Handling (CRITICAL):** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.\n- **Coherence:** The rewritten chunk MUST maintain logical consistency with the context from previously rewritten chunks.\n${localizationRequest}\n\n**Context from Previous Chunks (already in ${selectedTargetLangLabel}):**\n---\n${fullRewrittenText || "This is the first chunk."}\n---\n\n**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**\n---\n${textChunk}\n---\n\n**Your Task:**\nProvide ONLY the rewritten text for the current chunk in ${selectedTargetLangLabel}. Do not include any other text, introductions, or explanations.\n`;
                
                await delay(500); // Simulate API call delay
                const result = await generateAiContent(prompt, apiSettings?.provider || 'gemini', keyInfo.key);
                if (result.remainingCredits !== undefined) {
                    setKeyInfo({ ...keyInfo, credit: result.remainingCredits });
                }
                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + (result?.text || '').trim();
                updateState({ rewrittenText: fullRewrittenText }); // Update UI progressively
            }
            updateState({ rewrittenText: fullRewrittenText.trim(), loadingMessage: 'Hoàn thành!', progress: 100 });
        } catch (e) {
            updateState({ error: `Lỗi viết lại: ${(e as Error).message}`, loadingMessage: 'Lỗi!', progress: 0 });
        } finally {
            setTimeout(() => updateState({ loadingMessage: null }), 3000);
        }
    };

    const handlePostRewriteEdit = async () => {
         if (!rewrittenText.trim()) {
            updateState({ editError: 'Không có văn bản để tinh chỉnh.' });
            return;
        }
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ editError: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }
        updateState({ isEditing: true, editError: null, editLoadingMessage: 'Đang tinh chỉnh logic...', hasBeenEdited: false });
        
        const editPrompt = `You are a meticulous story editor. Your task is to refine and polish the given text, ensuring consistency, logical flow, and improved style.\n\n**Text to Edit:**\n---\n${rewrittenText}\n---\n\n**Editing Instructions:**\n1.  **Consistency:** Ensure character names, locations, and plot points are consistent throughout the text. Correct any contradictions.\n2.  **Flow and Cohesion:** Improve the flow between sentences and paragraphs. Ensure smooth transitions.\n3.  **Clarity and Conciseness:** Remove repetitive phrases and redundant words. Clarify any confusing sentences.\n4.  **Grammar and Spelling:** Correct any grammatical errors or typos.\n5.  **Timestamp Check (Final):** Double-check and ensure absolutely NO timestamps (e.g., (11:42)) remain in the final text. The output must be a clean narrative.\n\n**Output:**\nReturn ONLY the fully edited and polished text. Do not add any commentary or explanations.\n`;
        
        try {
            const result = await generateAiContent(editPrompt, apiSettings?.provider || 'gemini', keyInfo.key);
            if (result.remainingCredits !== undefined) {
                setKeyInfo({ ...keyInfo, credit: result.remainingCredits });
            }
            updateState({ rewrittenText: result?.text || '', isEditing: false, editLoadingMessage: 'Tinh chỉnh hoàn tất!', hasBeenEdited: true });
        } catch (e) {
            updateState({ editError: `Lỗi tinh chỉnh: ${(e as Error).message}`, isEditing: false, editLoadingMessage: 'Lỗi!' });
        } finally {
             setTimeout(() => updateState({ editLoadingMessage: null }), 3000);
        }
    };
    
    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        alert("Đã sao chép!");
    };
    
    const anyLoading = loadingMessage !== null || isEditing;
    const userLevelDescriptions: { [key: number]: string } = {
        0: "Chỉ sửa lỗi chính tả và ngữ pháp cơ bản. Giữ nguyên 100% nội dung và văn phong gốc.",
        25: "Làm mới văn bản bằng cách thay đổi một số từ ngữ và cấu trúc câu. Giữ nguyên ý nghĩa, nhân vật, bối cảnh và cốt truyện chính.",
        50: "Viết lại vừa phải từ ngữ và văn phong. Có thể thay đổi cấu trúc câu, từ vựng, một số chi tiết mô tả nhỏ. Tên nhân vật chính, cốt truyện chính PHẢI được giữ nguyên.",
        75: "Sáng tạo lại câu chuyện một cách đáng kể. Có thể thay đổi tên nhân vật, bối cảnh. Cốt truyện có thể có những phát triển mới nhưng PHẢI giữ được tinh thần của bản gốc.",
        100: "Viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại 'linh hồn' (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc."
    };
    const getCurrentLevelDescription = () => userLevelDescriptions[Math.round(rewriteLevel / 25) * 25];

    return (
         <div className="space-y-6 animate-fadeIn">
            <InfoBox>
                <strong>Viết Lại Nhanh.</strong> Sử dụng thanh trượt để điều chỉnh mức độ thay đổi từ chỉnh sửa nhẹ đến sáng tạo hoàn toàn. Lý tưởng cho các tác vụ viết lại nhanh chóng.
            </InfoBox>
            
            <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow">
                <h3 className="text-xl font-semibold text-gray-800">Cài đặt Viết lại Nhanh</h3>
                 <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="rewriteSlider" className="text-sm font-medium text-gray-700">Mức độ thay đổi:</label>
                        <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">{rewriteLevel}%</span>
                    </div>
                    <input type="range" id="rewriteSlider" min="0" max="100" step="25" value={rewriteLevel} onChange={(e) => updateState({ rewriteLevel: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={anyLoading}/>
                    <div className="mt-2 text-sm text-gray-600 bg-indigo-50 p-3 rounded-md border border-indigo-200">
                        <strong>Giải thích mức {rewriteLevel}%:</strong> {getCurrentLevelDescription()}
                    </div>
                </div>
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label htmlFor="quickSourceLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ gốc:</label>
                        <select id="quickSourceLang" value={sourceLanguage} onChange={(e) => updateState({ sourceLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                        {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="quickTargetLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra:</label>
                        <select id="quickTargetLang" value={targetLanguage} onChange={(e) => updateState({ targetLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                        {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="quickRewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại:</label>
                        <select id="quickRewriteStyle" value={rewriteStyle} onChange={(e) => updateState({ rewriteStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}>
                        {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                </div>
                 {rewriteStyle === 'custom' && (
                    <div>
                        <label htmlFor="quickCustomStyle" className="block text-sm font-medium text-gray-700 mb-1">Hướng dẫn tùy chỉnh:</label>
                        <textarea id="quickCustomStyle" value={customRewriteStyle} onChange={(e) => updateState({ customRewriteStyle: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg" disabled={anyLoading}/>
                    </div>
                )}
            </div>
             <div>
                <label htmlFor="quickOriginalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
                <textarea id="quickOriginalText" value={originalText} onChange={(e) => updateState({ originalText: e.target.value })} rows={6} className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Nhập văn bản..." disabled={anyLoading}></textarea>
            </div>
             <button onClick={handleSingleRewrite} disabled={anyLoading || !originalText.trim()} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                Viết lại Văn bản
            </button>
            {anyLoading && <LoadingSpinner message={loadingMessage || editLoadingMessage || 'Đang xử lý...'} />}
            {error && <ErrorAlert message={error} />}
            {editError && <ErrorAlert message={editError} />}
            {rewrittenText && !anyLoading && (
                 <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                     <h3 className="text-lg font-semibold mb-2">Văn bản đã viết lại:</h3>
                     <textarea value={rewrittenText} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white"/>
                     <div className="mt-3 flex gap-2">
                        <button onClick={() => copyToClipboard(rewrittenText)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Sao chép</button>
                        <button onClick={handlePostRewriteEdit} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">Biên Tập & Tinh Chỉnh</button>
                     </div>
                 </div>
            )}
        </div>
    );
};


export default RewriteModule;