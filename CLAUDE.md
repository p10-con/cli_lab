# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A shared playground where multiple contributors freely build CLI tools and submit PRs. Each contributor owns a namespaced subdirectory under `commands/` and can use any language/framework they like.

## Directory Structure

```
cli_lab/
├── commands/
│   └── {username}/          # Each contributor's namespace
│       └── {tool-name}/     # Individual CLI tool
│           ├── README.md    # Required: what it does, usage, example output
│           └── ...          # Source files, any language
├── shared/                  # Optional cross-contributor utilities
├── CONTRIBUTING.md
└── README.md
```

## Adding a New CLI Tool

1. Create `commands/{your-username}/{tool-name}/`
2. Add a `README.md` with: description, usage, example output
3. Add your source files
4. Open a PR — at least 1 approval required before merging

## Conventions

- **Namespace by username**: Prevents naming conflicts. Directory name = your GitHub username.
- **Self-contained tools**: Each tool directory should work independently.
- **No shared dependency pollution**: If your tool needs packages, manage them inside your own directory (own `package.json`, `requirements.txt`, etc.).
- **Shared utilities**: If something is genuinely reusable across tools, propose adding it to `shared/` in the PR description.

## Safety Rules

These are enforced at review time:

- No file deletion outside the tool's own directory
- No silent network requests (document any external API calls in the tool's README)
- No hardcoded secrets — use `.env` files, add `.env` to `.gitignore`
- Destructive operations (system commands, shell exec, etc.) require explicit opt-in from the user running the tool

## PR Requirements

- CI must pass (if configured)
- Tool's `README.md` must exist and describe usage
- 1 reviewer approval minimum
- Don't modify other contributors' directories without their consent
