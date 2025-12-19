---
description: Guide for agents to perform code improvements safely and efficiently.
---

# Agent Improvement Guide

Follow these steps to ensure code improvements are agent-optimized, cheap, quick, and non-breaking.

## 1. Research & Analysis
- **Identify Monoliths**: Look for files > 500 lines or components with multiple responsibilities.
- **Trace Dependencies**: Use `view_file_outline` to understand the structure before editing.
- **Check for existing tests**: Run `deno test` or `npm test` to see what is already covered.

## 2. Planning (PLANNING mode)
- Create an `implementation_plan.md` detail what you will change.
- **Atomic Changes**: Break large refactors into smaller steps.
- **No Deletions**: Avoid removing functionality unless explicitly asked. Deprecate instead if necessary.

## 3. Execution (EXECUTION mode)
- **Small Commits**: Make one change at a time (e.g., extract one component).
- **Verify Syntax**: Use `run_command` to check for syntax errors if possible (e.g., `deno check`).
- **Maintain Types**: Ensure TypeScript types are correctly preserved or improved.

## 4. Verification (VERIFICATION mode)
- **Unit Tests**: Write unit tests for new/refactored logic.
- **Manual Check**: If a UI change, use the browser tool to verify rendering.
- **Check Logs**: Ensure no new warnings or errors in the console.

## 5. Polish
- **Documentation**: Update README or create/update workflow files.
- **Final Walkthrough**: Create `walkthrough.md` with proof of work.

// turbo-all
## Commands
To verify the build:
1. `deno task build`
To run tests:
2. `deno test -A`
