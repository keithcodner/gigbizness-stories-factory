# Pipeline State Visual

Last updated: July 26, 2026

## Status Board

```text
VISUAL PIPELINE STATUS
|
|-- STANDALONE REPOSITORY PROMOTION ........ [WORKING]
|   |-- canonical folder structure ......... [WORKING]
|   |-- local shared runtime in src ........ [WORKING]
|   |-- package command surface ............ [WORKING]
|   |-- workspace stage mirroring .......... [WORKING]
|   |-- root-path portability .............. [WORKING]
|   `-- smoke validation path .............. [WORKING]
|
|-- PREVIEW-FIRST STORY FLOW ............... [WORKING]
|   |-- story package generation ........... [WORKING]
|   |-- voice preview generation ........... [WORKING]
|   |-- visual package generation .......... [WORKING]
|   |-- preview animatic assembly .......... [WORKING]
|   |-- workspace status reporting ......... [WORKING]
|   `-- workspace validation checks ........ [WORKING]
|
|-- COMFYUI GTX 1080 FOUNDATION ............ [WORKING]
|   |-- active install path ................ [C:\AI\ComfyUI-GTX1080]
|   |-- gpu detection ...................... [WORKING]
|   |-- vram operating state ............... [8 GB / NORMAL_VRAM]
|   |-- torch runtime ...................... [2.7.1+cu118]
|   |-- comfyui runtime .................... [0.27.0]
|   `-- live server availability ........... [WORKING]
|
|-- CUSTOM NODE STACK ...................... [WORKING]
|   |-- comfyui-ipadapter .................. [INSTALLED]
|   |-- advanced-controlnet ................ [INSTALLED]
|   |-- videohelpersuite ................... [INSTALLED]
|   |-- animatediff-evolved ................ [INSTALLED]
|   `-- frame-interpolation ................ [INSTALLED]
|
|-- NODE DEPENDENCY LAYER .................. [WORKING]
|   |-- videohelpersuite python deps ....... [INSTALLED]
|   |-- frame interpolation deps ........... [INSTALLED]
|   |-- cupy backend for gtx1080 ........... [INSTALLED]
|   |-- custom node import verification .... [WORKING]
|   `-- startup compatibility check ........ [WORKING]
|
|-- RUNTIME MODEL STACK .................... [WORKING]
|   |-- animatediff motion model ........... [mm_sd_v15_v2.ckpt INSTALLED]
|   |-- clip vision encoder ................ [CLIP-ViT-H-14 INSTALLED]
|   |-- ipadapter sd15 plus ................ [INSTALLED]
|   |-- sd1.5 checkpoint route ............. [WORKING]
|   `-- local model path recognition ....... [WORKING]
|
|-- FIRST REAL MOTION WORKFLOW ............. [WORKING]
|   |-- workflow template file ............. [CREATED]
|   |-- patch-rule mapping ................. [CREATED]
|   |-- ipadapter conditioning route ....... [WORKING]
|   |-- animatediff motion route ........... [WORKING]
|   |-- vhs video export route ............. [WORKING]
|   |-- workflow structural validation ..... [WORKING]
|   |-- 16-frame standard proof ............ [PROVEN]
|   `-- 8-frame fast proof ................. [PROVEN]
|
|-- ADVANCED CONTROL GUIDANCE .............. [PENDING]
|   |-- controlnet model install ........... [PENDING]
|   |-- controlnet workflow branch ......... [PENDING]
|   `-- scheduled guidance tuning .......... [PENDING]
|
|-- FRAME INTERPOLATION FINISH ............. [WORKING]
|   |-- interpolation model selection ...... [RIFE 2X LOCKED]
|   |-- post-pass workflow branch .......... [WORKING]
|   `-- output smoothness tuning ........... [PROVEN]
|
|-- REPO INTEGRATION ....................... [WORKING]
|   |-- templates/wan_i2v_api.json ......... [WORKING]
|   |-- config/wan_i2v_patch_rules.json .... [WORKING]
|   |-- scripts/run_workflow.js ............ [WORKING]
|   |-- scripts/motion-proof.js ............ [WORKING]
|   |-- canonical story:motion hookup ...... [WORKING]
|   |-- workspace motion clip export ....... [WORKING]
|   |-- scripts/motion-finish.js ........... [WORKING]
|   `-- production workspace roundtrip ..... [WORKING]
|
|-- GTX 1080 OPERATING PROFILE ............. [WORKING]
|   |-- short preview clips ................ [RECOMMENDED]
|   |-- 8 to 12 fps generation ............. [RECOMMENDED]
|   |-- selective motion strategy .......... [RECOMMENDED]
|   |-- vfi after generation ............... [RECOMMENDED]
|   `-- conservative batch sizing .......... [RECOMMENDED]
|
|-- KNOWN ISSUES ........................... [OPEN]
|   |-- dual comfyui ports active .......... [OBSERVED]
|   |-- database lock on parallel startup .. [OBSERVED]
|   |-- newer cuda optimizations unavailable [ACCEPTED]
|   `-- long first-pass renders on gtx1080 . [ACCEPTED]
|
`-- CURRENT REALITY
    |-- standalone repo foundation ......... [REAL]
    |-- node stack install ................. [REAL]
    |-- runtime model install .............. [REAL]
    |-- first real workflow asset .......... [REAL]
    |-- 16-frame render proof .............. [REAL]
    |-- 8-frame fast proof profile ......... [REAL]
    `-- production-ready motion pipeline ... [REAL]
```

## Proof Notes

- Full proof completed on Sunday, July 26, 2026 via ComfyUI prompt `6a9cc9c8-5e80-468d-97c9-348102c405ac`, producing `bricktoon_wan_i2v_preview_00001.mp4`.
- Fast proof completed on Sunday, July 26, 2026 via ComfyUI prompt `a1129c90-79ae-4db6-a068-33edf241c7d7`, producing `bricktoon_wan_i2v_preview_00002.mp4`.
- Frame interpolation finish proof completed on Sunday, July 26, 2026, producing a 2x RIFE delivery clip at `16 fps` from the fast `8 fps` motion source.
- Production profile is tracked in `config/motion_profiles/gtx1080_standard16.json`.
- Recommended GTX 1080 iteration profile is tracked in `config/motion_profiles/gtx1080_preview.json`.
- Finish-pass profile is tracked in `config/motion_profiles/gtx1080_rife2x_finish.json`.
- Repo proof runner now lives in `scripts/motion-proof.js`.
- Repo finish-pass runner now lives in `scripts/motion-finish.js`.
- Canonical story motion execution now renders real clips through `story:motion` and can write an interpolated delivery clip into the workspace `06_motion` stage when `--interpolate` is used.
