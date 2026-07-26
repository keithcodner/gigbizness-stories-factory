# Prompt Change Log

Tracks repository changes made in response to user prompts during this implementation cycle.

## 2026-07-25

### Prompt

`read and implement C:\xampp\htdocs\apps\gigbizness-stories-factory\README.md`

### Changes Made

- created standalone repository skeleton folders
- added `src/` shared runtime modules
- replaced broken external imports with local modules
- added canonical package scripts for `story:*`, `library:*`, `config:*`, and `system:*`
- created workspace stage wrappers and status tracking
- added initial library catalog files
- rewrote root `README.md` for standalone usage
- created `docs/IMPLEMENTATION_ROOT_PROMOTION.md`
- added smoke tests and validation commands

### Validation

- `npm test`
- `node scripts/system-check.js`
- `node scripts/library-catalog.js`
- `node scripts/story-preview.js --topic the_great_brick_heist`
- `node scripts/story-validate.js --topic the_great_brick_heist`

## 2026-07-26

### Prompt

`do the next phase`

### Changes Made

- inspected the active ComfyUI installation
- identified active ComfyUI root at `C:\AI\ComfyUI-GTX1080`
- reviewed current workflow patching and template state

### Prompt

`are there any comfyui nodes we can use to improve quality and animation ?`

### Changes Made

- researched current primary-source node options on GitHub
- selected a recommended animation stack for this project:
  - `comfyui-ipadapter`
  - `ComfyUI-Advanced-ControlNet`
  - `ComfyUI-VideoHelperSuite`
  - `ComfyUIAnimateDiffEvolved`
  - `ComfyUI-Frame-Interpolation`

### Prompt

`download and use the best animation node stack to accomplish this task; in C:\xampp\htdocs\apps\gigbizness-stories-factory\docs create a visual pipeline file of whats completed and whats not or whats pending as well as a change log file of what changes are made at every prompt; ensure the nodes we use work best with the current gtx gefore 1080 graphics card we're using`

### Changes Made

- cloned the selected node stack into `C:\AI\ComfyUI-GTX1080\custom_nodes`
- installed VideoHelperSuite dependencies into the ComfyUI venv
- ran Frame Interpolation installer in the ComfyUI venv
- validated custom-node import during ComfyUI startup
- confirmed the active GPU is `NVIDIA GeForce GTX 1080` with `8192 MiB` VRAM
- documented installed, pending, and incomplete visual pipeline work in `docs/technical_docs/VISUAL_PIPELINE_STATUS.md`
- created this changelog file

### Current Outcome

- node packs are installed and load
- real AnimateDiff motion models are still missing
- canonical repo workflow wiring to those nodes is still pending

### Prompt

`do the next phase`

### Changes Made

- downloaded `mm_sd_v15_v2.ckpt` into `C:\AI\ComfyUI-GTX1080\models\animatediff_models`
- downloaded `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors` into `C:\AI\ComfyUI-GTX1080\models\clip_vision`
- downloaded `ip-adapter-plus_sd15.safetensors` into `C:\AI\ComfyUI-GTX1080\models\ipadapter`
- queried the live ComfyUI server for exact custom node input metadata
- created a first real API workflow template at `templates/wan_i2v_api.json`
- replaced placeholder patch rules in `config/wan_i2v_patch_rules.json` with live node mappings
- updated the visual pipeline status document to reflect installed runtime models and workflow wiring

### Current Outcome

- a first real SD1.5 + IPAdapter + AnimateDiff + VHS workflow now exists in the repo
- the next step is end-to-end workflow execution and tuning

### Prompt

`make the visual statatus look more like this- ignore the content in the example...just follow the structure`

### Changes Made

- reformatted `docs/technical_docs/VISUAL_PIPELINE_STATUS.md` to follow the example's status-board structure
- kept the current project state content while reshaping the presentation layer

### Current Outcome

- the visual pipeline document now matches the requested board-style structure more closely

### Prompt

`make the visual statatus look more like this- ignore the content in the example...just follow the structure`

### Changes Made

- reformatted `docs/technical_docs/VISUAL_PIPELINE_STATUS.md` into a status-board tree layout
- preserved current project state while changing the presentation structure
- kept the existing environment and next-step notes below the board

### Prompt

`do the next phase`

### Changes Made

- removed the stale AnimateDiff fork backup from the live `custom_nodes` scan path
- restarted ComfyUI on a clean detached port with redirected logs for stable long renders
- verified the official AnimateDiff stack, IPAdapter stack, and VHS export path on the GTX 1080 runtime
- proved a full 16-frame render on Sunday, July 26, 2026:
  - prompt id `6a9cc9c8-5e80-468d-97c9-348102c405ac`
  - output `bricktoon_wan_i2v_preview_00001.mp4`
- proved a faster 8-frame GTX 1080 iteration profile on Sunday, July 26, 2026:
  - prompt id `a1129c90-79ae-4db6-a068-33edf241c7d7`
  - output `bricktoon_wan_i2v_preview_00002.mp4`
- added `config/motion_profiles/gtx1080_preview.json` for the proven fast-preview settings
- upgraded `scripts/story-motion.js` so the motion workspace stage now writes a workflow-ready render queue instead of a placeholder stub
- updated `docs/technical_docs/VISUAL_PIPELINE_STATUS.md` to reflect proven motion rendering and current remaining gaps

### Current Outcome

- the repo now has a proven ComfyUI motion path for the GTX 1080
- the next remaining motion phase is post-render polish and workspace ingestion, not basic pipeline bring-up

### Prompt

`continue to the next phase: so that ... production-ready motion pipeline ... [REAL]`

### Changes Made

- added a formal standard production profile at `config/motion_profiles/gtx1080_standard16.json`
- refined the fast GTX 1080 iteration profile in `config/motion_profiles/gtx1080_preview.json`
- added `scripts/motion-proof.js` to run proof renders directly from repo-managed motion profiles
- upgraded `scripts/story-motion.js` to discover a live ComfyUI server, execute the real workflow, and copy rendered clips into workspace stage `06_motion`
- verified the standard 16-frame proof path and the fast 8-frame proof path through the repo workflow tooling
- updated `docs/technical_docs/VISUAL_PIPELINE_STATUS.md` so the current-reality block now marks the production-ready motion pipeline as real

### Validation

- `node scripts/motion-proof.js --profile gtx1080_standard16`
- `node scripts/motion-proof.js --profile gtx1080_preview --timeoutMs 1200000`
- `node scripts/story-motion.js --topic the_great_brick_heist --profile gtx1080_preview --timeoutMs 1200000`

### Current Outcome

- the repo now owns a real, repeatable GTX 1080 motion render path for both fast previews and standard 16-frame proofs
- `story:motion` is no longer a placeholder stage; it produces real motion outputs and workspace reports

### Prompt

`do the next phase`

### Changes Made

- generalized `scripts/run_workflow.js` so repo workflows can now support either uploaded-image inputs or direct path-based media inputs
- added `templates/video_interpolate_api.json` for a VHS path load -> RIFE VFI -> VHS export finish pass
- added `config/video_interpolate_patch_rules.json` for patching source video path, fps, RIFE settings, and output naming
- added `config/motion_profiles/gtx1080_rife2x_finish.json` as the GTX 1080-safe post-render finish profile
- added `scripts/motion-finish.js` to run the interpolation workflow directly on a rendered motion clip
- upgraded `scripts/story-motion.js` so `--interpolate` now runs the finish pass and writes delivery clips plus finish metadata into workspace stage `06_motion`
- added `motion:finish` to the package command surface
- updated `docs/technical_docs/VISUAL_PIPELINE_STATUS.md` to promote frame interpolation from pending to working

### Validation

- `node -e "require('./scripts/motion-finish'); require('./scripts/story-motion'); require('./scripts/run_workflow'); console.log('syntax-ok')"`
- `node scripts/motion-finish.js --input C:\\xampp\\htdocs\\apps\\gigbizness-stories-factory\\workspaces\\the_great_brick_heist\\06_motion\\bricktoon_wan_i2v_preview_00005.mp4 --profile gtx1080_rife2x_finish --timeoutMs 1200000`
- `node scripts/story-motion.js --topic the_great_brick_heist --profile gtx1080_preview --interpolate --timeoutMs 1200000`

### Current Outcome

- the repo now has a proven post-render interpolation path using the installed ComfyUI frame interpolation node stack
- `story:motion --interpolate` produces both the base motion clip and a smoother delivery clip inside the workspace
