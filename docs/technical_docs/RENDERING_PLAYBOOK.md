# Rendering Learning Playbook

This playbook records reusable decisions learned from rendered samples. The machine-readable source is `config/rendering_learnings.json`; active rules from that registry are included in future visual-package requests.

## Learning lifecycle

1. Record a new observation as `candidate`.
2. Apply it to a small scene sample.
3. Review multiple frames, motion transitions, continuity, and audio.
4. Promote it to `active` only after the sample improves and passes review.
5. Mark an obsolete rule `retired` instead of deleting its evidence.

## Animation attempt organization

Every meaningful animation iteration is preserved under:

`output/story_packages/<story>/animation_experiments/<scene>/attempt_NNN_<short_name>/`

Each attempt contains a `manifest.json` plus copies of its pose inputs, render, source-pose review, contact sheet, or other evidence. Its status is one of `candidate`, `accepted`, or `rejected`. Never overwrite an earlier attempt. `scene:walk` creates the next numbered candidate folder and its review sheet automatically.

```powershell
npm run animation:attempt -- --story story_id --scene SCENE_01_MS_04 --attempt auto --slug short_name --status rejected --hypothesis "What this attempt tests" --outcome "What the review showed" --lesson-ids related_rule_id --artifacts path/to/render.mp4,path/to/review.png
```

The scene-level `index.json` orders all attempts and points to their manifests.

Use this command to record a candidate:

```powershell
npm run rendering:learn -- --id short_rule_id --title "Short title" --applies-to image_request,motion_render --directive "Instruction future renders must follow" --rationale "What the render taught us" --validation "How to prove it works"
```

## Current production rules

### Environment continuity

- One approved environment plate is locked to each scene and camera setup.
- Props, layout, set geometry, lighting, and camera pose remain unchanged between character poses.
- A new plate is allowed only for a scene change, deliberate camera setup change, or explicit story event that changes the environment.
- Camera movement changes framing; it does not authorize regenerating the set.

### Character animation

- Generate characters as transparent layers separate from the environment.
- Lock identity, wardrobe, scale, lighting direction, and approximate screen position across key poses.
- Composite characters onto the approved plate before frame interpolation.
- Prefer alpha transparency over chroma keying to avoid colored edge contamination.

### Walking

- Use eight ordered gait phases: contact, down, passing, and up on one support leg, then contact, down, passing, and up on the opposite support leg.
- Arms swing opposite the legs; hips and shoulders counter-rotate.
- The body drops on each down pose and rises on each up pose while the support foot remains planted.
- Close the loop by returning from the eighth phase to the first contact without reversing the sequence.
- Never reverse a single step to imitate the opposite-leg step; that produces rocking instead of walking.
- Generated pose sheets use deterministic key-pose timing at 24 fps until their adjacent limbs are rig-consistent.
- Do not use RIFE to invent large limb changes between generated poses; it can create extra elbows, smeared hands, merged legs, or fluctuating limb thickness.
- Enable interpolation only after a review of every delivery frame proves that adjacent poses deform cleanly.
- Trim or loop the clean cycle only to the dialogue duration.
- Measure each pose's transparent bounds and align its lowest foot to one shared ground coordinate.
- Move the character layer across the locked environment; do not pan the completed frame as a substitute for character travel.
- Build traversal for the full dialogue duration so horizontal position does not reset at every gait loop.

### Voice

- Use phrase-aware pacing and restrained pitch/rate variation.
- Apply light equalization and compression.
- Deliver at 48 kHz and verify synchronization against the final scene.

### Approval

- Sample the full clip into a contact sheet.
- Inspect identity, props, layout, character edges, body scale, foot transitions, loop boundaries, and camera behavior.
- Promote a candidate rule only after this review passes.

## Files implementing the current rules

- `config/rendering_learnings.json`
- `config/motion_profiles/gtx1080_walk_cycle.json`
- `scripts/build_story_visual_package.js`
- `scripts/scene-walk-cycle.js`
- `scripts/scene-sample-finish.js`
