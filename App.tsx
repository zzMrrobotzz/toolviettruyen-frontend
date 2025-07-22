import React, { useState, useEffect } from 'react';
import { useAppContext } from './AppContext';
import KeyValidationModal from './components/KeyValidationModal';
import LoadingSpinner from './components/LoadingSpinner';
import {
  ActiveModule, ElevenLabsApiKey, ApiSettings, ApiProvider,
  SuperAgentModuleState, CreativeLabModuleState, 
  WriteStoryModuleState, RewriteModuleState, AnalysisModuleState, TtsModuleState,
  YoutubeSeoModuleState,
  ViralTitleGeneratorModuleState, ElevenLabsVoice,
  ImageGenerationSuiteModuleState, ImageGenerationEngine, GeneratedImageItem,
  EditStoryModuleState, BatchStoryWritingModuleState,
  BatchRewriteModuleState,
  NicheThemeExplorerModuleState,
  Dream100CompetitorAnalysisModuleState,
  CharacterStudioModuleState,
  GeminiSubPromptsResponse
} from './types';
import { 
    NAVIGATION_ITEMS, DEFAULT_API_PROVIDER, HOOK_LANGUAGE_OPTIONS, 
    WRITING_STYLE_OPTIONS, REWRITE_STYLE_OPTIONS, ASPECT_RATIO_OPTIONS, 
    SUPER_AGENT_WORD_COUNT_OPTIONS, PLOT_STRUCTURE_OPTIONS, 
    OUTLINE_DETAIL_LEVEL_OPTIONS, STABILITY_STYLE_PRESETS, IMAGE_GENERATION_ENGINE_OPTIONS, 
    HOOK_STYLE_OPTIONS, HOOK_LENGTH_OPTIONS, STORY_LENGTH_OPTIONS,
    LESSON_LENGTH_OPTIONS, LESSON_WRITING_STYLE_OPTIONS, PREDEFINED_ART_STYLES,
    HOOK_STRUCTURE_OPTIONS, VARIATION_GOAL_OPTIONS
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
import ViralTitleGeneratorModule from './components/modules/ViralTitleGeneratorModule';
import ImageGenerationSuiteModule from './components/modules/ImageGenerationSuiteModule';
import EditStoryModule from './components/modules/EditStoryModule';
import BatchStoryWritingModule from './components/modules/BatchStoryWritingModule';
import BatchRewriteModule from './components/modules/BatchRewriteModule';
import NicheThemeExplorerModule from './components/modules/NicheThemeExplorerModule';
import Dream100CompetitorAnalysisModule from './components/modules/Dream100CompetitorAnalysisModule';
import CharacterStudioModule from './components/modules/CharacterStudioModule';
import SupportModule from './components/modules/SupportModule';
import RechargeModule from './components/modules/RechargeModule';

const App: React.FC = () => {
  const { keyInfo, isLoading, apiSettings, setApiSettings } = useAppContext();
  const [activeModule, setActiveModule] = useState<ActiveModule>(ActiveModule.SuperAgent);
  const [elevenLabsApiKeys, setElevenLabsApiKeys] = useState<ElevenLabsApiKey[]>(() => {
    const savedKeys = localStorage.getItem('elevenLabsApiKeys');
    return savedKeys ? JSON.parse(savedKeys) : [];
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
    referenceOutlineAnalysisResult: null,
    isAnalyzingReferenceOutline: false,
    errorAnalyzingReferenceOutline: null,
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
    batchConcurrencyLimit: 3,
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
    hookStructure: HOOK_STRUCTURE_OPTIONS[0].value,
    generatedHooks: '', 
    hookError: null,
    hookLoadingMessage: null,
    storyInputForLesson: '',
    lessonTargetLength: LESSON_LENGTH_OPTIONS[1].value,
    lessonWritingStyle: LESSON_WRITING_STYLE_OPTIONS[0].value,
    customLessonWritingStyle: '',
    ctaChannelForLesson: '',
    generatedLesson: '',
    lessonError: null,
    lessonLoadingMessage: null,
    storyTranslation: {
      translatedText: null,
      isTranslating: false,
      error: null,
    },
  };

  const [writeStoryState, setWriteStoryState] = useState<WriteStoryModuleState>(initialWriteStoryState);

  const initialRewriteState: RewriteModuleState = {
    rewriteLevel: 50,
    sourceLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    targetLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    rewriteStyle: REWRITE_STYLE_OPTIONS[0].value,
    customRewriteStyle: '',
    adaptContext: false,
    originalText: '',
    rewrittenText: '',
    error: null,
    progress: 0,
    loadingMessage: null,
    isProcessing: false,
    isEditing: false,
    editError: null,
    editLoadingMessage: null,
    hasBeenEdited: false,
    translation: {
      translatedText: null,
      isTranslating: false,
      error: null,
    },
  };

  const [rewriteState, setRewriteState] = useState<RewriteModuleState>(() => {
    const savedState = localStorage.getItem('rewriteModuleState_v1');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        return { ...initialRewriteState, ...parsed };
      } catch (e) {
        console.error("Failed to parse rewriteModuleState from localStorage", e);
      }
    }
    return initialRewriteState;
  });

  // Thêm useEffect để lưu lại rewriteState vào localStorage mỗi khi thay đổi
  useEffect(() => {
    localStorage.setItem('rewriteModuleState_v1', JSON.stringify(rewriteState));
  }, [rewriteState]);
  
  const [analysisState, setAnalysisState] = useState<AnalysisModuleState>({
    sourceText: '', analysisFactors: [], suggestions: '', improvedStory: '', viralOutlineAnalysisResult: '',
    loadingMessage: null, errorAnalysis: null, errorImprovement: null, errorViralOutline: null,
  });

  const [ttsState, setTtsState] = useState<TtsModuleState>({
    selectedApiKey: '',
    voices: [],
    selectedVoiceId: '',
    textToSpeak: '',
    generatedAudioChunks: [],
    totalCharsLeft: '',
    error: null,
    loadingMessage: null,
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
  const [viralTitleGeneratorState, setViralTitleGeneratorState] = useState<ViralTitleGeneratorModuleState>(initialViralTitleGeneratorState);


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
  const [imageGenerationSuiteState, setImageGenerationSuiteState] = useState<ImageGenerationSuiteModuleState>(initialImageGenerationSuiteState);

  const initialEditStoryState: EditStoryModuleState = {
    activeTab: 'single',
    originalStoryToEdit: '',
    outlineForEditing: '',
    targetLengthForEditing: STORY_LENGTH_OPTIONS[1].value, 
    languageForEditing: HOOK_LANGUAGE_OPTIONS[0].value,
    editedStoryOutput: '',
    isLoadingEditing: false,
    loadingMessageEditing: null,
    errorEditing: null,
    postEditAnalysis: null,
    refinementInstruction: '',
    isRefiningFurther: false,
    furtherRefinementError: null,
    batchInputItems: [{ id: Date.now().toString(), originalStory: '', outline: null, specificTargetLength: null, specificLanguage: null }],
    batchResults: [],
    isProcessingBatchEdit: false,
    batchEditProgressMessage: null,
    batchEditError: null,
    batchConcurrencyLimit: 3,
  };
  const [editStoryState, setEditStoryState] = useState<EditStoryModuleState>(initialEditStoryState);

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
    concurrencyLimit: 3,
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
  const [nicheThemeExplorerState, setNicheThemeExplorerState] = useState<NicheThemeExplorerModuleState>(initialNicheThemeExplorerState);

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
    characterGender: '',
    characterCountry: '',
    characterProfession: '',
    characterKeyFeatures: '',
    inputLanguage: HOOK_LANGUAGE_OPTIONS[0].value, 
    outputLanguage: HOOK_LANGUAGE_OPTIONS[1].value, 
    generatedBaseCharacterPrompt: '',
    isLoadingBasePrompt: false,
    errorBasePrompt: null,
    progressMessageBasePrompt: null,
    refinementInstructionForBasePrompt: '',
    isLoadingRefinementForBasePrompt: false,
    errorRefinementForBasePrompt: null,
    characterAction: '',
    generatedCompleteImagePrompt: '',
    isLoadingCompletePrompt: false,
    errorCompletePrompt: null,
    progressMessageCompletePrompt: null,
  };
  const [characterStudioState, setCharacterStudioState] = useState<CharacterStudioModuleState>(initialCharacterStudioState);

  useEffect(() => {
    localStorage.setItem('elevenLabsApiKeys', JSON.stringify(elevenLabsApiKeys));
  }, [elevenLabsApiKeys]);

  useEffect(() => {
    const stateToSave: Partial<WriteStoryModuleState> = { ...writeStoryState };
    delete stateToSave.generatedStory;
    delete stateToSave.generatedHooks;
    delete stateToSave.generatedLesson;
    delete stateToSave.storyLoadingMessage;
    delete stateToSave.storyProgress;
    delete stateToSave.singleStoryEditProgress;
    delete stateToSave.hookLoadingMessage;
    delete stateToSave.lessonLoadingMessage;
    localStorage.setItem('writeStoryModuleState_v1', JSON.stringify(stateToSave));
  }, [writeStoryState]);

  useEffect(() => {
    const stateToSave: Partial<RewriteModuleState> = { ...rewriteState };
    // Remove temporary states
    delete stateToSave.rewrittenText;
    delete stateToSave.loadingMessage;
    delete stateToSave.progress;
    delete stateToSave.isEditing;
    delete stateToSave.editError;
    delete stateToSave.editLoadingMessage;
    delete stateToSave.hasBeenEdited;
    delete stateToSave.error;

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
    localStorage.setItem('batchRewriteModuleState_v1', JSON.stringify(stateToSave));
  }, [batchRewriteState]);

  useEffect(() => {
    const stateToSave: Partial<EditStoryModuleState> = { ...editStoryState };
    delete stateToSave.editedStoryOutput;
    delete stateToSave.postEditAnalysis;
    delete stateToSave.isLoadingEditing;
    delete stateToSave.loadingMessageEditing;
    delete stateToSave.errorEditing;
    delete stateToSave.isRefiningFurther;
    delete stateToSave.furtherRefinementError;
    delete stateToSave.refinementInstruction;
    delete stateToSave.batchResults;
    delete stateToSave.isProcessingBatchEdit;
    delete stateToSave.batchEditProgressMessage;
    delete stateToSave.batchEditError;
    localStorage.setItem('editStoryModuleState_v1', JSON.stringify(stateToSave));
  }, [editStoryState]);
  
  useEffect(() => {
    const stateToSave: Partial<CreativeLabModuleState> = { ...creativeLabState };
    delete stateToSave.quickOutlineResult;
    delete stateToSave.finalOutline;
    delete stateToSave.generatedBatchOutlines;
    delete stateToSave.referenceOutlineAnalysisResult;
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
    delete stateToSave.youtubeDescription;
    delete stateToSave.youtubeTags;
    delete stateToSave.suggestedKeywordsOutput;
    delete stateToSave.generatedChapters;
    delete stateToSave.currentResult;
    delete stateToSave.titleAnalysisScore;
    delete stateToSave.titleAnalysisFeedback;
    delete stateToSave.suggestedTitles;
    delete stateToSave.thumbnailTextSuggestions;
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
    localStorage.setItem('dream100CompetitorAnalysisModuleState_v1', JSON.stringify(stateToSave));
  }, [dream100State]);

  useEffect(() => {
    const stateToSave: Partial<CharacterStudioModuleState> = { ...characterStudioState };
    delete stateToSave.generatedBaseCharacterPrompt;
    delete stateToSave.isLoadingBasePrompt;
    delete stateToSave.errorBasePrompt;
    delete stateToSave.progressMessageBasePrompt;
    delete stateToSave.isLoadingRefinementForBasePrompt;
    delete stateToSave.errorRefinementForBasePrompt;
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
    delete stateToSave.resultText;
    delete stateToSave.analysisReport;
    delete stateToSave.viralFormulas;
    delete stateToSave.applicationSuggestions;
    delete stateToSave.groundingSourcesAnalysis;
    delete stateToSave.generateVariationsExplanation;
    delete stateToSave.loadingMessage;
    delete stateToSave.error;
    delete stateToSave.analyzeLoadingMessage;
    delete stateToSave.analyzeError;
    localStorage.setItem('viralTitleGeneratorModuleState_v1', JSON.stringify(stateToSave));
  }, [viralTitleGeneratorState]);


  useEffect(() => {
     if(outlineForSuperAgent){
        setSuperAgentState(prev => ({...prev, sourceText: outlineForSuperAgent}));
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
      }));
       if (activeModule === ActiveModule.EditStory && !editStoryState.originalStoryToEdit) {
            setEditStoryState(prevEdit => ({
                ...prevEdit,
                outlineForEditing: storyOutlineForWriteModule,
                activeTab: 'single'
            }));
        }
    }
  }, [storyOutlineForWriteModule, activeModule, editStoryState.originalStoryToEdit]);

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
      case ActiveModule.BatchStoryWriting:
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
      case ActiveModule.BatchRewrite:
        return <BatchRewriteModule 
                  apiSettings={apiSettings}
                  moduleState={batchRewriteState}
                  setModuleState={setBatchRewriteState}
                />;
      case ActiveModule.Analysis:
        return <AnalysisModule 
                  moduleState={analysisState}
                  setModuleState={setAnalysisState}
                />;
       case ActiveModule.NicheThemeExplorer:
        return <NicheThemeExplorerModule 
                  apiSettings={apiSettings}
                  moduleState={nicheThemeExplorerState}
                  setModuleState={setNicheThemeExplorerState}
                />;
       case ActiveModule.Dream100CompetitorAnalysis:
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
      case ActiveModule.CharacterStudio:
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
        return <SupportModule currentKey={keyInfo?.key || ''} />;
      case ActiveModule.Recharge:
        return <RechargeModule currentKey={keyInfo?.key || ''} />;
      default:
        return <div className="p-6 text-center text-gray-600">Chọn một module từ thanh bên ��ể bắt đầu.</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-slate-900 to-gray-800 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!keyInfo) {
    return <KeyValidationModal />;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 to-gray-800">
      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={setActiveModule} 
      />
      <main className="flex-1 ml-64 p-3 md:p-6 bg-gray-100 rounded-l-3xl shadow-2xl overflow-y-auto">
        <div className="bg-white shadow-xl rounded-2xl min-h-full flex flex-col">
            <MainHeader />
            <div className="p-4 md:p-8 flex-grow">
                <ApiSettingsComponent />
                {renderActiveModule()}
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