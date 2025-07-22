

import React, { useEffect, useState, useRef } from 'react';
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
import { generateTextViaBackend } from '../../services/aiProxyService';
import { delay } from '../../utils';
import { Text, Wand2, Bot, Check, GitCompareArrows } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { addToHistory, getModuleHistory } from '../../utils/historyManager';
import HistoryViewer from '../HistoryViewer';

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

    const anyLoading = moduleState.quick.isProcessing || moduleState.quick.isEditing || moduleState.restructure.isLoading;

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
    const { 
        step, originalText, goal, perspectiveCharacter, targetGenre, customTargetGenre, 
        targetStyle, customTargetStyle, rewritePlan, rewrittenText, 
        isLoading, loadingMessage, error 
    } = state;

    const abortControllerRef = useRef<AbortController | null>(null);
    const { consumeCredit } = useAppContext();

    const generateText = async (prompt: string, systemInstruction?: string, signal?: AbortSignal) => {
        const request = {
          prompt,
          systemInstruction,
          provider: apiSettings?.provider || 'gemini',
          model: apiSettings?.model,
          temperature: apiSettings?.temperature,
          maxTokens: apiSettings?.maxTokens,
        };
        const result = await generateTextViaBackend(request, () => {}, signal);
        if (!result.success) throw new Error(result.error || 'AI generation failed');
        return result.text || '';
    };

    const handleStop = () => {
        abortControllerRef.current?.abort();
    };

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

        abortControllerRef.current = new AbortController();
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
            const planResult = await generateText(prompt, undefined, abortControllerRef.current.signal);
            updateState({ rewritePlan: planResult, step: 'reviewing', isLoading: false, loadingMessage: null });
        } catch (e) {
            const err = e as Error;
            if (err.name === 'AbortError') {
                updateState({ error: 'Tạo kế hoạch đã bị dừng.', isLoading: false, loadingMessage: null });
            } else {
                updateState({ error: `Lỗi khi tạo kế hoạch: ${err.message}`, isLoading: false, loadingMessage: null });
            }
        } finally {
            abortControllerRef.current = null;
        }
    };
    
    const handleExecutePlan = async () => {
        abortControllerRef.current = new AbortController();
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
            const executionResult = await generateText(prompt, undefined, abortControllerRef.current.signal);
            updateState({ rewrittenText: executionResult, step: 'completed', isLoading: false, loadingMessage: null });
             if (executionResult.trim()) {
                addToHistory('rewrite-restructure', executionResult.trim(), {
                    originalText,
                    settings: { goal, perspectiveCharacter, targetGenre, customTargetGenre, targetStyle, customTargetStyle, rewritePlan }
                });
            }
        } catch (e) {
            const err = e as Error;
             if (err.name === 'AbortError') {
                updateState({ error: 'Thực thi kế hoạch đã bị dừng.', isLoading: false, loadingMessage: null });
            } else {
                updateState({ error: `Lỗi khi thực thi kế hoạch: ${err.message}`, isLoading: false, loadingMessage: null });
            }
        } finally {
            abortControllerRef.current = null;
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
                {isLoading ? 'Đang tạo...' : 'Tạo Kế hoạch'}
            </button>
             {isLoading && <button onClick={handleStop} className="w-full mt-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg">Dừng</button>}
        </div>
    );

    const renderReviewingStep = () => (
        <div className="space-y-6">
            <InfoBox>
                <strong>Bước 2: Xem xét Kế hoạch.</strong> Đây là kế hoạch AI đề xuất. Hãy xem lại và nhấn "Chấp thuận & Thực thi" để tiếp tục.
            </InfoBox>
            <div>
                 <h3 className="text-lg font-semibold text-gray-700 mb-2">Văn bản Gốc (để đối chiếu)</h3>
                 <textarea value={originalText} readOnly rows={6} className="w-full p-2 border border-gray-200 bg-gray-100 rounded-md"/>
            </div>
             <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Kế hoạch Tái cấu trúc của AI <Bot size={20} className="inline-block text-indigo-600"/></h3>
                <textarea value={rewritePlan} readOnly rows={6} className="w-full p-3 border-2 border-indigo-300 bg-indigo-50 rounded-lg shadow-sm whitespace-pre-wrap"/>
            </div>
            <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                    <button onClick={() => updateState({step: 'planning'})} disabled={isLoading} className="w-1/3 bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-gray-600 disabled:opacity-50">
                        Quay lại
                    </button>
                    <button onClick={handleExecutePlan} disabled={isLoading} className="w-2/3 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50">
                        <Check className="inline-block mr-2" size={20}/>
                        {isLoading ? 'Đang thực thi...' : 'Chấp thuận & Thực thi'}
                    </button>
                </div>
                {isLoading && <button onClick={handleStop} className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-lg">Dừng</button>}
            </div>
        </div>
    );
    
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
    
    const {
        rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
        originalText, rewrittenText, error, progress, loadingMessage, isProcessing,
        isEditing, editError, editLoadingMessage, hasBeenEdited
    } = state;

    const [showHistory, setShowHistory] = useState(false);
    const [historyCount, setHistoryCount] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);
    const { consumeCredit } = useAppContext();

     useEffect(() => {
        const history = getModuleHistory('rewrite-quick');
        setHistoryCount(history.length);
    }, [showHistory]);

    const generateText = async (prompt: string, systemInstruction?: string, signal?: AbortSignal) => {
        const request = {
          prompt,
          systemInstruction,
          provider: apiSettings?.provider || 'gemini',
          model: apiSettings?.model,
          temperature: apiSettings?.temperature,
          maxTokens: apiSettings?.maxTokens,
        };
        const result = await generateTextViaBackend(request, () => {}, signal);
        if (!result.success) throw new Error(result.error || 'AI generation failed');
        return result.text || '';
    };

    const handleStop = () => {
        abortControllerRef.current?.abort();
    };

    useEffect(() => {
        if (targetLanguage !== sourceLanguage) {
            updateState({ adaptContext: true }); 
        } else {
            updateState({ adaptContext: false });
        }
    }, [targetLanguage, sourceLanguage]);

    const handleSingleRewrite = async () => {
         if (!originalText.trim()) {
            updateState({ error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
            return;
        }

        const hasCredits = await consumeCredit(2); // 2 credits for 2 steps
        if (!hasCredits) {
          updateState({ error: 'Không đủ credit để thực hiện. Cần 2 credit.' });
          return;
        }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        updateState({ isProcessing: true, error: null, editError: null, rewrittenText: '', progress: 0, loadingMessage: 'Đang chuẩn bị...', hasBeenEdited: false });
        
        try {
            // ==========================================================
            // STEP 1: REWRITE (Using the complex prompt logic)
            // ==========================================================
            updateState({ loadingMessage: 'Đang viết lại...', progress: 1 });
            
            const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === sourceLanguage)?.label || sourceLanguage;
            const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === targetLanguage)?.label || targetLanguage;
            
            let effectiveRewriteStyleForPrompt = '';
            let customInstructionsForPrompt = '';

            if (rewriteStyle === 'custom') {
                if (!customRewriteStyle.trim()) throw new Error('Phong cách viết lại tùy chỉnh không được để trống khi được chọn.');
                effectiveRewriteStyleForPrompt = 'custom';
                customInstructionsForPrompt = customRewriteStyle.trim();
            } else {
                effectiveRewriteStyleForPrompt = REWRITE_STYLE_OPTIONS.find(opt => opt.value === rewriteStyle)?.label || rewriteStyle;
            }

            const CHUNK_REWRITE_CHAR_COUNT = 4000;
            const numChunks = Math.ceil(originalText.length / CHUNK_REWRITE_CHAR_COUNT);
            let fullRewrittenText = '';
            let characterMap: string | null = null; 

            const systemInstructionForRewrite = "You are an expert multilingual text rewriting AI. Your primary function is to transform input text according to precise instructions, ensuring that when a rewrite is requested (degree of change > 0%), the output is a modified version of the input, not the original input itself.";

            for (let i = 0; i < numChunks; i++) {
                if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
                updateState({ progress: Math.round(((i + 1) / numChunks) * 50), loadingMessage: `Đang viết lại phần ${i + 1}/${numChunks}...` });
                
                const textChunk = originalText.substring(i * CHUNK_REWRITE_CHAR_COUNT, (i + 1) * CHUNK_REWRITE_CHAR_COUNT);
                
                const levelDescriptions: {[key: number]: string} = {
                    0: 'only fix spelling and grammar. Keep the original story 100%. The output MUST be the full text of the chunk after applying these fixes (if any).',
                    25: 'make some changes to words and sentence structures to refresh the text, while strictly preserving the original meaning, characters, settings, and plot. The goal is a light refreshment. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these revisions*. Do not return the original text if changes, however minor, are instructed.',
                    50: 'moderately rewrite the wording and style. You can change sentence structures, vocabulary, and some minor descriptive details (e.g., character\'s age, specific objects, minor traits of secondary characters). However, you MUST keep the main character names, core plot points, main occupations, and primary settings of the original text. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these revisions*, even if the revisions seem moderate rather than extensive. Do not return the original text.',
                    75: 'creatively reimagine the story. You can change character names, occupations, and settings. The plot may have new developments, but it MUST retain the spirit, message, and most appealing points of the original script. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these creative revisions*. Do not return the original text.',
                    100: 'completely rewrite into a new script. Only retain the "soul" (core idea, main theme) of the original story. Everything else, such as character names, settings, professions, and even some subplots, must be completely new. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied this complete rewrite*. Do not return the original text.'
                };
                const descriptionKey = Math.round(rewriteLevel / 25) * 25;
                const levelDescription = levelDescriptions[descriptionKey];

                let localizationRequest = '';
                if (targetLanguage !== sourceLanguage && adaptContext) {
                    localizationRequest = `\n- **Cultural Localization Required:** Do not just translate. Deeply adapt the cultural context, social norms, proper names, and other details to make the story feel natural and appropriate for a ${selectedTargetLangLabel}-speaking audience.`;
                }
                
                let rewriteStyleInstructionPromptSegment = '';
                if (effectiveRewriteStyleForPrompt === 'custom') {
                  rewriteStyleInstructionPromptSegment = `Apply the following custom rewrite instructions. These instructions are PARAMOUNT and OVERRIDE the general rules of the 'Degree of Change Required' when there is a direct conflict.
           - For example, if the 'Degree of Change' for 50% says 'keep main character names', but your custom instruction says 'change the main character's name to Dra. Carmen Valdés', you MUST change the name to 'Dra. Carmen Valdés'.
           - Similarly, if the text mentions '20 years of experience' and your custom instruction is to maintain persona details, you MUST keep '20 years of experience' unless explicitly told to change it.
          Your Custom Instructions: "${customInstructionsForPrompt}"`;
                } else {
                  rewriteStyleInstructionPromptSegment = `The desired rewrite style is: ${effectiveRewriteStyleForPrompt}.`;
                }
                
                const lengthFidelityInstruction = `\n- **GUIDANCE ON OUTPUT LENGTH:** Your primary task is to REWRITE according to the 'Degree of Change Required'. The rewritten chunk should generally reflect the narrative scope and detail of the original.
              \n  - For Degree of Change 0-25%: Aim for the output length to be reasonably close (e.g., +/-15%) to the original chunk's character count. However, making the required textual changes (even if minimal) as per the degree's description is MORE IMPORTANT than strictly adhering to this length if a conflict arises. DO NOT return original text if 'Degree of Change Required' is greater than 0.
              \n  - For Degree of Change 50%: Aim for a length within +/-25% of the original. Focus on meaningful rewriting as per the degree.
              \n  - For Degree of Change 75-100%: Length can vary significantly based on the creative changes, but the output must be a developed narrative segment. A 100% rewrite may be shorter if it's a thematic reinterpretation.
              \n  In all cases where 'Degree of Change Required' is greater than 0%, prioritize executing the rewrite as instructed over returning an unchanged text due to length concerns. Avoid drastic, unexplained shortening unless it's a 100% rewrite or explicitly instructed by custom rewrite instructions.`;


                let characterConsistencyInstructions = `
                    \n  - **ABSOLUTE CHARACTER NAME CONSISTENCY (FOR ALL CHARACTERS):**
                        \n    - **General Rule:** Once a name is established for ANY character (main, secondary, minor, recurring) in the \`${selectedTargetLangLabel}\` output of THIS SPECIFIC REWRITE SESSION, that name MUST be used with 100% consistency for that character throughout ALL subsequent parts of this same story. DO NOT change it later.
                        \n    - **If Target Language Differs from Source Language AND Rewrite Level < 75%:** For each character, you MUST choose ONE consistent form in \`${selectedTargetLangLabel}\` (either a standard direct translation or the original name if more appropriate phonetically) upon their first appearance in the rewritten text, AND THEN USE THAT CHOSEN FORM WITH ABSOLUTE CONSISTENCY. No random variations.
                        \n    - **(Specific rules for Character Map at Level >= 75% are detailed below).**`;

                let prompt = `**Primary Objective:** Your main goal is to actively REWRITE the input text chunk. The extent and nature of the rewrite are determined by the 'Degree of Change Required' and the 'Rewrite Style Application' instructions below. You MUST produce a rewritten version. Only if the 'Degree of Change Required' is 0% AND the text has absolutely no errors to fix, should you return the original text verbatim. For any other degree of change, a rewritten output is mandatory.

                \n**CRITICAL NARRATIVE INTEGRITY (SINGLE TRUTH MANDATE):** You are rewriting ONE SINGLE STORY. All details regarding characters (names, roles, relationships, established traits), plot points, events, locations, and timelines MUST remain ABSOLUTELY CONSISTENT with what has been established in previously rewritten chunks of THIS SAME STORY (provided as \`fullRewrittenText\` context, which is THE CANON for this session) and the initial setup of the current chunk. DO NOT introduce conflicting information or alter established facts. Maintain ONE UNIFIED AND LOGICAL NARRATIVE THREAD.

                \n**Your Task:** Rewrite the provided text chunk.
                \n**Critical Output Requirement:** Your response for this task MUST BE ONLY the rewritten text itself, in the specified Target Language. NO other text, introductions, explanations, or meta-comments are allowed.
                \n**Rewrite Instructions:**
                \n- **Source Language (of the input text):** ${selectedSourceLangLabel}
                \n- **Target Language (for the output text):** ${selectedTargetLangLabel}
                \n- **Degree of Change Required:** ${rewriteLevel}%. This means you should ${levelDescription}. Ensure your changes strictly adhere to the permissions of this level (e.g., if the level states 'main character names...MUST be kept', then they MUST NOT be changed).
                ${lengthFidelityInstruction}
                \n- **Rewrite Style Application:** ${rewriteStyleInstructionPromptSegment}
                \n- **Timestamp Handling:** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.
                ${localizationRequest}
                \n- **Overall Story Coherence (CRITICAL - Builds on Narrative Integrity):**
                    \n  - **Persona Consistency:** Pay close attention to key details that define a character's persona, such as their stated years of experience, specific titles (Dr., Prof.), or recurring personal details. These details MUST be maintained with 100% consistency throughout the entire rewritten text, unless a custom instruction explicitly directs you to change them.
                    \n  - **Logical Flow:** The rewritten chunk MUST maintain logical consistency internally and with \`fullRewrittenText\`.
                    \n  - **Character Consistency (General Behavior & Names):** ${characterConsistencyInstructions}
                    \n  - **Event, Setting & Situation Coherence:** Ensure events, locations, and plot-relevant objects are plausible and consistent with established facts (from \`fullRewrittenText\` and the original chunk's premise), respecting the "Degree of Change". Once a setting or event detail is established in the rewrite, stick to it.
                \n- **Context from Previous Chunks (THE CANON - must be in ${selectedTargetLangLabel}):**
                    \n  \`${fullRewrittenText || "This is the first chunk. No previous context."}\`
                `;
                
                if (i === 0 && rewriteLevel >= 75) {
                    prompt += ` \n\n**Character Mapping (MANDATORY for First Chunk if Level >= 75%):** For this first chunk ONLY, after you finish writing the rewritten text, you MUST append a character map to your output. This map is critical for consistency in subsequent chunks.
                    \n- Format: Create a section starting with the exact tag \`[CHARACTER_MAP]\` and ending with the exact tag \`[/CHARACTER_MAP]\`.
                    \n- Content: Inside this section, list every single character name that appears in your rewritten chunk. For each name, provide its original form from the source text and the new form you've used in the rewritten text. If a name is unchanged, list it as "Original Name -> Original Name".
                    \n- Example:
                    \n[CHARACTER_MAP]
                    \n- John -> Jean
                    \n- Dr. Smith -> Dr. Schmidt
                    \n- Mary -> Mary
                    \n[/CHARACTER_MAP]
                    \nThis map MUST be at the very end of your response, after the full rewritten text of the chunk.`;
                } else if (characterMap && rewriteLevel >= 75) {
                    prompt += `\n- **ABSOLUTE CHARACTER CONSISTENCY MANDATE (Based on Character Map for Level >= 75%):**
                    \n  - You have previously established a Character Map. You MUST now adhere to it with 100% accuracy.
                    \n  - For ANY character mentioned in the Character Map, you MUST use the exact name specified in the map for the Target Language. NO EXCEPTIONS.
                    \n  - For any new characters introduced in this chunk, create a name appropriate for the Target Language and maintain it.
                    \n  - The established Character Map is:
                    \n    \`\`\`
                    \n    ${characterMap}
                    \n    \`\`\``;
                }

                prompt += `\n**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
                \n---
                \n${textChunk}
                \n---
                \n**IMPORTANT FINAL INSTRUCTION FOR THIS CHUNK:**
                \nRegardless of the complexity or perceived difficulty of the rewrite task based on the 'Degree of Change Required' and other constraints, if 'Degree of Change Required' is greater than 0%, your output for THIS CHUNK ABSOLUTELY MUST BE A REWRITTEN VERSION. It CANNOT be an identical copy of the 'Original Text Chunk to Rewrite' provided above. Make your best effort to apply the changes as instructed. If the 'Degree of Change Required' is 0%, only fix basic spelling/grammar and return the full text; otherwise, you must rewrite.
                \n**Perform the rewrite for THIS CHUNK ONLY in ${selectedTargetLangLabel}. Adhere strictly to all instructions. Remember, ONLY the rewritten story text.**`;
                
                if (i > 0) await delay(750);
                const resultText = await generateText(prompt, systemInstructionForRewrite, signal);
                
                let partResultText = resultText || "";
                if (i === 0 && rewriteLevel >= 75) {
                    const mapMatch = partResultText.match(/\[CHARACTER_MAP\]([\s\S]*?)\[\/CHARACTER_MAP\]/);
                    if (mapMatch && mapMatch[1]) {
                        characterMap = mapMatch[1].trim();
                        partResultText = partResultText.replace(mapMatch[0], '');
                    }
                }
                partResultText = partResultText.trim();
                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + partResultText;
                updateState({ rewrittenText: fullRewrittenText });
            }

            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            
            updateState({ progress: 51, loadingMessage: 'Đang tinh chỉnh logic...' });
            
            const systemInstructionForEdit = "You are a meticulous story editor. Your task is to refine and polish a given text, ensuring consistency, logical flow, and improved style, while respecting previous rewrite intentions.";
            
            let editPrompt = `Bạn là một biên tập viên truyện chuyên nghiệp, cực kỳ tỉ mỉ. Nhiệm vụ của bạn là xem xét lại văn bản đã được viết lại dưới đây và thực hiện các chỉnh sửa cuối cùng để đảm bảo chất lượng cao nhất.

                **Bối cảnh:**
                - Văn bản gốc đã được viết lại theo một mức độ thay đổi cụ thể (${rewriteLevel}%).
                - Ngôn ngữ đầu ra là: ${selectedTargetLangLabel}.
                
                **Nhiệm vụ của bạn:**
                1.  **Đọc và hiểu** toàn bộ văn bản đã được viết lại dưới đây.
                2.  **Sửa lỗi còn sót lại:** Rà soát và sửa bất kỳ lỗi chính tả, ngữ pháp, hoặc dấu câu nào còn sót lại.
                3.  **Đảm bảo tính nhất quán (CRITICAL):**
                    -   **Nhân vật & Bối cảnh:** Đảm bảo tên nhân vật, địa điểm, và các chi tiết quan trọng khác được sử dụng một cách nhất quán trong toàn bộ văn bản. Sửa bất kỳ sự mâu thuẫn nào.
                    -   **Văn phong (Tone of voice):** Đảm bảo văn phong nhất quán, phù hợp với phong cách đã chọn (${effectiveRewriteStyleForPrompt}). Nếu văn bản có vẻ rời rạc hoặc văn phong thay đổi đột ngột giữa các đoạn, hãy điều chỉnh để nó liền mạch.
                4.  **Cải thiện dòng chảy & Khả năng đọc:**
                    -   Điều chỉnh cấu trúc câu và từ nối để câu chuyện trôi chảy và dễ đọc hơn.
                    -   Loại bỏ các câu văn lủng củng hoặc tối nghĩa.

                **Văn bản cần được tinh chỉnh:**
                ---
                ${fullRewrittenText}
                ---

                **Yêu cầu đầu ra:**
                -   Chỉ trả về phiên bản cuối cùng, hoàn hảo của văn bản bằng ngôn ngữ ${selectedTargetLangLabel}.
                -   KHÔNG thêm bất kỳ bình luận, giải thích hay ghi chú nào. Chỉ có văn bản thuần túy.`;
            
            const finalResult = await generateText(editPrompt, systemInstructionForEdit, signal);
            
            updateState({ rewrittenText: finalResult.trim(), isProcessing: false, loadingMessage: 'Hoàn thành!', progress: 100, hasBeenEdited: true });
            
            if (finalResult.trim()) {
                addToHistory('rewrite-quick', finalResult.trim(), { originalText, settings: { rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext }});
                setHistoryCount(getModuleHistory('rewrite-quick').length);
            }

        } catch (e) {
            const err = e as Error;
            if (err.name === 'AbortError') {
                updateState({ error: 'Quá trình đã bị dừng.', loadingMessage: 'Đã dừng' });
            } else {
                updateState({ error: `Lỗi: ${err.message}`, loadingMessage: 'Lỗi!' });
            }
        } finally {
            updateState({ isProcessing: false, loadingMessage: null, progress: 0 });
            abortControllerRef.current = null;
        }
    };

    const handlePostRewriteEdit = async () => {
        if (!rewrittenText.trim()) {
            updateState({ editError: 'Không có văn bản để tinh chỉnh.' });
            return;
        }
        
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
          updateState({ editError: 'Không đủ credit để thực hiện.' });
          return;
        }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        updateState({ isEditing: true, editError: null, editLoadingMessage: 'Đang tinh chỉnh lại...', hasBeenEdited: false });

        try {
            const systemInstructionForEdit = "You are a meticulous story editor. Your task is to refine and polish a given text, ensuring consistency, logical flow, and improved style, while respecting previous rewrite intentions.";
            
            const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === targetLanguage)?.label || targetLanguage;

            let editPrompt = `Bạn là một biên tập viên truyện chuyên nghiệp, cực kỳ tỉ mỉ. Nhiệm vụ của bạn là xem xét lại văn bản đã được viết lại dưới đây và thực hiện các chỉnh sửa cuối cùng để đảm bảo chất lượng cao nhất.

                **Bối cảnh:**
                - Văn bản gốc đã được viết lại theo một mức độ thay đổi cụ thể (${rewriteLevel}%).
                - Ngôn ngữ đầu ra là: ${selectedTargetLangLabel}.
                
                **Nhiệm vụ của bạn:**
                1.  **Đọc và hiểu** toàn bộ văn bản đã được viết lại dưới đây.
                2.  **Sửa lỗi còn sót lại:** Rà soát và sửa bất kỳ lỗi chính tả, ngữ pháp, hoặc dấu câu nào còn sót lại.
                3.  **Đảm bảo tính nhất quán (CRITICAL):**
                    -   **Nhân vật & Bối cảnh:** Đảm bảo tên nhân vật, địa điểm, và các chi tiết quan trọng khác được sử dụng một cách nhất quán trong toàn bộ văn bản. Sửa bất kỳ sự mâu thuẫn nào.
                    -   **Văn phong (Tone of voice):** Đảm bảo văn phong nhất quán, phù hợp với phong cách đã chọn (${rewriteStyle === 'custom' ? customRewriteStyle : rewriteStyle}). Nếu văn bản có vẻ rời rạc hoặc văn phong thay đổi đột ngột giữa các đoạn, hãy điều chỉnh để nó liền mạch.
                4.  **Cải thiện dòng chảy & Khả năng đọc:**
                    -   Điều chỉnh cấu trúc câu và từ nối để câu chuyện trôi chảy và dễ đọc hơn.
                    -   Loại bỏ các câu văn lủng củng hoặc tối nghĩa.

                **Văn bản cần được tinh chỉnh:**
                ---
                ${rewrittenText}
                ---

                **Yêu cầu đầu ra:**
                -   Chỉ trả về phiên bản cuối cùng, hoàn hảo của văn bản bằng ngôn ngữ ${selectedTargetLangLabel}.
                -   KHÔNG thêm bất kỳ bình luận, giải thích hay ghi chú nào. Chỉ có văn bản thuần túy.`;
            
            const finalResult = await generateText(editPrompt, systemInstructionForEdit, signal);
            updateState({ rewrittenText: finalResult, isEditing: false, editLoadingMessage: 'Tinh chỉnh hoàn tất!', hasBeenEdited: true });
             if (finalResult.trim()) {
                addToHistory('rewrite-quick', finalResult.trim(), { originalText, settings: { rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext }});
                setHistoryCount(getModuleHistory('rewrite-quick').length);
            }
        } catch (e) {
             const err = e as Error;
            if (err.name === 'AbortError') {
                updateState({ editError: 'Quá trình đã bị dừng.', editLoadingMessage: 'Đã dừng' });
            } else {
                updateState({ editError: `Lỗi tinh chỉnh: ${err.message}`, editLoadingMessage: 'Lỗi!' });
            }
        } finally {
            updateState({ isEditing: false, editLoadingMessage: null });
            abortControllerRef.current = null;
        }
    };
    
    const [copyButtonText, setCopyButtonText] = useState('Sao chép');
    
    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopyButtonText('Đã sao chép!');
        setTimeout(() => setCopyButtonText('Sao chép'), 2000);
    };
    
    const anyLoading = isProcessing || isEditing;
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
                <div className="flex justify-between items-center">
                    <span><strong>Viết Lại Nhanh.</strong> Sử dụng thanh trượt để điều chỉnh mức độ thay đổi từ chỉnh sửa nhẹ đến sáng tạo hoàn toàn.</span>
                     <button
                        onClick={() => setShowHistory(true)}
                        className="ml-4 px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm rounded-lg transition-colors flex items-center gap-1"
                    >
                        📚 Lịch sử ({historyCount})
                    </button>
                </div>
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
             <div className="flex flex-col items-center gap-4">
                <button onClick={handleSingleRewrite} disabled={anyLoading || !originalText.trim()} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                    Viết lại Văn bản
                </button>
                 {anyLoading && (
                    <button onClick={handleStop} className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-700">
                        Dừng
                    </button>
                )}
            </div>
            {(isProcessing || isEditing) && <LoadingSpinner message={loadingMessage || editLoadingMessage || 'Đang xử lý...'} />}
            {error && <ErrorAlert message={error} />}
            {editError && <ErrorAlert message={editError} />}
            {rewrittenText && !anyLoading && (
                 <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                     <h3 className="text-lg font-semibold mb-2">Văn bản đã viết lại:</h3>
                     <textarea value={rewrittenText} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white"/>
                     <div className="mt-3 flex gap-2">
                        <button onClick={() => copyToClipboard(rewrittenText)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">{copyButtonText}</button>
                        <button onClick={handlePostRewriteEdit} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600" disabled={anyLoading}>Biên Tập & Tinh Chỉnh Lại</button>
                     </div>
                 </div>
            )}
            <HistoryViewer
                module="rewrite-quick"
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
            />
        </div>
    );
};


export default RewriteModule;