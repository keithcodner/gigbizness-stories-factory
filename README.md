# GigBizness Stories Factory

Standalone Bricktoon story production pipeline with a preview-first workflow.

The repo is structured so a fresh clone can package a story, create voice previews, prepare character references, build visual requests, assemble an animatic preview, and manage per-story workspaces without depending on an old parent repository.

## Quickstart

1. Activate the repository's Node.js version with `nvm use`.
2. Copy `.env.example` to `.env` and fill in any machine-specific values.
3. Confirm machine dependencies are installed:
   `node`, `python`, `ffmpeg`, and optionally ComfyUI for live image generation.
4. Run:

```bash
npm run system:check
npm run library:catalog
npm run story:preview -- --topic the_great_brick_heist
```

## Bootstrap a fresh Windows machine

From the repository root, run:

```powershell
scripts\setup-environment.ps1
```

This script will:

- copy `.env.example` to `.env` if needed
- create `workspaces/` if missing
- detect `node`, `python`, and `ffmpeg`
- install `ffmpeg` automatically via `winget` when available

After bootstrapping, validate the repo with:

```powershell
npm run system:check
```

For a fully configured live visual workflow, set `COMFYUI_BASE_URL` in `.env` and ensure your ComfyUI server is running.

### Install the documented GTX 1080 ComfyUI integration

The repository's supported Windows layout is `C:\AI\ComfyUI-GTX1080`. The
installation lives on the C drive and executes CUDA workloads on the graphics
card; software cannot be installed directly onto GPU memory.

From an elevated PowerShell terminal in the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-comfyui-gtx1080.ps1
```

The installer follows the stack recorded in
`docs/technical_docs/VISUAL_PIPELINE_STATUS.md`: Python 3.11, PyTorch
`2.7.1+cu118`, IPAdapter, Advanced ControlNet, VideoHelperSuite, AnimateDiff
Evolved, Frame Interpolation, and the named support models. It is safe to
rerun and does not replace existing models.

The final SD 1.5 checkpoint is license-dependent and is not downloaded
automatically. Put the checkpoint named by `COMFYUI_CHECKPOINT` in
`C:\AI\ComfyUI-GTX1080\models\checkpoints`, then start and check the service:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-comfyui.ps1
npm run comfyui:check
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

## Reference-Driven Scene Sample

Reference images in `library/reference_images` are cataloged as source material, then cropped and cleaned into reusable character assets before any scene is rendered. Do not condition final scenes directly on the original headline/brand-heavy images.

The following creates a Maya dialogue proof from the Scene 1 script:

```powershell
nvm use
npm run library:catalog
node scripts/build_story_package.js --story the_great_brick_heist_scene_01 --output-id the_great_brick_heist_scene_sample
node scripts/run_story_preview.js --story the_great_brick_heist_scene_01 --output-id the_great_brick_heist_scene_sample
node scripts/build_story_character_refs.js --package output/story_packages/the_great_brick_heist_scene_sample/story_package.json --characters MAYA
node scripts/build_story_visual_package.js --package output/story_packages/the_great_brick_heist_scene_sample/story_package.json
node scripts/render_story_visuals.js --package output/story_packages/the_great_brick_heist_scene_sample/story_package.json --micro-scenes SCENE_01_MS_04 --force --stop-on-error
npm run motion:proof:fast -- --input output/story_packages/the_great_brick_heist_scene_sample/visual_package/generated_frames/SCENE_01_MS_04.png --label scene_01_ms_04_voice_sample
npm run scene-sample:finish -- --story the_great_brick_heist_scene_sample --micro-scene SCENE_01_MS_04
```

The reusable Maya library is written under `visual_package/character_refs/maya`. The final voiced proof is written under `scene_sample`. This proof uses real motion plus voice-over; it intentionally does not claim lip sync. A later mouth/viseme pass should use the clean talking-expression asset.

For smoother, identity-safe dialogue animation, render two approved key poses with matching framing and run:

```powershell
npm run scene:performance -- --story the_great_brick_heist_scene_sample --micro-scene SCENE_01_MS_04 --start output/story_packages/the_great_brick_heist_scene_sample/visual_package/generated_frames/SCENE_01_MS_04.png --end output/story_packages/the_great_brick_heist_scene_sample/visual_package/generated_frames/SCENE_01_MS_04_gesture.png
```

This reusable GTX 1080 profile interpolates the poses, applies a second smoothing pass, adds a controlled camera push, and assembles the matching polished voice segment.

Walking scenes use three matched poses—contact A, passing, and contact B:

```powershell
npm run scene:walk -- --story the_great_brick_heist_scene_sample --micro-scene SCENE_01_MS_04 --environment output/story_packages/the_great_brick_heist_scene_sample/visual_package/environments/scene_01_basement/camera_a/environment_plate.png --poses output/story_packages/the_great_brick_heist_scene_sample/visual_package/character_refs/maya/walking_gait_v3/canvas/contact_near.png,output/story_packages/the_great_brick_heist_scene_sample/visual_package/character_refs/maya/walking_gait_v3/canvas/down_near.png,output/story_packages/the_great_brick_heist_scene_sample/visual_package/character_refs/maya/walking_gait_v3/canvas/passing_far.png,output/story_packages/the_great_brick_heist_scene_sample/visual_package/character_refs/maya/walking_gait_v3/canvas/up_far.png,output/story_packages/the_great_brick_heist_scene_sample/visual_package/character_refs/maya/walking_gait_v3/canvas/contact_far.png,output/story_packages/the_great_brick_heist_scene_sample/visual_package/character_refs/maya/walking_gait_v3/canvas/down_far.png,output/story_packages/the_great_brick_heist_scene_sample/visual_package/character_refs/maya/walking_gait_v3/canvas/passing_near.png,output/story_packages/the_great_brick_heist_scene_sample/visual_package/character_refs/maya/walking_gait_v3/canvas/up_near.png
```

This uses a complete eight-phase gait rather than reversing one three-pose step. It composites the transparent poses onto the unchanged approved environment plate before interpolation, producing a 24 fps identity-locked walking cycle without regenerated props or chroma-key edges. It loops only to the dialogue duration, applies a gentle tracking move, and attaches the polished voice. Reuse the same plate for every shot in the same scene and camera setup. Generate a new plate only for a scene change, a deliberate camera setup change, or an explicit story event that changes the environment.

Reusable rendering discoveries are tracked in `config/rendering_learnings.json` and explained in `docs/technical_docs/RENDERING_PLAYBOOK.md`. Active entries are embedded in future visual requests. Record a newly observed rule as a candidate with `npm run rendering:learn`; promote it to `active` only after a rendered sample passes multi-frame review.

Animation iterations are preserved in separate numbered folders under the story package's `animation_experiments` directory. `scene:walk` automatically creates the next candidate folder with its pose inputs, render, review sheet, hypothesis, and manifest. Use `npm run animation:attempt` to record additional manual experiments.

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

Current visual pipeline and ComfyUI node-stack status lives in [docs/technical_docs/VISUAL_PIPELINE_STATUS.md](/C:/xampp/htdocs/apps/gigbizness-stories-factory/docs/technical_docs/VISUAL_PIPELINE_STATUS.md), and prompt-by-prompt repo changes are tracked in [docs/reports/PROMPT_CHANGELOG.md](/C:/xampp/htdocs/apps/gigbizness-stories-factory/docs/reports/PROMPT_CHANGELOG.md).

## Notes

- All important paths resolve relative to the repository root.
- Generated story files are mirrored into `workspaces/<story_id>/`.
- `library/catalogs/*.json` are the canonical asset catalogs.
- Preview approval is the intended gate before expensive motion or final render work.
