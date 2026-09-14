---
name: jira-story-reader
description: This skill should be used when the user wants to read, parse, or summarize a Jira user story from local context or supplied issue details.
version: 0.1.0
---

# Jira Story Reader Skill

Use this skill to read the Jira issue key from `.env`, use any available issue details or local project context, and present a clean summary for the workflow.

## Workflow
1. Read `JIRA_ISSUE_KEY` or `JIRA_PROJECT_KEY` from `.env`.
2. Summarize the summary, description, acceptance criteria, and priority from the supplied context.
3. Return the raw payload when later steps need the exact issue data.
4. Keep secrets out of logs and output.

## Output
- Issue summary
- Acceptance criteria
- Priority
- Raw payload for downstream steps
