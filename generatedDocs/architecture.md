# Architecture: Documentation Sync Pipeline with Retry-with-Backoff

**Date:** 2026-09-14  
**Project:** DOCSYNC (DOCSYNC-2)  
**Scope:** Fix existing sync pipeline code with retry mechanism and improved error handling

---

## 1. High-Level Design Overview

### System Boundaries
The documentation sync pipeline orchestrates three primary flows:
1. **Change Detection** → Identify modified files in the repository
2. **Document Generation** → Transform file changes into Confluence-compatible content
3. **Confluence Sync** → Push generated documentation to Confluence via Atlassian API

### Retry-with-Backoff Strategy

The retry mechanism will be implemented at the **Atlassian API client layer** to ensure all three API operations (findPageByTitle, createPage, updatePage) benefit from resilience without duplicating logic across the pipeline.

**Exponential Backoff Configuration:**
- **Initial Delay:** 1 second
- **Backoff Factor:** 2x per retry
- **Max Retries:** 3 attempts (total: 1s, 2s, 4s)
- **Max Delay Cap:** 8 seconds (configurable)
- **Jitter:** ±10% random jitter to prevent thundering herd on rate limits

**Retryable Conditions:**
- Network timeouts (ECONNREFUSED, ETIMEDOUT, EHOSTUNREACH)
- Transient HTTP errors (429 Too Many Requests, 503 Service Unavailable, 504 Gateway Timeout)
- Temporarily unavailable responses from Atlassian servers

**Non-Retryable Conditions:**
- Authentication errors (401, 403) — indicates configuration problem
- Not found (404) — indicates invalid state or page deleted
- Bad request (400) — indicates logic error in client code
- Other 4xx errors — indicate client-side issues

---

## 2. Error Handling Strategy

### Error Classification
The pipeline implements a three-tier error classification system:

**Tier 1: Configuration Errors (ConfigurationError)**
- Missing or invalid Atlassian credentials
- Invalid environment variable values
- Missing required client interface

**Tier 2: Transient Errors (RetryableError)**
- Network connectivity issues
- Rate limiting by Atlassian API
- Temporary service unavailability

**Tier 3: Fatal Errors (PipelineError)**
- Unexpected response format from Atlassian API
- Concurrent modification conflicts
- Unrecoverable state corruption

### Error Propagation Flow

```
Pipeline Entry (index.js)
    ↓
runPipeline() [pipeline.js]
    ├── getChangedFiles() [change-detector.js]
    ├── generateDocumentSummary() [document-generator.js]
    ├── syncToConfluence() [confluence-sync.js]
    │   └── Atlassian Client with Retry Logic [atlassian-client.js]
    │       ├── findPageByTitle() → API Call + Retry Logic
    │       ├── createPage() → API Call + Retry Logic
    │       └── updatePage() → API Call + Retry Logic
    ├── buildVerificationReport() [verification.js]
    └── writeVerificationResults() [document-writer.js]
```

### Error Handling Pattern: Try-Catch-Recover

Each module follows a consistent pattern:
1. **Validate inputs** before processing
2. **Execute operation** with error propagation
3. **Catch errors** at appropriate layer
4. **Log context** (without exposing secrets)
5. **Re-throw or recover** with meaningful context

---

## 3. Module Responsibilities and Dependencies

### Module Dependency Graph

```
index.js
├── requires: atlassian-client.js
├── requires: pipeline.js
│   ├── requires: change-detector.js
│   ├── requires: document-generator.js
│   ├── requires: confluence-sync.js (orchestrator)
│   │   └── requires: atlassian-client.js
│   ├── requires: verification.js
│   └── requires: document-writer.js
└── requires: config.js (for environment loading)
```

### Module Responsibilities

**config.js**
- Load and validate environment variables
- Provide configuration object to application
- Responsibility: Single source of truth for environment state

**change-detector.js**
- Filter and normalize file paths from command-line arguments
- Responsibility: Accept any file list, return validated list

**document-generator.js**
- Transform file paths into human-readable document content
- Handle edge cases (empty lists, special characters)
- Responsibility: File → Markdown transformation

**confluence-sync.js** (Orchestrator)
- Determine whether page exists (GET operation)
- Route to createPage or updatePage (POST/PUT operations)
- Handle no-client scenario gracefully
- Responsibility: API orchestration logic

**atlassian-client.js** (API Adapter)
- Implement HTTP communication with Atlassian API
- Encapsulate retry-with-backoff logic
- Transform API responses to internal format
- Responsibility: All network I/O, retry logic, and error translation

**verification.js**
- Create structured report of pipeline execution
- Responsibility: Result serialization for auditing

**document-writer.js**
- Write verification results to filesystem
- Create directories as needed
- Responsibility: Filesystem I/O

---

## 4. Data Flow: Change Detection → Sync → Verification

### Primary Data Flow

```
User Input (file paths)
    ↓
change-detector.js::getChangedFiles()
    ↓ (filtered file paths array)
document-generator.js::generateDocumentSummary()
    ↓ (markdown string)
confluence-sync.js::syncToConfluence()
    ├→ client.findPageByTitle(pageTitle)
    │  ├→ atlassian-client.js + retry logic
    │  └→ returns {id, title, ...} or null
    ├→ if exists: client.updatePage(id, {title, body})
    └→ if not: client.createPage({title, body})
    ↓ (sync result: {updated: bool, action: string, pageTitle: string})
verification.js::buildVerificationReport()
    ↓ (JSON string)
document-writer.js::writeVerificationResults()
    ↓ (file written to disk)
runPipeline() returns result object to index.js
```

### State Consistency Guarantees

- **No Partial Updates:** All-or-nothing: either the Confluence page is fully updated or the operation fails
- **Failed Syncs:** If syncToConfluence throws (after retry exhaustion), pipeline halts and reports error
- **Idempotent Operations:** Retrying the same sync multiple times is safe because:
  - findPageByTitle is idempotent (read operation)
  - updatePage is idempotent if called with same content
  - No transactions span multiple API calls (single call is atomic)

---

## 5. Key Classes and Functions Requiring Modification

### 5.1 atlassian-client.js (NEW: Retry Logic)

**Current State:** Stub implementation without real HTTP calls

**Required Changes:**
1. **Add real HTTP implementation** using Node.js `https` module or fetch API
2. **Implement retry wrapper function:**
   ```javascript
   async function withRetry(asyncFn, options = {}) {
     // Exponential backoff with jitter
     // Returns result or throws on exhaustion
   }
   ```
3. **Wrap each API operation:**
   ```javascript
   findPageByTitle: async (title) => 
     withRetry(() => performHttpGet(...), {maxRetries: 3})
   ```
4. **Add error translation:**
   - Map HTTP status codes to retryable vs. fatal errors
   - Preserve original error context for logging

**Key Functions:**
- `createAtlassianClient({baseUrl, email, apiToken})` → factory
- `withRetry(asyncFn, {maxRetries, initialDelay, maxDelay, jitterFactor})` → retry wrapper
- `sleep(ms)` → delay utility with jitter
- `isRetryableError(error)` → error classification

### 5.2 confluence-sync.js (ENHANCE: Error Handling)

**Current State:** Basic orchestration without error context

**Required Changes:**
1. **Add validation before API calls:**
   - Ensure client is not null
   - Ensure pageTitle is non-empty string
   - Ensure summary is non-empty string
2. **Add error context logging:**
   - Log operation type (find/create/update)
   - Log retry attempts (via client error details)
   - Don't log credentials or sensitive content
3. **Add result enrichment:**
   - Include timestamp of sync
   - Include retry count (if available from client)
   - Preserve original error for debugging

**Key Functions:**
- `syncToConfluence(client, pageTitle, summary)` → remains same signature, enhanced error handling

### 5.3 errors.js (NEW: Error Hierarchy)

**Current State:** Only `ConfigurationError` defined

**Required Additions:**
```javascript
class RetryableError extends Error {
  // For transient failures (network, rate limit, timeout)
  constructor(message, originalError, retryCount, nextRetryDelay) {}
}

class PipelineError extends Error {
  // For unrecoverable pipeline failures
  constructor(message, context = {}) {}
}

class AtlassianApiError extends Error {
  // For Atlassian API-specific errors
  constructor(message, statusCode, responseBody) {}
}
```

### 5.4 index.js (ENHANCE: Error Handling)

**Current State:** Catches errors and logs message only

**Required Changes:**
1. **Distinguish error types in output:**
   - ConfigurationError → log hint about missing env vars
   - RetryableError → log retry summary
   - Other errors → log full context
2. **Add conditional exit code:**
   - Exit 1 on all errors (current behavior)
   - Consider exit codes: 1 (general error), 2 (config error), 3 (transient, retry recommended)

### 5.5 pipeline.js (ENHANCE: Validation and Logging)

**Current State:** Happy path only, minimal validation

**Required Changes:**
1. **Add input validation:**
   - Verify changedFiles is array
   - Verify client has required methods
2. **Add logging hooks:**
   - Log start of pipeline with file count
   - Log each stage completion
   - Log final sync result
3. **Add error context collection:**
   - Catch errors from each stage
   - Annotate with stage name for debugging

---

## 6. Design Decisions and Trade-offs

### Decision 1: Retry Logic Location
**Choice:** Implement retry in `atlassian-client.js` (API adapter layer)

**Rationale:**
- ✅ Single point of control for all API calls
- ✅ No retry logic duplication across modules
- ✅ Easy to test retry behavior in isolation
- ✅ Maintains separation of concerns

**Alternative:** Implement retry in `confluence-sync.js`
- ❌ Would duplicate logic if we add more API calls in future
- ❌ Mixing orchestration logic with resilience logic

### Decision 2: Error Classification
**Choice:** Three-tier hierarchy (ConfigurationError, RetryableError, PipelineError)

**Rationale:**
- ✅ Allows error-type-specific recovery strategies
- ✅ Enables structured logging and monitoring
- ✅ Clear contracts between modules

**Alternative:** Single generic error with status codes
- ❌ Loses semantic meaning (errors become numbers)
- ❌ Harder to determine if error is retryable

### Decision 3: Retry Configuration
**Choice:** Hardcode exponential backoff (1s, 2s, 4s) with environment variable override

**Rationale:**
- ✅ Sensible defaults for Atlassian rate limiting
- ✅ Operators can tune via env var if needed
- ✅ No excessive complexity for typical use case

**Alternative:** Full configuration object in every call
- ❌ Adds complexity to pipeline code
- ❌ Most operators won't need customization

### Decision 4: Logging Strategy
**Choice:** Structured logs (no credentials, context-rich) to stderr and stdout

**Rationale:**
- ✅ No secrets leaked into logs
- ✅ Follows zero-trust-security.md guidelines
- ✅ Works with most logging aggregation tools
- ✅ Deterministic for testing

**Alternative:** Dedicated logger module
- ❌ Over-engineering for MVP scope
- ❌ Not required by acceptance criteria

### Decision 5: State Consistency
**Choice:** No distributed transaction support; single API call = atomic unit

**Rationale:**
- ✅ Matches Atlassian API design (no multi-call transactions)
- ✅ Simplifies implementation
- ✅ Each operation idempotent by design

**Alternative:** Implement local transaction log
- ❌ Not needed for Confluence API use case
- ❌ Would require coordination for rollback

---

## 7. Implementation Priority and Sequencing

### Phase 1: Error Foundation (Foundation)
1. Extend `errors.js` with RetryableError, PipelineError
2. Implement `withRetry()` wrapper in `atlassian-client.js`
3. Add real HTTP implementation to atlassian-client.js

### Phase 2: API Integration (Core)
1. Implement `sleep()` utility with jitter
2. Implement error classification logic
3. Wrap all three API operations with retry logic

### Phase 3: Pipeline Hardening (Robustness)
1. Add validation to `confluence-sync.js`
2. Enhance error context in `index.js`
3. Add logging to `pipeline.js`

### Phase 4: Testing (Verification)
1. Unit tests for retry logic (success, failure, exhaustion)
2. Unit tests for error classification
3. E2E tests for full pipeline with mock API
4. Integration tests with real Atlassian API (optional, gated on credentials)

---

## 8. Testing Strategy

### Unit Test Coverage

**atlassian-client.js:**
- ✅ Retry succeeds on transient error then success
- ✅ Retry exhausts and throws after max attempts
- ✅ Non-retryable errors throw immediately
- ✅ Exponential backoff timing is correct (±jitter)
- ✅ All three API operations work correctly

**confluence-sync.js:**
- ✅ Page update flow (existing page)
- ✅ Page creation flow (new page)
- ✅ No-client scenario (returns early)
- ✅ Input validation (empty title, null client)

**errors.js:**
- ✅ Error instantiation and inheritance
- ✅ Error message preservation
- ✅ Stack traces maintained

**pipeline.js:**
- ✅ Skips when no files changed
- ✅ Creates page for new file changes
- ✅ Updates page for existing page changes
- ✅ Propagates errors from child modules

### Integration Test Coverage (Playwright)

**smoke.spec.js:**
- ✅ Full pipeline runs without crashing
- ✅ Verification report is generated
- ✅ Result file written to disk (if path provided)
- ✅ Exit code indicates success/failure

---

## 9. Logging and Observability

### Log Points (Info Level)
- Pipeline start: `[INFO] Starting sync pipeline with N files`
- Stage completion: `[INFO] Document generated for K files`
- API attempt: `[INFO] Syncing to Confluence page: {title}`
- Retry attempt: `[INFO] Retry attempt 2/3 after 2s delay`
- Final result: `[INFO] Sync completed: {action} page {id}`

### Log Points (Error Level)
- Configuration missing: `[ERROR] Missing ATLASSIAN_HOST environment variable`
- Retry exhausted: `[ERROR] Failed after 3 retries: {error.message}`
- Pipeline failure: `[ERROR] Pipeline failed at {stage}: {error.message}`

### Log Context (Never Logged)
- ❌ ATLASSIAN_API_TOKEN
- ❌ ATLASSIAN_EMAIL
- ❌ Full HTTP response bodies (only status codes)
- ❌ File content (only file paths)

---

## 10. Security Considerations

### Credential Handling
- ✅ All credentials loaded from environment only (no .env in git)
- ✅ No credentials hardcoded in source files
- ✅ No credentials logged or passed to external systems

### API Error Messages
- ✅ Don't expose Atlassian error details that might leak structure info
- ✅ Do preserve enough context for debugging (status code, general message)
- ✅ Log full errors to stderr (for operators), not stdout (for external consumption)

### Retry Backoff Security
- ✅ Use jitter to prevent thundering herd on rate limits
- ✅ Respect HTTP 429 Retry-After header (future enhancement)
- ✅ Don't retry on 429 > 60s (resource exhaustion protection)

---

## 11. File Structure (After Implementation)

```
src/
├── index.js                 # Entry point (enhanced error handling)
├── pipeline.js              # Orchestrator (enhanced logging)
├── config.js                # Configuration (unchanged)
├── change-detector.js       # File filtering (unchanged)
├── document-generator.js    # Content generation (unchanged)
├── confluence-sync.js       # API orchestration (enhanced validation)
├── atlassian-client.js      # API adapter with retry logic (NEW implementation)
├── document-writer.js       # Filesystem I/O (unchanged)
├── verification.js          # Report generation (unchanged)
└── errors.js                # Error hierarchy (enhanced with new error types)

tests/
├── config.test.js           # Configuration tests (unchanged)
├── pipeline.test.js         # Pipeline tests (unchanged, still passing)
└── playwright/
    └── smoke.spec.js        # E2E tests (unchanged)
```

---

## 12. Acceptance Criteria Mapping

| Criterion | Implementation | Testing |
|-----------|---|---|
| Atlassian API calls retry with exponential backoff | `withRetry()` in atlassian-client.js | Unit tests verify 1s, 2s, 4s sequence |
| Unit tests pass for retry logic and error scenarios | errors.js, atlassian-client.js test coverage | `npm test` command |
| Playwright E2E tests verify pipeline behavior | smoke.spec.js unchanged pattern | `npm run test:e2e` command |
| Documentation updated in Confluence | Sync results written to verify report | HTML report and Confluence page |
| Code review confirms no vulnerabilities | Security review of credential handling, error messages | Security scanning in PR review |
| PR created with clear commit messages | Commit message format: type(module): description | Git history shows intent |

---

## 13. Configuration and Environment

### Environment Variables (Already Defined)
- `ATLASSIAN_HOST` — Confluence instance URL
- `ATLASSIAN_EMAIL` — API user email
- `ATLASSIAN_API_TOKEN` — API authentication token
- `PLAYWRIGHT_BASE_URL` — Browser testing base URL
- `VERIFY_RESULTS_PATH` — Output file for verification report

### New Configuration (Optional Enhancements)
- `SYNC_MAX_RETRIES` — Override default 3 retries
- `SYNC_INITIAL_DELAY_MS` — Override default 1000ms
- `SYNC_MAX_DELAY_MS` — Override default 8000ms
- `DEBUG_SYNC_PIPELINE` — Enable verbose logging

---

## Summary

This architecture maintains the existing modular structure while adding robust error handling and retry-with-backoff mechanisms. The design preserves backward compatibility, follows the project's security and code quality guidelines, and enables clear testing and observability of the documentation sync pipeline.
