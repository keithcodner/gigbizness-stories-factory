const fs = require("fs");
const path = require("path");
const { REPO_ROOT, readJson } = require("./lib");

function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "story";
}

function estimateSeconds(text, floor = 1.8) {
  const words = String(text || "").split(/\s+/).filter(Boolean).length;
  return Math.max(floor, Number((((words / 155) * 60) + 0.8).toFixed(2)));
}

function parseCharacterLine(line) {
  const match = line.match(/^([A-Z0-9 .'\-]+)\s+[—-]\s+(.+)$/);
  if (!match) {
    return null;
  }
  return {
    id: slugify(match[1]).toUpperCase(),
    name: match[1].trim(),
    description: match[2].trim()
  };
}

function isSpeakerLine(line) {
  return /^[A-Z0-9 .'\-]+:$/.test(line.trim());
}

function splitSentences(paragraph) {
  return String(paragraph || "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureCharacter(characters, speakerName) {
  const name = String(speakerName || "").trim();
  if (!name) {
    return null;
  }
  const existing = characters.find((item) => item.name === name);
  if (existing) {
    return existing;
  }
  const created = {
    id: slugify(name).toUpperCase(),
    name,
    description: "Implicitly discovered from screenplay dialogue."
  };
  characters.push(created);
  return created;
}

function parseScreenplay(markdown, options = {}) {
  const lines = markdown.split(/\r?\n/);
  const characters = [];
  const scenes = [];
  let title = "";
  let runtime = "";
  let style = "";
  let inCharacters = false;
  let currentScene = null;
  let paragraphBuffer = [];
  let dialogueBuffer = null;

  function flushParagraph() {
    if (!currentScene || paragraphBuffer.length === 0) {
      paragraphBuffer = [];
      return;
    }
    currentScene.elements.push({
      type: "action",
      text: paragraphBuffer.join(" ").trim()
    });
    paragraphBuffer = [];
  }

  function flushDialogue() {
    if (!currentScene || !dialogueBuffer) {
      dialogueBuffer = null;
      return;
    }
    currentScene.elements.push({
      type: "dialogue",
      speaker: dialogueBuffer.speaker,
      text: dialogueBuffer.lines.join(" ").trim()
    });
    dialogueBuffer = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushDialogue();
      continue;
    }

    if (!title && !/^Runtime:/i.test(line) && !/^Style:/i.test(line) && !/^CHARACTERS$/i.test(line) && !/^SCENE\s+\d+/i.test(line)) {
      title = line;
      continue;
    }
    if (/^Runtime:/i.test(line)) {
      runtime = line.replace(/^Runtime:\s*/i, "").trim();
      continue;
    }
    if (/^Style:/i.test(line)) {
      style = line.replace(/^Style:\s*/i, "").trim();
      continue;
    }
    if (/^CHARACTERS$/i.test(line)) {
      flushParagraph();
      flushDialogue();
      inCharacters = true;
      continue;
    }
    if (/^SCENE\s+\d+\s+[—-]\s+/i.test(line)) {
      flushParagraph();
      flushDialogue();
      inCharacters = false;
      const match = line.match(/^SCENE\s+(\d+)\s+[—-]\s+(.+)$/i);
      currentScene = {
        scene_number: Number(match[1]),
        scene_id: `SCENE_${String(match[1]).padStart(2, "0")}`,
        title: match[2].trim(),
        location: "",
        elements: []
      };
      scenes.push(currentScene);
      continue;
    }

    if (inCharacters) {
      const parsed = parseCharacterLine(line);
      if (parsed) {
        characters.push(parsed);
      }
      continue;
    }

    if (!currentScene) {
      continue;
    }

    if (!currentScene.location && /^(INT|EXT|INT\/EXT|EXT\/INT)\./i.test(line)) {
      currentScene.location = line;
      continue;
    }

    if (isSpeakerLine(line)) {
      flushParagraph();
      flushDialogue();
      const speaker = line.replace(/:$/, "").trim();
      ensureCharacter(characters, speaker);
      dialogueBuffer = {
        speaker,
        lines: []
      };
      continue;
    }

    if (dialogueBuffer) {
      dialogueBuffer.lines.push(line);
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushDialogue();

  const sceneLimit = Number(options.sceneLimit || 0);
  const limitedScenes = sceneLimit > 0 ? scenes.slice(0, sceneLimit) : scenes;

  return {
    title,
    story_id: slugify(title),
    runtime,
    style,
    characters,
    scenes: limitedScenes
  };
}

function readReferenceCatalog() {
  const candidatePaths = [
    path.join(REPO_ROOT, "library", "catalogs", "reference_catalog.json"),
    path.join(REPO_ROOT, "library", "reference_images", "reference_catalog.json")
  ];
  for (const catalogPath of candidatePaths) {
    if (!fs.existsSync(catalogPath)) {
      continue;
    }
    const catalog = readJson(catalogPath);
    if (Array.isArray(catalog.references)) {
      return catalog.references;
    }
    if (Array.isArray(catalog.assets)) {
      return catalog.assets;
    }
  }
  return [];
}

function buildReferenceAnchors() {
  const references = readReferenceCatalog();
  const byFile = new Map(references.map((item) => [path.basename(item.file), item]));
  const villain = byFile.get("4khiPx0sJKqg7FnNI6kU.png") || null;
  const police = byFile.get("Screenshot_30.png") || null;
  const kid = byFile.get("Screenshot_29.png") || null;
  return [
    villain && {
      anchor_id: "villain_ceo_style",
      label: "Mustache-twirling CEO / villain editorial style",
      reference_id: villain.reference_id,
      file: villain.file,
      crop_hint: {
        x: 0.44,
        y: 0.02,
        width: 0.3,
        height: 0.9
      },
      reference_mode: "character_focus",
      allow_direct_image_conditioning: false,
      avoid_traits: [
        "headline copy",
        "speech bubbles",
        "thumbnail layout",
        "storefront logo duplication"
      ],
      traits: [
        "bold villain silhouette",
        "large expressive face",
        "dramatic hand pose",
        "dramatic editorial lighting",
        "clean toy-plastic material finish"
      ]
    },
    police && {
      anchor_id: "police_authority_style",
      label: "Police / authority bricktoon style",
      reference_id: police.reference_id,
      file: police.file,
      crop_hint: {
        x: 0.56,
        y: 0.47,
        width: 0.34,
        height: 0.26
      },
      reference_mode: "supporting_cast",
      allow_direct_image_conditioning: false,
      avoid_traits: [
        "headline copy",
        "text boxes",
        "poster framing",
        "badge closeup logo emphasis"
      ],
      traits: [
        "uniformed authority figures",
        "clean badge silhouettes",
        "controlled reaction poses",
        "background lineup composition",
        "clear minifig-style proportions"
      ]
    },
    kid && {
      anchor_id: "kid_reaction_style",
      label: "Family witness / worried kid reaction style",
      reference_id: kid.reference_id,
      file: kid.file,
      crop_hint: {
        x: 0.0,
        y: 0.57,
        width: 0.34,
        height: 0.39
      },
      reference_mode: "character_focus",
      allow_direct_image_conditioning: false,
      avoid_traits: [
        "headline copy",
        "speech bubbles",
        "thumbnail layout",
        "oversized branded signage"
      ],
      traits: [
        "curly-haired worried witness",
        "strong phone or prop readability",
        "large readable eyes",
        "family-story reaction framing",
        "clean expressive mouth zone"
      ]
    }
  ].filter(Boolean);
}

function detectRoleClass(character) {
  const text = `${character.name} ${character.description}`.toLowerCase();
  if (/ceo|villain|greed|evil/.test(text)) {
    return "villain";
  }
  if (/12-year-old|kid|child|builder/.test(text)) {
    return "kid";
  }
  if (/police|officer|authority/.test(text)) {
    return "authority";
  }
  if (/father|dad|mother|mom|parent/.test(text)) {
    return "parent";
  }
  if (/youtuber|investigates|host|hero/.test(text)) {
    return "hero";
  }
  return "support";
}

function chooseVoiceProfile(character, voiceConfig) {
  const fallback = voiceConfig.default_profile_id || "narrator_editorial";
  const haystack = `${character.name} ${character.description}`.toLowerCase();
  const matched = (voiceConfig.archetype_rules || []).find((rule) => {
    return (rule.match_any || []).some((term) => haystack.includes(String(term).toLowerCase()));
  });
  return matched?.profile_id || fallback;
}

function attachCharacterAnchors(characters, anchors) {
  return characters.map((character) => {
    const roleClass = detectRoleClass(character);
    let preferredAnchorIds = [];
    if (roleClass === "villain") {
      preferredAnchorIds = ["villain_ceo_style"];
    } else if (roleClass === "authority") {
      preferredAnchorIds = ["police_authority_style"];
    } else if (roleClass === "kid") {
      preferredAnchorIds = ["kid_reaction_style"];
    }
    return {
      ...character,
      role_class: roleClass,
      preferred_anchor_ids: preferredAnchorIds,
      reference_policy: preferredAnchorIds.length > 0
        ? "Use anchor traits only. Do not copy logos, embedded text, or exact branded layouts."
        : "Use shared bricktoon style language plus approved anchor families where helpful."
    };
  });
}

function inferShotClass(text, elementType) {
  const lower = String(text || "").toLowerCase();
  if (elementType === "dialogue") {
    if (/gone|who steals|need someone|need benji/.test(lower)) {
      return "dialogue_reaction_closeup";
    }
    return "dialogue_single";
  }
  if (/empty|bare walls|stares|shock/.test(lower)) {
    return "discovery_establishing";
  }
  if (/business card|phone|video titled/.test(lower)) {
    return "prop_insert";
  }
  return "reaction_medium";
}

function inferMotionPlan(text, elementType) {
  const lower = String(text || "").toLowerCase();
  const actions = [];
  const camera = [];
  if (elementType === "dialogue") {
    actions.push("mouth_movement", "blink_cycle", "small_head_turn");
    camera.push("slow_push");
  }
  if (/stares|shock|gone/.test(lower)) {
    actions.push("eye_widen", "head_snap", "shoulder_drop");
    camera.push("push_in");
  }
  if (/business card/.test(lower)) {
    actions.push("prop_pickup", "finger_point");
    camera.push("insert_push");
  }
  if (/phone|video titled/.test(lower)) {
    actions.push("phone_raise", "screen_glance");
    camera.push("over_shoulder_insert");
  }
  if (/empty|bare walls/.test(lower)) {
    camera.push("wide_pan");
  }
  return {
    actor_motion: [...new Set(actions)],
    camera_motion: [...new Set(camera)],
    render_strategy: camera.includes("insert_push") || camera.includes("over_shoulder_insert")
      ? "still_plus_overlay"
      : "cutout_rig_primary"
  };
}

function buildMicroScenes(parsed) {
  const microScenes = [];
  const voiceSegments = [];
  for (const scene of parsed.scenes) {
    let order = 1;
    if (scene.location) {
      microScenes.push({
        micro_scene_id: `${scene.scene_id}_MS_${String(order).padStart(2, "0")}`,
        scene_id: scene.scene_id,
        order,
        source_type: "location",
        shot_class: "scene_establishing",
        text: scene.location,
        duration_seconds: 2.4,
        motion_plan: {
          actor_motion: [],
          camera_motion: ["slow_pan", "push_in"],
          render_strategy: "still_plus_overlay"
        }
      });
      order += 1;
    }

    for (const element of scene.elements) {
      const chunks = element.type === "action" ? splitSentences(element.text) : [element.text];
      for (const chunk of chunks) {
        const duration = estimateSeconds(chunk, element.type === "dialogue" ? 2.2 : 1.8);
        const microSceneId = `${scene.scene_id}_MS_${String(order).padStart(2, "0")}`;
        const shotClass = inferShotClass(chunk, element.type);
        const motionPlan = inferMotionPlan(chunk, element.type);
        microScenes.push({
          micro_scene_id: microSceneId,
          scene_id: scene.scene_id,
          order,
          source_type: element.type,
          speaker: element.speaker || null,
          shot_class: shotClass,
          text: chunk,
          duration_seconds: duration,
          motion_plan: motionPlan
        });
        voiceSegments.push({
          segment_id: `${microSceneId}_VO`,
          micro_scene_id: microSceneId,
          scene_id: scene.scene_id,
          type: element.type === "dialogue" ? "character_dialogue" : "narration_action",
          speaker: element.speaker || "NARRATOR",
          text: chunk,
          estimated_seconds: duration
        });
        order += 1;
      }
    }
  }
  return {
    microScenes,
    voiceSegments
  };
}

function buildPreviewMarkdown(pkg) {
  const lines = [
    `# ${pkg.title} Story Preview Package`,
    "",
    `- Story ID: ${pkg.story_id}`,
    `- Runtime note: ${pkg.runtime || "n/a"}`,
    `- Style: ${pkg.style || "n/a"}`,
    `- Scene count in test package: ${pkg.scenes.length}`,
    `- Micro-scenes generated: ${pkg.micro_scenes.length}`,
    `- Voice segments generated: ${pkg.voice_segments.length}`,
    "",
    "## Reference Anchors",
    ""
  ];

  for (const anchor of pkg.reference_anchors) {
    lines.push(`- ${anchor.anchor_id}: ${anchor.label} -> ${anchor.file}`);
  }

  lines.push("");
  lines.push("## Cast Voice Assignments");
  lines.push("");
  for (const character of pkg.characters) {
    const voice = pkg.voice_cast[character.name] || null;
    lines.push(`- ${character.name}: role ${character.role_class}, voice profile ${voice?.profile_id || "n/a"}, anchor ${character.preferred_anchor_ids.join(", ") || "none"}`);
  }

  lines.push("");
  lines.push("## Scene Micro-Scenes");
  lines.push("");
  for (const scene of pkg.scenes) {
    lines.push(`### ${scene.scene_id} — ${scene.title}`);
    lines.push("");
    if (scene.location) {
      lines.push(`- Location: ${scene.location}`);
    }
    for (const micro of pkg.micro_scenes.filter((item) => item.scene_id === scene.scene_id)) {
      lines.push(`- ${micro.micro_scene_id}: ${micro.source_type}${micro.speaker ? ` / ${micro.speaker}` : ""} / ${micro.shot_class} / ${micro.duration_seconds}s`);
      lines.push(`  ${micro.text}`);
      lines.push(`  Motion: ${micro.motion_plan.actor_motion.join(", ") || "none"} | Camera: ${micro.motion_plan.camera_motion.join(", ") || "none"} | Route: ${micro.motion_plan.render_strategy}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildStoryPackage(markdown, voiceConfig, options = {}) {
  const parsed = parseScreenplay(markdown, options);
  const referenceAnchors = buildReferenceAnchors();
  const characters = attachCharacterAnchors(parsed.characters, referenceAnchors);
  const voiceCast = {};
  for (const character of characters) {
    voiceCast[character.name] = {
      profile_id: chooseVoiceProfile(character, voiceConfig)
    };
  }
  voiceCast.NARRATOR = {
    profile_id: voiceConfig.default_profile_id || "narrator_editorial"
  };

  const movement = buildMicroScenes({
    ...parsed,
    characters
  });

  return {
    title: parsed.title,
    story_id: parsed.story_id,
    runtime: parsed.runtime,
    style: parsed.style,
    generated_at: new Date().toISOString(),
    source_policy: "Scene-sized story package for preview-first bricktoon planning. References supply trait anchors only.",
    scene_limit: Number(options.sceneLimit || 0) || parsed.scenes.length,
    characters,
    scenes: parsed.scenes,
    reference_anchors: referenceAnchors,
    voice_cast: voiceCast,
    micro_scenes: movement.microScenes,
    voice_segments: movement.voiceSegments
  };
}

module.exports = {
  buildPreviewMarkdown,
  buildStoryPackage,
  parseScreenplay,
  slugify
};
