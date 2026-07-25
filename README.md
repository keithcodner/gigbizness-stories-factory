Plan
Side Project Root Promotion Plan, Rev 2
Summary
Promote side_projects/comfyui_video_lab into the blueprint for a new standalone root repo, not just a subfolder. The new repo must be self-contained: docs, libraries, workspaces, agents, configs, templates, scripts, runtime code, and outputs all live under the new root so it does not depend on the current parent repo.

The implementation source-of-truth document for this migration should live at:

docs/IMPLEMENTATION_ROOT_PROMOTION.md

inside the new repo root.

The new repo should be designed so a fresh clone can be set up without needing to copy mystery files later.

Target Repo Shape
The new repo root should contain this canonical structure:

new-bricktoon-repo/
├─ agents/
│  ├─ orchestrator/
│  └─ research_agents/
├─ config/
├─ docs/
│  ├─ technical_docs/
│  ├─ setup/
│  └─ reports/
├─ library/
│  ├─ reference_images/
│  ├─ characters/
│  ├─ props/
│  ├─ environments/
│  ├─ general/
│  └─ catalogs/
├─ output/
├─ prompts/
├─ schemas/
├─ scripts/
├─ src/
├─ templates/
├─ tests/
├─ tmp/
├─ topics/
├─ workspaces/
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
Required meaning of each top-level folder:

agents/
Orchestration entrypoints, guided runners, and research/approval helpers that still matter in the simplified production flow.
config/
Provider selection, ComfyUI routing, workflow-template registry, runtime profiles, quality tiers, voice settings, and preview/render defaults.
docs/
All durable documentation for setup, architecture, pipeline usage, implementation phases, reports, and change tracking.
library/
Permanent reusable art/reference inventory that survives across stories.
output/
Standalone side-project outputs that are not tied to one story workspace.
prompts/
Reusable prompt fragments, style locks, cast prompt scaffolds, and scene-generation prompt assets.
schemas/
JSON schemas or shape contracts for story packages, manifests, catalogs, workflow requests, render contracts, and review packets.
scripts/
CLI entrypoints for packaging, generation, preview, motion prep, render, imports, audits, and startup helpers.
src/
Shared runtime code used by scripts and agents.
templates/
Starter story templates, starter manifests, workflow templates, and starter workspace skeletons.
tests/
Integration, fixture, and regression coverage for the standalone pipeline.
tmp/
Scratch/intermediate local artifacts safe to ignore.
topics/
Static source topics and sample story inputs.
workspaces/
Per-story generated work folders and approvals.
Library and Asset Migration
The new repo must not depend on today’s scattered library roots. Consolidate them into one canonical library/ tree.

Migration rules:

Current library/reference_images/*
becomes library/reference_images/*
Current library/general_assets/*
becomes library/general/*
Current character_library/bricktoon/*
becomes library/characters/bricktoon/*
Current prop_library/bricktoon/props/*
becomes library/props/bricktoon/*
Current environment_library/bricktoon/environments/*
becomes library/environments/bricktoon/*
Initial catalog expectations:

library/catalogs/reference_catalog.json
library/catalogs/character_catalog.json
library/catalogs/prop_catalog.json
library/catalogs/environment_catalog.json
library/catalogs/general_asset_catalog.json
Catalog entries should track at minimum:

stable asset id
category
source path
tags
style family
continuity suitability
character/environment/prop role
approval status
optional notes
The new repo should ship with the folder structure present even if some folders are empty. Empty starter folders are acceptable for:

workspaces/
output/
tmp/
docs/reports/
What to Carry Over From the Current Root
The new repo should include the useful parts of the current project root so we do not have to rebuild the foundation.

Carry over and adapt:

side_projects/comfyui_video_lab/scripts
This becomes the basis of the new script surface.
side_projects/comfyui_video_lab/config
Keep as the seed for ComfyUI-first config.
side_projects/comfyui_video_lab/templates
Keep and expand into production templates.
src/
Carry over the shared runtime pieces already used by the lab, especially env loading, workflow contracts, provider routing, manifest helpers, and path utilities.
agents/
Keep only the parts needed for story orchestration, approvals, recovery, research support, and render flow.
config/
Carry over reusable project-wide config that still matters after the migration.
schemas/
Carry over existing useful contract files instead of redefining data shapes from scratch.
prompts/
Keep reusable prompt and style assets that still support the new visual pipeline.
tests/
Carry over only tests that validate the new standalone flow or useful shared modules.
docs/technical_docs
Carry over the milestone and premium-quality implementation docs that still govern the new system.
templates/
Merge useful root templates with the side-project templates.
library/, character_library/, prop_library/, environment_library/
Merge into the new unified library/.
Do not promote as first-class in the new repo unless still needed:

old business-doc/research-heavy stages that no longer belong in the premium bricktoon production path
obsolete placeholder-only rendering utilities
duplicate command surfaces that conflict with the new canonical story pipeline
root-level structure that only existed for the older non-visual workflow
Canonical Standalone Pipeline
The new repo should expose one primary story flow:

story-package
voice-preview
character-refs
visual-package
still-render
preview
motion-prep
motion-render
scene-assembly
review
finish
Expected runtime shape per story:

workspaces/<story_id>/
├─ 01_story_package/
├─ 02_voice/
├─ 03_characters/
├─ 04_visuals/
├─ 05_preview/
├─ 06_motion/
├─ 07_scene_outputs/
├─ 08_review/
└─ 09_final/
The pipeline should always support:

reference-driven character generation
reference-driven scene keyframes
preview-before-full-render
multi-voice script playback
ComfyUI-first still generation
motion-pass generation for selected shots
manual review checkpoints before expensive overnight runs
Public Interfaces and Command Surface
The new repo should standardize on one command family:

npm run story:package -- --topic <id>
npm run story:voices -- --topic <id>
npm run story:characters -- --topic <id>
npm run story:visuals -- --topic <id>
npm run story:preview -- --topic <id>
npm run story:motion -- --topic <id>
npm run story:assemble -- --topic <id>
npm run story:review -- --topic <id>
npm run story:finish -- --topic <id>
npm run story:full -- --topic <id>
Required docs in the new repo:

README.md
Quickstart and daily workflow.
docs/IMPLEMENTATION_ROOT_PROMOTION.md
Root-migration source of truth.
docs/setup/FULL_SETUP.md
Fresh-machine setup from clone to ComfyUI render.
docs/setup/COMFYUI_GTX1080_SETUP.md
GTX 1080 specific install and startup path.
docs/technical_docs/PIPELINE_STATE_VISUAL.md
Current status diagram.
docs/technical_docs/CHANGELOG.md
Ongoing implementation record.
Test and Acceptance Plan
The new repo is ready only when these are true:

fresh clone can install and run without depending on the old parent repo
unified library/ exists and catalogs can be built from it
a sample topic can run through package, voices, characters, visuals, and preview
preview works before expensive motion/render stages
workspaces are generated under the new root only
the standalone scripts do not require hardcoded paths back to the old repo
the docs fully describe setup, daily usage, and asset organization
a test story can produce:
character refs
scene stills
preview assets
motion-ready artifacts
assembled sample output
Assumptions and Defaults
The new repo is a hard replacement target, not a thin wrapper around the current root.
The side-project pipeline becomes the canonical product direction.
The new repo keeps asset libraries, shared runtime modules, and useful prompts/config/schemas, but drops obsolete workflow baggage where practical.
library/ is the single permanent asset home.
workspaces/ and output/ start empty in the new repo.
Documentation must assume nothing exists outside the repo except machine-level dependencies like Node, Python, FFmpeg, and ComfyUI.
The implementation doc location is changed from the earlier planned side-project root file to:
docs/IMPLEMENTATION_ROOT_PROMOTION.md
because the new repo must have a proper docs hierarchy from day one.
