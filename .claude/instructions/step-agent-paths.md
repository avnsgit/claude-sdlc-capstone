# Step Agent File Path Standards

## Critical Rule: All SDLC Documents Go to generatedDocs/

All step agents MUST read from and write to the **`generatedDocs/` folder in project root**, NOT `.claude/` or scattered in project root.

### Document Paths (All in generatedDocs/)

| Step | Input Files | Output File | Location |
|------|-------------|------------|----------|
| 1    | (Jira story) | `requirements.md` | `/generatedDocs/requirements.md` |
| 2    | `requirements.md` | `architecture.md` | `/generatedDocs/architecture.md` |
| 3    | `architecture.md`, `requirements.md` | `design-review.md` | `/generatedDocs/design-review.md` |
| 4    | `requirements.md`, `architecture.md`, `design-review.md` | `impl-plan.md` | `/generatedDocs/impl-plan.md` |
| 5    | `impl-plan.md` | Modified `src/` files | `/src/*` |
| 6    | `src/` files, `impl-plan.md` | `code-review-report.md` | `/generatedDocs/code-review-report.md` |
| 7    | (project files) | `verify-results.txt` | `/generatedDocs/verify-results.txt` |
| 8    | All prior outputs | `pr-summary.md` | `/generatedDocs/pr-summary.md` |

### How to Write Files in Step Agents

When using the `Write` tool from a step agent, construct the absolute path to generatedDocs:

```javascript
// CORRECT: Write to generatedDocs
const filePath = path.join(process.cwd(), 'generatedDocs', 'design-review.md');
fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, content);

// WRONG: Do NOT use project root or .claude/
const filePath = path.join(process.cwd(), 'design-review.md');  // WRONG
const filePath = path.join(process.cwd(), '.claude', 'design-review.md');  // WRONG
```

### How to Read Files in Step Agents

When reading input documents:

```javascript
// CORRECT: Read from generatedDocs
const reqPath = path.join(process.cwd(), 'generatedDocs', 'requirements.md');
const content = fs.readFileSync(reqPath, 'utf8');

// WRONG: Do NOT read from elsewhere
const reqPath = path.join(process.cwd(), 'requirements.md');  // WRONG
const reqPath = path.join(process.cwd(), '.claude', 'requirements.md');  // WRONG
```

## Why This Structure

1. **Organized**: All generated content in one folder, easy to find and reference
2. **Git-friendly**: Can add `generatedDocs/` to `.gitignore` if needed for ephemeral docs
3. **CI/CD-ready**: Clear separation between source code and generated documentation
4. **Scalable**: If you need to add more output types, they all go in generatedDocs/
5. **Clean project root**: Project root stays tidy with only source and config files

## Verification

Before an agent completes, it should verify the output file was created in generatedDocs:

```bash
ls -la /path/to/project/generatedDocs/design-review.md  # Should exist
ls -la /path/to/project/design-review.md  # Should NOT exist
```

## Special Case: Code Changes (Step 5)

Step 5 still modifies `src/` files directly. Other generated artifacts (reports, specs) stay in `generatedDocs/`.
