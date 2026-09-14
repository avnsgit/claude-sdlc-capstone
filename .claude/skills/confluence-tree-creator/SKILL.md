---
name: confluence-tree-creator
description: Create or update Confluence documentation pages for the SDLC pipeline. Creates root and 8 phase pages once, then only updates existing pages.
version: 0.3.0
---

# Confluence Tree Creator Skill

Use this skill to manage SDLC documentation pages in Confluence with smart create-once, update-always logic.

## Critical Logic

### First Run (Tree Creation)
If parent page "Claude SDLC Capstone" does NOT exist:
1. Create root parent page "Claude SDLC Capstone" in Confluence space
2. Create 8 child phase pages:
   - Phase 1: Requirements
   - Phase 2: Architecture
   - Phase 3: Design Review
   - Phase 4: Implementation Plan
   - Phase 5: Implementation Summary
   - Phase 6: Code Review
   - Phase 7: Verification
   - Phase 8: Pull Request
3. Nest all phase pages under root parent
4. Report: Tree created with 8 phase pages

### Subsequent Runs (Update Only)
If parent page "Claude SDLC Capstone" EXISTS:
1. Do NOT create root page or any child pages
2. Query existing phase pages by title
3. Update each phase page with new content from generatedDocs/
4. Report: Pages updated (no new pages created)

## Workflow

1. **Query Root Page:**
   - Search Confluence for "Claude SDLC Capstone" page
   - If found: Go to "Update Existing Pages" workflow
   - If NOT found: Go to "Create Tree Structure" workflow

2. **Create Tree Structure (First Run Only):**
   - Create root page: "Claude SDLC Capstone"
   - Create 8 phase pages as children of root
   - Each phase page starts with basic structure
   - Record all page IDs for future updates

3. **Update Existing Pages (All Other Runs):**
   - For each phase (1-8):
     - Query existing page by title
     - Retrieve page ID and current content
     - Replace content with new artifact from generatedDocs/
     - Do NOT modify page title or hierarchy
   - Report updated page URLs

## Page Mapping

| Phase | Page Title | Content Source | Created | Updated |
|-------|-----------|-----------------|---------|---------|
| 1 | Phase 1: Requirements | generatedDocs/requirements.md | Once | Always |
| 2 | Phase 2: Architecture | generatedDocs/architecture.md | Once | Always |
| 3 | Phase 3: Design Review | generatedDocs/design-review.md | Once | Always |
| 4 | Phase 4: Implementation Plan | generatedDocs/impl-plan.md | Once | Always |
| 5 | Phase 5: Implementation Summary | src/ summary | Once | Always |
| 6 | Phase 6: Code Review | generatedDocs/code-review-report.md | Once | Always |
| 7 | Phase 7: Verification | generatedDocs/verify-results.txt | Once | Always |
| 8 | Phase 8: Pull Request | PR URL + details | Once | Always |

## Tools to Use

**For First Run (Create):**
- `searchConfluenceUsingCql()` — Check if root page exists
- `createConfluencePage()` — Create root page (once only)
- `createConfluencePage()` — Create 8 phase pages nested under root (once only)

**For All Runs (Update):**
- `searchConfluenceUsingCql()` — Query existing phase pages by title
- `getConfluencePage()` — Retrieve page content and ID
- `updateConfluencePage()` — Update page body with new content

## Output

### First Run
- Root page created (ID and URL)
- 8 phase pages created (titles and URLs)
- Tree structure confirmation

### Subsequent Runs
- 8 phase pages updated (IDs and URLs)
- Content replaced confirmation
- No new pages created (state: "update-only")

### Always
- Phase page URLs for reference
- No secrets or credentials exposed
