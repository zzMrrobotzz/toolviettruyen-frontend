
import React, { useState, useEffect } from 'react';
import { 
    ApiSettings, 
    RewriteModuleState,
    RewriteActiveTab,
    RewriteGoal
} from '../../types'; 
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
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
    const { consumeCredit } = useAppContext();

    const updateQuickState = (updates: Partial<RewriteModuleState['quick']>) => {
        setModuleState(prev => ({ ...prev, quick: { ...prev.quick, ...updates } }));
    };

    const updateRestructureState = (updates: Partial<RewriteModuleState['restructure']>) => {
        setModuleState(prev => ({ ...prev, restructure: { ...prev.restructure, ...updates } }));
    };
    
    const handleTabChange = (tabId: RewriteActiveTab) => {
        setModuleState(prev => ({
            ...prev,
            activeTab: tabId,
            quick: { 
                ...prev.quick, 
                error: null, 
                loadingMessage: null, 
                editError: null, 
                editLoadingMessage: null,
                progress: 0,
                isEditing: false
            },
            restructure: { 
                ...prev.restructure, 
                error: null, 
                loadingMessage: null,
                isLoading: false
            }
        }));
    };

    const anyLoading = moduleState.quick.loadingMessage !== null || moduleState.quick.isEditing || moduleState.restructure.isLoading;

    const generateText = async (prompt: string, systemInstruction?: string, useJsonOutput?: boolean, apiSettings?: ApiSettings) => {
        const request = {
            prompt,
            provider: apiSettings?.provider || 'gemini'
        };

        const result = await generateTextViaBackend(request, (newCredit) => {
            // Update credit if needed
        });

        if (!result.success) {
            throw new Error(result.error || 'AI generation failed');
        }

        return { text: result.text || '' };
    };

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
    state: RewriteModuleState['restructure'];
    updateState: (updates: Partial<RewriteModuleState['restructure']>) => void;
}

const RestructureTab: React.FC<RestructureTabProps> = ({ apiSettings, state, updateState }) => {
    const { consumeCredit } = useAppContext();
    const { 
        step, originalText, goal, perspectiveCharacter, targetGenre, customTargetGenre, 
        targetStyle, customTargetStyle, rewritePlan, rewrittenText, 
        isLoading, loadingMessage, error 
    } = state;

    const generateText = async (prompt: string, systemInstruction?: string, useJsonOutput?: boolean, apiSettings?: ApiSettings) => {
        const request = {
            prompt,
            provider: apiSettings?.provider || 'gemini'
        };

        const result = await generateTextViaBackend(request, (newCredit) => {
            // Update credit if needed
        });

        if (!result.success) {
            throw new Error(result.error || 'AI generation failed');
        }

        return { text: result.text || '' };
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
            const planResult = await generateText(prompt, undefined, false, apiSettings);
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
            const executionResult = await generateText(prompt, undefined, false, apiSettings);
            updateState({ rewrittenText: executionResult.text, step: 'completed', isLoading: false, loadingMessage: null });
        } catch (e) {
            updateState({ error: `Lỗi khi thực thi kế hoạch: ${(e as Error).message}`, isLoading: false, loadingMessage: null });
        }
    };
    
    const resetRestructure = () => {
        updateState({
            step: 'planning',
            originalText: '',
            goal: 'changeStyle',
            perspectiveCharacter: '',
            targetGenre: 'Ngôn tình lãng mạn',
            customTargetGenre: '',
            targetStyle: REWRITE_STYLE_OPTIONS[0].value,
            customTargetStyle: '',
            rewritePlan: '',
            rewrittenText: '',
            isLoading: false,
            loadingMessage: null,
            error: null,
        });
    };

    const renderPlanningStep = () => (
        <div className="space-y-6">
            <InfoBox>
                <strong>Tái Cấu Trúc & Biến Hóa.</strong> Tạo kế hoạch chi tiết trước khi viết lại, đảm bảo kết quả chính xác theo mục tiêu của bạn.
            </InfoBox>
            
            <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow">
                <h3 className="text-xl font-semibold text-gray-800">Cài đặt Tái Cấu Trúc</h3>
                
                <div>
                    <label htmlFor="restructureOriginalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
                    <textarea 
                        id="restructureOriginalText" 
                        value={originalText} 
                        onChange={e => updateState({ originalText: e.target.value })}
                        rows={6} 
                        className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" 
                        placeholder="Nhập văn bản cần tái cấu trúc..."
                        disabled={isLoading}
                    />
                </div>
                
                <div>
                    <label htmlFor="rewriteGoal" className="block text-sm font-medium text-gray-700 mb-1">Mục tiêu tái cấu trúc:</label>
                    <select id="rewriteGoal" value={goal} onChange={e => updateState({ goal: e.target.value as RewriteGoal })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoading}>
                        <option value="changePerspective">Thay đổi góc nhìn</option>
                        <option value="changeGenre">Thay đổi thể loại</option>
                        <option value="changeStyle">Thay đổi phong cách</option>
                        <option value="summarize">Tóm tắt</option>
                        <option value="expand">Mở rộng</option>
                    </select>
                </div>
                
                {goal === 'changePerspective' && (
                    <div>
                        <label htmlFor="perspectiveCharacter" className="block text-sm font-medium text-gray-700 mb-1">Nhân vật góc nhìn mới:</label>
                        <input type="text" id="perspectiveCharacter" value={perspectiveCharacter} onChange={e => updateState({ perspectiveCharacter: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isLoading} />
                    </div>
                )}
                
                {goal === 'changeGenre' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Thể loại mới:</label>
                        <select value={targetGenre} onChange={e => updateState({ targetGenre: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isLoading}>
                            {GENRE_OPTIONS.map(genre => <option key={genre} value={genre}>{genre}</option>)}
                        </select>
                        {targetGenre === 'Tùy chỉnh...' && <input type="text" value={customTargetGenre} onChange={e => updateState({ customTargetGenre: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Nhập thể loại tùy chỉnh" disabled={isLoading}/>}
                    </div>
                )}
                
                {goal === 'changeStyle' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách mới:</label>
                        <select value={targetStyle} onChange={e => updateState({ targetStyle: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isLoading}>
                            {REWRITE_STYLE_OPTIONS.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}
                        </select>
                        {targetStyle === 'custom' && <input type="text" value={customTargetStyle} onChange={e => updateState({ customTargetStyle: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Nhập phong cách tùy chỉnh" disabled={isLoading}/>}
                    </div>
                )}
            </div>
            
            <div className="flex gap-2">
                <button onClick={handleGeneratePlan} disabled={isLoading || !originalText.trim()} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                    Tạo Kế Hoạch
                </button>
                <button onClick={resetRestructure} disabled={isLoading} className="px-4 py-3 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 disabled:opacity-50">
                    Reset
                </button>
            </div>
            
            {isLoading && <LoadingSpinner message={loadingMessage || 'Đang xử lý...'} />}
            {error && <ErrorAlert message={error} />}
        </div>
    );

    const renderReviewingStep = () => (
        <div className="space-y-6">
            <InfoBox>
                <strong>Xem lại Kế Hoạch.</strong> Kiểm tra kế hoạch tái cấu trúc trước khi thực hiện.
            </InfoBox>
            
            <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2">Kế Hoạch Tái Cấu Trúc:</h3>
                <div className="whitespace-pre-wrap text-gray-700">{rewritePlan}</div>
            </div>
            
            <div className="flex gap-2">
                <button onClick={handleExecutePlan} disabled={isLoading} className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                    Thực Hiện Kế Hoạch
                </button>
                <button onClick={() => updateState({ step: 'planning' })} disabled={isLoading} className="px-4 py-3 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 disabled:opacity-50">
                    Chỉnh Sửa Kế Hoạch
                </button>
            </div>
            
            {isLoading && <LoadingSpinner message={loadingMessage || 'Đang xử lý...'} />}
            {error && <ErrorAlert message={error} />}
        </div>
    );

    const renderCompletedStep = () => (
        <div className="space-y-6">
            <InfoBox>
                <strong>Hoàn Thành.</strong> Văn bản đã được tái cấu trúc theo kế hoạch.
            </InfoBox>
            
            <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2">Văn Bản Đã Tái Cấu Trúc:</h3>
                <textarea value={rewrittenText} readOnly rows={12} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white"/>
                <div className="mt-3">
                    <button onClick={() => navigator.clipboard.writeText(rewrittenText)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        Sao Chép
                    </button>
                </div>
            </div>
            
            <div className="flex gap-2">
                <button onClick={() => updateState({ step: 'planning' })} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90">
                    Tái Cấu Trúc Văn Bản Khác
                </button>
                <button onClick={resetRestructure} className="px-4 py-3 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600">
                    Reset Hoàn Toàn
                </button>
            </div>
        </div>
    );

    return (
        <div>
            {step === 'planning' && renderPlanningStep()}
            {step === 'reviewing' && renderReviewingStep()}
            {step === 'completed' && renderCompletedStep()}
        </div>
    );
};

// =================================================================================
// Simple "Quick Rewrite" Tab Component
// =================================================================================

interface QuickRewriteTabProps {
    apiSettings: ApiSettings;
    state: RewriteModuleState['quick'];
    updateState: (updates: Partial<RewriteModuleState['quick']>) => void;
}

const QuickRewriteTab: React.FC<QuickRewriteTabProps> = ({ apiSettings, state, updateState }) => {
    const { consumeCredit } = useAppContext();
    
    const {
        rewriteLevel, sourceLanguage, targetLanguage, rewriteStyle, customRewriteStyle, adaptContext,
        originalText, rewrittenText, error, progress, loadingMessage,
        isEditing, editError, editLoadingMessage, hasBeenEdited, translation
    } = state;

    // Reset loading states on mount to prevent stuck states
    useEffect(() => {
        updateState({
            loadingMessage: null,
            isEditing: false,
            editLoadingMessage: null,
            progress: 0,
            error: null,
            editError: null
        });
    }, [updateState]);

    // Debug effect to track rewrittenText changes
    useEffect(() => {
        console.log('rewrittenText changed:', rewrittenText ? 'Has content' : 'Empty');
    }, [rewrittenText]);

    const generateText = async (prompt: string, systemInstruction?: string, useJsonOutput?: boolean, apiSettings?: ApiSettings) => {
        const request = {
            prompt,
            provider: apiSettings?.provider || 'gemini'
        };

        const result = await generateTextViaBackend(request, (newCredit) => {
            // Update credit if needed
        });

        if (!result.success) {
            throw new Error(result.error || 'AI generation failed');
        }

        return { text: result.text || '' };
    };

    const updateTranslationState = (updates: Partial<RewriteModuleState['quick']['translation']>) => {
        updateState({ translation: { ...translation, ...updates } });
    };

    // Auto-set adaptContext based on language difference
    useEffect(() => {
        if (targetLanguage !== sourceLanguage) {
            updateState({ adaptContext: true }); 
        } else {
            updateState({ adaptContext: false });
        }
    }, [targetLanguage, sourceLanguage, updateState]);

    const handleSingleRewrite = async () => {
        console.log('handleSingleRewrite called');
        
        if (!originalText.trim()) {
            updateState({ error: 'Lỗi: Vui lòng nhập văn bản cần viết lại!' });
            return;
        }
        
        console.log('Checking credits...');
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ error: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }
        
        console.log('Starting rewrite process...');
        updateState({ 
            error: null, 
            rewrittenText: '', 
            progress: 0, 
            loadingMessage: 'Đang chuẩn bị...', 
            hasBeenEdited: false 
        });
        
        const CHUNK_CHAR_COUNT = 4000;
        const numChunks = Math.ceil(originalText.length / CHUNK_CHAR_COUNT);
        let fullRewrittenText = '';

        try {
            console.log(`Processing ${numChunks} chunks...`);
            
            for (let i = 0; i < numChunks; i++) {
                console.log(`Processing chunk ${i + 1}/${numChunks}`);
                
                updateState({ 
                    progress: Math.round(((i + 1) / numChunks) * 100), 
                    loadingMessage: `Đang viết lại phần ${i + 1}/${numChunks}...` 
                });
                
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

                const prompt = `You are an expert multilingual text rewriting AI. Your task is to rewrite the provided text chunk according to the following instructions.

**Instructions:**
- **Source Language:** ${selectedSourceLangLabel}
- **Target Language:** ${selectedTargetLangLabel}
- **Degree of Change Required:** ${rewriteLevel}%. This means you should ${levelDescription}.
- **Rewrite Style:** ${rewriteStyleInstructionPromptSegment}
- **Timestamp Handling (CRITICAL):** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.
- **Coherence:** The rewritten chunk MUST maintain logical consistency with the context from previously rewritten chunks.
${localizationRequest}

**Context from Previous Chunks (already in ${selectedTargetLangLabel}):**
---
${fullRewrittenText || "This is the first chunk."}
---

**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
---
${textChunk}
---

**Your Task:**
Provide ONLY the rewritten text for the current chunk in ${selectedTargetLangLabel}. Do not include any other text, introductions, or explanations.
`;
                
                console.log('Calling generateText...');
                await delay(500); // Simulate API call delay
                const result = await generateTextViaBackend({ prompt, provider: apiSettings?.provider || 'gemini' }, (newCredit) => {
                    // Update credit if needed
                });
                console.log('generateText result:', result);
                
                if (!result.success) {
                    throw new Error(result.error || 'AI generation failed');
                }
                
                fullRewrittenText += (fullRewrittenText ? '\n\n' : '') + result.text.trim();
                console.log('Updating state with chunk result:', fullRewrittenText.substring(0, 100) + '...');
                updateState({ rewrittenText: fullRewrittenText }); // Update UI progressively
            }
            
            console.log('Rewrite completed');
            console.log('Final rewritten text:', fullRewrittenText.trim());
            
            // Force state update with new object
            const finalText = fullRewrittenText.trim();
            updateState({ 
                rewrittenText: finalText,
                loadingMessage: 'Hoàn thành!',
                progress: 100
            });
            
            console.log('State updated with rewritten text');
        } catch (e) {
            console.error('Rewrite error:', e);
            updateState({ 
                error: `Lỗi viết lại: ${(e as Error).message}`, 
                loadingMessage: 'Lỗi!', 
                progress: 0 
            });
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
        
        const editPrompt = `You are a meticulous story editor. Your task is to refine and polish the given text, ensuring consistency, logical flow, and improved style.

**Text to Edit:**
---
${rewrittenText}
---

**Editing Instructions:**
1.  **Consistency:** Ensure character names, locations, and plot points are consistent throughout the text. Correct any contradictions.
2.  **Flow and Cohesion:** Improve the flow between sentences and paragraphs. Ensure smooth transitions.
3.  **Clarity and Conciseness:** Remove repetitive phrases and redundant words. Clarify any confusing sentences.
4.  **Grammar and Spelling:** Correct any grammatical errors or typos.
5.  **Timestamp Check (Final):** Double-check and ensure absolutely NO timestamps (e.g., (11:42)) remain in the final text. The output must be a clean narrative.

**Output:**
Return ONLY the fully edited and polished text. Do not add any commentary or explanations.
`;
        
        try {
            const result = await generateTextViaBackend({ prompt: editPrompt, provider: apiSettings?.provider || 'gemini' }, (newCredit) => {
                // Update credit if needed
            });
            
            if (!result.success) {
                throw new Error(result.error || 'AI generation failed');
            }
            
            updateState({ rewrittenText: result.text, isEditing: false, editLoadingMessage: 'Tinh chỉnh hoàn tất!', hasBeenEdited: true });
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
    console.log('Current state:', { 
        rewrittenText: rewrittenText ? 'Has text' : 'No text', 
        loadingMessage, 
        isEditing, 
        anyLoading 
    });
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
             <div className="flex gap-2">
                 <button onClick={handleSingleRewrite} disabled={anyLoading || !originalText.trim()} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50">
                     Viết lại Văn bản
                 </button>
                 {anyLoading && (
                     <button 
                         onClick={() => updateState({ 
                             loadingMessage: null, 
                             isEditing: false, 
                             editLoadingMessage: null,
                             progress: 0,
                             error: null,
                             editError: null
                         })} 
                         className="px-4 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600"
                         title="Reset trạng thái nếu bị treo"
                     >
                         Reset
                     </button>
                 )}
             </div>
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
             {!rewrittenText && !anyLoading && (
                 <div className="mt-6 p-4 border rounded-lg bg-yellow-50">
                     <h3 className="text-lg font-semibold mb-2 text-yellow-800">Debug Info:</h3>
                     <p className="text-sm text-yellow-700">
                         rewrittenText: {rewrittenText ? 'Has content' : 'Empty'}<br/>
                         loadingMessage: {loadingMessage || 'null'}<br/>
                         isEditing: {isEditing ? 'true' : 'false'}<br/>
                         anyLoading: {anyLoading ? 'true' : 'false'}
                     </p>
                 </div>
             )}
         </div>
     );
};

export default RewriteModule;
