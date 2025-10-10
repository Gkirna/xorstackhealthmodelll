# AI Pipeline Flow - Xorstack Health Model

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HEIDI BRAIN                              │
│              (AI Orchestration Layer)                        │
│                 src/ai/heidiBrain.ts                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Prompts │   │ Context │   │  API    │
   │ Builder │   │ Manager │   │ Client  │
   └─────────┘   └─────────┘   └─────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Lovable AI    │
              │ (Gemini 2.5)   │
              └────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   Validation   │
              │   & Logging    │
              └────────────────┘
```

## Clinical Workflow

### Standard Session Flow

```
1. Session Created
   └─> User records/types transcript
   
2. Transcript Complete
   └─> summarizeEncounter() [Auto or Manual]
       ├─> Update session.summary
       └─> Log to ai_logs
   
3. Ready to Generate
   └─> generateClinicalNote()
       ├─> Fetch session context
       ├─> Scrub PHI
       ├─> Build prompt with context
       ├─> Call Gemini 2.5 Flash (temp: 0.3)
       ├─> Validate JSON output
       ├─> Update session.generated_note
       └─> Log to ai_logs
   
4. Note Generated [Auto Pipeline Triggers]
   ├─> extractTasks() [Parallel]
   │   ├─> Tool calling for structured output
   │   ├─> Insert tasks to database
   │   └─> Log to ai_logs
   │
   └─> suggestCodes() [Parallel]
       ├─> Build coding prompt
       ├─> Call Gemini 2.5 Flash (temp: 0.2)
       ├─> Filter by confidence > 0.5
       ├─> Update session.clinical_codes
       └─> Log to ai_logs

5. Review & Finalize
   └─> User reviews, edits, exports
```

## AI Functions Detail

### 1. generateClinicalNote()
**Input**: session_id, transcript, detail_level  
**Process**: Context → Prompt → AI → Validate → Store  
**Output**: SOAP note (JSON + plaintext)  
**Duration**: ~6s

### 2. extractTasks()
**Input**: session_id, note_text  
**Process**: Prompt → AI with tools → Parse → Insert DB  
**Output**: Array of tasks  
**Duration**: ~3s

### 3. suggestCodes()
**Input**: session_id, note_text, region  
**Process**: Prompt → AI → Parse JSON → Filter confidence → Store  
**Output**: Array of ICD-10 codes  
**Duration**: ~3s

### 4. summarizeEncounter()
**Input**: session_id, transcript_chunk  
**Process**: Prompt → AI → Validate → Store summary  
**Output**: 200-word summary  
**Duration**: ~2s

### 5. askHeidiAssistant()
**Input**: question, session_id (optional)  
**Process**: Build context → Prompt → AI → Validate  
**Output**: Conversational answer  
**Duration**: ~4s

## Auto Pipeline Mode (Future)

```
┌───────────────────────────────────────┐
│  User enables "Auto Pipeline Mode"   │
└───────────────┬───────────────────────┘
                │
                ▼
┌──────────────────────────────────────────┐
│  Transcript → Summarize (auto-trigger)   │
└───────────────┬──────────────────────────┘
                │ (when complete)
                ▼
┌──────────────────────────────────────────┐
│  Summary → Generate Note (auto-trigger)  │
└───────────────┬──────────────────────────┘
                │ (when note ready)
                ▼
        ┌───────┴────────┐
        ▼                ▼
┌───────────────┐  ┌─────────────┐
│ Extract Tasks │  │Suggest Codes│
│  (parallel)   │  │  (parallel) │
└───────────────┘  └─────────────┘
```

## Context Management Flow

```
Session ID
   │
   ▼
getSessionContext()
   │
   ├─> Fetch session data
   ├─> Fetch transcripts
   ├─> Fetch user profile
   └─> Combine into context object
   │
   ▼
buildAIContext(maxTokens = 8000)
   │
   ├─> Add patient info
   ├─> Add visit metadata
   ├─> Add summary (if exists)
   ├─> Add note (if exists)
   └─> Add transcript (truncated if needed)
   │
   ▼
scrubPHI()
   │
   ├─> Replace names → [PATIENT]
   ├─> Replace IDs → [ID]
   ├─> Replace dates → [DATE]
   └─> Generic patterns (phone, email, SSN)
   │
   ▼
AI Prompt (safe context)
```

## Validation & Error Recovery

```
AI Call
   │
   ├─> Success
   │   ├─> validateAIOutput()
   │   │   ├─> Check empty
   │   │   ├─> Check format
   │   │   ├─> Check patterns
   │   │   └─> Return warnings
   │   │
   │   └─> Log to ai_logs (success)
   │
   └─> Error
       ├─> 429 Rate Limit → Retry with backoff
       ├─> 402 Payment → Alert user
       ├─> 401 Unauthorized → Re-auth
       └─> 500 Other → Log error, show toast
```

## Key Integration Points

### Frontend → Heidi Brain
```typescript
import { generateClinicalNote } from '@/ai/heidiBrain';

const result = await generateClinicalNote(sessionId, transcript, 'medium');
if (result.success) {
  // Update UI with result.note
}
```

### Heidi Brain → Edge Functions
```typescript
// Calls through supabase.functions.invoke()
await fetch(`${SUPABASE_URL}/functions/v1/generate-note`, {
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ messages, model, temperature })
});
```

### Real-time Updates
```typescript
// UI subscribes to realtime changes
useRealtimeSubscription('sessions', (payload) => {
  if (payload.new.generated_note) {
    // Update note display
  }
});
```

---

**Version**: 1.0  
**Last Updated**: 2025-01-10
