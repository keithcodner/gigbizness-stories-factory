# Visual Pipeline Status

Last updated: July 26, 2026

## Status Board

```text
VISUAL PIPELINE STATUS
|
|-- STANDALONE REPOSITORY .................. [WORKING]
|   |-- canonical folder structure ......... [WORKING]
|   |-- local shared runtime in src ........ [WORKING]
|   |-- package command surface ............ [WORKING]
|   |-- workspace stage mirroring .......... [WORKING]
|   `-- smoke validation path .............. [WORKING]
|
|-- PREVIEW-FIRST STORY FLOW ............... [WORKING]
|   |-- story package generation ........... [WORKING]
|   |-- voice preview generation ........... [WORKING]
|   |-- visual package generation .......... [WORKING]
|   |-- animatic preview assembly .......... [WORKING]
|   `-- workspace status / validation ...... [WORKING]
|
|-- COMFYUI GTX 1080 ENVIRONMENT ........... [WORKING]
|   |-- active install path ................ [C:\AI\ComfyUI-GTX1080]
|   |-- gpu detection ...................... [WORKING]
|   |-- vram profile ....................... [8 GB / NORMAL_VRAM]
|   |-- torch runtime ...................... [2.7.1+cu118]
|   `-- comfyui runtime .................... [0.27.0]
|
|-- CUSTOM NODE STACK ...................... [WORKING]
|   |-- comfyui-ipadapter .................. [INSTALLED]
|   |-- advanced-controlnet ................ [INSTALLED]
|   |-- videohelpersuite ................... [INSTALLED]
|   |-- animatediff-evolved ................ [INSTALLED]
|   `-- frame-interpolation ................ [INSTALLED]
|
|-- RUNTIME MODEL STACK .................... [WORKING]
|   |-- animatediff motion model ........... [mm_sd_v15_v2.ckpt INSTALLED]
|   |-- clip vision encoder ................ [CLIP-ViT-H-14 INSTALLED]
|   `-- ipadapter sd15 plus ................ [INSTALLED]
|
|-- NODE DEPENDENCY LAYER .................. [WORKING]
|   |-- videohelpersuite python deps ....... [INSTALLED]
|   |-- frame interpolation deps ........... [INSTALLED]
|   |-- cupy backend for gtx1080 ........... [INSTALLED]
|   `-- custom node import check ........... [WORKING]
|
|-- FIRST REAL MOTION WORKFLOW ............. [PARTIAL]
|   |-- workflow template file ............. [CREATED]
|   |-- patch-rule mapping ................. [CREATED]
|   |-- sd1.5 checkpoint route ............. [WORKING]
|   |-- ipadapter conditioning route ....... [WORKING]
|   |-- animatediff motion route ........... [WORKING]
|   |-- vhs video export route ............. [WORKING]
|   `-- end-to-end render proof ............ [IN PROGRESS]
|
|-- ADVANCED CONTROL GUIDANCE .............. [PENDING]
|   |-- controlnet model install ........... [PENDING]
|   |-- controlnet workflow branch ......... [PENDING]
|   `-- scheduled guidance tuning .......... [PENDING]
|
|-- FRAME INTERPOLATION FINISH ............. [PENDING]
|   |-- interpolation model selection ...... [PENDING]
|   |-- post-pass workflow branch .......... [PENDING]
|   `-- output quality tuning .............. [PENDING]
|
|-- REPO INTEGRATION ....................... [PARTIAL]
|   |-- templates/wan_i2v_api.json ......... [WORKING]
|   |-- config/wan_i2v_patch_rules.json .... [WORKING]
|   |-- scripts/run_workflow.js ............ [WORKING]
|   |-- canonical story:motion hookup ...... [PENDING]
|   |-- review/finish stage hookup ......... [PENDING]
|   `-- production workspace roundtrip ..... [PENDING]
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
|   `-- first workflow still under proof ... [OPEN]
|
`-- CURRENT REALITY
    |-- standalone repo foundation ......... [REAL]
    |-- node stack install ................. [REAL]
    |-- model stack install ................ [REAL]
    |-- first real workflow asset .......... [REAL]
    `-- production-ready motion pipeline ... [NOT YET]
```

## Environment

- Repository root: `C:\xampp\htdocs\apps\gigbizness-stories-factory`
- Active ComfyUI install: `C:\AI\ComfyUI-GTX1080`
- GPU: `NVIDIA GeForce GTX 1080`
- VRAM: `8192 MiB`
- Driver: `582.28`
- Torch runtime: `2.7.1+cu118`
- ComfyUI version: `0.27.0`

## Notes

- The first real workflow lives at `templates/wan_i2v_api.json`.
- The live patch mapping lives at `config/wan_i2v_patch_rules.json`.
- The next real milestone is a successful end-to-end motion render, followed by ControlNet and frame interpolation branches.
