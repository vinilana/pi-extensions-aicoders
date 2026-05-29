---
type: doc
name: deployment
description: Build, release, deployment and rollback process
generated: 2026-05-29
status: generated
---

# Deployment

## Build and Release Commands

No package scripts detected yet.

## Distribution Model

- Distributed as a pi package declared through package.json pi.extensions and pi.themes.
- Package keywords: `pi-package`, `pi-extension`, `aicoders`, `aicoders-academy`.
- README includes installation guidance for local and git-based pi package loading.

## Release Notes

- No release/publish scripts detected in package.json.
- Before publishing, smoke-test extension discovery, command registration and resource discovery from a clean clone.
- When theme files change, reload pi and select the theme from /settings for visual smoke testing.
