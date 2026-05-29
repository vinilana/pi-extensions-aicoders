---
type: doc
name: testing-strategy
description: Test commands, coverage expectations and validation approach
generated: 2026-05-29
status: generated
---

# Testing Strategy

## Test and Check Commands

No package scripts detected yet.

## Detected Test Files

- No test files detected in the current scan.

## Recommended Validation

- No automated validation scripts detected; add lint/typecheck/test scripts when the project grows.
- Smoke-test extension loading with `pi -e .` in a disposable session.
- Exercise `/dotcontext init` and `/dotcontext feed <task>` against a temporary repository before release.
- Test allow/block decisions for sensitive paths and destructive commands.
- Validate PREVC stage transitions with prevc_workflow actions and command flows.

## Evidence Standard

For every change, capture commands run, exit status, relevant logs and any manual verification steps.
