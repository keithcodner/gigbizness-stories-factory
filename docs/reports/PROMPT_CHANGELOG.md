# Prompt Change Log

Tracks repository changes made in response to user prompts during this implementation cycle.

## 2026-07-30

### Prompt

`ok better but hes floating in mid air and not walking across the ground`

### Findings

- measured each transparent pose and found lowest-foot positions varied by roughly 34 source pixels
- confirmed camera cropping moved the completed frame while Maya remained centered
- identified those two issues as the cause of hovering and walking-in-place

### Changes Made

- added automatic alpha-bound measurement for every gait pose
- normalized character height and anchored every pose's lowest foot to one shared floor coordinate
- changed traversal to move the transparent character layer continuously from left to right
- kept the approved environment plate static instead of using camera movement to imitate travel
- built enough continuous traversal for the full voice duration, eliminating per-cycle horizontal resets
- generated and reviewed Attempt 007
- marked Attempt 005 rejected for floating-in-place and retained its evidence

### Current Outcome

- `scene_01_ms_04_walking_gait_v6_grounded_travel.mp4` shows Maya crossing the set on the floor
- environment props remain fixed
- character scale and ground contact remain stable across the sampled shot

### Prompt

`its still getting better which is good and the walking animation is good too; but its still malformed scene_01_ms_04_walking_gait_v3_candidate.mp4 read this and look for yourself and improve`

### Findings

- inspected all 24 delivery frames from the first gait cycle
- confirmed the eight-phase walking structure is improved
- found RIFE-created extra elbows, smeared hands, merged legs, and fluctuating limb thickness between otherwise clean key poses

### Changes Made

- changed generated sprite-sheet walking to deterministic 24 fps key-pose timing
- retained the locked environment, complete gait order, voice, and camera tracking
- generated Attempt 005 and verified clean anatomy in all 24 reviewed frames
- tested bidirectional optical flow as Attempt 006
- rejected optical flow after it produced double faces, transparent limbs, motion trails, and incomplete cycle coverage
- marked malformed Attempt 004 rejected and preserved its evidence
- kept clean-anatomy Attempt 005 as the current preferred candidate

### Current Outcome

- `scene_01_ms_04_walking_gait_v4_clean_anatomy.mp4` removes the malformed interpolated limbs
- the remaining limitation is stepped cadence
- future smoothing should use rig-controlled in-betweens rather than whole-image generative or optical-flow morphing

### Prompt

`organize them in their own folder for each iteration we improve`

### Changes Made

- confirmed Attempts 001–004 are isolated in separate numbered folders
- changed animation attempt numbering to support automatic next-number allocation
- connected `scene:walk` directly to the experiment archive
- made each future walking render automatically generate a cycle review sheet
- made each future iteration copy its exact pose inputs, rendered video, and review sheet into its own folder
- made each automatic iteration write a candidate manifest containing its hypothesis and related rendering-learning IDs
- added filename collision protection when multiple artifacts share a basename

### Current Outcome

- future walking iterations cannot overwrite or mix with earlier attempts
- each improvement is self-contained and chronologically indexed
- manual experiments can still be recorded with `npm run animation:attempt -- --attempt auto`

### Prompt

`if you view this video: scene_01_ms_04_walking_smooth_voice.mp4 the animation is better and consistent; but the walking motion is not correct`

### Findings

- confirmed the clip preserves character identity and scene styling well
- identified that both contact poses use essentially the same leading foot
- identified that reversing the same half-step produces rocking rather than an alternating walk
- confirmed the source lacks separate contact, down, passing, and up phases for both support legs

### Changes Made

- retained the consistent character and environment approach
- added full eight-phase gait handling to `scripts/scene-walk-cycle.js`
- changed complete gait closure to interpolate from the final phase back to the first instead of reversing the motion
- added a GTX 1080 full-cycle cadence of 8 source poses per second with 3x interpolation to 24 fps
- generated and reviewed corrected eight-phase Maya gait assets
- retired the rejected three-pose learning and recorded the eight-phase method as a candidate pending final artifact cleanup

### Current Outcome

- Attempt 004 has improved stride progression and vertical weight changes
- one limb-interpolation artifact and weak opposite arm swing remain, so the method has not yet been promoted to active

### Prompt

`also organize each attempt as we get better in discovering the animation process`

### Changes Made

- added `npm run animation:attempt`
- added numbered scene-specific animation experiment folders
- added manifests containing hypothesis, outcome, status, related learning IDs, and copied evidence
- backfilled Attempts 001–004 without overwriting their original files
- marked Attempts 001–003 rejected and Attempt 004 candidate
- documented the attempt workflow in the rendering playbook and root README

### Current Outcome

- every significant animation iteration can now be compared chronologically
- rejected attempts retain their evidence and reasons
- candidate learnings remain separate from active production rules until review passes

### Prompt

`ensure as we learn these patterns they are recorded for future rendering`

### Changes Made

- created `config/rendering_learnings.json` as the machine-readable rendering-learning registry
- created `docs/technical_docs/RENDERING_PLAYBOOK.md` as the human-readable production playbook
- recorded the proven environment-lock, transparent-character, three-pose walk, natural-voice, and multi-frame review patterns
- added candidate, active, and retired lifecycle rules so experimental observations are not treated as production guidance prematurely
- added `npm run rendering:learn` for recording future candidate learnings with evidence and validation criteria
- connected active, scope-matched learning IDs and directives to generated visual requests
- expanded configuration validation to reject incomplete or duplicate rendering-learning records

### Validation

- rebuilt the scene sample visual package and confirmed its request contains the correct environment and character-layer learning IDs
- confirmed its prompt contains the active environment-lock directive
- passed configuration validation and all smoke tests

### Current Outcome

- future visual packages inherit proven rendering rules automatically
- specialized rules such as walking apply only to matching motion blueprints
- rendering discoveries now remain versioned, reviewable, and reusable across scenes

### Prompt

`also the background changes when we generate an image, we need to keep the environment props the same; unless the scene changes or something else happen like a camera frame change`

### Changes Made

- created one approved basement environment plate for the scene and camera setup
- separated Maya into transparent walking-pose layers
- changed the walk workflow to composite poses onto the fixed plate before interpolation
- removed chroma keying from the reusable walking path to prevent colored edge artifacts
- added a scene-and-camera environment continuity contract to future visual requests
- documented that environment regeneration is allowed only for a scene change, deliberate camera setup change, or explicit set-changing story event

### Current Outcome

- the walking sample retains the same fence, planter, stair structure, bins, boxes, wall blocks, and lighting across the shot
- framing may change through an intentional camera move without regenerating the environment
- the locked-plate workflow is reusable for future character animation

### Prompt

`do the next phase`

### Changes Made

- confirmed the repository uses NVM for Windows `1.2.2`, with Node `24.18.1` selected by `.nvmrc`
- verified the NVM symlink precedes the redundant standalone Node path in the machine PATH
- downloaded the official Realistic Vision V5.1 Hyper (VAE) pruned fp16 checkpoint into the ComfyUI checkpoint folder
- verified the 2,132,625,894-byte checkpoint with SHA-256 `F47E942AD4C30D863AD7F53CB60145FFCD2118845DFA705CE8BD6B42E90C4A13`
- confirmed ComfyUI recognizes `realisticVisionV60B1_v51HyperVAE.safetensors`
- replaced the stale `-small` checkpoint filename in the workflow and patch defaults
- configured `COMFYUI_CHECKPOINT` in `.env`
- ran a live 8-frame motion proof through SD 1.5, IPAdapter, AnimateDiff, and VHS
- added WinGet-aware FFprobe discovery to `scripts/motion-finish.js`
- removed the unconditional VHS audio connection from the RIFE workflow so silent proof clips are supported
- changed the ComfyUI poller to fail immediately when a prompt reports an error or completes without outputs
- ran a live RIFE 2× finish pass on the new motion proof

### Current Outcome

- the full SD 1.5 + IPAdapter + AnimateDiff runtime model stack is installed and recognized
- the GTX 1080 fast proof produced an H.264 512x288 clip at 8 fps with 8 frames
- the RIFE finish pass produced an H.264 512x288 delivery clip at 16 fps with 15 frames

### Prompt

`add the comfort integration on the root of the c drive or the gtx geforce 1080 graphics card. use the existing info in the Readme files`

### Changes Made

- reconstructed ComfyUI at `C:\AI\ComfyUI-GTX1080` from the paths and versions recorded in the repository docs
- installed Python 3.11 and an isolated PyTorch `2.7.1+cu118` environment
- installed IPAdapter, Advanced ControlNet, VideoHelperSuite, AnimateDiff Evolved, and Frame Interpolation
- installed the documented AnimateDiff, CLIP Vision, and IPAdapter support models
- upgraded the NVIDIA GTX 1080 driver from `457.85` to `527.56` after the old driver failed CUDA memory initialization
- added an idempotent GTX 1080 installer and launcher under `scripts/`
- connected `.env` to `http://127.0.0.1:8188` and made the workflow checkpoint configurable through `COMFYUI_CHECKPOINT`
- added `npm run comfyui:check` and documented install/start/check commands in the root README
- corrected the launcher for ComfyUI versions where normal VRAM mode is the default and `--normalvram` is no longer accepted

### Validation

- PyTorch reported `2.7.1+cu118`, `cuda=True`, and `NVIDIA GeForce GTX 1080`
- `torch.cuda.mem_get_info()` succeeded after the driver update
- ComfyUI `0.29.0` served `/system_stats` at `http://127.0.0.1:8188`
- `/object_info` confirmed `IPAdapterUnifiedLoader`, `IPAdapterAdvanced`, `ADE_LoadAnimateDiffModel`, `ADE_ApplyAnimateDiffModelSimple`, `VHS_VideoCombine`, and `RIFE VFI`

### Current Outcome

- the C-drive ComfyUI service is live and GPU-backed
- the final licensed SD 1.5 checkpoint remains operator-supplied and must match `COMFYUI_CHECKPOINT`

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
