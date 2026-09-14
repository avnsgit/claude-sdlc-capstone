# Design Review: Retry-with-Backoff for Documentation Sync Pipeline

**Date:** 2026-09-14  
**Reviewer:** Lead SDLC Engineer  
**Project:** DOCSYNC-2 (Fix Existing Sync Pipeline Code)  
**Scope:** Retry-with-backoff architecture for Confluence API calls

---

## 1. Feasibility Assessment

### Codebase Readiness: FEASIBLE

The existing codebase is **well-structured for integration** of retry-with-backoff logic without major rewrites:

#### Strengths
- **Modular architecture:** Each module has a single responsibility (change detection, document generation, Confluence sync, API adapter)
- **Clean separation of concerns:** The Atlassian API client is already isolated in `atlassian-client.js`, making it the ideal location for retry logic
- **Minimal existing implementation:** The current client is a stub (returns hardcoded responses), leaving room for real HTTP implementation with retry logic
- **Existing error handling structure:** `errors.js` already defines `ConfigurationError`, providing a foundation for error hierarchy
- **Standardized testing:** Uses Node.js built-in `test` module (no external test frameworks to configure)

#### Integration Points
1. **atlassian-client.js** (STUB → IMPLEMENTATION)
   - Current: Returns hardcoded mock responses
   - Future: Needs real HTTP calls with retry wrapper
   - Risk: LOW — entirely isolated module

2. **errors.js** (EXTEND)
   - Current: Only `ConfigurationError` defined
   - Future: Add `RetryableError`, `PipelineError`, `AtlassianApiError`
   - Risk: LOW — backward-compatible extension

3. **confluence-sync.js** (ENHANCE)
   - Current: Calls client methods directly without validation
   - Future: Add pre-call validation and error context logging
   - Risk: VERY LOW — surface-level enhancements only

4. **index.js** (ENHANCE)
   - Current: Catches and logs errors at top level
   - Future: Add error-type-specific handling
   - Risk: VERY LOW — error handling improvements only

5. **pipeline.js** (ENHANCE)
   - Current: Minimal error handling
   - Future: Add logging and context collection
   - Risk: VERY LOW — add logging hooks only

#### Conclusion
**Feasibility: APPROVED** — No major architectural changes needed; implementation is straightforward module-by-module enhancement.

---

## 2. Identified Risks

### Risk Matrix

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|-----------|--------|-----------|
| Idempotency violations (duplicate pages) | HIGH | MEDIUM | Lost data, sync failures | See Risk #1 below |
| Rate limit exhaustion from retry storms | HIGH | LOW | Pipeline stalled | See Risk #2 below |
| Credentials leaked in logs/errors | CRITICAL | LOW | Security breach | See Risk #3 below |
| Retry logic infinite loops | MEDIUM | LOW | Hung processes | See Risk #4 below |
| HTTP implementation bugs | MEDIUM | MEDIUM | Silent failures | See Risk #5 below |
| Integration test environment issues | MEDIUM | HIGH | Cannot verify E2E | See Risk #6 below |

### Risk Details and Mitigations

#### Risk #1: Idempotency and Duplicate Page Creation
**Scenario:** Retry mechanism retries a `createPage` call after network timeout, but the page was actually created before timeout. Result: duplicate page.

**Why This Matters:**
- Confluence API `createPage` is **not idempotent** — multiple calls create multiple pages
- Network timeouts can occur after server accepts request but before client receives response
- Current architecture calls `findPageByTitle` before `createPage`, but this check-then-act pattern is **not atomic**

**Mitigation Strategy:**
1. **No automatic retry on createPage 500+ errors** — only retry network-level errors
2. **Implement idempotent key pattern (future):** If Atlassian API supports custom metadata, add a sync-id to prevent duplicates
3. **For MVP:** Accept that `createPage` can fail with network timeout; caller (CI/CD) responsible for retry of entire pipeline
4. **Documentation:** Add comment in atlassian-client.js explaining non-idempotent operations
5. **Test coverage:** Add test verifying `findPageByTitle` is called before `createPage` in all cases

**Current Architecture Guarantee:**
- The existing flow does attempt `findPageByTitle` before `createPage`, so duplicate detection exists
- If `findPageByTitle` times out and retries succeed, no duplicate is created
- If `createPage` times out, pipeline fails; operator retries entire pipeline

**Recommendation:** ACCEPTABLE RISK with documented limitation — operators aware that full pipeline retry is required for network failures during create operations.

---

#### Risk #2: Rate Limit Exhaustion (Retry Storm / Thundering Herd)
**Scenario:** 1000 CI/CD pipelines all encounter a 429 (rate limit) error simultaneously. All implement exponential backoff but with synchronized timing. Result: all 1000 pipelines retry at same time (thundering herd problem).

**Why This Matters:**
- Atlassian rate limits are strict (~100 requests/min for typical accounts)
- Synchronized retry storms can amplify the rate limit problem
- Default exponential backoff (1s, 2s, 4s) doesn't account for 429 Retry-After header

**Mitigation Strategy:**
1. **Add jitter (±10%):** Already specified in architecture.md — randomize retry delays to desynchronize requests
2. **Respect Retry-After header (future):** If HTTP response includes `Retry-After`, use that instead of exponential backoff
3. **Abort on large retry delays:** If backoff exceeds 60 seconds, give up (indicates systemic rate limit, not transient)
4. **Configuration override:** Allow operators to disable retries or set lower limits via `SYNC_MAX_RETRIES` env var
5. **Monitoring hook:** Log each retry with attempt number for observability

**Current Implementation Plan:**
- Jitter is specified in design; needs implementation in `withRetry()` function
- Retry-After header respect deferred to Phase 2 (enhancement)
- Abort logic can be added in Phase 1

**Recommendation:** APPROVED with jitter implementation required — design already accounts for thundering herd.

---

#### Risk #3: Credentials Leakage in Error Messages
**Scenario:** API call fails with response body containing user email or tokens. Error is logged to stdout. Operator pastes logs into issue tracker or Slack channel. Credentials exposed.

**Why This Matters:**
- CRITICAL security issue per CLAUDE.md zero-trust-security guidelines
- Atlassian API responses can contain user metadata
- Current error handling in index.js uses `console.error(error.message)` without filtering

**Mitigation Strategy:**
1. **Never log full HTTP response bodies** — only log status code and generic message
2. **Sanitize error messages** — filter out email addresses, tokens, URLs containing credentials
3. **Separate logs:** stderr for operator (non-sensitive context), stdout for external consumers (success only)
4. **Error transformation:** Convert Atlassian errors to generic `AtlassianApiError` with sanitized message
5. **Test coverage:** Add test verifying no credentials in error messages

**Implementation Checklist:**
- [ ] `isRetryableError()` function only classifies on status code, not response body
- [ ] Error messages use format: `[ERROR] Atlassian API failed: {statusCode} {genericMessage}` (no response body)
- [ ] Credential validation in `index.js`: ensure `.env` file is not logged
- [ ] Unit test: pass error with email in body, verify output has no email

**Recommendation:** APPROVED with credential filtering implementation required — design acknowledges zero-trust guideline; implementation must enforce it.

---

#### Risk #4: Infinite Retry Loop or Hung Processes
**Scenario:** `withRetry()` function has off-by-one error and never exits loop. Or jitter calculation causes negative delay. Result: process hangs indefinitely.

**Why This Matters:**
- CI/CD pipelines have timeout limits (e.g., 15 min jobs)
- Hung process consumes resources and blocks downstream steps
- User has no visibility into whether retry is still running or stuck

**Mitigation Strategy:**
1. **Hard limits:** Max total retry time (e.g., 15 seconds) in addition to max attempt count
2. **Attempt counter with bounds:** Guard loop with `for (let i = 0; i < maxRetries; i++)`
3. **Jitter bounds validation:** Ensure `Math.random() * jitterFactor` cannot be negative or exceed max delay
4. **Logging per retry:** Log "Retry attempt X/N" to stdout so operators see progress
5. **Timeout parameter:** Allow caller to set overall timeout (e.g., via `withRetry(fn, {timeout: 30000})`)

**Current Architecture Plan:**
- Architecture.md specifies: 1s, 2s, 4s, then give up (3 retries = ~7 seconds total)
- Jitter specified as ±10% (should be safe if implemented correctly)

**Recommendation:** APPROVED with bounds validation in unit tests — implementation should verify retry limits are respected.

---

#### Risk #5: HTTP Implementation Bugs (TLS, Authentication, Payload Format)
**Scenario:** Real HTTP implementation in `atlassian-client.js` has bugs: incorrect TLS cert validation, wrong Authorization header format, malformed JSON payload. Result: 400/401/403 errors that should be caught in unit tests.

**Why This Matters:**
- Current stub implementation returns hardcoded values; real HTTP is complex
- TLS/auth bugs silently break integration with real Confluence
- Payload format errors cause 400 Bad Request (non-retryable) instead of expected success

**Mitigation Strategy:**
1. **Use standard library `https` or `fetch`:** Avoid custom HTTP code where possible
2. **Unit tests with mock server:** Test against mock HTTP server (e.g., using `node:http`) to verify payload format
3. **Integration tests with real credentials (optional):** If test Confluence instance available, verify auth header format
4. **Code review checklist:** TLS validation enabled, auth header format correct, JSON serialization tested
5. **Payload validation:** Test with actual Confluence API request format (example in test file)

**Implementation Guidance:**
- Use Node.js `https.request()` or `fetch()` API (both built-in in modern Node.js)
- Construct Authorization header as: `Authorization: Basic <base64(email:apiToken)>`
- Test payload: `{ title: "Test", body: "Test" }` as JSON
- Verify response structure: `{ id, title, body, version: {...} }`

**Recommendation:** APPROVED with unit test requirement — implementation must include mock server tests for HTTP layer.

---

#### Risk #6: Integration Test Environment Setup Complexity
**Scenario:** Playwright E2E test tries to verify pipeline with real Confluence API. But test machine has no `.env` or invalid credentials. Test skips silently. E2E coverage lost.

**Why This Matters:**
- Architecture requires E2E test to verify full pipeline end-to-end
- CI/CD environments may not have Confluence credentials available
- Silent skip means retry logic is never tested in integrated scenario

**Mitigation Strategy:**
1. **Environment detection:** E2E test checks for `ATLASSIAN_HOST` and `ATLASSIAN_API_TOKEN` before running
2. **Skip with reason:** If credentials missing, log "E2E test skipped: Atlassian credentials not configured" and exit 0
3. **Mock mode for local dev:** Option to run E2E test against mock HTTP server (not live Confluence)
4. **CI/CD gating:** Document that E2E tests require credentials; CI must set env vars
5. **Separate test profiles:** Unit tests run everywhere; E2E tests run only when credentials present

**Current Status:**
- `smoke.spec.js` exists but only tests Playwright itself (data: URL)
- No integration with actual pipeline code yet
- Must be updated to test real pipeline with mock or real client

**Recommendation:** APPROVED with documented test environment requirements — implement skip logic for missing credentials.

---

## 3. Design Trade-offs and Alternatives

### Trade-off #1: Retry Location (Client vs. Orchestrator)

**Chosen Design:** Retry logic in `atlassian-client.js` (API adapter layer)

**Pros:**
- ✅ Single source of truth for all API operations
- ✅ Easy to test retry behavior in isolation
- ✅ Scaling: if new API calls added in future, they automatically benefit from retry
- ✅ Clear separation: orchestrator doesn't know about retries

**Cons:**
- ❌ Retry timing information not visible at orchestrator level
- ❌ Orchestrator cannot implement circuit breaker pattern (would require retry metadata)

**Alternative #1: Retry at orchestrator level (confluence-sync.js)**

```javascript
// BAD: Retry logic duplicated if we add more API operations
async function syncToConfluence(client, pageTitle, summary) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const existingPage = await client.findPageByTitle(pageTitle);
      if (existingPage) {
        return await client.updatePage(existingPage.id, { title: pageTitle, body: summary });
      }
      return await client.createPage({ title: pageTitle, body: summary });
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) throw error;
      if (attempt < 3) await sleep(calculateBackoff(attempt));
    }
  }
  throw lastError;
}
```

**Why Rejected:**
- Retry logic duplicated for every orchestrator function
- Harder to maintain; changes to retry strategy require updates in multiple places
- Violates DRY principle

**Alternative #2: Centralized retry middleware (new module)**

```javascript
// utils/retry.js
async function withRetry(asyncFn, options = {}) {
  // Retry wrapper
}

// Then wrap at call site
const client = {
  findPageByTitle: (title) => withRetry(() => realFind(title)),
  createPage: (page) => withRetry(() => realCreate(page)),
  updatePage: (id, page) => withRetry(() => realUpdate(id, page)),
};
```

**Why Rejected (but reconsidered):**
- Additional indirection; retry config spread across multiple modules
- Current design (retry in client factory) is simpler and doesn't require new module

**Recommendation:** APPROVED — retry in atlassian-client.js is the right choice. If circuit breaker needed in future, add new module then.

---

### Trade-off #2: Error Hierarchy (Three Tiers vs. Two Tiers vs. Single Type)

**Chosen Design:** Three-tier hierarchy
```
ConfigurationError (env missing/invalid)
RetryableError (transient network failures)
PipelineError (unrecoverable, fatal)
AtlassianApiError (API-specific)
```

**Pros:**
- ✅ Error handling can be type-specific (different recovery per type)
- ✅ Caller can decide: retry on RetryableError, fail on PipelineError
- ✅ Clear semantics: you know what each error means
- ✅ Enables structured logging (log ERROR level for all, but tag by type)

**Cons:**
- ❌ Adds complexity; more code to write and test
- ❌ Requires error type checking in multiple places (index.js, pipeline.js)

**Alternative #1: Two-tier (Retryable vs. Fatal)**

```javascript
// Only two classes: RetryableError and FatalError
// Simpler but conflates configuration errors with actual failures
```

**Why Rejected:**
- Configuration errors (missing env vars) are fundamentally different from runtime failures
- Treating them the same obscures root cause

**Alternative #2: Single error type with status codes**

```javascript
// class PipelineError { constructor(statusCode, message, retryable) {} }
// Then check: if (error.retryable) { retry } else { fail }
```

**Why Rejected:**
- Loses semantic meaning; error.statusCode = 1001 means nothing to maintainer
- Harder to grep for "what types of errors exist"

**Recommendation:** APPROVED — three-tier hierarchy is the right balance of complexity vs. clarity.

---

### Trade-off #3: Retry Configuration (Hardcoded vs. Fully Configurable)

**Chosen Design:** Hardcoded defaults (1s, 2s, 4s max) with environment variable override

```javascript
// atlassian-client.js
const DEFAULT_MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES || '3');
const DEFAULT_INITIAL_DELAY = parseInt(process.env.SYNC_INITIAL_DELAY_MS || '1000');
const DEFAULT_MAX_DELAY = parseInt(process.env.SYNC_MAX_DELAY_MS || '8000');
```

**Pros:**
- ✅ Works out-of-box without configuration
- ✅ Sensible defaults based on Atlassian best practices
- ✅ Operators can tune if needed
- ✅ No config object passed through every function call

**Cons:**
- ❌ Less flexible for edge cases (e.g., per-operation config)
- ❌ Config split between code (hardcoded) and env vars

**Alternative #1: Fully parameterized (config object everywhere)**

```javascript
// VERBOSE: config passed to every function
withRetry(asyncFn, {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 8000,
  jitterFactor: 0.1,
})
```

**Why Rejected:**
- Adds parameter bloat; most callers use defaults anyway
- Not required by acceptance criteria

**Alternative #2: Hardcoded only (no env var override)**

```javascript
// INFLEXIBLE: operators cannot tune
const DEFAULT_MAX_RETRIES = 3;
```

**Why Rejected:**
- Operators may need to adjust for high-load environments
- No flexibility for future rate limit tuning

**Recommendation:** APPROVED — hardcoded defaults + env var override is the right balance.

---

### Trade-off #4: HTTP Library (Node.js `https` vs. `fetch` vs. External Package)

**Chosen Design:** Node.js built-in `https` module

**Pros:**
- ✅ No external dependencies (minimal attack surface)
- ✅ Reliable and well-tested in production
- ✅ Fine-grained control over TLS, headers, etc.
- ✅ Works in Node.js 14.x+ (project target)

**Cons:**
- ❌ Verbose callback style (need promisify)
- ❌ Manual header management (Authorization, Content-Type)

**Alternative #1: Fetch API**

```javascript
// Simpler async/await syntax
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Authorization': `Basic ${btoa(email:token)}` },
  body: JSON.stringify(payload),
});
```

**Pros of Fetch:**
- ✅ Cleaner syntax (async/await)
- ✅ Available in Node.js 18.0+

**Cons of Fetch:**
- ❌ May not be available on all project targets
- ❌ Still need polyfill on Node.js 14.x

**Why Chosen:** Use `https` with promisification for compatibility. If project upgrades to Node.js 18+, can switch to fetch later.

**Alternative #2: External HTTP package (axios, node-fetch, got)**

```javascript
// axios example
const response = await axios.post(url, payload, {
  headers: { 'Authorization': `Basic ${btoa(...)}` }
});
```

**Why Rejected:**
- Adds external dependency (package-lock.json bloat, supply chain risk)
- Unnecessary for simple HTTP calls
- Goes against "minimal dependencies" principle

**Recommendation:** APPROVED — use Node.js `https` module with promisify wrapper.

---

### Trade-off #5: Logging Strategy (Structured vs. Printf-style)

**Chosen Design:** Printf-style logs to stderr (no external logger)

```javascript
console.error(`[ERROR] Sync pipeline failed at ${stage}: ${error.message}`);
console.log(`[INFO] Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
```

**Pros:**
- ✅ No external dependencies
- ✅ Simple and readable
- ✅ Operators can grep logs easily
- ✅ Works with standard log aggregation (ELK, Splunk, etc.)

**Cons:**
- ❌ Less structured than JSON logging
- ❌ No built-in log levels (must manually prefix [ERROR], [INFO])

**Alternative #1: Structured JSON logging**

```javascript
console.error(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'ERROR',
  stage: 'confluence_sync',
  message: error.message,
  code: error.code,
}));
```

**Pros:**
- ✅ Easier for log aggregation tools to parse
- ✅ Can include structured metadata

**Cons:**
- ❌ Harder to read in terminal
- ❌ More code to write

**Why Chosen:** Printf-style is sufficient for MVP. Can upgrade to JSON logging later if needed.

**Alternative #2: Dedicated logger module (winston, pino)**

**Why Rejected:**
- Over-engineering for MVP scope
- Adds external dependency
- Not required by acceptance criteria

**Recommendation:** APPROVED — printf-style logging with [ERROR]/[INFO] prefixes is appropriate for MVP.

---

## 4. Security Review

### 4.1 Credential Handling

**Status:** APPROVED with implementation requirements

**Checks Performed:**
- ✅ All credentials loaded from environment (process.env), not hardcoded
- ✅ Credentials passed to createAtlassianClient factory; not exposed in module scope
- ✅ No credentials logged in current code

**Required Implementation:**
- [ ] Filter credentials from error messages (see Risk #3 mitigation)
- [ ] Test: verify no email or token in error logs
- [ ] Ensure `.env` file is in .gitignore (already listed)

**Credential Leakage Risk Points:**
1. **HTTP response body logging** — If API error response contains user email, don't log it
2. **Error stack traces** — Stack traces may contain URL with credentials (less likely)
3. **Configuration validation logs** — When validating env vars, don't echo values

**Verification Steps:**
```javascript
// Example secure error handling
try {
  await client.findPageByTitle(pageTitle);
} catch (error) {
  // BAD: console.error(error); // might contain auth header
  // GOOD:
  console.error(`[ERROR] API call failed: ${error.statusCode || 'unknown'}`);
  throw new PipelineError(error.statusCode || 'unknown', { stage: 'confluence_sync' });
}
```

---

### 4.2 API Token Scope and Permissions

**Status:** APPROVED (design assumes valid tokens)

**Current Assumption:**
- Atlassian API token (from ATLASSIAN_API_TOKEN) has permissions to:
  - Read pages (findPageByTitle)
  - Create pages (createPage)
  - Update pages (updatePage)
  - In the `DocSync` space

**No credential rotation:**
- Architecture.md notes: "No credential rotation required" (standard security posture)
- Operator responsible for rotating tokens if compromised

**Recommendations (out of scope but noted):**
- Use service account with minimal permissions (read/write DocSync space only)
- Implement token rotation in CI/CD (not in this pipeline)
- Monitor API token usage for unauthorized access (via Atlassian audit logs)

---

### 4.3 TLS and HTTPS

**Status:** APPROVED with implementation verification

**Requirements:**
- All HTTP calls to Atlassian must use HTTPS
- TLS certificate validation must be enabled (default in Node.js https module)
- No REJECTUNAUTHORIZED = false (would disable cert validation)

**Implementation Checklist:**
- [ ] Use `https.request()` not `http.request()`
- [ ] Verify baseUrl starts with `https://`
- [ ] Add validation: `if (!baseUrl.startsWith('https://')) throw new ConfigurationError(...)`
- [ ] Never set `rejectUnauthorized: false` in https options

---

### 4.4 Error Message Sanitization

**Status:** REQUIRES IMPLEMENTATION

**Risks:**
- API error responses may contain user information
- Stack traces may expose internal structure
- Retry logs may leak operation details

**Required Sanitization:**
```javascript
// Before logging:
1. Remove email addresses: message.replace(/[\w\.-]+@[\w\.-]+/g, '[REDACTED]')
2. Remove tokens: message.replace(/Bearer\s+\w+/g, 'Bearer [REDACTED]')
3. Remove URLs containing credentials: message.replace(/:[^@]+@/g, ':[REDACTED]@')
4. Remove full response bodies (only log status code)
```

**Test Case:**
```javascript
test('error message does not contain credentials', async () => {
  const error = new AtlassianApiError('Unauthorized', 401, 'invalid token abc123');
  const sanitized = sanitizeErrorMessage(error.message);
  assert(!sanitized.includes('abc123'));
  assert(!sanitized.includes('invalid token'));
});
```

---

### 4.5 Rate Limiting and DOS Prevention

**Status:** APPROVED with jitter implementation required

**Attack Scenario:**
- Malicious actor floods Atlassian API with requests
- Retry logic amplifies the attack
- Rate limiter (429) triggered
- Legitimate pipelines fail due to rate limit

**Mitigation:**
- ✅ Jitter (±10%) prevents synchronized retry storms
- ✅ Max retry cap (8 seconds) prevents resource exhaustion
- ✅ Operator can disable retries (SYNC_MAX_RETRIES=0) if needed
- ❌ Rate limiting is reactive, not proactive; no pre-emptive backoff

**Note:** This is acceptable for MVP; advanced patterns (circuit breaker, adaptive backoff) deferred to Phase 2.

---

### 4.6 Dependency Security

**Status:** APPROVED

**Current Dependencies:**
- @playwright/test (test runner, only devDependency)
- dotenv (loads env vars, widely used and maintained)

**No new security risks:** Proposed changes don't add external HTTP libraries; uses Node.js built-in https module.

**Recommendation:** Run `npm audit` before committing to verify no vulnerabilities in existing dependencies.

---

## 5. Integration Concerns

### 5.1 Integration with Existing Tests

**Status:** APPROVED with test updates required

**Current Test Coverage:**
- ✅ `config.test.js` — Validates config loading (unaffected)
- ✅ `pipeline.test.js` — Tests pipeline orchestration (unaffected if mock client still works)
- ✅ `smoke.spec.js` — Playwright E2E test (needs update to test real pipeline)

**What Must NOT Break:**
1. `npm test` must still pass with mock client
2. `npm run test:e2e` must still run (even if skipped due to missing credentials)

**Changes Needed:**
1. **Update `pipeline.test.js`:**
   - Mock client should implement real interface (no longer accept no-op methods)
   - Test should verify retry behavior indirectly (e.g., track retry metadata)

2. **Update `smoke.spec.js`:**
   - Currently tests only Playwright (data: URL)
   - Should be extended to test real pipeline with mock client or real API
   - Add skip logic for missing Atlassian credentials

3. **Add new test file: `atlassian-client.test.js`:**
   - Test retry logic with mock HTTP server
   - Test error classification
   - Test exponential backoff timing

**Example: Mock HTTP Server for Unit Tests**

```javascript
// atlassian-client.test.js
const http = require('node:http');
const { createAtlassianClient } = require('../src/atlassian-client');

test('retry succeeds on transient error then success', async () => {
  let attempt = 0;
  const server = http.createServer((req, res) => {
    attempt++;
    if (attempt < 2) {
      res.writeHead(503); // Service Unavailable
      res.end('Retry later');
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({ id: 'page-123', title: 'Test' }));
    }
  });

  // Start server, create client, make request, verify success and retry count
  // Stop server
});
```

---

### 5.2 Integration with Playwright Verification Suite

**Status:** APPROVED with documentation required

**Current Playwright Setup:**
- Uses `@playwright/test` (version ^1.63.0)
- Configured for headless mode (from instructions)
- Runs via `npm run test:e2e`

**How Retry Logic Integrates:**
1. **E2E test calls main pipeline**
2. **Pipeline creates Atlassian client**
3. **Client makes HTTP calls with retry logic**
4. **On API failure, retry logic kicks in automatically**
5. **E2E test verifies final result (success or expected failure)**

**E2E Test Requirements:**
- Can run with mock or real Atlassian API
- Skips gracefully if credentials not available (see Risk #6)
- Verifies retry behavior indirectly (observes final result, not retry count)

**Integration Steps:**
1. Update smoke.spec.js to test real pipeline (not just Playwright)
2. Add environment check: if ATLASSIAN_HOST missing, skip with message
3. If credentials present: run full sync, verify report generated
4. If mock mode: use mock HTTP server to simulate API failures

---

### 5.3 Integration with CI/CD Pipeline

**Status:** APPROVED with operator documentation required

**CI/CD Assumptions:**
- Node.js 14.x or higher available
- npm dependencies installed (npm ci)
- Environment variables set (ATLASSIAN_HOST, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN)
- Playwright browsers installed (only for E2E tests)

**What Changes:**
- Pipeline now implements retry logic automatically
- Operators don't need to implement retry in CI/CD config
- Transient failures (429, 503) are retried automatically

**What Doesn't Change:**
- Exit codes: still 0 on success, 1 on failure
- Output format: still logs to stdout/stderr
- Environment variables: same three required

**Documentation Requirement:**
- Add section to README or INSTALL.md explaining retry behavior
- Document that network timeouts during createPage may cause failures
- Recommend CI/CD timeout > 30 seconds (to allow retries)

---

### 5.4 Backward Compatibility

**Status:** APPROVED — fully backward compatible

**What Remains Unchanged:**
- All existing function signatures (no breaking changes)
- Environment variable names and format
- Output format (stdout/stderr messages)
- Exit codes
- Verification report structure

**What Is Enhanced (additive):**
- Error handling is better (won't silent fail on transient errors)
- Retry logic transparent to callers
- Logging is more informative (but same format)

**Migration Path:**
- No migration required; existing CI/CD configs work as-is
- Immediate benefit: transient API errors now handled gracefully

---

## 6. Approval Status

### Summary Assessment

| Category | Status | Notes |
|----------|--------|-------|
| **Feasibility** | ✅ APPROVED | Modular architecture enables straightforward implementation |
| **Risks** | ✅ APPROVED WITH CONDITIONS | All identified risks have documented mitigations |
| **Design Trade-offs** | ✅ APPROVED | Design decisions well-justified; alternatives considered |
| **Security** | ✅ APPROVED WITH CONDITIONS | Credential handling requires implementation verification |
| **Integration** | ✅ APPROVED WITH CONDITIONS | Test updates required; backward compatible |
| **Overall** | ✅ APPROVED FOR IMPLEMENTATION | Proceed with Phase 1 (Error Foundation) |

---

### Conditions for Approval

**MUST DO (Blocking):**
1. Implement credential filtering in error messages (no email/token leaks)
2. Add unit tests for retry logic with mock HTTP server
3. Implement exponential backoff with jitter (±10%)
4. Update `smoke.spec.js` to test real pipeline (or document why E2E is skipped)
5. Validate that HTTPS URLs are used (reject http:// baseUrl)

**SHOULD DO (Strongly Recommended):**
1. Add logging per retry attempt (for observability)
2. Implement Retry-After header parsing (for rate limit handling)
3. Document retry behavior in README (operators should know about it)
4. Add circuit breaker pattern (if phase 2 includes this)
5. Run `npm audit` before merging to detect security vulnerabilities

**NICE TO HAVE (Future Enhancements):**
1. Implement per-operation retry configuration (instead of global)
2. Add structured JSON logging (instead of printf-style)
3. Implement dedicated logger module
4. Add metrics/observability hooks (Prometheus, CloudWatch, etc.)

---

### Risk Acceptance

The design is APPROVED with the understanding that:

1. **Idempotency Risk (ACCEPTED):** Operators are responsible for retrying the full pipeline if network failures occur during page creation. Documentation will explain this limitation.

2. **Rate Limit Risk (MITIGATED):** Jitter implementation prevents thundering herd. Advanced circuit breaker patterns deferred to Phase 2.

3. **Credential Leakage Risk (CONDITIONAL):** Approval contingent on sanitization implementation in error messages.

4. **HTTP Implementation Risk (CONDITIONAL):** Unit tests with mock HTTP server required to verify HTTP layer correctness.

5. **Integration Test Risk (CONDITIONAL):** E2E test must skip gracefully if credentials unavailable; operators document required credentials.

---

### Implementation Readiness

**Green Light:** Proceed with implementation using Phase 1-3 sequencing from architecture.md.

**Before Implementation:**
- [ ] Review this design-review.md with stakeholders
- [ ] Confirm risk mitigations are acceptable
- [ ] Verify test environment setup (mock HTTP server available)
- [ ] Assign implementation tasks to team members

**During Implementation:**
- [ ] Follow MUST DO conditions above
- [ ] Reference this document for design decisions and trade-off justifications
- [ ] Update code comments to explain non-obvious decisions
- [ ] Add tests as specified in Unit Test Coverage section

**After Implementation:**
- [ ] Run `npm audit` to verify no security vulnerabilities
- [ ] Run `npm test` to verify all tests pass
- [ ] Run `npm run test:e2e` to verify E2E tests pass or skip gracefully
- [ ] Review code for credential handling compliance (zero-trust security)
- [ ] Update README with retry behavior documentation

---

## Appendix: Key References

### Architecture Documents
- [architecture.md](./.claude/architecture.md) — High-level design overview
- [requirements.md](./.claude/requirements.md) — Functional requirements and acceptance criteria

### Security Guidelines
- [zero-trust-security.md](./.claude/instructions/zero-trust-security.md) — Credential handling requirements
- [code-style-typescript.md](./.claude/instructions/code-style-typescript.md) — Code quality standards
- [playwright-testing.md](./.claude/instructions/playwright-testing.md) — E2E testing guidelines

### Implementation Guides
- [Atlassian REST API Docs](https://developer.atlassian.com/cloud/confluence/rest/v2/) — API reference (external)
- [Node.js HTTPS Module](https://nodejs.org/api/https.html) — Built-in HTTP client docs (external)

### Phase Sequencing
1. **Phase 1:** Error Foundation (errors.js, withRetry, HTTP implementation)
2. **Phase 2:** API Integration (sleep, error classification, wrap operations)
3. **Phase 3:** Pipeline Hardening (validation, logging, error context)
4. **Phase 4:** Testing (unit, integration, E2E)

---

**Design Review Completed:** 2026-09-14  
**Reviewer:** Lead SDLC Engineer  
**Status:** APPROVED FOR IMPLEMENTATION
