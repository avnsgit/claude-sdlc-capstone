# Implementation Plan: Fix Sync Pipeline with Retry-Backoff

**Date:** 2026-09-14  
**Project:** DOCSYNC (DOCSYNC-2)  
**Status:** Ready for implementation

---

## Overview
This document outlines the step-by-step implementation plan to add retry-with-backoff logic to the existing documentation sync pipeline. The changes focus on improving robustness without requiring architectural rewrites.

## Implementation Phases

### Phase 1: Error Handling Infrastructure (1-2 hours)
Create new error classes to classify failures properly.

**Files to Create/Modify:**
1. **`src/errors.js`** (MODIFY)
   - Add `RetryableError` class for transient failures
   - Add `PipelineError` class for unrecoverable failures
   - Keep existing `ConfigurationError` class

**Tasks:**
- [ ] Define RetryableError with message, code, and retry metadata
- [ ] Define PipelineError with context object
- [ ] Add helper function `isRetryable(error)` to classify errors
- [ ] Add unit tests for error classification

**Acceptance Criteria:**
- Error classes properly inherit from Error
- Error types are distinguishable in catch blocks
- Tests verify correct classification of common errors

---

### Phase 2: Atlassian Client Implementation (2-3 hours)
Implement real HTTP client with retry logic.

**Files to Create/Modify:**
1. **`src/atlassian-client.js`** (REWRITE)
   - Replace stub implementation with real API client
   - Implement HTTP requests using Node.js built-in `https` module
   - Add retry wrapper function with exponential backoff
   - Implement three methods: `findPageByTitle()`, `createPage()`, `updatePage()`

**Implementation Details:**
- Use Node.js `https.request()` or `fetch()` (if available in Node.js version)
- Implement `executeWithRetry()` wrapper that:
  - Executes the API call
  - Catches retryable errors
  - Implements exponential backoff (1s, 2s, 4s, 8s max)
  - Adds ±10% jitter to prevent thundering herd
  - Re-throws non-retryable errors
  - Logs each retry attempt with attempt number and delay

**Confluence API Endpoints:**
- `GET /rest/api/v3/pages?title=<title>&space-key=<space>` → Find page by title
- `POST /rest/api/v3/pages` → Create page
- `PUT /rest/api/v3/pages/<page-id>` → Update page

**Tasks:**
- [ ] Implement `executeWithRetry(fn, maxRetries, initialDelay)` helper
- [ ] Implement `findPageByTitle(title)` with API call and retry
- [ ] Implement `createPage(page)` with API call and retry
- [ ] Implement `updatePage(pageId, page)` with API call and retry
- [ ] Add request/response logging without exposing credentials
- [ ] Add unit tests for retry logic with mocked API responses

**Acceptance Criteria:**
- All three API methods make actual HTTP requests (mocked in tests)
- Retry logic correctly classifies errors and retries transient failures
- Exponential backoff delays are correct (1s, 2s, 4s, 8s)
- Authentication headers are properly set
- No credentials logged or exposed
- Unit tests verify retry behavior

---

### Phase 3: Confluence Sync Enhancement (1-2 hours)
Add error handling and validation to the sync orchestrator.

**Files to Create/Modify:**
1. **`src/confluence-sync.js`** (MODIFY)
   - Add input validation for client and page data
   - Wrap API calls with try-catch to provide meaningful error context
   - Ensure idempotency (update if exists, create if not)
   - Return more detailed sync results

**Tasks:**
- [ ] Add validation for required fields (pageTitle, body, client)
- [ ] Wrap findPageByTitle() call with error context
- [ ] Wrap createPage() and updatePage() calls with error context
- [ ] Add logging for each sync step
- [ ] Return enhanced sync results with error details
- [ ] Add unit tests for error scenarios

**Acceptance Criteria:**
- All API calls wrapped with meaningful error messages
- Sync fails gracefully with clear error reasons
- Tests verify behavior for missing pages, API failures, etc.

---

### Phase 4: Pipeline Error Handling (1-2 hours)
Add error propagation and logging to the main pipeline.

**Files to Create/Modify:**
1. **`src/pipeline.js`** (MODIFY)
   - Wrap syncToConfluence() with error handling
   - Add logging for each pipeline stage
   - Enhance error messages with context
   - Ensure verification report is generated even on sync errors

**Tasks:**
- [ ] Add try-catch around syncToConfluence() call
- [ ] Add logging for pipeline stages (start, complete, error)
- [ ] Enhance error propagation with context
- [ ] Ensure verification report captures sync status
- [ ] Add unit tests for error scenarios

**Acceptance Criteria:**
- Pipeline errors are caught and logged
- Meaningful error messages are provided
- Verification report includes error details if sync failed

---

### Phase 5: Index Entry Point Enhancement (30 min)
Add error handling and logging to the main entry point.

**Files to Create/Modify:**
1. **`src/index.js`** (MODIFY)
   - Wrap main() with error handling
   - Add structured logging
   - Handle and report different error types appropriately

**Tasks:**
- [ ] Add try-catch with specific error type handling
- [ ] Add logging for execution start and completion
- [ ] Distinguish ConfigurationError vs. transient errors in user output
- [ ] Set appropriate exit codes based on error type

**Acceptance Criteria:**
- Configuration errors are reported clearly to the user
- Transient errors include retry information
- Exit codes distinguish between error types (1 for general, 2 for config)

---

### Phase 6: Testing and Verification (2-3 hours)
Ensure all changes are covered by tests and work end-to-end.

**Files to Create/Modify:**
1. **`tests/pipeline.test.js`** (MODIFY)
   - Add tests for error scenarios
   - Add tests for retry logic
   - Add tests for each error type

2. **`tests/atlassian-client.test.js`** (CREATE if needed)
   - Test HTTP client directly
   - Mock API responses
   - Verify retry logic

3. **`tests/confluence-sync.test.js`** (CREATE if needed)
   - Test sync orchestration
   - Test error handling
   - Test idempotency

**Tasks:**
- [ ] Add unit tests for all new error classes
- [ ] Add unit tests for retry logic (mock delays)
- [ ] Add unit tests for HTTP client methods (mocked responses)
- [ ] Add integration tests for pipeline with retries
- [ ] Run full test suite: `npm test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Verify no regressions in existing tests

**Acceptance Criteria:**
- All unit tests pass
- All E2E tests pass
- Code coverage for error paths > 80%
- No new test warnings or deprecations

---

## Implementation Order

1. **errors.js** - Foundation for error handling
2. **atlassian-client.js** - Core retry logic and HTTP client
3. **confluence-sync.js** - Sync orchestration with error handling
4. **pipeline.js** - Pipeline-level error handling and logging
5. **index.js** - Entry point error handling
6. **Tests** - Comprehensive test coverage

## Testing Strategy

### Unit Tests (Mock HTTP responses)
- Test retry logic with simulated failures
- Test error classification and propagation
- Test each module in isolation

### Integration Tests
- Test full pipeline with mocked Atlassian API
- Test real-world error scenarios (transient failures, retries)

### E2E Tests (Playwright)
- Smoke test the pipeline with real or staged Atlassian instance
- Verify verification report generation

## Risk Mitigation

1. **Backward Compatibility:** Changes are additive; existing API contracts remain unchanged
2. **Credential Security:** Use environment variables; never log API tokens or passwords
3. **Rate Limiting:** Implement jitter in backoff to prevent thundering herd
4. **Idempotency:** Ensure multiple retries don't create duplicate pages (findPageByTitle first)
5. **Logging:** Log structure without sensitive data; avoid logging request/response bodies that contain credentials

## Definition of Done

- ✅ All code changes implemented per architecture.md
- ✅ All unit tests pass with >80% coverage
- ✅ All E2E tests pass
- ✅ No security vulnerabilities (secrets leakage, credential exposure)
- ✅ No backward compatibility breaks
- ✅ Code reviewed and approved
- ✅ Documentation updated with retry behavior
- ✅ Verification report generated and confirmed
- ✅ PR created and ready for merge

## Timeline Estimate

**Total Effort:** 7-13 hours (depending on testing depth and debugging)
- Phase 1: 1-2 hours (errors)
- Phase 2: 2-3 hours (HTTP client + retries)
- Phase 3: 1-2 hours (sync enhancement)
- Phase 4: 1-2 hours (pipeline error handling)
- Phase 5: 0.5 hours (entry point)
- Phase 6: 2-3 hours (testing and verification)

**Recommended Pace:** Implement phases 1-5 in parallel/quick succession, then Phase 6 testing at the end.
