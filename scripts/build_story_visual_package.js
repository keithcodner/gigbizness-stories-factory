const fs = require("fs");
const path = require("path");
const {
  loadVisualGenerationConfig,
  resolveWorkflowTemplate
} = require("../../../src/bricktoon/workflowContracts");
const { inferMotionRecipe } = require("../../../src/bricktoon/workflowContracts");
const { LAB_ROOT, REPO_ROOT, parseArgs, readJson, writeJson, writeText, ensureDir } = require("./lib");

function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "item";
}

function resolvePackagePath(args) {
  if (args.package) {
    return path.resolve(args.package);
  }
  const storyId = slugify(args.story || args._?.[0] || "the_great_brick_heist");
  return path.join(LAB_ROOT, "output", "story_packages", storyId, "story_package.json");
}

function loadStoryRenderProfile(config, options = {}) {
  const profileId = options.renderProfile || options.render_profile || process.env.STORY_RENDER_PROFILE || null;
  if (!profileId) {
    return {
      id: null,
      config: null
    };
  }
  const profiles = config.story_render_profiles || {};
  const profile = profiles[profileId];
  if (!profile) {
    throw new Error(`Unknown story render profile: ${profileId}`);
  }
  return {
    id: profileId,
    config: profile
  };
}

function loadVoiceTiming(packageDir) {
  const manifestPath = path.join(packageDir, "voice_preview", "voice_preview_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return new Map();
  }
  const manifest = readJson(manifestPath);
  return new Map((manifest.segments || []).map((segment) => [segment.micro_scene_id, segment]));
}

function loadStoryCharacterRefIndex(packageDir, character) {
  const characterSlug = slugify(character.id || character.name);
  const indexPath = path.join(packageDir, "visual_package", "character_refs", characterSlug, "index.json");
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  return readJson(indexPath);
}

function shotClassToWorkflow(shotClass, renderProfile = null) {
  const value = String(shotClass || "").toLowerCase();
  const profileWorkflows = renderProfile?.shot_class_workflows || {};
  const profileQuality = renderProfile?.quality_tier_overrides || {};
  const select = (fallback) => ({
    workflowId: profileWorkflows[fallback.normalizedShotClass] || fallback.workflowId,
    qualityTier: profileQuality[fallback.qualityTier] || fallback.qualityTier,
    normalizedShotClass: fallback.normalizedShotClass
  });
  if (["dialogue_reaction_closeup", "dialogue_single", "closeup_face", "medium_single"].includes(value)) {
    return select({
      workflowId: "hybrid_character_closeup_v1",
      qualityTier: "hero",
      normalizedShotClass: "closeup_face"
    });
  }
  if (["dialogue_exchange", "two_shot", "medium_two_shot"].includes(value)) {
    return select({
      workflowId: "hybrid_character_dialogue_v1",
      qualityTier: "standard",
      normalizedShotClass: "medium_two_shot"
    });
  }
  if (["prop_insert", "document_insert", "phone_insert", "business_card_insert", "push_in_document"].includes(value)) {
    return select({
      workflowId: "hybrid_document_insert_v1",
      qualityTier: "utility",
      normalizedShotClass: "document_insert"
    });
  }
  return select({
    workflowId: "hybrid_establishing_v1",
    qualityTier: "standard",
    normalizedShotClass: "establishing_wide"
  });
}

function findCharacterByName(characters, name) {
  const needle = String(name || "").trim().toLowerCase();
  return characters.find((character) => String(character.name || "").trim().toLowerCase() === needle) || null;
}

function detectCharactersForMicroScene(pkg, microScene) {
  const found = [];
  if (microScene.speaker) {
    const speakerCharacter = findCharacterByName(pkg.characters, microScene.speaker);
    if (speakerCharacter) {
      found.push(speakerCharacter);
    }
  }

  if (microScene.source_type === "dialogue") {
    return found;
  }

  const text = String(microScene.text || "").toLowerCase();
  for (const character of pkg.characters) {
    const name = String(character.name || "");
    const namePieces = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (namePieces.some((piece) => piece.length > 2 && text.includes(piece))) {
      if (!found.some((item) => item.name === character.name)) {
        found.push(character);
      }
    }
  }

  return found;
}

function anchorLookup(pkg) {
  return new Map((pkg.reference_anchors || []).map((anchor) => [anchor.anchor_id, anchor]));
}

function inferReferenceUsage(microScene, characters) {
  const shotClass = String(microScene.shot_class || "").toLowerCase();
  const text = String(microScene.text || "").toLowerCase();
  const isPropLed = /business card|phone|video titled|screen|document|evidence/.test(text);
  const isDialogue = microScene.source_type === "dialogue";
  const hasVisibleCharacters = (characters || []).length > 0;

  if (isPropLed) {
    return {
      maxImageRefs: hasVisibleCharacters ? 1 : 0,
      includeSupportingCast: false,
      traitsOnlyFallback: true,
      mode: "prop_led"
    };
  }

  if (shotClass.includes("scene_establishing") || shotClass.includes("establishing") || !hasVisibleCharacters) {
    return {
      maxImageRefs: 0,
      includeSupportingCast: false,
      traitsOnlyFallback: true,
      mode: "environment_led"
    };
  }

  if (isDialogue) {
    return {
      maxImageRefs: 1,
      includeSupportingCast: characters.length > 1,
      traitsOnlyFallback: true,
      mode: "character_led"
    };
  }

  return {
    maxImageRefs: 1,
    includeSupportingCast: false,
    traitsOnlyFallback: true,
    mode: "general"
  };
}

function referencesForMicroScene(packageDir, pkg, microScene, characters) {
  const anchorMap = anchorLookup(pkg);
  const references = [];
  const added = new Set();
  const usage = inferReferenceUsage(microScene, characters);
  let imageRefCount = 0;
  for (const character of characters) {
    const refIndex = loadStoryCharacterRefIndex(packageDir, character);
    const preferredFile = refIndex?.preferred_shot_refs?.[microScene.shot_class]
      || refIndex?.preferred_shot_refs?.[shotClassToWorkflow(microScene.shot_class).normalizedShotClass]
      || refIndex?.preferred_shot_refs?.default
      || refIndex?.master_reference
      || null;
    if (!preferredFile || imageRefCount >= usage.maxImageRefs) {
      continue;
    }
    const absolutePreferredPath = path.join(packageDir, preferredFile);
    const repoRelativePreferredPath = path.relative(REPO_ROOT, absolutePreferredPath).replaceAll("\\", "/");
    references.push({
      reference_id: `story_ref_${slugify(character.id || character.name)}`,
      anchor_id: `story_character_ref_${slugify(character.id || character.name)}`,
      type: "character_reference_image",
      file: repoRelativePreferredPath,
      label: `${character.name} cleaned story character ref`,
      traits: [
        "exact same character identity",
        "same face",
        "same hair",
        "same wardrobe",
        "same toy-plastic construction"
      ],
      reference_mode: "identity_lock"
    });
    imageRefCount += 1;
  }

  for (const character of characters) {
    for (const anchorId of character.preferred_anchor_ids || []) {
      const anchor = anchorMap.get(anchorId);
      if (!anchor || added.has(anchor.anchor_id)) {
        continue;
      }
      const mayUseDirectImage = anchor.allow_direct_image_conditioning === true;
      const useImageFile = mayUseDirectImage && imageRefCount < usage.maxImageRefs;
      references.push({
        reference_id: anchor.reference_id,
        anchor_id: anchor.anchor_id,
        type: useImageFile ? "style_reference_image" : "style_reference_traits",
        file: useImageFile ? anchor.file : null,
        label: anchor.label,
        traits: anchor.traits,
        avoid_traits: anchor.avoid_traits || [],
        reference_mode: anchor.reference_mode || "style"
      });
      added.add(anchor.anchor_id);
      if (useImageFile) {
        imageRefCount += 1;
      }
    }
  }

  if (usage.includeSupportingCast) {
    for (const anchor of pkg.reference_anchors || []) {
      if (references.length >= 3) {
        break;
      }
      if (added.has(anchor.anchor_id)) {
        continue;
      }
      references.push({
        reference_id: anchor.reference_id,
        anchor_id: anchor.anchor_id,
        type: "style_reference_traits",
        file: null,
        label: anchor.label,
        traits: anchor.traits,
        avoid_traits: anchor.avoid_traits || [],
        reference_mode: anchor.reference_mode || "style"
      });
      added.add(anchor.anchor_id);
    }
  }

  if (/business card|phone|video titled/i.test(microScene.text || "")) {
    references.push({
      reference_id: "PROP_GUIDE_GENERIC_INSERT",
      anchor_id: "prop_insert_clean_layout",
      type: "prop_guideline",
      file: null,
      label: "Readable prop insert guideline",
      traits: [
        "clean hand-to-prop separation",
        "large readable prop silhouette",
        "do not embed readable branded text"
      ]
    });
  }

  if (usage.traitsOnlyFallback) {
    references.push({
      reference_id: "GLOBAL_STYLE_GUARD",
      anchor_id: "bricktoon_story_frame_guard",
      type: "style_guard",
      file: null,
      label: "Bricktoon story-frame guardrail",
      traits: [
        "single cinematic frame from an animated story",
        "editorial bricktoon material finish",
        "character-forward staging when characters are visible",
        "clean composition built for later puppet animation"
      ],
      avoid_traits: [
        "youtube thumbnail headline layout",
        "speech bubbles",
        "poster composition",
        "big fake text blocks",
        "logo-driven storytelling"
      ]
    });
  }

  return references;
}

function promptForMicroScene(pkg, scene, microScene, characters, references) {
  const sceneTitle = scene?.title || microScene.scene_id;
  const location = scene?.location || "";
  const lead = characters[0] || null;
  const visibleCount = characters.length;
  const roleSummary = characters.length > 0
    ? characters.map((character) => `${character.name}: ${character.description}`).join("; ")
    : "No visible named character. Environment and prop storytelling only.";
  const anchorSummary = references
    .filter((item) => Array.isArray(item.traits))
    .map((item) => `${item.label}: ${item.traits.join(", ")}`)
    .join(" | ");
  const avoidSummary = references
    .filter((item) => Array.isArray(item.avoid_traits) && item.avoid_traits.length > 0)
    .map((item) => `${item.label}: avoid ${item.avoid_traits.join(", ")}`)
    .join(" | ");

  const isPropLed = microScene.motion_plan?.render_strategy === "still_plus_overlay" && /prop|phone|card|document|business card|video titled/i.test(microScene.text || "");
  const lines = [
    `Story still for ${pkg.title}, ${scene.scene_id} ${sceneTitle}.`,
    `Micro-scene ${microScene.micro_scene_id}.`,
    `Location: ${location || "interior set"}.`,
    `Beat text: ${microScene.text}`,
    `Shot class: ${microScene.shot_class}.`,
    `Cast in shot: ${roleSummary}`,
    `Visual goal: premium editorial bricktoon frame with strong toy-plastic materials, cinematic depth, expressive readable faces, and no baked text overlays.`,
    `Frame format: one film-frame style image from an animated scene, not a YouTube thumbnail, not a poster, not a comic cover, not an infographic, and not a meme layout.`,
    `Do not place any speech bubbles, captions, titles, logos, storefront signs, UI blocks, or readable text anywhere in the frame.`,
    `Motion-prep framing: preserve clean face, mouth, eye, hand, and prop zones for later blink, mouth, gesture, and prop animation.`,
    anchorSummary ? `Reference anchor traits: ${anchorSummary}.` : "",
    avoidSummary ? `Reference avoidance rules: ${avoidSummary}.` : "",
    visibleCount === 0 ? "Visible subject count: zero people. No faces, no crowd, no background characters." : "",
    visibleCount === 1 && lead ? `Visible subject count: exactly one character, ${lead.name}. No extra people, no secondary faces, no reflected faces, and no crowd background.` : "",
    visibleCount > 1 ? `Visible subject count: exactly ${visibleCount} named characters only. Do not add extra background people or spare faces.` : "",
    lead ? `Primary character lock: ${lead.name}. Keep the silhouette stable, the face readable, and the role-consistent wardrobe and expression family intact.` : "",
    isPropLed
      ? "Prop-led insert. Keep the active phone, business card, or evidence object large, readable, isolated from the background, and free of on-object readable text. Favor icon-level design rather than written words."
      : lead
        ? "Character-led frame. Favor a strong readable pose that can interpolate into the next micro-scene. Keep the background supportive and cinematic instead of poster-like."
        : "Environment-led frame. Emphasize the missing collection, empty shelves, and a readable cinematic layout that can carry a slow camera move. Keep it grounded as story scenery, not as ad art."
  ];

  return lines.filter(Boolean).join(" ");
}

function negativePromptForMicroScene(microScene, characters) {
  const terms = [
    "embedded subtitles",
    "large readable text",
    "brand logos",
    "watermarks",
    "identity drift",
    "extra limbs",
    "deformed hands",
    "mushy face",
    "flat lighting",
    "blurry render",
    "poster-only composition",
    "photoreal human skin",
    "speech bubble",
    "caption box",
    "headline text",
    "title text",
    "youtube thumbnail",
    "magazine cover",
    "infographic layout",
    "storefront sign closeup",
    "fake paragraph text",
    "decorative border frame",
    "name plate banner",
    "trading card layout",
    "character card layout"
  ];
  if ((characters || []).length <= 1) {
    terms.push("duplicate people", "crowd background", "extra face", "background character", "secondary person");
  }
  if ((characters || []).length === 0) {
    terms.push("visible face", "character portrait", "person in frame");
  }
  if (/business card|phone|video titled/i.test(microScene.text || "")) {
    terms.push("unreadable prop", "text-heavy signboard", "screen full of words");
  }
  return [...new Set(terms)].join(", ");
}

function buildMotionBlueprint(microScene, voiceSegment, workflowSelection) {
  const normalizedShotClass = workflowSelection.normalizedShotClass;
  const performanceClass = normalizedShotClass === "establishing_wide"
    ? "tableau"
    : microScene.motion_plan?.render_strategy === "still_plus_overlay"
      ? "document_insert_motion"
      : "single_character_explainer";
  const recipe = inferMotionRecipe({
    shot_type: normalizedShotClass,
    reason: `${microScene.shot_class} ${microScene.text}`,
    performance_class: performanceClass
  }, {
    shot_type: normalizedShotClass,
    purpose: microScene.text,
    performance_class: performanceClass,
    secondary_action: (microScene.motion_plan?.actor_motion || []).join("_"),
    mouth_sync_mode: microScene.source_type === "dialogue" ? "viseme_emphasis" : "none"
  });

  return {
    micro_scene_id: microScene.micro_scene_id,
    motion_recipe: recipe,
    render_strategy: microScene.motion_plan?.render_strategy || "cutout_rig_primary",
    actor_motion: microScene.motion_plan?.actor_motion || [],
    camera_motion: microScene.motion_plan?.camera_motion || [],
    target_duration_seconds: Number(voiceSegment?.actual_seconds || microScene.duration_seconds || 2.5),
    speech_driven: microScene.source_type === "dialogue",
    timing: voiceSegment ? {
      start_seconds: voiceSegment.start_seconds,
      end_seconds: voiceSegment.end_seconds,
      actual_seconds: voiceSegment.actual_seconds
    } : null
  };
}

function markdownForVisualPlan(pkg, requests, sceneMap) {
  const lines = [
    `# ${pkg.title} Visual Package`,
    "",
    `- Story ID: ${pkg.story_id}`,
    `- Scene count: ${pkg.scenes.length}`,
    `- Micro-scene requests: ${requests.length}`,
    "",
    "## Scene Requests",
    ""
  ];

  for (const scene of pkg.scenes) {
    lines.push(`### ${scene.scene_id} — ${scene.title}`);
    lines.push("");
    const sceneRequests = requests.filter((item) => item.scene_id === scene.scene_id);
    for (const request of sceneRequests) {
      const sceneRecord = sceneMap.get(request.micro_scene_id) || {};
      lines.push(`- ${request.micro_scene_id}: ${request.workflow_template_id} / ${request.shot_class} / ${request.quality_tier}`);
      lines.push(`  Prompt: ${request.prompt_contract.prompt_text}`);
      lines.push(`  Motion: ${(sceneRecord.motion_blueprint?.actor_motion || []).join(", ") || "none"} | Camera: ${(sceneRecord.motion_blueprint?.camera_motion || []).join(", ") || "none"} | Recipe: ${sceneRecord.motion_blueprint?.motion_recipe || "n/a"}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildVisualPackage(options = {}) {
  const packagePath = resolvePackagePath(options);
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Story package not found: ${packagePath}`);
  }

  const pkg = readJson(packagePath);
  const packageDir = path.dirname(packagePath);
  const outputDir = path.join(packageDir, "visual_package");
  const requestsDir = path.join(outputDir, "image_requests");
  ensureDir(requestsDir);

  const config = loadVisualGenerationConfig();
  const storyRenderProfile = loadStoryRenderProfile(config, options);
  const voiceTiming = loadVoiceTiming(packageDir);
  const requests = [];
  const sceneMap = new Map();
  const outputOverrides = storyRenderProfile.config?.output || {};

  for (const scene of pkg.scenes || []) {
    const microScenes = (pkg.micro_scenes || []).filter((item) => item.scene_id === scene.scene_id);
    for (const microScene of microScenes) {
      const workflowSelection = shotClassToWorkflow(microScene.shot_class, storyRenderProfile.config);
      const workflowTemplate = resolveWorkflowTemplate(config, "shot_keyframe", {
        workflowId: workflowSelection.workflowId,
        qualityTier: workflowSelection.qualityTier,
        providerName: config.default_image_provider || "comfyui",
        shotClass: workflowSelection.normalizedShotClass,
        width: outputOverrides.width,
        height: outputOverrides.height
      });
      const visibleCharacters = detectCharactersForMicroScene(pkg, microScene);
      const references = referencesForMicroScene(packageDir, pkg, microScene, visibleCharacters);
      const voiceSegment = voiceTiming.get(microScene.micro_scene_id) || null;
      const motionBlueprint = buildMotionBlueprint(microScene, voiceSegment, workflowSelection);
      const request = {
        request_id: `${pkg.story_id}_${microScene.micro_scene_id}`.toLowerCase(),
        created_at: new Date().toISOString(),
        stage: "story_visual_package",
        provider: config.default_image_provider || "comfyui",
        kind: "shot_keyframe",
        scene_id: scene.scene_id,
        micro_scene_id: microScene.micro_scene_id,
        shot_class: workflowSelection.normalizedShotClass,
        quality_tier: workflowSelection.qualityTier,
        workflow_template_id: workflowTemplate.workflow_id,
        render_profile_id: storyRenderProfile.id,
        output_contract: {
          output_file: `visual_package/generated_frames/${microScene.micro_scene_id}.png`,
          width: workflowTemplate.output.width,
          height: workflowTemplate.output.height,
          aspect_ratio: workflowTemplate.output.aspect_ratio
        },
        prompt_contract: {
          prompt_text: promptForMicroScene(pkg, scene, microScene, visibleCharacters, references),
          negative_prompt_text: negativePromptForMicroScene(microScene, visibleCharacters)
        },
        references,
        visible_characters: visibleCharacters.map((character) => ({
          name: character.name,
          role_class: character.role_class,
          preferred_anchor_ids: character.preferred_anchor_ids || []
        })),
        motion_blueprint: motionBlueprint
      };

      const requestPath = path.join(requestsDir, `${microScene.micro_scene_id}.json`);
      writeJson(requestPath, request);
      requests.push(request);
      sceneMap.set(microScene.micro_scene_id, {
        request_path: path.relative(packageDir, requestPath).replaceAll("\\", "/"),
        motion_blueprint: motionBlueprint
      });
    }
  }

  const storyboard = {
    story_id: pkg.story_id,
    generated_at: new Date().toISOString(),
    render_profile_id: storyRenderProfile.id,
    request_count: requests.length,
    scenes: (pkg.scenes || []).map((scene) => ({
      scene_id: scene.scene_id,
      title: scene.title,
      micro_scenes: (pkg.micro_scenes || [])
        .filter((item) => item.scene_id === scene.scene_id)
        .map((item) => ({
          micro_scene_id: item.micro_scene_id,
          shot_class: shotClassToWorkflow(item.shot_class).normalizedShotClass,
          request_file: sceneMap.get(item.micro_scene_id)?.request_path || null,
          target_duration_seconds: sceneMap.get(item.micro_scene_id)?.motion_blueprint?.target_duration_seconds || item.duration_seconds
        }))
    }))
  };

  const motionManifest = {
    story_id: pkg.story_id,
    generated_at: new Date().toISOString(),
    motion_blueprints: requests.map((request) => request.motion_blueprint)
  };

  const storyboardPath = path.join(outputDir, "storyboard.json");
  const motionManifestPath = path.join(outputDir, "motion_blueprints.json");
  const markdownPath = path.join(outputDir, "visual_storyboard.md");

  writeJson(storyboardPath, storyboard);
  writeJson(motionManifestPath, motionManifest);
  writeText(markdownPath, markdownForVisualPlan(pkg, requests, sceneMap));

  console.log(`Visual package created at ${outputDir}`);
  console.log(`Storyboard written to ${storyboardPath}`);
  console.log(`Motion blueprints written to ${motionManifestPath}`);

  return {
    output_dir: outputDir,
    storyboard_path: storyboardPath,
    motion_manifest_path: motionManifestPath,
    markdown_path: markdownPath
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  buildVisualPackage(args);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  buildVisualPackage
};
