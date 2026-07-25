# GigBizness Stories Factory

Standalone Bricktoon story production pipeline with a preview-first workflow.

The repo is structured so a fresh clone can package a story, create voice previews, prepare character references, build visual requests, assemble an animatic preview, and manage per-story workspaces without depending on an old parent repository.

## Quickstart

1. Copy `.env.example` to `.env` and fill in any machine-specific values.
2. Confirm machine dependencies are installed:
   `node`, `python`, `ffmpeg`, and optionally ComfyUI for live image generation.
3. Run:

```bash
npm run system:check
npm run library:catalog
npm run story:preview -- --topic the_great_brick_heist
```

That command sequence will:

- validate environment and folder readiness
- rebuild the asset catalogs
- create a story workspace
- generate a voice preview
- prepare visual requests
- render preview stills
- assemble an animatic review package

By default, if a live ComfyUI workflow is not configured, preview frame generation falls back to placeholder renders so the pipeline remains testable on a clean clone.

## Daily Commands

```bash
npm run story:package -- --topic the_great_brick_heist
npm run story:voices -- --topic the_great_brick_heist
npm run story:characters -- --topic the_great_brick_heist
npm run story:visuals -- --topic the_great_brick_heist
npm run story:preview -- --topic the_great_brick_heist
npm run story:motion -- --topic the_great_brick_heist
npm run story:assemble -- --topic the_great_brick_heist
npm run story:review -- --topic the_great_brick_heist
npm run story:finish -- --topic the_great_brick_heist
```

Use `npm run story:status -- --topic the_great_brick_heist` to inspect stage state, and `npm run story:resume -- --topic the_great_brick_heist` to continue from the first incomplete stage.

## Repository Layout

Key directories:

- `config/` runtime and provider configuration
- `docs/` setup, technical docs, and reports
- `library/` reusable approved assets and catalogs
- `output/` cross-story outputs and scratch story package generation
- `prompts/` reusable prompt fragments
- `schemas/` contracts and data shapes
- `scripts/` user-facing CLI entrypoints
- `src/` shared runtime implementation
- `templates/` starter files and workflow templates
- `topics/` static topic inputs
- `workspaces/` isolated per-story production folders

## Source Of Truth

Implementation tracking lives in [docs/IMPLEMENTATION_ROOT_PROMOTION.md](/C:/xampp/htdocs/apps/gigbizness-stories-factory/docs/IMPLEMENTATION_ROOT_PROMOTION.md).

## Notes

- All important paths resolve relative to the repository root.
- Generated story files are mirrored into `workspaces/<story_id>/`.
- `library/catalogs/*.json` are the canonical asset catalogs.
- Preview approval is the intended gate before expensive motion or final render work.
