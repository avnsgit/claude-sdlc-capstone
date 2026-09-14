# Confluence Page Tree and Documentation Standards

## Smart Create-Once, Update-Always Logic

### First Run: Create Tree Structure
If parent page "Claude SDLC Capstone" does NOT exist in Confluence:
1. Create root parent page: "Claude SDLC Capstone"
2. Create 8 child phase pages nested under root
3. Pages created once, then only updated forever

### All Other Runs: Update Only
If parent page "Claude SDLC Capstone" EXISTS:
1. Do NOT create any pages (root or children)
2. Query existing phase pages by title
3. Update each phase page with new content from generatedDocs/
4. Maintain page hierarchy and titles (never change)

## Page Tree Structure

```text
Claude SDLC Capstone (ROOT - Create once, then only update)
├── Phase 1: Requirements (Create once, then only update)
├── Phase 2: Architecture (Create once, then only update)
├── Phase 3: Design Review (Create once, then only update)
├── Phase 4: Implementation Plan (Create once, then only update)
├── Phase 5: Implementation Summary (Create once, then only update)
├── Phase 6: Code Review (Create once, then only update)
├── Phase 7: Verification (Create once, then only update)
└── Phase 8: Pull Request (Create once, then only update)
```

## 8 Phase Pages (All Required)

| Phase | Title | Content Source | First Run | After |
|-------|-------|-----------------|-----------|-------|
| 1 | Phase 1: Requirements | generatedDocs/requirements.md | CREATE | UPDATE |
| 2 | Phase 2: Architecture | generatedDocs/architecture.md | CREATE | UPDATE |
| 3 | Phase 3: Design Review | generatedDocs/design-review.md | CREATE | UPDATE |
| 4 | Phase 4: Implementation Plan | generatedDocs/impl-plan.md | CREATE | UPDATE |
| 5 | Phase 5: Implementation Summary | src/ code summary | CREATE | UPDATE |
| 6 | Phase 6: Code Review | generatedDocs/code-review-report.md | CREATE | UPDATE |
| 7 | Phase 7: Verification | generatedDocs/verify-results.txt | CREATE | UPDATE |
| 8 | Phase 8: Pull Request | PR URL + branch info | CREATE | UPDATE |

## Implementation Rules

### First Run Detection
1. Query Confluence for page titled "Claude SDLC Capstone"
2. If found: Skip creation, go to update workflow
3. If NOT found: Create tree structure

### Create Workflow (First Run)
1. Create root page: "Claude SDLC Capstone" in DocSync space
2. Create 8 phase pages as children of root page
3. Each phase page initialized with basic structure
4. Record all page IDs

### Update Workflow (All Other Runs)
1. Query each phase page by title
2. Retrieve page ID
3. Use `updateConfluencePage()` to replace content
4. Never modify page titles or hierarchy
5. Never create new pages

## Tools

**Create Operations (First Run Only):**
- `searchConfluenceUsingCql()` — Check if root exists
- `createConfluencePage()` — Create root page once
- `createConfluencePage()` — Create 8 phase pages once

**Update Operations (All Runs):**
- `searchConfluenceUsingCql()` — Find phase pages
- `getConfluencePage()` — Retrieve page details
- `updateConfluencePage()` — Replace page content

**Never Use:**
- ❌ Multiple `createConfluencePage()` calls after first run
- ❌ `createConfluenceInlineComment()` for main content
- ❌ Nested child pages under phase pages
