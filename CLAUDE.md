# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered story writing desktop application built with React, TypeScript, and Electron. The application provides comprehensive AI tools for Vietnamese content creators including story writing, rewriting, analysis, image generation, text-to-speech, and YouTube SEO optimization.

## Common Development Commands

### Development
```bash
npm run dev          # Start development server with Vite
npm run preview      # Preview production build locally
```

### Building
```bash
npm run build        # Build web application for production
npm run dist         # Build Electron desktop application
```

### Automated Build
```bash
.\build-release.ps1  # PowerShell script for automated release build
```

## Architecture Overview

### Core Structure
- **Frontend**: React 18 + TypeScript + Vite
- **Desktop**: Electron wrapper for cross-platform distribution
- **Backend**: Node.js Express API (deployed on Render)
- **Database**: MongoDB Atlas for user management and credit system
- **Payment**: PayOS integration for credit purchases

### Main Components
- **App.tsx**: Main application component with module routing and state management
- **AppContext.tsx**: Global context for user authentication, API settings, and credit management
- **Sidebar**: Navigation component for switching between AI modules
- **ModuleContainer**: Wrapper for individual AI tool modules

### Module System
The application is organized into specialized AI modules:

**Writing Modules:**
- `SuperAgentModule`: AI story generation with images and voice
- `WriteStoryModule`: Single story writing with hooks and lessons
- `BatchStoryWritingModule`: Bulk story generation
- `RewriteModule`: Text rewriting and translation
- `BatchRewriteModule`: Bulk text rewriting
- `EditStoryModule`: Story editing and refinement

**Creative Tools:**
- `CreativeLabModule`: Story outline and plot structure generation
- `CharacterStudioModule`: Character development and prompt generation
- `ImageGenerationSuiteModule`: AI image generation (Google Imagen, Stability AI, DALL-E, DeepSeek)
- `TtsModule`: Text-to-speech with ElevenLabs
- `ViralTitleGeneratorModule`: Viral content title generation

**Analysis & SEO:**
- `AnalysisModule`: Story analysis and improvement suggestions
- `YoutubeSeoModule`: YouTube SEO optimization and keyword research
- `NicheThemeExplorerModule`: Content niche exploration
- `Dream100CompetitorAnalysisModule`: Competitor analysis

**Utility:**
- `SupportModule`: Help and contact information
- `RechargeModule`: Credit purchase and management

### State Management
- Each module maintains its own state using React useState
- State is persisted to localStorage with versioning (e.g., `writeStoryModuleState_v1`)
- Global app state managed through AppContext
- User authentication and credit management centralized in context

### API Integration
- **AI Services**: Centralized service layer for multiple AI providers (Gemini, OpenAI, DeepSeek, etc.)
- **Backend Communication**: REST API for user management, credit tracking, and AI key management
- **Credit System**: Real-time credit consumption tracking with backend validation

### Key Configuration Files
- `config.ts`: Backend API endpoints
- `constants.ts`: UI options, language settings, and module configurations
- `types.ts`: Comprehensive TypeScript interfaces for all modules and state

### Data Flow
1. User authentication through backend API
2. Module state initialized from localStorage or defaults
3. AI requests routed through service layer to backend
4. Credit consumption tracked and updated in real-time
5. Results processed and stored in module state
6. State changes automatically persisted to localStorage

### Development Best Practices
- Use TypeScript interfaces from `types.ts` for all component props and state
- Follow existing module structure when adding new features
- Implement proper error handling with user-friendly messages
- Maintain backward compatibility when updating localStorage state schemas
- Test credit consumption flows thoroughly
- Validate API responses before updating state

### Backend Dependencies
The application requires a running backend service for:
- User authentication and key validation
- Credit management and consumption tracking
- AI API key management and routing
- Payment processing (PayOS integration)

Backend URL is configured in `config.ts` and defaults to: `https://key-manager-backend.onrender.com/api`