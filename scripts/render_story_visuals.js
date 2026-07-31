const fs = require("fs");
const path = require("path");
const {
  buildExecutionResult,
  loadVisualGenerationConfig,
  resolveWorkflowTemplate
} = require("../src/bricktoon/workflowContracts");
const { withImageProvider } = require("../src/bricktoon/providers");
const { validateGeneratedAsset } = require("../src/bricktoon/validateGeneratedAsset");
const { LAB_ROOT, REPO_ROOT, ensureDir, parseArgs, readJson, writeJson, writeText } = require("./lib");

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

function parseMicroSceneIds(value) {
  if (!value) {
    return null;
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSceneIds(value) {
  if (!value) {
    return null;
  }
  return new Set(
    String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function loadRequests(visualDir) {
  const requestsDir = path.join(visualDir, "image_requests");
  if (!fs.existsSync(requestsDir)) {
    throw new Error(`Visual request directory not found: ${requestsDir}`);
  }
  return fs.readdirSync(requestsDir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort(naturalSort)
    .map((name) => {
      const filePath = path.join(requestsDir, name);
      return {
        filePath,
        request: readJson(filePath)
      };
    });
}

function referencePathsForRequest(request) {
  return (request.references || [])
    .map((ref) => ref.file ? path.join(REPO_ROOT, ref.file) : null)
    .filter((filePath) => filePath && fs.existsSync(filePath));
}

function renderPromptForRequest(request) {
  return {
    prompt_text: request.prompt_contract?.prompt_text || "",
    negative_prompt_text: request.prompt_contract?.negative_prompt_text || ""
  };
}

function resolveStoryRenderTimeoutMs(visualConfig, request, options = {}) {
  const requested = Number(options.timeoutMs || options.timeout || 0);
  if (Number.isFinite(requested) && requested > 0) {
    return requested;
  }

  const baseTimeout = Number(
    process.env.COMFYUI_TIMEOUT_MS_STORY
    || process.env.COMFYUI_TIMEOUT_MS
    || visualConfig.comfyui?.timeout_ms
    || 240000
  );
  const qualityTier = String(request.quality_tier || "standard").toLowerCase();
  const shotClass = String(request.shot_class || "").toLowerCase();

  if (qualityTier === "hero" || shotClass.includes("closeup")) {
    return Math.max(baseTimeout, 420000);
  }
  if (qualityTier === "standard") {
    return Math.max(baseTimeout, 300000);
  }
  return baseTimeout;
}

function buildStoryProviderConfig(visualConfig, request, options = {}) {
  const timeoutMs = resolveStoryRenderTimeoutMs(visualConfig, request, options);
  return {
    ...visualConfig,
    comfyui: {
      ...(visualConfig.comfyui || {}),
      timeout_ms: timeoutMs
    }
  };
}

async function renderRequest(request, outputPath, visualConfig, options = {}) {
  const providerName = process.env.BRICKTOON_IMAGE_PROVIDER || visualConfig.default_image_provider || "comfyui";
  const workflowTemplate = resolveWorkflowTemplate(visualConfig, "shot_keyframe", {
    workflowId: request.workflow_template_id,
    qualityTier: request.quality_tier,
    providerName,
    shotClass: request.shot_class
  });
  const prompt = renderPromptForRequest(request);
  if (options.promptSuffix) {
    prompt.prompt_text = `${prompt.prompt_text} ${String(options.promptSuffix)}`;
  }
  const referencePaths = referencePathsForRequest(request);
  const storyProviderConfig = buildStoryProviderConfig(visualConfig, request, options);

  const run = await withImageProvider(`story visual ${request.micro_scene_id}`, async (provider, activeProviderName, providerConfig) => {
    const providerResult = await provider.renderShotKeyframe({
      prompt,
      outputPath,
      width: request.output_contract?.width || 1920,
      height: request.output_contract?.height || 1080,
      qualityTier: request.quality_tier || "standard",
      shotId: request.micro_scene_id,
      referenceImagePaths: referencePaths,
      workflowRequest: {
        ...request,
        workflow_template: workflowTemplate
      },
      providerConfig: {
        ...storyProviderConfig,
        workflowTemplate,
        referenceImagePaths: referencePaths,
        shotType: request.shot_class,
        referenceDenoise: Number(
          options.referenceDenoise
          || (request.quality_tier === "hero" ? 0.65 : 0.55)
        )
      }
    });
    return {
      providerName: activeProviderName,
      providerResult
    };
  });

  const validation = validateGeneratedAsset(outputPath, {
    width: request.output_contract?.width || 1920,
    height: request.output_contract?.height || 1080
  });
  if (!validation.valid) {
    throw new Error(`Rendered frame validation failed for ${request.micro_scene_id}: ${validation.reason}`);
  }

  return {
    provider: run.providerName,
    providerResult: run.providerResult,
    workflowTemplate
  };
}

function renderSummaryMarkdown(summary) {
  const lines = [
    `# ${summary.story_id} Visual Render Summary`,
    "",
    `- Provider requested: ${summary.provider_requested}`,
    `- Rendered frames: ${summary.rendered_count}`,
    `- Skipped existing: ${summary.skipped_count}`,
    `- Failed: ${summary.failed_count}`,
    "",
    "## Frames",
    ""
  ];

  for (const item of summary.frames) {
    lines.push(`- ${item.micro_scene_id}: ${item.status} / ${item.provider || "n/a"} / ${item.output_file}`);
  }

  return `${lines.join("\n")}\n`;
}

function persistSummary(visualDir, summary, suffix = "") {
  const summaryName = suffix ? `render_summary.${suffix}.json` : "render_summary.json";
  const markdownName = suffix ? `render_summary.${suffix}.md` : "render_summary.md";
  const summaryPath = path.join(visualDir, summaryName);
  const summaryMarkdownPath = path.join(visualDir, markdownName);
  writeJson(summaryPath, summary);
  writeText(summaryMarkdownPath, renderSummaryMarkdown(summary));
  return {
    summaryPath,
    summaryMarkdownPath
  };
}

function selectionSuffix(sceneIds, microSceneIds) {
  if (sceneIds && sceneIds.size > 0) {
    return `scenes_${[...sceneIds].map((item) => item.toLowerCase()).join("_")}`;
  }
  if (microSceneIds && microSceneIds.length > 0) {
    return `micro_${microSceneIds.map((item) => item.toLowerCase()).join("_")}`;
  }
  return "";
}

async function renderStoryVisuals(options = {}) {
  if (options.provider) {
    process.env.BRICKTOON_IMAGE_PROVIDER = String(options.provider);
  }

  const packagePath = resolvePackagePath(options);
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Story package not found: ${packagePath}`);
  }

  const pkg = readJson(packagePath);
  const packageDir = path.dirname(packagePath);
  const visualDir = path.join(packageDir, "visual_package");
  const framesDir = path.join(visualDir, "generated_frames");
  const reportsDir = path.join(visualDir, "render_reports");
  ensureDir(framesDir);
  ensureDir(reportsDir);

  const selectedIds = parseMicroSceneIds(options.microScenes || options["micro-scenes"]);
  const selectedSceneIds = parseSceneIds(options.scene || options.scenes || options["scene-id"] || options["scene-ids"]);
  const limit = Number(options.limit || 0);
  const requests = loadRequests(visualDir)
    .filter((item) => !selectedIds || selectedIds.includes(item.request.micro_scene_id))
    .filter((item) => !selectedSceneIds || selectedSceneIds.has(item.request.scene_id))
    .slice(0, limit > 0 ? limit : undefined);

  if (requests.length === 0) {
    throw new Error("No visual requests matched the current filter.");
  }

  const visualConfig = loadVisualGenerationConfig();
  const summary = {
    story_id: pkg.story_id,
    created_at: new Date().toISOString(),
    scene_filter: selectedSceneIds ? [...selectedSceneIds] : null,
    micro_scene_filter: selectedIds || null,
    provider_requested: process.env.BRICKTOON_IMAGE_PROVIDER || visualConfig.default_image_provider || "comfyui",
    rendered_count: 0,
    skipped_count: 0,
    failed_count: 0,
    frames: []
  };
  const suffix = selectionSuffix(selectedSceneIds, selectedIds);

  for (const item of requests) {
    const request = item.request;
    const variantSuffix = options.variantLabel ? `_${slugify(options.variantLabel)}` : "";
    const outputPath = path.join(framesDir, `${request.micro_scene_id}${variantSuffix}.png`);
    const reportPath = path.join(reportsDir, `${request.micro_scene_id}${variantSuffix}.json`);

    if (!options.force && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      summary.skipped_count += 1;
      summary.frames.push({
        micro_scene_id: request.micro_scene_id,
        status: "skipped_existing",
        output_file: path.relative(packageDir, outputPath).replaceAll("\\", "/")
      });
      persistSummary(visualDir, summary, suffix);
      continue;
    }

    try {
      const result = await renderRequest(request, outputPath, visualConfig, options);
      const execution = buildExecutionResult({
        request_id: request.request_id,
        provider: result.provider,
        workflow_template_id: request.workflow_template_id,
        quality_tier: request.quality_tier,
        output_contract: {
          output_file: path.relative(packageDir, outputPath).replaceAll("\\", "/")
        },
        pass_plan: result.workflowTemplate.pass_plan
      }, {
        status: "completed",
        promptId: result.providerResult?.promptId || null,
        passResults: result.providerResult?.passResults,
        metrics: result.providerResult?.metrics
      });
      writeJson(reportPath, {
        request,
        result: execution
      });
      summary.rendered_count += 1;
      summary.frames.push({
        micro_scene_id: request.micro_scene_id,
        status: "rendered",
        provider: result.provider,
        workflow_template_id: request.workflow_template_id,
        output_file: path.relative(packageDir, outputPath).replaceAll("\\", "/"),
        report_file: path.relative(packageDir, reportPath).replaceAll("\\", "/")
      });
      persistSummary(visualDir, summary, suffix);
    } catch (error) {
      summary.failed_count += 1;
      summary.frames.push({
        micro_scene_id: request.micro_scene_id,
        status: "failed",
        error: error.message,
        output_file: path.relative(packageDir, outputPath).replaceAll("\\", "/")
      });
      writeJson(reportPath, {
        request,
        error: error.message,
        failed_at: new Date().toISOString()
      });
      persistSummary(visualDir, summary, suffix);
      if (options.stopOnError) {
        throw error;
      }
    }
  }

  const { summaryPath } = persistSummary(visualDir, summary, suffix);

  console.log(`Story visual render completed for '${pkg.story_id}'.`);
  console.log(`Rendered: ${summary.rendered_count}; skipped: ${summary.skipped_count}; failed: ${summary.failed_count}.`);
  console.log(`Summary written to ${summaryPath}`);
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await renderStoryVisuals(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  renderStoryVisuals
};
