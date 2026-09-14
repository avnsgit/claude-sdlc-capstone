# VS Code & MCP Configuration Guide

## Directory Structure

```
.vscode/
├── mcp.json           # MCP server definitions for Claude Code
├── settings.json      # Claude Code settings with MCP configuration
└── extensions.json    # Recommended extensions for the project
```

## Files Overview

### `.vscode/mcp.json`
Defines MCP (Model Context Protocol) servers:
- **Playwright**: Browser automation and E2E testing
- **Atlassian**: Jira and Confluence integration
- **GitHub**: GitHub API access via MCP

All servers require environment variables to be set in your `.env` file:
- `PLAYWRIGHT_BASE_URL` — Atlassian instance URL
- `ATLASSIAN_HOST` — Confluence host
- `ATLASSIAN_EMAIL` — Your Atlassian email
- `ATLASSIAN_API_TOKEN` — API token for authentication

### `.vscode/settings.json`
Configures Claude Code IDE settings:
- Model: claude-opus-4-8 (latest and most capable)
- MCP servers configuration
- Environment variable references

### `.vscode/extensions.json`
Recommended VS Code extensions:
- `anthropic.claude-code` — Claude Code IDE
- `ms-playwright.playwright` — Playwright support
- `GitHub.copilot` — GitHub Copilot
- `GitHub.vscode-pull-request-github` — GitHub PR integration

## How It Works

1. **VS Code opens** → Loads `.vscode/settings.json`
2. **Claude Code initializes** → Loads MCP configuration from `.vscode/mcp.json`
3. **MCP servers start** → Each server uses env vars for authentication
4. **Tools available** → You can use Atlassian, Playwright, GitHub MCP tools

## Authentication

All MCP servers use environment variables for authentication:

```bash
# Set in .env file
ATLASSIAN_HOST=https://your-instance.atlassian.net
ATLASSIAN_EMAIL=your-email@example.com
ATLASSIAN_API_TOKEN=your-api-token
PLAYWRIGHT_BASE_URL=https://your-instance.atlassian.net
```

## GitHub MCP Note

GitHub MCP requires OAuth authentication. In VS Code:
1. Open Claude Code
2. Go to MCP settings (if prompted)
3. Authenticate with GitHub
4. GitHub MCP tools become available

## Troubleshooting

- **MCP servers not connecting**: Check environment variables are set
- **GitHub authentication fails**: Use `/mcp` command in Claude Code to re-authenticate
- **Extensions not recommended**: Click "Show Recommended" in Extensions panel

## Project Integration

This configuration integrates with the SDLC pipeline:
- Atlassian MCP: Jira story reading, Confluence syncing
- Playwright MCP: E2E test verification
- GitHub MCP: PR creation and management

See CLAUDE.md for the full SDLC workflow.
