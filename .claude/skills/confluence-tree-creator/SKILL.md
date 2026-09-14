---
name: confluence-tree-creator
description: This skill should be used when the user wants to create or update a Confluence documentation tree for the SDLC pipeline.
version: 0.1.0
---

# Confluence Tree Creator Skill

Use this skill to keep SDLC documentation nested under the project root page in the configured Confluence space.

## Workflow
1. Ensure the root page exists for the project documentation tree.
2. Nest the requested child page underneath the root page.
3. Create the page if it is missing, or update it if it already exists.
4. Keep page titles aligned with the SDLC stage names.
5. Avoid leaking secrets or environment values into page content.

## Output
- Root page state
- Child page state
- Update or creation status
