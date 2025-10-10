# Xorstack Health Model - API Reference

## Authentication

All API endpoints require authentication using Supabase JWT tokens. Include the auth token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this structure:

```json
{
  "success": boolean,
  "data": any,
  "error": {
    "code": string,
    "message": string
  }
}
```

## Edge Functions

### 1. Generate Note

**Endpoint:** `/functions/v1/generate-note`  
**Method:** POST

Generate a structured clinical note from a transcript using AI.

**Request Body:**
```json
{
  "session_id": "uuid",
  "transcript_text": "string",
  "detail_level": "low" | "medium" | "high"
}
```

**Response:**
```json
{
  "success": true,
  "note": "plaintext clinical note",
  "note_json": {
    "soap": {
      "subjective": "...",
      "objective": "...",
      "assessment": "...",
      "plan": "..."
    }
  },
  "warnings": []
}
```

### 2. Extract Tasks

**Endpoint:** `/functions/v1/extract-tasks`  
**Method:** POST

Extract actionable tasks from a clinical note.

**Request Body:**
```json
{
  "session_id": "uuid",
  "note_text": "string"
}
```

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "priority": "low" | "medium" | "high",
      "category": "string"
    }
  ]
}
```

### 3. Suggest Codes

**Endpoint:** `/functions/v1/suggest-codes`  
**Method:** POST

Suggest ICD-10 diagnosis codes based on clinical note.

**Request Body:**
```json
{
  "session_id": "uuid",
  "note_text": "string",
  "region": "US" | "UK" | etc.
}
```

**Response:**
```json
{
  "success": true,
  "codes": [
    {
      "code": "string",
      "system": "ICD-10-CM",
      "label": "string",
      "confidence": 0.0-1.0
    }
  ]
}
```

### 4. Ask Heidi

**Endpoint:** `/functions/v1/ask-heidi`  
**Method:** POST

Get answers from Heidi AI assistant with session context.

**Request Body:**
```json
{
  "question": "string",
  "session_id": "uuid (optional)",
  "context_snippet": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "string",
  "citations": []
}
```

### 5. Summarize Transcript

**Endpoint:** `/functions/v1/summarize-transcript`  
**Method:** POST

Generate a concise summary of the clinical encounter.

**Request Body:**
```json
{
  "session_id": "uuid",
  "transcript_chunk": "string"
}
```

**Response:**
```json
{
  "success": true,
  "summary": "string"
}
```

### 6. Export Note

**Endpoint:** `/functions/v1/export-note`  
**Method:** POST

Export clinical note in various formats.

**Request Body:**
```json
{
  "session_id": "uuid",
  "format": "pdf" | "docx" | "txt",
  "recipient_email": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "file_url": "signed URL",
  "format": "pdf",
  "export_id": "uuid"
}
```

### 7. Log Event

**Endpoint:** `/functions/v1/log-event`  
**Method:** POST

Log audit events and optionally create notifications.

**Request Body:**
```json
{
  "type": "string",
  "payload": {},
  "create_notification": boolean
}
```

**Response:**
```json
{
  "success": true,
  "log_id": "uuid"
}
```

## Database Operations

### Sessions

**Create Session:**
```typescript
const { data, error } = await supabase
  .from('sessions')
  .insert({
    user_id: userId,
    patient_name: 'John Doe',
    patient_id: 'MRN123',
    scheduled_date: new Date().toISOString(),
  })
  .select()
  .single();
```

**Get Sessions:**
```typescript
const { data, error } = await supabase
  .from('sessions')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**Update Session:**
```typescript
const { data, error } = await supabase
  .from('sessions')
  .update({ status: 'completed' })
  .eq('id', sessionId)
  .eq('user_id', userId);
```

### Tasks

**Create Task:**
```typescript
const { data, error } = await supabase
  .from('tasks')
  .insert({
    user_id: userId,
    title: 'Follow up with patient',
    priority: 'high',
  });
```

**List Tasks:**
```typescript
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_id', userId)
  .eq('status', 'pending')
  .order('due_date', { ascending: true });
```

### Templates

**Get Community Templates:**
```typescript
const { data, error } = await supabase
  .from('templates')
  .select('*')
  .eq('is_community', true);
```

## Realtime Subscriptions

### Subscribe to Transcript Updates

```typescript
import { useTranscriptUpdates } from '@/hooks/useRealtime';

useTranscriptUpdates(sessionId, (transcript) => {
  console.log('New transcript:', transcript);
  // Update UI with new transcript
});
```

### Subscribe to Task Updates

```typescript
import { useTaskUpdates } from '@/hooks/useRealtime';

useTaskUpdates(userId, (task) => {
  console.log('Task update:', task);
  // Update task list in UI
});
```

## Storage

### Upload Audio File

```typescript
const filePath = `${userId}/recording_${Date.now()}.webm`;
const { data, error } = await supabase.storage
  .from('audio-recordings')
  .upload(filePath, audioBlob);
```

### Get Signed URL

```typescript
const { data } = await supabase.storage
  .from('audio-recordings')
  .createSignedUrl(filePath, 3600); // 1 hour expiry

const signedUrl = data.signedUrl;
```

## Error Handling

Common error codes:

- `UNAUTHORIZED` (401): Missing or invalid auth token
- `GENERATION_ERROR` (500): AI generation failed
- `EXTRACTION_ERROR` (500): Task extraction failed
- `SUGGESTION_ERROR` (500): Code suggestion failed
- `ASSISTANT_ERROR` (500): AI assistant error
- `EXPORT_ERROR` (500): Export generation failed
- `LOGGING_ERROR` (500): Event logging failed
- Rate limit exceeded (429): Too many requests
- Payment required (402): Insufficient AI credits

## Rate Limits

AI functions have rate limits per workspace:
- Default: 60 requests per minute
- Upgrade to paid plan for higher limits

## Development vs Production

### DEV Mode (Current)
- Auto-confirm emails enabled
- Mock SMTP for email sending
- Verbose logging enabled
- CORS allows all origins

### Production Hardening Checklist
- [ ] Disable auto-confirm emails in Supabase Auth settings
- [ ] Configure allowed redirect URIs
- [ ] Enable stronger password policy (min 10 chars, require special chars)
- [ ] Enable MFA for admin accounts
- [ ] Set up real email service (e.g., Resend)
- [ ] Configure proper CORS origins
- [ ] Review and tighten RLS policies
- [ ] Enable audit logging
- [ ] Set up monitoring and alerting
- [ ] Configure rate limiting per user
