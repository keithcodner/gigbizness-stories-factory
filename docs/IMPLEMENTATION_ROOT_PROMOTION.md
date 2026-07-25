# Root Promotion Implementation

Status: in progress  
Last updated: 2026-07-25

## Scope

This repository is now the standalone target for the Bricktoon preview-first pipeline. The implementation in this repo replaces the older parent-repository assumptions by:

- using repository-relative paths only
- exposing a canonical `story:*` command family
- maintaining reusable assets under `library/`
- isolating generated work under `workspaces/<story_id>/`
- keeping quickstart guidance in `README.md`

## Completed Work

- created canonical top-level folders for `docs`, `library`, `prompts`, `schemas`, `src`, `tests`, `tmp`, `topics`, and `workspaces`
- added placeholder tracked directories where the repo starts empty
- replaced broken external runtime imports with local `src/` modules
- standardized package scripts around the standalone story pipeline
- added workspace stage syncing and stage-status manifests
- added catalog generation and audit commands
- added environment and system validation commands
- added smoke coverage for root-path and story-package flow

## Current Compatibility Notes

- existing low-level story generation scripts still write their source artifacts into `output/story_packages/<story_id>/`
- standalone CLI wrappers mirror those artifacts into the canonical workspace stage folders
- when ComfyUI is not fully configured, image-generation calls fall back to placeholder renders so preview assembly remains runnable

## Remaining Gaps

- deeper schema coverage for every manifest type
- richer asset metadata enrichment and duplicate detection
- true motion rendering integrations beyond manifest preparation
- final review and finish stages currently package existing outputs rather than performing a separate render pass

## Validation Summary

Expected validation path:

1. `npm run system:check`
2. `npm run library:catalog`
3. `npm run story:preview -- --topic the_great_brick_heist`
4. `npm run story:status -- --topic the_great_brick_heist`
5. `npm test`
