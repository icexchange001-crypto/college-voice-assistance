# Real-Time College Voice Assistant

## Overview

This is a web-based bilingual voice assistant designed specifically for RKSD College. The application provides real-time responses to college-related queries through both voice and text interfaces, supporting Hindi and English languages. Built with modern web technologies, it features a clean, professional interface optimized for both desktop and mobile devices with hosting-ready architecture.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React + TypeScript**: Modern component-based frontend using React 18 with TypeScript for type safety
- **UI Framework**: Shadcn/UI components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Voice Integration**: 
  - Web Speech API for Speech-to-Text (STT) functionality
  - Three-tier Text-to-Speech (TTS) system:
    1. Cartesia API (primary) - Ultra-low latency with speed and emotion controls
    2. ElevenLabs API (fallback) - High-quality neural voice synthesis
    3. Browser SpeechSynthesis API (final fallback) - Native browser TTS support
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Node.js + Express**: RESTful API server built with Express.js
- **Database Layer**: 
  - Drizzle ORM for type-safe database operations
  - PostgreSQL as the primary database (configured for Neon serverless)
  - In-memory storage fallback for development/testing
- **API Design**: RESTful endpoints for chat messages, AI responses, and college information management
- **Error Handling**: Centralized error handling middleware with proper HTTP status codes

### Data Storage Solutions
- **Primary Database**: PostgreSQL with three main entities:
  - `users`: User authentication and management
  - `chat_messages`: Conversation history with role-based messages (user/assistant)
  - `college_info`: Categorized college information with metadata support
- **Schema Management**: Drizzle Kit for database migrations and schema versioning
- **Data Categories**: Organized college information by categories (hostel, departments, contacts, events)

### Authentication and Authorization
- **Session-based Authentication**: Express sessions with PostgreSQL session store
- **User Management**: Basic user registration and login system
- **Security**: Environment-based configuration for database credentials

### AI Integration
- **Groq API**: Integration configured for conversational AI responses using llama3-8b-8192 model
- **Context-Aware Responses**: College information is injected as context for relevant, personalized responses
- **Bilingual Support**: System prompts designed to handle both Hindi and English naturally

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon database
- **drizzle-orm** & **drizzle-kit**: Type-safe ORM and migration tools
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight routing library

### UI Component Libraries
- **@radix-ui/***: Comprehensive set of accessible UI primitives (accordion, dialog, dropdown, etc.)
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Dynamic class name generation
- **lucide-react**: Icon library

### Text-to-Speech APIs (Three-tier System)
- **Cartesia API**: Primary TTS provider with ultra-low latency (<90ms), speed controls, emotion controls, and 15 language support
- **ElevenLabs API**: Fallback TTS provider with high-quality neural voice synthesis and multilingual support
- **Web Speech API**: Browser-native speech recognition (no external dependency)
- **SpeechSynthesis API**: Final fallback browser-native text-to-speech

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type checking and enhanced development experience
- **ESBuild**: Fast bundling for production builds
- **@replit/vite-plugin-***: Replit-specific development enhancements

### Planned Integrations
- **Groq API**: For AI-powered conversational responses (configuration ready)
- **Vercel**: Deployment platform (frontend)
- **Render**: Backend hosting platform