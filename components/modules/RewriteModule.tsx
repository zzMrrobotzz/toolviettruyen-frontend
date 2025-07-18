
import React from 'react';
import { 
    ApiSettings, 
    RewriteModuleState
} from '../../types'; 
import { REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateTextViaBackend } from '../../services/aiProxyService';
import { useAppContext } from '../../AppContext';

interface RewriteModuleProps {
  apiSettings: ApiSettings;
  moduleState: RewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<RewriteModuleState>>;
}

const RewriteModule: React.FC<RewriteModuleProps> = ({ apiSettings, moduleState, setModuleState }) => {
    const { consumeCredit } = useAppContext();

    const updateState = (updates: Partial<RewriteModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    const anyLoading = moduleState.singleLoadingMessage !== null || moduleState.isEditingSingleRewrite;

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

    const handleSingleRewrite = async () => {
        if (!moduleState.singleOriginalText.trim()) {
            updateState({ singleError: 'Vui lòng nhập văn bản cần viết lại!' });
            return;
        }
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ singleError: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }
        updateState({ singleError: null, singleRewrittenText: '', singleProgress: 0, singleLoadingMessage: 'Đang viết lại...' });
        
        try {
            const levelDescriptions: {[key: number]: string} = {
                0: 'only fix spelling and grammar. Keep the original story 100%.',
                25: 'make some changes to words and sentence structures to refresh the text, while strictly preserving the original meaning and plot.',
                50: 'moderately rewrite the wording and style. You can change sentence structures and vocabulary, but MUST keep the main character names and core plot points.',
                75: 'creatively reimagine the story. You can change character names and some settings. The plot may have new developments, but it MUST retain the spirit of the original script.',
                100: 'completely rewrite into a new script. Only retain the "soul" (core idea, main theme) of the original story.'
            };
            const descriptionKey = Math.round(moduleState.rewriteLevel / 25) * 25;
            const levelDescription = levelDescriptions[descriptionKey];

            const prompt = `You are an expert multilingual text rewriting AI. Your task is to rewrite the provided text according to the following instructions.

**Instructions:**
- **Degree of Change Required:** ${moduleState.rewriteLevel}%. This means you should ${levelDescription}.
- **Rewrite Style:** ${moduleState.rewriteStyle === 'custom' ? moduleState.customRewriteStyle : REWRITE_STYLE_OPTIONS.find(opt => opt.value === moduleState.rewriteStyle)?.label || moduleState.rewriteStyle}.

**Original Text:**
---
${moduleState.singleOriginalText}
---

**Your Task:**
Provide ONLY the rewritten text. Do not include any other text, introductions, or explanations.`;

            const result = await generateText(prompt, undefined, false, apiSettings);
            updateState({ singleRewrittenText: result.text.trim(), singleLoadingMessage: 'Hoàn thành!' });
        } catch (e) {
            updateState({ singleError: `Lỗi viết lại: ${(e as Error).message}`, singleLoadingMessage: 'Lỗi!' });
        } finally {
            setTimeout(() => updateState({ singleLoadingMessage: null }), 3000);
        }
    };

    const handlePostRewriteEdit = async () => {
        if (!moduleState.singleRewrittenText.trim()) {
            updateState({ singleRewriteEditError: 'Không có văn bản để tinh chỉnh.' });
            return;
        }
        const hasCredits = await consumeCredit(1);
        if (!hasCredits) {
            updateState({ singleRewriteEditError: 'Không đủ credit để thực hiện thao tác này.' });
            return;
        }
        updateState({ isEditingSingleRewrite: true, singleRewriteEditError: null, singleRewriteEditLoadingMessage: 'Đang tinh chỉnh...' });
        
        try {
            const editPrompt = `You are a meticulous text editor. Your task is to refine and polish the given text, ensuring consistency, logical flow, and improved style.

**Text to Edit:**
---
${moduleState.singleRewrittenText}
---

**Editing Instructions:**
1. **Consistency:** Ensure character names, locations, and plot points are consistent throughout the text.
2. **Flow and Cohesion:** Improve the flow between sentences and paragraphs.
3. **Clarity and Conciseness:** Remove repetitive phrases and redundant words.
4. **Grammar and Spelling:** Correct any grammatical errors or typos.

**Output:**
Return ONLY the fully edited and polished text. Do not add any commentary or explanations.`;

            const result = await generateText(editPrompt, undefined, false, apiSettings);
            updateState({ 
                singleRewrittenText: result.text, 
                isEditingSingleRewrite: false, 
                singleRewriteEditLoadingMessage: 'Tinh chỉnh hoàn tất!', 
                hasSingleRewriteBeenEdited: true 
            });
        } catch (e) {
            updateState({ 
                singleRewriteEditError: `Lỗi tinh chỉnh: ${(e as Error).message}`, 
                isEditingSingleRewrite: false, 
                singleRewriteEditLoadingMessage: 'Lỗi!' 
            });
        } finally {
            setTimeout(() => updateState({ singleRewriteEditLoadingMessage: null }), 3000);
        }
    };

    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        alert("Đã sao chép!");
    };

    return (
        <ModuleContainer title="🔄 Viết Lại & Tái Cấu Trúc">
            <div className="space-y-6">
                <InfoBox>
                    <strong>Viết Lại Văn Bản.</strong> Nhập văn bản gốc và chọn mức độ viết lại từ 0% đến 100%. AI sẽ viết lại văn bản theo yêu cầu của bạn.
                </InfoBox>
                
                <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow">
                    <h3 className="text-xl font-semibold text-gray-800">Cài đặt Viết Lại</h3>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="rewriteSlider" className="text-sm font-medium text-gray-700">Mức độ thay đổi:</label>
                                <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">{moduleState.rewriteLevel}%</span>
                            </div>
                            <input 
                                type="range" 
                                id="rewriteSlider" 
                                min="0" 
                                max="100" 
                                step="25" 
                                value={moduleState.rewriteLevel} 
                                onChange={(e) => updateState({ rewriteLevel: parseInt(e.target.value)})} 
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                                disabled={anyLoading}
                            />
                        </div>
                        
                        <div>
                            <label htmlFor="rewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại:</label>
                            <select 
                                id="rewriteStyle" 
                                value={moduleState.rewriteStyle} 
                                onChange={(e) => updateState({ rewriteStyle: e.target.value })} 
                                className="w-full p-3 border-2 border-gray-300 rounded-lg" 
                                disabled={anyLoading}
                            >
                                {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {moduleState.rewriteStyle === 'custom' && (
                        <div>
                            <label htmlFor="customRewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách tùy chỉnh:</label>
                            <input 
                                type="text" 
                                id="customRewriteStyle" 
                                value={moduleState.customRewriteStyle} 
                                onChange={(e) => updateState({ customRewriteStyle: e.target.value })} 
                                className="w-full p-3 border-2 border-gray-300 rounded-lg" 
                                placeholder="Ví dụ: Kịch tính, hài hước..." 
                                disabled={anyLoading}
                            />
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="originalText" className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc:</label>
                        <textarea 
                            id="originalText" 
                            value={moduleState.singleOriginalText} 
                            onChange={(e) => updateState({ singleOriginalText: e.target.value })} 
                            rows={8} 
                            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                            placeholder="Dán văn bản cần viết lại vào đây..."
                            disabled={anyLoading}
                        />
                    </div>
                    
                    <button
                        onClick={handleSingleRewrite}
                        disabled={anyLoading || !moduleState.singleOriginalText.trim()}
                        className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {anyLoading ? 'Đang viết lại...' : 'Viết Lại Văn Bản'}
                    </button>
                </div>
                
                {moduleState.singleRewrittenText && (
                    <div className="space-y-4 p-6 border-2 border-gray-200 rounded-lg bg-white shadow">
                        <h3 className="text-xl font-semibold text-gray-800">Kết quả viết lại:</h3>
                        <textarea 
                            value={moduleState.singleRewrittenText} 
                            readOnly 
                            rows={12} 
                            className="w-full p-3 border-2 border-gray-200 rounded-md bg-gray-50"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => copyToClipboard(moduleState.singleRewrittenText)}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                                Sao chép
                            </button>
                            <button
                                onClick={handlePostRewriteEdit}
                                disabled={moduleState.isEditingSingleRewrite}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                            >
                                {moduleState.isEditingSingleRewrite ? 'Đang tinh chỉnh...' : 'Tinh chỉnh thêm'}
                            </button>
                        </div>
                    </div>
                )}
                
                {moduleState.singleError && <ErrorAlert message={moduleState.singleError} />}
                {moduleState.singleRewriteEditError && <ErrorAlert message={moduleState.singleRewriteEditError} />}
            </div>
        </ModuleContainer>
    );
};

export default RewriteModule;
