# AI Tuning Guide - Xorstack Health Model

## Overview

This guide covers the configuration, tuning, and optimization of AI functions in Xorstack Health Model for production clinical use.

## AI Architecture

### Heidi Brain - Orchestration Layer

**Location**: `src/ai/heidiBrain.ts`

The Heidi Brain is the central AI orchestration layer that manages all AI operations:

```typescript
// Core AI Functions
- generateClinicalNote()
- extractTasks()
- suggestCodes()
- summarizeEncounter()
- askHeidiAssistant()
```

**Key Features**:
- Centralized AI call management
- Standardized error handling
- Automatic logging to `ai_logs` table
- Context injection via `contextManager`
- Output validation
- Temperature and token management

---

## Temperature Settings

Temperature controls the randomness of AI responses. Lower = more deterministic, Higher = more creative.

### Production Settings

| Function | Temperature | Reasoning |
|----------|-------------|-----------|
| **Note Generation** | 0.3 | Balanced - needs consistency but natural language flow |
| **Task Extraction** | 0.2 | Highly deterministic - factual extraction only |
| **Code Suggestion** | 0.2 | Accuracy critical - minimize variance |
| **Summarization** | 0.3 | Consistent summaries with natural language |
| **Ask Heidi** | 0.4 | More conversational tone, helpful responses |

### Tuning Temperature

**If outputs are too repetitive/robotic**:
- Increase temperature by 0.1
- Test with 5+ sample inputs
- Monitor clinical accuracy

**If outputs are too inconsistent**:
- Decrease temperature by 0.1
- Verify outputs still meet quality standards
- Check for hallucinations

**Temperature Range**: 0.1 - 0.5 (don't exceed 0.6 for clinical applications)

---

## Token Management

### Max Token Limits

Tokens limit the length of AI-generated responses.

| Function | Max Tokens | Typical Output Length |
|----------|-----------|---------------------|
| **Note Generation** | 4000 | 1000-3000 tokens (~750-2250 words) |
| **Task Extraction** | 2000 | 200-1000 tokens (5-20 tasks) |
| **Code Suggestion** | 1500 | 300-800 tokens (3-10 codes) |
| **Summarization** | 500 | 100-200 tokens (~75-150 words) |
| **Ask Heidi** | 2000 | 300-1000 tokens (conversational) |

### Input Token Management

**Context Budget**: 8000 tokens (~32,000 characters)

**Priority Order for Context Inclusion**:
1. System prompt (fixed)
2. User question/instruction (required)
3. Patient demographics (scrubbed)
4. Visit metadata (type, specialty)
5. Clinical summary (if available)
6. Previous note (truncated if needed)
7. Transcript (may be heavily truncated)

**Truncation Strategy**:
```typescript
// If context exceeds budget
// 1. Truncate transcript from beginning (keep most recent)
// 2. Summarize previous note instead of full text
// 3. Remove optional metadata
```

**Token Estimation**:
```typescript
// Rough approximation: 1 token ≈ 4 characters
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

---

## Context Management

### Session Context

**Location**: `src/lib/contextManager.ts`

**Functions**:
- `getSessionContext(session_id)` - Fetch complete session data
- `buildAIContext(session_id, maxTokens)` - Build prompt-ready context
- `scrubPHI(text, options)` - Remove identifiable information

### PHI Scrubbing

**Automated Scrubbing**:
```typescript
scrubPHI(text, {
  patient_name: "John Doe",
  patient_id: "MRN123456",
  dob: "1980-05-15"
})
```

**Generic Pattern Scrubbing**:
- Dates: `YYYY-MM-DD`, `MM/DD/YYYY` → `[DATE]`
- Phone: `(555) 123-4567`, `555-123-4567` → `[PHONE]`
- SSN: `123-45-6789` → `[SSN]`
- Email: `patient@example.com` → `[EMAIL]`

**⚠️ IMPORTANT**: PHI scrubbing is NOT foolproof. Review AI logs regularly.

---

## Output Validation

### Validation Checks

**Location**: `src/lib/contextManager.ts` → `validateAIOutput()`

**Checks Performed**:
1. **Non-empty**: Output exists and is not null
2. **Type compliance**: JSON vs text as expected
3. **Length validation**: Not suspiciously short
4. **Refusal patterns**: Detects "I cannot", "I apologize", "As an AI"
5. **JSON integrity**: Valid structure for structured outputs

**Usage**:
```typescript
const validation = validateAIOutput(output, 'json');
if (!validation.valid) {
  console.error('Validation failed:', validation.warnings);
  // Log to ai_logs with warnings
}
```

**Warning Levels**:
- **Critical**: Empty or invalid output → Retry
- **Warning**: Suspicious patterns → Log but proceed
- **Info**: Minor issues → Log only

---

## Error Handling

### Common Errors

| Error Code | HTTP Status | Meaning | Action |
|-----------|-------------|---------|--------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Retry with backoff |
| `PAYMENT_REQUIRED` | 402 | Insufficient credits | Alert admin |
| `UNAUTHORIZED` | 401 | Invalid auth token | Re-authenticate |
| `GENERATION_ERROR` | 500 | AI call failed | Log and retry |
| `CONTEXT_TOO_LARGE` | 400 | Input too long | Truncate and retry |

### Retry Strategy

**Exponential Backoff** (for rate limits):
```typescript
async function retryWithBackoff(fn: Function, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

---

## Safety Controls

### Content Moderation

**Implicit in Prompts**:
- System prompts include safety guidelines
- Heidi assistant explicitly avoids PHI echoing
- No definitive diagnoses without context

**Explicit Checks** (future):
- Post-processing for inappropriate content
- Validation against clinical guidelines
- Confidence thresholds for high-risk outputs

### Clinical Accuracy

**Current Measures**:
- Evidence-based system prompts
- Confidence scoring for diagnosis codes
- Caveats in assistant responses
- User verification required for all outputs

**Future Enhancements**:
- Integration with clinical decision support systems
- Cross-reference with UpToDate/medical databases
- Clinician feedback loop for accuracy improvement

---

## Performance Optimization

### Response Time Targets

| Function | Target (p95) | Current Baseline |
|----------|--------------|------------------|
| Note Generation | < 8 seconds | ~6 seconds |
| Task Extraction | < 4 seconds | ~3 seconds |
| Code Suggestion | < 4 seconds | ~3 seconds |
| Summarization | < 3 seconds | ~2 seconds |
| Ask Heidi | < 5 seconds | ~4 seconds |

### Optimization Strategies

1. **Streaming Responses** (future):
   - Stream note generation for real-time feedback
   - Show partial results as they arrive

2. **Caching**:
   - Cache ICD-10 code lookups
   - Cache template-based system prompts

3. **Parallel Processing**:
   - Run task extraction and code suggestion in parallel after note generation
   - Batch process multiple sessions

4. **Model Selection**:
   - Use Gemini 2.5 Flash for speed
   - Switch to Gemini 2.5 Pro for complex cases (diagnostic reasoning)

---

## Monitoring & Logging

### AI Logs Table

**Schema**: `ai_logs`

**Fields Logged**:
- `user_id` - Who initiated the request
- `session_id` - Related session (if applicable)
- `function_name` - Which AI function was called
- `input_hash` - SHA-256 hash of scrubbed input (first 16 chars)
- `output_preview` - First 200 chars of output
- `tokens_used` - Token consumption (if available)
- `duration_ms` - Response time
- `status` - success | error | timeout
- `error_message` - Error details if failed

### Metrics to Monitor

**Performance**:
- Average response time by function
- P95 response time
- Error rate (should be < 2%)

**Usage**:
- Calls per day by function
- Token consumption per user
- Most common operations

**Quality**:
- Validation warnings rate
- Retry rate
- User feedback scores (if implemented)

### Alerting Thresholds

**Set up alerts for**:
- Error rate > 5% over 1 hour
- P95 response time > 10 seconds
- Payment required errors (credits exhausted)
- Unusual spike in usage (possible abuse)

---

## Intelligent Workflow (Auto Pipeline)

### Automatic Triggers

**Current State**: Manual workflow (user initiates each step)

**Auto Pipeline Mode** (future feature):

1. **After Summarization** → Auto-generate note if:
   - Session status = "ready_to_generate"
   - Transcript complete
   - User has auto-pipeline enabled

2. **After Note Generation** → Auto-trigger:
   - Task extraction
   - Code suggestion
   - Both run in parallel

**Toggle Location**: Settings > AI Features > "Auto Pipeline Mode"

**User Control**:
- Enable/disable per session
- Override with manual triggers
- Review before finalization

---

## Testing Checklist

### Pre-Production Tests

**Note Generation**:
- [ ] 5 diverse transcripts (different specialties)
- [ ] Verify SOAP structure in all outputs
- [ ] Test all detail levels (low, medium, high)
- [ ] Check language consistency
- [ ] Validate JSON format

**Task Extraction**:
- [ ] 3 notes with explicit tasks → >90% recall
- [ ] 2 notes without tasks → 0 false positives
- [ ] Verify priority assignment accuracy
- [ ] Check category classification

**Code Suggestion**:
- [ ] 2 sessions with clear diagnoses → verify code accuracy
- [ ] 1 session with ambiguous findings → check confidence scores
- [ ] Test with multiple diagnoses → all captured

**Ask Heidi**:
- [ ] Contextual questions (with session) → uses context
- [ ] General medical questions → evidence-based
- [ ] Edge cases (no good answer) → acknowledges limitations

### Performance Tests

- [ ] Load test: 100 concurrent note generations
- [ ] Stress test: Maximum transcript length
- [ ] Token limit handling
- [ ] Error recovery (simulate API failures)

---

## Production Hardening

### Before Go-Live

1. **Set Up Monitoring**:
   - CloudWatch/Datadog for AI logs
   - Alert on error spikes
   - Track response times

2. **Configure Rate Limits**:
   - Per-user limits (prevent abuse)
   - Workspace-level limits

3. **Review PHI Scrubbing**:
   - Audit scrubbing patterns
   - Test with real (anonymized) data
   - Legal review

4. **Load Test**:
   - Simulate production traffic
   - Verify response times hold
   - Check error handling

5. **Clinical Review**:
   - Have clinicians test all functions
   - Gather accuracy feedback
   - Refine prompts based on feedback

### Post-Launch Monitoring

**Week 1**:
- Daily review of AI logs
- User feedback collection
- Prompt adjustments if needed

**Ongoing**:
- Weekly metrics review
- Monthly prompt optimization
- Quarterly clinical accuracy audit

---

## Troubleshooting

### Common Issues

**Issue**: Outputs are too short or empty  
**Fix**: Check token limits, review validation warnings, increase maxTokens

**Issue**: High error rate  
**Fix**: Check LOVABLE_API_KEY configuration, verify auth is working, review rate limits

**Issue**: Inconsistent outputs  
**Fix**: Lower temperature, refine system prompts, add more examples

**Issue**: PHI leaking into outputs  
**Fix**: Improve scrubbing patterns, review AI logs, add post-processing validation

**Issue**: Slow response times  
**Fix**: Reduce context size, optimize token usage, consider model upgrade

---

## Appendix: Configuration Reference

### Environment Variables

```bash
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### Supabase Secrets (Edge Functions)

```
LOVABLE_API_KEY=<auto-provisioned>
SUPABASE_URL=<auto-set>
SUPABASE_SERVICE_ROLE_KEY=<auto-set>
```

### AI Configuration Constants

**File**: `src/ai/heidiBrain.ts`

```typescript
const TEMPERATURE_PRESETS = {
  noteGeneration: 0.3,
  taskExtraction: 0.2,
  codeSuggestion: 0.2,
  assistant: 0.4,
  summary: 0.3,
};

const MAX_TOKENS = {
  noteGeneration: 4000,
  taskExtraction: 2000,
  codeSuggestion: 1500,
  assistant: 2000,
  summary: 500,
};
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-10 | 1.0 | Initial AI tuning guide |

