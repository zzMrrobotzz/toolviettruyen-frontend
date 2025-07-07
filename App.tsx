import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveModule, ElevenLabsApiKey, ApiSettings, ApiProvider,
  SuperAgentModuleState, CreativeLabModuleState, 
  WriteStoryModuleState, RewriteModuleState, AnalysisModuleState, TtsModuleState,
  YoutubeSeoModuleState, /* ImageByHookModuleState, */ // Removed
  ViralTitleGeneratorModuleState, ElevenLabsVoice, /* ImageByHookEngine, */ // Removed
  /* BatchImageGeneratorModuleState, */ // Removed
  ImageGenerationSuiteModuleState, ImageGenerationEngine, GeneratedImageItem, // BatchOutlineItem removed from here as it's not directly used by App
  EditStoryModuleState, EditStoryAnalysisReport, BatchStoryWritingModuleState, BatchStoryInputItem,
  BatchRewriteModuleState, BatchRewriteInputItem, EditStoryActiveTab, BatchEditStoryInputItem, // Added BatchRewrite types
  NicheThemeExplorerModuleState, NicheThemeAnalysisResult, // Added for Niche Theme Explorer
  Dream100CompetitorAnalysisModuleState, Dream100ChannelResult, GroundingChunk, // Added for Dream 100
  CharacterStudioModuleState, // Added for Character Studio
  GeminiSubPromptsResponse, // Added for ImageGenerationSuite
  // SupportModuleState is not strictly needed for a static display, but can be added if it evolves
} from './types';
import { 
    NAVIGATION_ITEMS, DEFAULT_API_PROVIDER, HOOK_LANGUAGE_OPTIONS, 
    WRITING_STYLE_OPTIONS, REWRITE_STYLE_OPTIONS, ASPECT_RATIO_OPTIONS, 
    SUPER_AGENT_WORD_COUNT_OPTIONS, PLOT_STRUCTURE_OPTIONS, 
    OUTLINE_DETAIL_LEVEL_OPTIONS, STABILITY_STYLE_PRESETS, IMAGE_GENERATION_ENGINE_OPTIONS, 
    HOOK_STYLE_OPTIONS, HOOK_LENGTH_OPTIONS, STORY_LENGTH_OPTIONS,
    LESSON_LENGTH_OPTIONS, LESSON_WRITING_STYLE_OPTIONS, PREDEFINED_ART_STYLES,
    HOOK_STRUCTURE_OPTIONS, VARIATION_GOAL_OPTIONS // Added VARIATION_GOAL_OPTIONS
} from './constants';
import Sidebar from './components/Sidebar';
import MainHeader from './components/MainHeader';
import ApiSettingsComponent from './components/ApiSettingsComponent';
import SuperAgentModule from './components/modules/SuperAgentModule';
import CreativeLabModule from './components/modules/CreativeLabModule';
import WriteStoryModule from './components/modules/WriteStoryModule';
import RewriteModule from './components/modules/RewriteModule';
import AnalysisModule from './components/modules/AnalysisModule';
import TtsModule from './components/modules/TtsModule';
import YoutubeSeoModule from './components/modules/YoutubeSeoModule';
// import ImageByHookModule from './components/modules/ImageByHookModule'; // Removed
import ViralTitleGeneratorModule from './components/modules/ViralTitleGeneratorModule';
// import BatchImageGeneratorModule from './components/modules/BatchImageGeneratorModule'; // Removed
import ImageGenerationSuiteModule from './components/modules/ImageGenerationSuiteModule';
import EditStoryModule from './components/modules/EditStoryModule'; // Added
import BatchStoryWritingModule from './components/modules/BatchStoryWritingModule'; // Added
import BatchRewriteModule from './components/modules/BatchRewriteModule'; // Added
import NicheThemeExplorerModule from './components/modules/NicheThemeExplorerModule';
import Dream100CompetitorAnalysisModule from './components/modules/Dream100CompetitorAnalysisModule'; // Added
import CharacterStudioModule from './components/modules/CharacterStudioModule'; // Added
import SupportModule from './components/modules/SupportModule'; // Added
import RechargeModule from './components/modules/RechargeModule'; // Đã thêm đúng
import axios from "axios";

// Địa chỉ backend API
const API_BASE = "https://key-manager-backend.onrender.com/api";

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ActiveModule>(ActiveModule.SuperAgent);
  const [elevenLabsApiKeys, setElevenLabsApiKeys] = useState<ElevenLabsApiKey[]>(() => {
    const savedKeys = localStorage.getItem('elevenLabsApiKeys');
    return savedKeys ? JSON.parse(savedKeys) : [];
  });
  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    provider: DEFAULT_API_PROVIDER as ApiProvider,
    apiKey: '',
  });

  const [storyOutlineForWriteModule, setStoryOutlineForWriteModule] = useState<string>('');
  const [outlineForSuperAgent, setOutlineForSuperAgent] = useState<string>('');

  const initialSuperAgentState: SuperAgentModuleState = {
    sourceText: '', wordCount: SUPER_AGENT_WORD_COUNT_OPTIONS[0].value, imageCount: 3, aspectRatio: ASPECT_RATIO_OPTIONS[0].value,
    selectedTtsApiKey: '', availableVoices: [], selectedTtsVoiceId: '',
    generatedStory: '', generatedImages: [], generatedAudioUrl: null, ttsError: null, error: null,
  };
  const [superAgentState, setSuperAgentState] = useState<SuperAgentModuleState>(initialSuperAgentState);


  const initialCreativeLabState: CreativeLabModuleState = {
    ideaLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    plotStructure: PLOT_STRUCTURE_OPTIONS[0].value,
    customPlot: '',
    outlineDetailLevel: OUTLINE_DETAIL_LEVEL_OPTIONS[0].value,
    referenceViralOutline: '', 
    referenceOutlineAnalysisResult: null, // Added
    isAnalyzingReferenceOutline: false, // Added
    errorAnalyzingReferenceOutline: null, // Added
    activeCreativeTab: 'quickOutline',
    quickOutlineTitle: '',
    quickOutlineResult: '',
    quickOutlineError: null,
    quickOutlineLoading: false,
    quickOutlineProgressMessage: null,
    coreIdea: '', 
    secondaryIdea: '',
    emotionalJourney: '', 
    finalOutline: '', 
    singleOutlineError: null,
    singleOutlineLoading: false,
    singleOutlineProgressMessage: null,
    batchCoreIdeas: [''], 
    generatedBatchOutlines: [],
    batchOutlineError: null,
    batchOutlineProgressMessage: null,
    batchOutlineLoading: false,
    batchConcurrencyLimit: 3, // Added
  };
  const [creativeLabState, setCreativeLabState] = useState<CreativeLabModuleState>(initialCreativeLabState);
  
  const initialWriteStoryState: WriteStoryModuleState = {
    activeWriteTab: 'singleStory',
    targetLength: STORY_LENGTH_OPTIONS[1].value, 
    writingStyle: WRITING_STYLE_OPTIONS[0].value, 
    customWritingStyle: '',
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    referenceViralStoryForStyle: '',
    storyOutline: '', 
    generatedStory: '', 
    keyElementsFromSingleStory: null, 
    hasSingleStoryBeenEditedSuccessfully: false, 
    storyError: null, 
    storyProgress: 0, 
    storyLoadingMessage: null,
    singleStoryEditProgress: null,
    storyInputForHook: '', 
    hookLanguage: HOOK_LANGUAGE_OPTIONS[0].value, 
    hookStyle: HOOK_STYLE_OPTIONS[0].value,
    customHookStyle: '',
    hookLength: HOOK_LENGTH_OPTIONS[1].value, 
    hookCount: 3, 
    ctaChannel: '',
    hookStructure: HOOK_STRUCTURE_OPTIONS[0].value, // Added
    generatedHooks: '', 
    hookError: null,
    hookLoadingMessage: null,
    storyInputForLesson: '',
    lessonTargetLength: LESSON_LENGTH_OPTIONS[1].value,
    lessonWritingStyle: LESSON_WRITING_STYLE_OPTIONS[0].value,
    customLessonWritingStyle: '',
    ctaChannelForLesson: '', // Added
    generatedLesson: '',
    lessonError: null,
    lessonLoadingMessage: null,
    // Batch story fields removed
  };

  const [writeStoryState, setWriteStoryState] = useState<WriteStoryModuleState>(() => {
    const savedState = localStorage.getItem('writeStoryModuleState_v1');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        // Ensure output fields are reset, effectively not persisted from localStorage
        return {
          ...initialWriteStoryState, // Start with defaults for output fields
          ...parsedState,            // Override with saved settings
          generatedStory: '',        // Explicitly clear output
          generatedHooks: '',
          generatedLesson: '',
          // storyInputForHook, storyInputForLesson, hookStructure, ctaChannelForLesson will be retained from parsedState if present
          // generatedBatchStories removed
        };
      } catch (error) {
        console.error("Error parsing saved WriteStoryModuleState:", error);
        return initialWriteStoryState;
      }
    }
    return initialWriteStoryState;
  });

  const initialRewriteState: RewriteModuleState = {
    rewriteLevel: 50,
    sourceLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    targetLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    rewriteStyle: REWRITE_STYLE_OPTIONS[0].value,
    customRewriteStyle: '',
    adaptContext: false,
    singleOriginalText: '',
    singleRewrittenText: '',
    singleError: null,
    singleProgress: 0,
    singleLoadingMessage: null,
    isEditingSingleRewrite: false,
    singleRewriteEditError: null,
    singleRewriteEditLoadingMessage: null,
    hasSingleRewriteBeenEdited: false,
  };

  const [rewriteState, setRewriteState] = useState<RewriteModuleState>(() => {
    const savedState = localStorage.getItem('rewriteModuleState_v1');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        // Ensure output fields and session-specific edit statuses are reset
        return {
          ...initialRewriteState,   // Start with defaults for output fields and edit statuses
          ...parsedState,           // Override with saved settings
          singleRewrittenText: '',  // Explicitly clear output
          hasSingleRewriteBeenEdited: false, // Reset edit status
        };
      } catch (error) {
        console.error("Error parsing saved RewriteModuleState:", error);
        return initialRewriteState;
      }
    }
    return initialRewriteState;
  });
  
  const [analysisState, setAnalysisState] = useState<AnalysisModuleState>({
    sourceText: '', analysisFactors: [], suggestions: '', improvedStory: '', viralOutlineAnalysisResult: '',
    loadingMessage: null, errorAnalysis: null, errorImprovement: null, errorViralOutline: null,
  });

  const [ttsState, setTtsState] = useState<TtsModuleState>({
    selectedApiKey: '', voices: [], selectedVoiceId: '', textToSpeak: '', 
    generatedAudioChunks: [], totalCharsLeft: 0, error: null, loadingMessage: null,
  });

  const initialYoutubeSeoState: YoutubeSeoModuleState = {
    activeSeoTab: 'description',
    language: HOOK_LANGUAGE_OPTIONS[0].value,
    loadingMessage: null,
    error: null,
    videoTitle: '',
    youtubeOutline: '',
    timelineCount: 5,
    videoDuration: 10,
    videoKeywords: '',
    youtubeDescription: '',
    youtubeTags: '',
    currentResult: '',
    keywordTopic: '',
    suggestedKeywordsOutput: '',
    chapterScript: '',
    chapterVideoDuration: 10,
    desiredChapterCount: 5,
    generatedChapters: '',
    // New fields for Title & Thumbnail Optimizer
    titleForAnalysis: '',
    titleAnalysisScore: null,
    titleAnalysisFeedback: null,
    suggestedTitles: [],
    shortVideoSummaryForThumbnail: '',
    thumbnailTextSuggestions: [],
    loadingTitleOptimizer: false,
    errorTitleOptimizer: null,
  };
  const [youtubeSeoState, setYoutubeSeoState] = useState<YoutubeSeoModuleState>(initialYoutubeSeoState);
  
  const initialViralTitleGeneratorState: ViralTitleGeneratorModuleState = {
    activeTab: 'generate',
    resultText: '',
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    loadingMessage: null,
    error: null,
    baseTitle: '',
    fixedPrefix: '',
    numVariations: 5,
    viralKeywords: '',
    variationGoal: VARIATION_GOAL_OPTIONS[0].value,
    newContextTheme: '',
    generateVariationsExplanation: null,
    existingViralTitles: '',
    numNewSeriesTitles: 3,
    scriptContent: '',
    channelViralTitles: '',
    numSuggestions: 5,
    analyzeInputType: 'urls',
    analyzeUrls: '',
    analyzeTitles: '',
    analyzeChannelTheme: '',
    analysisReport: '',
    viralFormulas: '',
    applicationSuggestions: '',
    analyzeLoadingMessage: null,
    analyzeError: null,
    groundingSourcesAnalysis: [],
  };
  const [viralTitleGeneratorState, setViralTitleGeneratorState] = useState<ViralTitleGeneratorModuleState>(() => {
    const savedState = localStorage.getItem('viralTitleGeneratorModuleState_v1');
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            return {
                ...initialViralTitleGeneratorState,
                ...parsedState,
                // Reset output fields
                resultText: '',
                analysisReport: '',
                viralFormulas: '',
                applicationSuggestions: '',
                groundingSourcesAnalysis: [],
                generateVariationsExplanation: null,
                // Reset loading/error messages
                loadingMessage: null,
                error: null,
                analyzeLoadingMessage: null,
                analyzeError: null,
            };
        } catch (e) {
            console.error("Error parsing ViralTitleGeneratorModuleState from localStorage", e);
            return initialViralTitleGeneratorState;
        }
    }
    return initialViralTitleGeneratorState;
  });


  const initialImageGenerationSuiteState: ImageGenerationSuiteModuleState = {
    activeTab: 'hookStory', 
    selectedArtStyle: PREDEFINED_ART_STYLES[0].value,
    aspectRatio: ASPECT_RATIO_OPTIONS[0].value,
    imageEngine: IMAGE_GENERATION_ENGINE_OPTIONS[0].value as ImageGenerationEngine,
    stabilityApiKey: '',
    chatGptApiKey: '',
    deepSeekImageApiKey: '',
    stabilityStyle: STABILITY_STYLE_PRESETS[0].value,
    stabilityNegativePrompt: 'text, watermark, blurry, ugly, deformed',
    hookText: '',
    generatedSingleImages: [],
    singleImageOverallError: null,
    singleImageProgressMessage: null,
    promptsInput: '',
    generatedBatchImages: [],
    batchOverallError: null,
    batchProgressMessage: null,
    hookTextForCtxPrompts: '',
    generatedCtxPrompts: [],
    ctxPromptsError: null,
    ctxPromptsLoadingMessage: null,
    settingsError: null,
    showRefinementModal: false,
    activeRefinementItem: null,
    refinementPrompt: '',
    isRefining: false,
    refinementError: null,
  };
  const [imageGenerationSuiteState, setImageGenerationSuiteState] = useState<ImageGenerationSuiteModuleState>(() => {
      const savedState = localStorage.getItem('imageGenerationSuiteState_v1');
      if (savedState) {
          try {
              const parsedState = JSON.parse(savedState);
              // Ensure activeTab is valid, default if not
              const validTabs: ImageGenerationSuiteModuleState['activeTab'][] = ['hookStory', 'batch', 'intelligentContextImageGenerator', 'intelligentContextPromptGenerator'];
              let currentActiveTab = parsedState.activeTab;
              if (currentActiveTab === 'contextualHookStory') { // Migration for old name
                currentActiveTab = 'intelligentContextImageGenerator';
              }
              if (!validTabs.includes(currentActiveTab)) {
                currentActiveTab = 'hookStory';
              }
              

              return {
                  ...initialImageGenerationSuiteState,
                  ...parsedState,
                  activeTab: currentActiveTab, // Ensure activeTab is valid
                  generatedSingleImages: [], // Clear outputs
                  generatedBatchImages: [],
                  singleImageOverallError: null,
                  singleImageProgressMessage: null,
                  batchOverallError: null,
                  batchProgressMessage: null,
                  generatedCtxPrompts: [], // Clear new output
                  ctxPromptsError: null,
                  ctxPromptsLoadingMessage: null,
                  settingsError: null,
                  showRefinementModal: false,
                  activeRefinementItem: null,
                  refinementPrompt: '',
                  isRefining: false,
                  refinementError: null,
              };
          } catch (e) {
              console.error("Error parsing ImageGenerationSuiteModuleState from localStorage", e);
              return initialImageGenerationSuiteState;
          }
      }
      return initialImageGenerationSuiteState;
  });

  const initialEditStoryState: EditStoryModuleState = {
    activeTab: 'single', // Default to single edit tab
    originalStoryToEdit: '',
    outlineForEditing: '',
    targetLengthForEditing: STORY_LENGTH_OPTIONS[1].value, 
    languageForEditing: HOOK_LANGUAGE_OPTIONS[0].value,
    editedStoryOutput: '',
    isLoadingEditing: false,
    loadingMessageEditing: null,
    errorEditing: null,
    postEditAnalysis: null,
    // New fields for interactive refinement
    refinementInstruction: '',
    isRefiningFurther: false,
    furtherRefinementError: null,
    // Batch edit fields
    batchInputItems: [{ id: Date.now().toString(), originalStory: '', outline: null, specificTargetLength: null, specificLanguage: null }],
    batchResults: [],
    isProcessingBatchEdit: false,
    batchEditProgressMessage: null,
    batchEditError: null,
    batchConcurrencyLimit: 3,
  };
  const [editStoryState, setEditStoryState] = useState<EditStoryModuleState>(() => {
    const savedState = localStorage.getItem('editStoryModuleState_v1');
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            return {
                ...initialEditStoryState, // Start with defaults for output/processing fields
                ...parsedState,           // Override with saved settings (activeTab, inputs)
                editedStoryOutput: '',    // Clear single edit output
                postEditAnalysis: null,   // Clear single edit analysis
                isLoadingEditing: false,
                loadingMessageEditing: null,
                refinementInstruction: '', // Clear refinement instruction
                isRefiningFurther: false,
                furtherRefinementError: null,
                batchResults: [],         // Clear batch results
                isProcessingBatchEdit: false,
                batchEditProgressMessage: null,
            };
        } catch (error) {
            console.error("Error parsing saved EditStoryModuleState:", error);
            return initialEditStoryState;
        }
    }
    return initialEditStoryState;
  });

  const initialBatchStoryWritingState: BatchStoryWritingModuleState = {
    inputItems: [{ id: Date.now().toString(), outline: '', specificTargetLength: null, specificWritingStyle: null, specificCustomWritingStyle: null }],
    results: [],
    globalTargetLength: STORY_LENGTH_OPTIONS[1].value,
    globalWritingStyle: WRITING_STYLE_OPTIONS[0].value,
    globalCustomWritingStyle: '',
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    referenceViralStoryForStyle: '',
    isProcessingBatch: false,
    batchProgressMessage: null,
    batchError: null,
    concurrencyLimit: 3,
  };
  const [batchStoryWritingState, setBatchStoryWritingState] = useState<BatchStoryWritingModuleState>(initialBatchStoryWritingState);

  const initialBatchRewriteState: BatchRewriteModuleState = {
    inputItems: [{ id: Date.now().toString(), originalText: '' }],
    results: [],
    globalRewriteLevel: 50,
    globalSourceLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    globalTargetLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    globalRewriteStyle: REWRITE_STYLE_OPTIONS[0].value,
    globalCustomRewriteStyle: '',
    globalAdaptContext: false,
    isProcessingBatch: false,
    batchProgressMessage: null,
    batchError: null,
    concurrencyLimit: 3, // Added
  };
  const [batchRewriteState, setBatchRewriteState] = useState<BatchRewriteModuleState>(initialBatchRewriteState);

  const initialNicheThemeExplorerState: NicheThemeExplorerModuleState = {
    inputTitles: '',
    inputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    numNichesToSuggest: 3,
    analysisResults: [],
    isLoading: false,
    error: null,
    progressMessage: null,
  };
  const [nicheThemeExplorerState, setNicheThemeExplorerState] = useState<NicheThemeExplorerModuleState>(() => {
    const savedState = localStorage.getItem('nicheThemeExplorerModuleState_v1');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            return {
                ...initialNicheThemeExplorerState,
                ...parsed,
                analysisResults: [],
                isLoading: false,
                error: null,
                progressMessage: null,
            };
        } catch (e) {
            console.error("Error parsing NicheThemeExplorerModuleState from localStorage", e);
            return initialNicheThemeExplorerState;
        }
    }
    return initialNicheThemeExplorerState;
  });

  const initialDream100State: Dream100CompetitorAnalysisModuleState = {
    inputChannelUrl: '',
    numberOfSuggestions: 5,
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    analysisResults: [],
    isLoading: false,
    error: null,
    progressMessage: null,
    groundingSources: [],
    searchForNewChannels: false,
    newChannelTimeframe: 'any',
    viewProfile: 'any',
  };
  const [dream100State, setDream100State] = useState<Dream100CompetitorAnalysisModuleState>(initialDream100State);

  const initialCharacterStudioState: CharacterStudioModuleState = {
    characterName: '',
    characterAge: '',
    characterGender: '', // Added
    characterCountry: '',
    characterProfession: '',
    characterKeyFeatures: '', // Added

    inputLanguage: HOOK_LANGUAGE_OPTIONS[0].value, 
    outputLanguage: HOOK_LANGUAGE_OPTIONS[1].value, 
    
    generatedBaseCharacterPrompt: '',
    isLoadingBasePrompt: false,
    errorBasePrompt: null,
    progressMessageBasePrompt: null,

    refinementInstructionForBasePrompt: '', // Added
    isLoadingRefinementForBasePrompt: false, // Added
    errorRefinementForBasePrompt: null, // Added
    
    characterAction: '',
    generatedCompleteImagePrompt: '',
    isLoadingCompletePrompt: false,
    errorCompletePrompt: null,
    progressMessageCompletePrompt: null,
  };
  const [characterStudioState, setCharacterStudioState] = useState<CharacterStudioModuleState>(initialCharacterStudioState);

  const [key, setKey] = useState<string>(localStorage.getItem("license_key") || "");
  const [isValid, setIsValid] = useState<boolean>(!!key);
  const [inputKey, setInputKey] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [keyInfo, setKeyInfo] = useState<any>(null);

  // Hàm xác thực key
  const handleValidateKey = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/validate`, { key: inputKey });
      if (res.data.valid) {
        setKey(inputKey);
        setIsValid(true);
        setKeyInfo(res.data.keyInfo);
        localStorage.setItem("license_key", inputKey);
        localStorage.setItem("license_key_info", JSON.stringify(res.data.keyInfo));
      } else {
        setError("Key không hợp lệ hoặc đã bị thu hồi!");
      }
    } catch (err) {
      setError("Không kết nối được tới server!");
    }
    setLoading(false);
  };

  useEffect(() => {
    localStorage.setItem('elevenLabsApiKeys', JSON.stringify(elevenLabsApiKeys));
  }, [elevenLabsApiKeys]);

  useEffect(() => {
    const stateToSave: Partial<WriteStoryModuleState> = { ...writeStoryState };
    // Remove output fields before saving to localStorage
    delete stateToSave.generatedStory;
    delete stateToSave.generatedHooks;
    delete stateToSave.generatedLesson;
    // storyInputForHook, storyInputForLesson, hookStructure, ctaChannelForLesson are inputs/settings, so they should persist.
    delete stateToSave.storyLoadingMessage;
    delete stateToSave.storyProgress;
    delete stateToSave.singleStoryEditProgress;
    delete stateToSave.hookLoadingMessage;
    delete stateToSave.lessonLoadingMessage;
    // deleted batch story fields

    localStorage.setItem('writeStoryModuleState_v1', JSON.stringify(stateToSave));
  }, [writeStoryState]);

  useEffect(() => {
    const stateToSave: Partial<RewriteModuleState> = { ...rewriteState };
    // Remove output fields and session-specific edit statuses/messages before saving
    delete stateToSave.singleRewrittenText;
    delete stateToSave.singleLoadingMessage;
    delete stateToSave.singleProgress;
    delete stateToSave.isEditingSingleRewrite;
    delete stateToSave.singleRewriteEditError;
    delete stateToSave.singleRewriteEditLoadingMessage;
    delete stateToSave.hasSingleRewriteBeenEdited;
    
    localStorage.setItem('rewriteModuleState_v1', JSON.stringify(stateToSave));
  }, [rewriteState]);

   useEffect(() => {
    const stateToSave: Partial<BatchStoryWritingModuleState> = { ...batchStoryWritingState };
    delete stateToSave.results;
    delete stateToSave.isProcessingBatch;
    delete stateToSave.batchProgressMessage;
    delete stateToSave.batchError;
    localStorage.setItem('batchStoryWritingModuleState_v1', JSON.stringify(stateToSave));
  }, [batchStoryWritingState]);

  useEffect(() => {
    const stateToSave: Partial<BatchRewriteModuleState> = { ...batchRewriteState };
    delete stateToSave.results;
    delete stateToSave.isProcessingBatch;
    delete stateToSave.batchProgressMessage;
    delete stateToSave.batchError;
    // Input items are settings, so they can be saved
    // delete stateToSave.inputItems; // No, keep input items
    localStorage.setItem('batchRewriteModuleState_v1', JSON.stringify(stateToSave));
  }, [batchRewriteState]);

  useEffect(() => {
    const stateToSave: Partial<EditStoryModuleState> = { ...editStoryState };
    // Persist activeTab, inputs for single and batch, and global settings for single edit
    // Clear outputs and processing states
    delete stateToSave.editedStoryOutput;
    delete stateToSave.postEditAnalysis;
    delete stateToSave.isLoadingEditing;
    delete stateToSave.loadingMessageEditing;
    delete stateToSave.errorEditing;
    // Clear refinement specific states not to be persisted
    delete stateToSave.isRefiningFurther;
    delete stateToSave.furtherRefinementError;
    // refinementInstruction is an input, so it can be persisted if desired, or cleared here.
    // For now, let's clear it for a fresh start each time.
    delete stateToSave.refinementInstruction;
    
    delete stateToSave.batchResults;
    delete stateToSave.isProcessingBatchEdit;
    delete stateToSave.batchEditProgressMessage;
    delete stateToSave.batchEditError;
    localStorage.setItem('editStoryModuleState_v1', JSON.stringify(stateToSave));
  }, [editStoryState]);
  
  useEffect(() => {
    const stateToSave: Partial<CreativeLabModuleState> = { ...creativeLabState };
    // Clear outputs
    delete stateToSave.quickOutlineResult;
    delete stateToSave.finalOutline;
    delete stateToSave.generatedBatchOutlines;
    delete stateToSave.referenceOutlineAnalysisResult;
    // Clear loading/error states
    delete stateToSave.quickOutlineLoading;
    delete stateToSave.singleOutlineLoading;
    delete stateToSave.batchOutlineLoading;
    delete stateToSave.isAnalyzingReferenceOutline;
    delete stateToSave.quickOutlineError;
    delete stateToSave.singleOutlineError;
    delete stateToSave.batchOutlineError;
    delete stateToSave.errorAnalyzingReferenceOutline;
    delete stateToSave.quickOutlineProgressMessage;
    delete stateToSave.singleOutlineProgressMessage;
    delete stateToSave.batchOutlineProgressMessage;
    
    localStorage.setItem('creativeLabModuleState_v1', JSON.stringify(stateToSave));
  }, [creativeLabState]);

  useEffect(() => {
    const stateToSave: Partial<YoutubeSeoModuleState> = { ...youtubeSeoState };
    // Clear output fields for each tab
    delete stateToSave.youtubeDescription;
    delete stateToSave.youtubeTags;
    delete stateToSave.suggestedKeywordsOutput;
    delete stateToSave.generatedChapters;
    delete stateToSave.currentResult; // General output field
    // Clear new title optimizer output fields
    delete stateToSave.titleAnalysisScore;
    delete stateToSave.titleAnalysisFeedback;
    delete stateToSave.suggestedTitles;
    delete stateToSave.thumbnailTextSuggestions;
    // Clear loading/error states
    delete stateToSave.loadingMessage;
    delete stateToSave.error;
    delete stateToSave.loadingTitleOptimizer;
    delete stateToSave.errorTitleOptimizer;
    localStorage.setItem('youtubeSeoModuleState_v1', JSON.stringify(stateToSave));
  }, [youtubeSeoState]);

  useEffect(() => {
    const stateToSave: Partial<NicheThemeExplorerModuleState> = { ...nicheThemeExplorerState };
    delete stateToSave.analysisResults;
    delete stateToSave.isLoading;
    delete stateToSave.error;
    delete stateToSave.progressMessage;
    localStorage.setItem('nicheThemeExplorerModuleState_v1', JSON.stringify(stateToSave));
  }, [nicheThemeExplorerState]);

  useEffect(() => {
    const stateToSave: Partial<Dream100CompetitorAnalysisModuleState> = { ...dream100State };
    delete stateToSave.analysisResults;
    delete stateToSave.isLoading;
    delete stateToSave.error;
    delete stateToSave.progressMessage;
    delete stateToSave.groundingSources;
    // Settings fields like inputChannelUrl, numberOfSuggestions, outputLanguage,
    // and the new filter preferences (searchForNewChannels, newChannelTimeframe, viewProfile)
    // should be persisted if that's the desired behavior.
    // If they should reset on reload, add them to delete list here.
    // For now, assuming they are settings and should be saved.
    localStorage.setItem('dream100CompetitorAnalysisModuleState_v1', JSON.stringify(stateToSave));
  }, [dream100State]);

  useEffect(() => {
    const stateToSave: Partial<CharacterStudioModuleState> = { ...characterStudioState };
    // Clear all output and processing-related fields
    delete stateToSave.generatedBaseCharacterPrompt;
    delete stateToSave.isLoadingBasePrompt;
    delete stateToSave.errorBasePrompt;
    delete stateToSave.progressMessageBasePrompt;
    
    delete stateToSave.isLoadingRefinementForBasePrompt; // Added
    delete stateToSave.errorRefinementForBasePrompt; // Added
    // refinementInstructionForBasePrompt is an input, so it can persist

    delete stateToSave.generatedCompleteImagePrompt;
    delete stateToSave.isLoadingCompletePrompt;
    delete stateToSave.errorCompletePrompt;
    delete stateToSave.progressMessageCompletePrompt;
    
    localStorage.setItem('characterStudioModuleState_v1', JSON.stringify(stateToSave));
  }, [characterStudioState]);

  useEffect(() => {
    const stateToSave: Partial<ImageGenerationSuiteModuleState> = {...imageGenerationSuiteState};
    delete stateToSave.generatedSingleImages;
    delete stateToSave.singleImageOverallError;
    delete stateToSave.singleImageProgressMessage;
    delete stateToSave.generatedBatchImages;
    delete stateToSave.batchOverallError;
    delete stateToSave.batchProgressMessage;
    delete stateToSave.generatedCtxPrompts;
    delete stateToSave.ctxPromptsError;
    delete stateToSave.ctxPromptsLoadingMessage;
    delete stateToSave.settingsError;
    delete stateToSave.showRefinementModal;
    delete stateToSave.activeRefinementItem;
    delete stateToSave.refinementPrompt;
    delete stateToSave.isRefining;
    delete stateToSave.refinementError;
    localStorage.setItem('imageGenerationSuiteState_v1', JSON.stringify(stateToSave));
  }, [imageGenerationSuiteState]);

  useEffect(() => {
    const stateToSave: Partial<ViralTitleGeneratorModuleState> = {...viralTitleGeneratorState};
    // Reset output fields
    delete stateToSave.resultText;
    delete stateToSave.analysisReport;
    delete stateToSave.viralFormulas;
    delete stateToSave.applicationSuggestions;
    delete stateToSave.groundingSourcesAnalysis;
    delete stateToSave.generateVariationsExplanation;
    // Reset loading/error messages
    delete stateToSave.loadingMessage;
    delete stateToSave.error;
    delete stateToSave.analyzeLoadingMessage;
    delete stateToSave.analyzeError;
    localStorage.setItem('viralTitleGeneratorModuleState_v1', JSON.stringify(stateToSave));
  }, [viralTitleGeneratorState]);


  useEffect(() => {
     if(outlineForSuperAgent){
        setSuperAgentState(prev => ({...prev, sourceText: outlineForSuperAgent}));
        // Optional: clear it after transferring if it's a one-time transfer
        // setOutlineForSuperAgent(''); 
     }
  }, [outlineForSuperAgent]);

  useEffect(() => {
    if(storyOutlineForWriteModule) {
      setWriteStoryState(prev => ({
        ...prev, 
        storyOutline: storyOutlineForWriteModule, 
        activeWriteTab: 'singleStory', 
        generatedStory: '', 
        keyElementsFromSingleStory: null, 
        hasSingleStoryBeenEditedSuccessfully: false, 
        storyError: null, 
        storyLoadingMessage: null,
        singleStoryEditProgress: null, 
        generatedHooks: '', 
        hookError: null,
        hookLoadingMessage: null,
        // storyInputForHook: '', // Do not clear storyInputForHook here, let user manage it
      }));
      // Also update EditStoryModule if it's the active one and its single edit outline is empty
       if (activeModule === ActiveModule.EditStory && !editStoryState.originalStoryToEdit) { // Check if story is empty before filling outline
            setEditStoryState(prevEdit => ({
                ...prevEdit,
                outlineForEditing: storyOutlineForWriteModule,
                activeTab: 'single' // Default to single tab when outline is passed
            }));
        }
    }
  }, [storyOutlineForWriteModule, activeModule, editStoryState.originalStoryToEdit]);

  useEffect(() => {
    const savedKey = localStorage.getItem("license_key");
    if (savedKey) {
      axios.post(`${API_BASE}/validate`, { key: savedKey }).then(res => {
        if (res.data.valid) {
          setIsValid(true);
          setKey(savedKey);
          setKeyInfo(res.data.keyInfo);
          localStorage.setItem("license_key_info", JSON.stringify(res.data.keyInfo));
        } else {
          setIsValid(false);
          setKey("");
          setKeyInfo(null);
          localStorage.removeItem("license_key");
          localStorage.removeItem("license_key_info");
        }
      }).catch(() => {
        setIsValid(false);
        setKey("");
        setKeyInfo(null);
      });
    }
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case ActiveModule.SuperAgent:
        return <SuperAgentModule 
                  apiSettings={apiSettings} 
                  elevenLabsApiKeys={elevenLabsApiKeys}
                  setElevenLabsApiKeys={setElevenLabsApiKeys}
                  moduleState={superAgentState}
                  setModuleState={setSuperAgentState}
                />;
      case ActiveModule.CreativeLab:
        return <CreativeLabModule 
                  apiSettings={apiSettings} 
                  setActiveModule={setActiveModule}
                  setStoryOutlineForWriteModule={setStoryOutlineForWriteModule} 
                  // onSendBatchOutlinesToStoryModule removed
                  setOutlineForSuperAgent={setOutlineForSuperAgent}
                  moduleState={creativeLabState}
                  setModuleState={setCreativeLabState}
                />;
      case ActiveModule.WriteStory:
        return <WriteStoryModule 
                  apiSettings={apiSettings}
                  moduleState={writeStoryState}
                  setModuleState={setWriteStoryState}
                  retrievedViralOutlineFromAnalysis={analysisState.viralOutlineAnalysisResult}
                />;
      case ActiveModule.BatchStoryWriting: // Added
        return <BatchStoryWritingModule 
                  apiSettings={apiSettings}
                  moduleState={batchStoryWritingState}
                  setModuleState={setBatchStoryWritingState}
                />;
      case ActiveModule.Rewrite:
        return <RewriteModule 
                  apiSettings={apiSettings} 
                  moduleState={rewriteState}
                  setModuleState={setRewriteState}
                />;
      case ActiveModule.BatchRewrite: // Added
        return <BatchRewriteModule 
                  apiSettings={apiSettings} 
                  moduleState={batchRewriteState}
                  setModuleState={setBatchRewriteState}
                />;
      case ActiveModule.Analysis:
        return <AnalysisModule 
                  apiSettings={apiSettings}
                  moduleState={analysisState}
                  setModuleState={setAnalysisState}
                />;
       case ActiveModule.NicheThemeExplorer:
        return <NicheThemeExplorerModule 
                  apiSettings={apiSettings}
                  moduleState={nicheThemeExplorerState}
                  setModuleState={setNicheThemeExplorerState}
                />;
       case ActiveModule.Dream100CompetitorAnalysis: // Added
        return <Dream100CompetitorAnalysisModule
                  apiSettings={apiSettings}
                  moduleState={dream100State}
                  setModuleState={setDream100State}
                />;
      case ActiveModule.TTS:
        return <TtsModule 
                  apiSettings={apiSettings}
                  elevenLabsApiKeys={elevenLabsApiKeys} 
                  setElevenLabsApiKeys={setElevenLabsApiKeys}
                  moduleState={ttsState}
                  setModuleState={setTtsState}
                />;
      case ActiveModule.YouTubeSEO:
        return <YoutubeSeoModule 
                  apiSettings={apiSettings}
                  moduleState={youtubeSeoState}
                  setModuleState={setYoutubeSeoState}
                />;
      case ActiveModule.ViralTitleGenerator:
        return <ViralTitleGeneratorModule 
                  apiSettings={apiSettings}
                  moduleState={viralTitleGeneratorState}
                  setModuleState={setViralTitleGeneratorState}
                 />;
      case ActiveModule.ImageGenerationSuite: 
        return <ImageGenerationSuiteModule 
                  apiSettings={apiSettings} 
                  moduleState={imageGenerationSuiteState}
                  setModuleState={setImageGenerationSuiteState}
                />;
      case ActiveModule.CharacterStudio: // Added
        return <CharacterStudioModule
                  apiSettings={apiSettings}
                  moduleState={characterStudioState}
                  setModuleState={setCharacterStudioState}
                />;
      case ActiveModule.EditStory:
        return <EditStoryModule
                  apiSettings={apiSettings}
                  moduleState={editStoryState}
                  setModuleState={setEditStoryState}
                />;
      case ActiveModule.Support: 
        return <SupportModule />;
      case ActiveModule.Recharge:
        return <RechargeModule currentKey={key} />;
      default:
        return <div className="p-6 text-center text-gray-600">Chọn một module từ thanh bên để bắt đầu.</div>;
    }
  };

  // Nếu chưa xác thực key, chỉ hiện form nhập key
  if (!isValid) {
    return (
      <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center" }}>
        <h2>Nhập Key Bản Quyền</h2>
        <input
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          placeholder="Nhập key..."
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />
        <br />
        <button onClick={handleValidateKey} disabled={loading || !inputKey}>
          {loading ? "Đang kiểm tra..." : "Xác thực key"}
        </button>
        {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 to-gray-800">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />
      <main className="flex-1 ml-64 p-3 md:p-6 bg-gray-100 rounded-l-3xl shadow-2xl overflow-y-auto">
        <div className="bg-white shadow-xl rounded-2xl min-h-full flex flex-col">
            <MainHeader />
            <div className="p-4 md:p-8 flex-grow">
                <ApiSettingsComponent apiSettings={apiSettings} setApiSettings={setApiSettings} />
                {renderActiveModule()}
                {keyInfo && (
                  <div style={{ background: "#f6f6f6", padding: 16, marginBottom: 16, borderRadius: 8 }}>
                    <b>Thông tin key:</b>
                    <ul>
                      <li><b>Key:</b> {keyInfo.key}</li>
                      <li><b>Ngày tạo:</b> {keyInfo.createdAt ? new Date(keyInfo.createdAt).toLocaleString() : "---"}</li>
                      <li><b>Ngày hết hạn:</b> {keyInfo.expiredAt ? new Date(keyInfo.expiredAt).toLocaleDateString() : "---"}</li>
                      <li><b>Số máy tối đa:</b> {keyInfo.maxActivations || 1}</li>
                      <li><b>Ghi chú:</b> {keyInfo.note || "---"}</li>
                      <li><b>Trạng thái:</b> {keyInfo.isActive ? "Hoạt động" : "Đã thu hồi"}</li>
                    </ul>
                  </div>
                )}
                <button
                  style={{ float: "right", margin: 10 }}
                  onClick={() => {
                    setIsValid(false);
                    setKey("");
                    setKeyInfo(null);
                    localStorage.removeItem("license_key");
                    localStorage.removeItem("license_key_info");
                  }}
                >
                  Đăng xuất / Đổi key
                </button>
            </div>
            <footer className="text-center p-6 text-sm text-gray-500 border-t border-gray-200 mt-auto">
                © {new Date().getFullYear()} AI Story - ALL IN ONE by Đức Đại MMO. Tất cả các quyền được bảo lưu. Liên hệ: <a href="mailto:ducdaimmo.contact@gmail.com" className="text-indigo-600 hover:underline">ducdaimmo.contact@gmail.com</a>
            </footer>
        </div>
      </main>
    </div>
  );
};

export default App;