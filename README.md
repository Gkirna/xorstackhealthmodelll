# Medical AI Scribe - Clinical Documentation System

> **⚠️ HIPAA COMPLIANCE REQUIRED**: This system processes Protected Health Information (PHI). See [SECURITY.md](./SECURITY.md) for compliance requirements before deploying to production.

## Overview

Advanced AI-powered medical transcription and clinical documentation system featuring:

- 🎙️ **Real-time Speech-to-Text**: OpenAI Whisper API for medical-grade transcription
- 👥 **Speaker Detection**: Automatic provider/patient identification
- 🏥 **Medical Auto-Correction**: AI-powered medical terminology correction
- 📝 **Clinical Note Generation**: Structured SOAP/DAP notes using Google Gemini
- 🎯 **ICD-10 Coding**: Automated diagnosis code suggestions
- 🔒 **HIPAA-Ready**: PHI protection, audit logging, secure handling

## Quick Start

### Prerequisites
- Node.js 18+ or Bun
- Supabase account (Lovable Cloud enabled)
- OpenAI API key (Enterprise tier with BAA for production)

### Installation

```bash
# Clone repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup

Required secrets (managed via Lovable Cloud):
- `OPENAI_API_KEY` - For Whisper transcription (requires BAA for production)
- `LOVABLE_API_KEY` - For clinical AI features (auto-configured)

## Features

### 1. Real-Time Transcription
- **Direct Recording**: Record doctor-patient conversations
- **Playback Mode**: Transcribe external audio through laptop microphone
- **Multi-Language**: Supports Indian English, US English, UK English, Australian English
- **High Accuracy**: Medical terminology optimized

### 2. Voice Analysis
- **Gender Detection**: Male/female voice identification
- **Pitch Analysis**: Real-time frequency analysis
- **Quality Monitoring**: Voice quality indicators
- **Speaker Switching**: Automatic provider/patient alternation

### 3. Clinical Documentation
- **SOAP Notes**: Subjective, Objective, Assessment, Plan format
- **DAP Notes**: Data, Assessment, Plan format
- **Template System**: Customizable note templates
- **Auto-Generation**: AI-powered note creation from transcripts

### 4. AI-Powered Features
- **Medical NER**: Extract conditions, medications, procedures
- **ICD-10 Suggestions**: Automated diagnosis coding
- **Task Extraction**: Identify follow-ups and action items
- **Ask Heidi**: Contextual AI assistant for clinical questions

## Architecture

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **UI Components**: Shadcn/ui + Tailwind CSS
- **State Management**: React Query + React Context
- **Audio Processing**: Web Audio API + MediaRecorder

### Backend
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth (email/password)
- **Edge Functions**: Deno (Supabase Functions)
- **File Storage**: Supabase Storage

### AI Services
- **Transcription**: OpenAI Whisper API
- **Clinical AI**: Google Gemini 2.5 Flash (via Lovable AI)
- **Voice Analysis**: Custom DSP algorithms

## Security & Compliance

### HIPAA Requirements ⚠️
1. **OpenAI BAA**: Required for production use
2. **Encryption**: At rest and in transit (enabled)
3. **Access Controls**: RLS policies + authentication
4. **Audit Logging**: All PHI access tracked
5. **Data Retention**: 90-day automatic cleanup

### Security Features
- ✅ No PHI in application logs
- ✅ Content hashing for audit trails
- ✅ Rate limiting (20 req/min per user)
- ✅ Input validation on all endpoints
- ✅ Row Level Security (RLS) on all tables
- ⚠️ CORS restriction needed (change '*' to your domain)

**See [SECURITY.md](./SECURITY.md) for complete compliance guide**

## Project Structure
```
src/
├── components/       # React components
│   ├── session/     # Recording session UI
│   └── ui/          # Shadcn components
├── hooks/           # Custom React hooks
├── utils/           # Utilities and helpers
├── ai/              # AI prompts and logic
└── pages/           # Route pages

supabase/
├── functions/       # Edge functions
└── migrations/      # Database migrations
```

## Deployment

### Pre-Deployment Checklist
- [ ] Sign OpenAI BAA (enterprise tier)
- [ ] Update CORS to restrict origins
- [ ] Enable MFA for admin users
- [ ] Configure data retention policies
- [ ] Set up error monitoring
- [ ] Run security audit
- [ ] Document privacy policy

### Deploy to Production
```bash
# Build and deploy
npm run build

# Deploy via Lovable
# Click Share -> Publish in Lovable UI
```

## Support & Resources

- 📖 [Full Documentation](./docs/)
- 🔒 [Security Guide](./SECURITY.md)
- 🏥 [Clinical Workflow Guide](./docs/TRANSCRIPTION_AI_FEATURES_GUIDE.md)
- 🌐 [Lovable Documentation](https://docs.lovable.dev)

## License

Proprietary - All rights reserved

---

**⚠️ IMPORTANT**: This software processes PHI. Ensure HIPAA compliance before production use. See SECURITY.md for requirements.
