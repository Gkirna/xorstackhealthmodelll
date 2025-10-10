# Full System Test Plan
**Xorstack Health Model - Comprehensive Testing Strategy**

---

## Test Levels

### 1. Unit Tests
**Framework:** Vitest + Testing Library  
**Coverage Target:** 80%

**Test Files:**
- `tests/phase1-auth.test.ts` ✅
- `tests/phase2-dashboard.test.ts` (TBD)
- `tests/phase3-workflow.test.ts` (TBD)
- `tests/phase4-features.test.ts` (TBD)
- `tests/phase5-ai.test.ts` (TBD)

### 2. Integration Tests
**Focus:** API + Database interactions

**Test Scenarios:**
- Auth flow → Profile creation
- Session creation → Transcript save
- AI function call → DB update
- File upload → Storage save

### 3. E2E Tests
**Framework:** Playwright  
**Coverage:** Critical user journeys

**Test Scenarios:**
1. Complete clinical workflow
2. Authentication flows
3. Real-time updates
4. Export functionality

### 4. Performance Tests
**Tool:** k6 or Artillery

**Metrics:**
- API latency (p50, p95, p99)
- Concurrent users
- Database query performance
- AI function response times

---

## Critical Test Scenarios

### Scenario 1: New User Onboarding
```
1. Visit /signup
2. Fill form with valid data
3. Submit → Profile created
4. Verify role assigned
5. Complete onboarding
6. Redirect to dashboard
7. Verify session persists
```

### Scenario 2: Clinical Session Workflow
```
1. Login
2. Create new session
3. Start recording
4. Upload audio
5. Transcription saves
6. Generate note
7. Extract tasks
8. Export note
9. Verify all DB entries
```

### Scenario 3: Real-time Collaboration
```
1. User A creates session
2. User B (team member) sees update
3. User A adds transcript
4. User B sees real-time update
5. Both export same note
```

---

## Security Testing

### Auth Security
- [ ] Prevent privilege escalation
- [ ] RLS policy enforcement
- [ ] Session hijacking prevention
- [ ] CSRF protection

### Data Security
- [ ] PHI scrubbing verification
- [ ] Storage bucket isolation
- [ ] Database injection prevention
- [ ] API rate limiting

---

## Performance Benchmarks

| Operation | Target | Test Method |
|-----------|--------|-------------|
| Login | <500ms | Unit test |
| Dashboard load | <1s | E2E |
| Session create | <200ms | Integration |
| Audio upload (5min) | <5s | E2E |
| Note generation | <30s | Integration |
| Task extraction | <15s | Integration |
| Real-time update | <500ms | E2E |

---

## Continuous Testing

### Pre-commit
- Lint checks
- Type checks
- Unit tests

### CI Pipeline
- All unit tests
- Integration tests
- Build validation

### Pre-deployment
- E2E tests
- Performance tests
- Security scans

---

## Test Commands

```bash
# Run all unit tests
npm run test

# Run specific test file
npm run test tests/phase1-auth.test.ts

# Run E2E tests
npm run test:e2e

# Performance tests
npm run test:perf

# Coverage report
npm run test:coverage
```

---

## Test Data Management

### Fixtures
- Test users with known credentials
- Sample sessions
- Mock AI responses
- Test audio files

### Cleanup
- Auto-delete test data after runs
- Separate test database
- Mock external services

---
