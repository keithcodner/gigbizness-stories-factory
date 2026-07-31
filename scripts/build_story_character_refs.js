const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  buildExecutionResult,
  loadVisualGenerationConfig,
  resolveWorkflowTemplate
} = require("../src/bricktoon/workflowContracts");
const { withImageProvider } = require("../src/bricktoon/providers");
const { validateGeneratedAsset } = require("../src/bricktoon/validateGeneratedAsset");
const { LAB_ROOT, ensureDir, parseArgs, readJson, resolveFfmpegPath, writeJson, writeText } = require("./lib");

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

function selectedCharacterIds(args) {
  const value = args.characters || args.characterIds || args["character-ids"] || args.character;
  if (!value) {
    return null;
  }
  return String(value)
    .split(",")
    .map((item) => slugify(item).toUpperCase())
    .filter(Boolean);
}

function selectedVariants(args) {
  const value = args.variants || args.variant;
  if (!value) {
    return null;
  }
  return new Set(String(value).split(",").map((item) => slugify(item)).filter(Boolean));
}

function anchorMap(pkg) {
  return new Map((pkg.reference_anchors || []).map((anchor) => [anchor.anchor_id, anchor]));
}

function cropImage(inputPath, outputPath, cropHint) {
  ensureDir(path.dirname(outputPath));
  const cropWidth = Number(cropHint.width || 1);
  const cropHeight = Number(cropHint.height || 1);
  const cropX = Number(cropHint.x || 0);
  const cropY = Number(cropHint.y || 0);
  const filter = `crop=iw*${cropWidth}:ih*${cropHeight}:iw*${cropX}:ih*${cropY},scale=768:768:force_original_aspect_ratio=decrease,pad=1024:1024:(ow-iw)/2:(oh-ih)/2:color=0xD9E6F2`;
  const result = spawnSync(resolveFfmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-vf",
    filter,
    outputPath
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed to crop anchor image for ${outputPath}`);
  }
}

function buildAnchorCrop(packageDir, pkg, character) {
  const anchors = anchorMap(pkg);
  const preferred = (character.preferred_anchor_ids || [])
    .map((anchorId) => anchors.get(anchorId))
    .find((anchor) => anchor?.file && anchor?.crop_hint);
  if (!preferred) {
    return null;
  }
  const inputPath = path.join(path.resolve(__dirname, ".."), preferred.file);
  if (!fs.existsSync(inputPath)) {
    return null;
  }
  const cropsDir = path.join(packageDir, "visual_package", "anchor_crops");
  const outputPath = path.join(cropsDir, `${slugify(character.id || character.name)}_${preferred.anchor_id}.png`);
  cropImage(inputPath, outputPath, preferred.crop_hint);
  return {
    filePath: outputPath,
    relativeFile: relativeToPackage(packageDir, outputPath),
    anchor_id: preferred.anchor_id,
    label: preferred.label
  };
}

function describeRole(roleClass) {
  const map = {
    hero: "determined story lead",
    villain: "dramatic villain executive",
    kid: "young clever witness",
    parent: "protective grounded parent",
    authority: "serious police authority",
    support: "supporting story character"
  };
  return map[roleClass] || "supporting story character";
}

function characterPromptBase(pkg, character) {
  const anchors = anchorMap(pkg);
  const anchorTraits = (character.preferred_anchor_ids || [])
    .map((anchorId) => anchors.get(anchorId))
    .filter(Boolean)
    .flatMap((anchor) => anchor.traits || []);
  const avoidTraits = (character.preferred_anchor_ids || [])
    .map((anchorId) => anchors.get(anchorId))
    .filter(Boolean)
    .flatMap((anchor) => anchor.avoid_traits || []);
  const lines = [
    `Create a reusable story character reference for ${character.name}.`,
    `Role class: ${character.role_class}.`,
    `Role summary: ${describeRole(character.role_class)}.`,
    `Description: ${character.description}.`,
    "Style: original editorial bricktoon character in a clean toy-plastic world.",
    "Output target: a clean production-ready single character reference for later shot conditioning.",
    "Character construction: rounded toy-plastic face, simple expressive eyebrows, readable eyes, clean mouth zone, clear hair or hat silhouette, animation-friendly arm readability.",
    "Framing: single character only, no crowd, no supporting cast, no props unless explicitly requested, no border, no title plate, no text, no speech bubbles.",
    "Wardrobe surfaces must remain completely plain and unmarked: no chest icon, no emblem, no lettering, no pseudo-text.",
    anchorTraits.length > 0 ? `Approved anchor traits: ${anchorTraits.join(", ")}.` : "",
    avoidTraits.length > 0 ? `Avoid traits: ${avoidTraits.join(", ")}.` : "",
    `Reference policy: ${character.reference_policy || "Use original story-safe traits only."}`,
    "Background: simple neutral studio or soft cinematic gradient only.",
    "Material finish: polished toy-plastic with soft dimensional highlights.",
    "No logos, no branding, no fake labels, no poster layout."
  ];
  return lines.filter(Boolean).join(" ");
}

function variantInstruction(variant) {
  const map = {
    master: "Canonical master identity frame. Preserve the reference's stylized yellow toy-plastic face, curly hair, blue hoodie, and simplified brick-figure anatomy. Show the complete head, face, torso, arms, and hands, centered with clear margin on every side. Neutral but alive expression. Highest identity lock.",
    front: "Front-facing clean reference. Exact facial proportions and mouth placement.",
    three_quarter: "Three-quarter view with the same identity, same hair, same face, same wardrobe.",
    talking: "Talking expression variant with the mouth visibly open mid-speech. Mouth area must stay clean and readable for later viseme replacement.",
    worried: "Worried reaction variant. Keep the same identity and the same wardrobe."
  };
  return map[variant] || "Keep exact same identity and wardrobe continuity.";
}

function variantSize(variant) {
  if (variant === "master") {
    return { width: 1024, height: 1024, qualityTier: "hero" };
  }
  return { width: 1024, height: 1024, qualityTier: "standard" };
}

function buildVariantPrompt(pkg, character, variant) {
  return `${characterPromptBase(pkg, character)} ${variantInstruction(variant)}`;
}

function referenceDenoiseForVariant(variant, referenceImagePaths = []) {
  if (!Array.isArray(referenceImagePaths) || referenceImagePaths.length === 0) {
    return 1;
  }
  if (variant === "master") {
    return 0.45;
  }
  if (variant === "front" || variant === "three_quarter") {
    return 0.34;
  }
  if (variant === "talking") {
    return 0.6;
  }
  return 0.45;
}

function relativeToPackage(packageDir, filePath) {
  return path.relative(packageDir, filePath).replaceAll("\\", "/");
}

function manifestMarkdown(pkg, summary) {
  const lines = [
    `# ${pkg.title} Character Ref Summary`,
    "",
    `- Story ID: ${pkg.story_id}`,
    `- Characters processed: ${summary.characters.length}`,
    `- Provider requested: ${summary.provider_requested}`,
    "",
    "## Characters",
    ""
  ];

  for (const item of summary.characters) {
    lines.push(`- ${item.character_id}: ${item.status} / ${item.master_reference || "n/a"}`);
    if (item.variants?.length) {
      lines.push(`  Variants: ${item.variants.map((variant) => variant.variant).join(", ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function renderVariant({ request, outputPath, referenceImagePaths, visualConfig }) {
  const workflowTemplate = resolveWorkflowTemplate(visualConfig, "character_reference", {
    qualityTier: request.quality_tier,
    providerName: request.provider,
    variant: request.variant
  });

  const run = await withImageProvider(`story character ${request.character_id}/${request.variant}`, async (provider, activeProviderName, providerConfig) => {
    const providerResult = await provider.renderCharacterReference({
      prompt: {
        prompt_text: request.prompt_contract.prompt_text,
        negative_prompt_text: request.prompt_contract.negative_prompt_text
      },
      outputPath,
      width: request.output_contract.width,
      height: request.output_contract.height,
      variant: request.variant,
      referenceImagePaths,
      workflowRequest: {
        ...request,
        workflow_template: workflowTemplate
      },
      providerConfig: {
        ...providerConfig,
        workflowTemplate,
        referenceImagePaths,
        shotType: "character_reference",
        referenceDenoise: referenceDenoiseForVariant(request.variant, referenceImagePaths)
      }
    });
    return {
      providerName: activeProviderName,
      providerResult
    };
  });

  const validation = validateGeneratedAsset(outputPath, {
    width: request.output_contract.width,
    height: request.output_contract.height
  });
  if (!validation.valid) {
    throw new Error(`Character ref validation failed for ${request.character_id}/${request.variant}: ${validation.reason}`);
  }

  return {
    provider: run.providerName,
    providerResult: run.providerResult,
    workflowTemplate
  };
}

async function buildStoryCharacterRefs(options = {}) {
  const packagePath = resolvePackagePath(options);
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Story package not found: ${packagePath}`);
  }

  const pkg = readJson(packagePath);
  const packageDir = path.dirname(packagePath);
  const visualDir = path.join(packageDir, "visual_package");
  const refsRoot = path.join(visualDir, "character_refs");
  const requestRoot = path.join(visualDir, "character_requests");
  const reportRoot = path.join(visualDir, "character_reports");
  ensureDir(refsRoot);
  ensureDir(requestRoot);
  ensureDir(reportRoot);

  const visualConfig = loadVisualGenerationConfig();
  const selectedIds = selectedCharacterIds(options);
  const variantFilter = selectedVariants(options);
  const characters = (pkg.characters || []).filter((character) => !selectedIds || selectedIds.includes(String(character.id || "").toUpperCase()));
  if (characters.length === 0) {
    throw new Error("No story characters matched the current filter.");
  }

  const summary = {
    story_id: pkg.story_id,
    created_at: new Date().toISOString(),
    provider_requested: process.env.BRICKTOON_IMAGE_PROVIDER || visualConfig.default_image_provider || "comfyui",
    characters: []
  };

  for (const character of characters) {
    const characterSlug = slugify(character.id || character.name);
    const characterDir = path.join(refsRoot, characterSlug);
    const expressionsDir = path.join(characterDir, "expressions");
    ensureDir(characterDir);
    ensureDir(expressionsDir);
    const anchorCrop = buildAnchorCrop(packageDir, pkg, character);

    const variants = {
      master: path.join(characterDir, "master.png"),
      front: path.join(characterDir, "front.png"),
      three_quarter: path.join(characterDir, "three_quarter.png"),
      talking: path.join(expressionsDir, "talking.png"),
      worried: path.join(expressionsDir, "worried.png")
    };

    const variantResults = [];
    let providerUsed = summary.provider_requested;
    let masterPath = fs.existsSync(variants.master) ? variants.master : null;

    for (const [variant, outputPath] of Object.entries(variants).filter(([name]) => !variantFilter || variantFilter.has(name))) {
      const size = variantSize(variant);
      const request = {
        request_id: `${pkg.story_id}_${characterSlug}_${variant}`.toLowerCase(),
        created_at: new Date().toISOString(),
        provider: providerUsed,
        kind: "character_reference",
        character_id: character.id,
        character_name: character.name,
        variant,
        quality_tier: size.qualityTier,
        output_contract: {
          output_file: relativeToPackage(packageDir, outputPath),
          width: size.width,
          height: size.height,
          aspect_ratio: "1:1"
        },
        prompt_contract: {
          prompt_text: buildVariantPrompt(pkg, character, variant),
          negative_prompt_text: [
            "speech bubble",
            "headline text",
            "title text",
            "border frame",
            "poster layout",
            "background character",
            "extra face",
            "crowd",
            "logo",
            "watermark",
            "fake label",
            "trading card",
            "comic cover"
          ].join(", ")
            + ", photoreal human, real child, realistic skin pores, realistic eyelashes, human portrait photography, multiple heads, realistic hand"
        },
        references: [],
        source_policy: "Cleaned story character refs intended to become the direct shot-conditioning source."
      };
      if (anchorCrop) {
        request.references.push({
          type: "anchor_crop",
          file: anchorCrop.relativeFile,
          label: anchorCrop.label,
          anchor_id: anchorCrop.anchor_id
        });
      }

      const requestPath = path.join(requestRoot, `${characterSlug}_${variant}.json`);
      writeJson(requestPath, request);

      const referenceImagePaths = variant === "master"
        ? (anchorCrop ? [anchorCrop.filePath] : [])
        : (!masterPath || !fs.existsSync(masterPath) ? [] : [masterPath]);
      const result = await renderVariant({
        request,
        outputPath,
        referenceImagePaths,
        visualConfig
      });
      providerUsed = result.provider;
      if (variant === "master") {
        masterPath = outputPath;
      }

      const execution = buildExecutionResult({
        request_id: request.request_id,
        provider: result.provider,
        workflow_template_id: result.workflowTemplate.workflow_id,
        quality_tier: request.quality_tier,
        output_contract: request.output_contract,
        pass_plan: result.workflowTemplate.pass_plan
      }, {
        status: "completed",
        promptId: result.providerResult?.promptId || null,
        passResults: result.providerResult?.passResults,
        metrics: result.providerResult?.metrics
      });

      const reportPath = path.join(reportRoot, `${characterSlug}_${variant}.json`);
      writeJson(reportPath, {
        request,
        result: execution
      });
      variantResults.push({
        variant,
        output_file: relativeToPackage(packageDir, outputPath),
        request_file: relativeToPackage(packageDir, requestPath),
        report_file: relativeToPackage(packageDir, reportPath)
      });
    }

    const indexPath = path.join(characterDir, "index.json");
    const index = {
      character_id: character.id,
      character_name: character.name,
      role_class: character.role_class,
      created_at: new Date().toISOString(),
      provider: providerUsed,
      master_reference: relativeToPackage(packageDir, variants.master),
      anchor_crop: anchorCrop ? anchorCrop.relativeFile : null,
      preferred_shot_refs: {
        closeup_face: relativeToPackage(packageDir, variants.talking),
        dialogue_single: relativeToPackage(packageDir, variants.talking),
        dialogue_reaction_closeup: relativeToPackage(packageDir, variants.worried),
        reaction_medium: relativeToPackage(packageDir, variants.worried),
        medium_single: relativeToPackage(packageDir, variants.front),
        default: relativeToPackage(packageDir, variants.master)
      },
      variants: variantResults
    };
    writeJson(indexPath, index);

    summary.characters.push({
      character_id: character.id,
      status: "generated",
      master_reference: index.master_reference,
      variants: variantResults
    });
  }

  const summaryPath = path.join(visualDir, "character_ref_summary.json");
  const summaryMarkdownPath = path.join(visualDir, "character_ref_summary.md");
  writeJson(summaryPath, summary);
  writeText(summaryMarkdownPath, manifestMarkdown(pkg, summary));

  console.log(`Story character refs generated for '${pkg.story_id}'.`);
  console.log(`Summary written to ${summaryPath}`);
  return summary;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  buildStoryCharacterRefs(args).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  buildStoryCharacterRefs
};
