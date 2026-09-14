# Project Structure - claude-sdlc-capstone

```
claude-sdlc-capstone/
│
├── .vscode/                          # VS Code & Claude Code Configuration
│   ├── mcp.json                      # MCP server definitions (Playwright, Atlassian, GitHub)
│   ├── settings.json                 # Claude Code IDE settings & MCP configuration
│   ├── extensions.json               # Recommended VS Code extensions
│   └── README.md                     # VS Code configuration guide
│
├── .claude/                          # Claude Code Framework Configuration
│   ├── agents/                       # Custom agent definitions
│   │   └── master-sdlc.md           # Master SDLC orchestrator agent
│   │
│   ├── instructions/                 # Project-specific guidance
│   │   ├── zero-trust-security.md
│   │   ├── confluence-tree-standards.md
│   │   ├── code-style-typescript.md
│   │   ├── playwright-testing.md
│   │   └── step-agent-paths.md
│   │
│   ├── hooks/                        # Automated hooks for git events
│   │
│   ├── skills/                       # Custom skills
│   │
│   ├── settings.json                 # Claude Code global settings
│   └── settings.local.json           # Local environment overrides
│
├── generatedDocs/                    # SDLC Pipeline Output Documents
│   ├── requirements.md               # Step 1: Requirements analysis
│   ├── architecture.md               # Step 2: Architecture design
│   ├── design-review.md              # Step 3: Design review & validation
│   ├── impl-plan.md                  # Step 4: Implementation plan
│   ├── code-review-report.md         # Step 6: Code review findings
│   ├── verify-results.txt            # Step 7: Test verification results
│   ├── pr-summary.md                 # Step 8: PR summary (comprehensive)
│   ├── pr-template.md                # Alternative PR template (concise)
│   └── PR_READY.txt                  # Status marker for PR creation
│
├── src/                              # Source Code (Implementation)
│   ├── errors.js                     # Error handling & classification
│   ├── atlassian-client.js           # Atlassian API client with retry logic
│   ├── confluence-sync.js            # Confluence documentation sync
│   ├── pipeline.js                   # Main pipeline orchestration
│   └── index.js                      # Entry point
│
├── tests/                            # Test Suite
│   ├── errors.test.js                # Error handling tests (9 tests)
│   ├── atlassian-client.test.js      # HTTP client tests (12 tests)
│   ├── confluence-sync.test.js       # Sync logic tests (10 tests)
│   └── pipeline.test.js              # Pipeline integration tests (7 tests)
│
├── CLAUDE.md                         # Project Root Instructions
├── package.json                      # Node.js project configuration
├── .env.example                      # Environment variables template
└── README.md                         # Project documentation
```

## Key Directories Explained

### `.vscode/`
**Purpose:** VS Code and Claude Code IDE configuration
- **mcp.json**: Defines MCP server connections (Playwright, Atlassian, GitHub)
- **settings.json**: Claude Code settings with model selection and MCP config
- **extensions.json**: Recommends required VS Code extensions
- **README.md**: Configuration guide

### `.claude/`
**Purpose:** Claude Code framework configuration and automation
- **agents/**: Custom agent definitions for SDLC pipeline steps
- **instructions/**: Project-specific best practices and standards
- **hooks/**: Automated scripts triggered by git events
- **skills/**: Reusable skill definitions
- **settings.json**: Global Claude Code settings

### `generatedDocs/`
**Purpose:** Output artifacts from SDLC pipeline execution
- All 8 steps produce documents here
- PR templates and summaries
- Ready for Confluence sync

### `src/` & `tests/`
**Purpose:** Application code and test suite
- Feature implementation for retry-with-backoff resilience
- Comprehensive test coverage (37+ tests)

## SDLC Pipeline Flow

```
Step 1: Requirements        → generatedDocs/requirements.md
         ↓ (user checkpoint)
Step 2: Architecture        → generatedDocs/architecture.md
         ↓
Step 3: Design Review       → generatedDocs/design-review.md
         ↓
Step 4: Implementation Plan → generatedDocs/impl-plan.md
         ↓
Step 5: Implementation      → src/ (code changes)
         ↓
Step 6: Code Review         → generatedDocs/code-review-report.md
         ↓
Step 7: Verification        → generatedDocs/verify-results.txt
         ↓
Step 8: PR & Confluence     → generatedDocs/pr-summary.md
                            + Confluence tree sync
```

## How to Run

1. **Initialize VS Code**: Extensions recommend Claude Code
2. **Set Environment**: Copy `.env.example` to `.env` with credentials
3. **Run SDLC Pipeline**: Use master-sdlc agent to execute workflow
4. **Create PR**: Use GitHub MCP tools in VS Code
5. **Sync Confluence**: Use confluence-tree-creator skill

## File Organization Principles

- ✅ **Configuration files** in `.vscode/` and `.claude/`
- ✅ **Generated documents** in `generatedDocs/`
- ✅ **Source code** in `src/`
- ✅ **Tests** in `tests/`
- ✅ **No MCP files in project root** (moved to `.vscode/mcp.json`)
- ✅ **No credentials in config** (use `.env` or env vars)
- ✅ **Secrets protected** (zero-trust-security.md)

## Next Steps

After PR creation:
1. Review PR in GitHub
2. Merge to main
3. Run `confluence-tree-creator` skill for documentation sync
4. Verify Confluence documentation tree is updated

---

**Project:** claude-sdlc-capstone  
**Structure Updated:** 2026-09-14  
**Status:** Ready for Production
