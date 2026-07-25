# Workflow Template Instructions

This folder holds exported ComfyUI API workflow JSON files.

For the first investigation pass, create:

- `wan_i2v_api.json`

## How To Export The Workflow

1. Open ComfyUI in the browser.
2. Build or load your image-to-video workflow.
3. Make sure it runs in the GUI first.
4. Use the ComfyUI export option that saves the workflow in API JSON form.
5. Save the exported file here as:
   - `side_projects/comfyui_video_lab/templates/wan_i2v_api.json`

## Important

- The runner expects API workflow JSON, not the normal UI workflow export if those formats differ in your setup.
- After export, run:

```powershell
npm run comfy:video:inspect -- --workflow side_projects/comfyui_video_lab/templates/wan_i2v_api.json
```

- Then copy the correct node ids into:
  - `side_projects/comfyui_video_lab/config/wan_i2v_patch_rules.json`

## What The Patch Rules Need

The patch rules tell the repo runner:

- which node input receives the uploaded still image
- which node inputs should be overridden for prompt, negative prompt, width, height, frames, fps, and seed
- what defaults to use when CLI args are not provided

The repo-side runner is generic on purpose so we can swap workflows later without rewriting the whole tool.
