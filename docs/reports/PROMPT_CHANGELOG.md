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

- reformatted `docs/technical_docs/VISUAL_PIPELINE_STATUS.md` into a status-board tree layout
- preserved current project state while changing the presentation structure
- kept the existing environment and next-step notes below the board
