const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadVisualGenerationConfig } = require("./workflowContracts");
const {
  downloadAsset,
  queuePrompt,
  uniqueAssetList,
  uploadInputImage,
  waitForOutputs,
  resolveFfmpegPath
} = require("../../scripts/lib");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createPlaceholderImage(outputPath, width, height, label) {
  ensureDir(path.dirname(outputPath));
  const filter = [
    `color=c=0xD9E6F2:s=${width}x${height}`,
    `drawbox=x=20:y=20:w=${Math.max(120, width - 40)}:h=${Math.max(120, height - 40)}:color=0x2D4F6C:t=8`,
    `drawtext=text='${String(label || "preview").replace(/[:'\\]/g, "")}':fontcolor=0x2D4F6C:fontsize=${Math.max(24, Math.round(width / 24))}:x=(w-text_w)/2:y=(h-text_h)/2`
  ].join(",");
  const result = spawnSync(resolveFfmpegPath(), [
    "-y",
    "-f",
    "lavfi",
    "-i",
    filter,
    "-frames:v",
    "1",
    outputPath
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed to create placeholder image at ${outputPath}`);
  }
}

function numericEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function safeDimension(value, fallback) {
  const numeric = Number(value || fallback);
  return Math.max(64, Math.round(numeric / 8) * 8);
}

function seedFor(text) {
  const digest = crypto.createHash("sha256").update(String(text || "bricktoon")).digest();
  return digest.readUInt32BE(0);
}

function buildComfyStillWorkflow(options = {}) {
  const checkpoint = process.env.COMFYUI_CHECKPOINT || "realisticVisionV60B1_v51HyperVAE.safetensors";
  const isHyperCheckpoint = /hyper/i.test(checkpoint);
  const width = safeDimension(options.width, 1024);
  const height = safeDimension(options.height, 1024);
  const positiveText = String(options.prompt?.prompt_text || "");
  const negativeText = [
    String(options.prompt?.negative_prompt_text || ""),
    String(process.env.COMFYUI_NEGATIVE_PROMPT || "")
  ].filter(Boolean).join(", ");
  const singleCharacterScene = options.kind === "shot_keyframe"
    && Array.isArray(options.workflowRequest?.visible_characters)
    && options.workflowRequest.visible_characters.length === 1;
  const useImageLatent = options.kind === "character_reference" || singleCharacterScene;
  const defaultReferenceWeight = useImageLatent ? 0.45 : 0.72;
  const workflow = {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: checkpoint }
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { text: positiveText, clip: ["1", 1] }
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativeText, clip: ["1", 1] }
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 }
    }
  };

  let nextNodeId = 5;
  let modelLink = ["1", 0];
  let latentLink = ["4", 0];
  let firstImageLink = null;
  const uploadedImages = options.uploadedImages || [];
  if (uploadedImages.length > 0) {
    const loaderId = String(nextNodeId++);
    workflow[loaderId] = {
      class_type: "IPAdapterUnifiedLoader",
      inputs: {
        model: modelLink,
        preset: "PLUS (high strength)"
      }
    };
    modelLink = [loaderId, 0];

    for (const imageName of uploadedImages.slice(0, 2)) {
      const imageId = String(nextNodeId++);
      const adapterId = String(nextNodeId++);
      workflow[imageId] = {
        class_type: "LoadImage",
        inputs: { image: imageName }
      };
      if (!firstImageLink) {
        firstImageLink = [imageId, 0];
      }
      workflow[adapterId] = {
        class_type: "IPAdapterAdvanced",
        inputs: {
          model: modelLink,
          ipadapter: [loaderId, 1],
          image: [imageId, 0],
          weight: numericEnv("COMFYUI_IPADAPTER_WEIGHT", defaultReferenceWeight),
          weight_type: "linear",
          combine_embeds: "average",
          start_at: 0,
          end_at: 0.85,
          embeds_scaling: "V only"
        }
      };
      modelLink = [adapterId, 0];
    }
  }

  if (useImageLatent && firstImageLink) {
    let encodePixels = firstImageLink;
    if (singleCharacterScene) {
      const scaleId = String(nextNodeId++);
      workflow[scaleId] = {
        class_type: "ImageScale",
        inputs: {
          image: firstImageLink,
          upscale_method: "lanczos",
          width,
          height,
          crop: "center"
        }
      };
      encodePixels = [scaleId, 0];
    }
    const encodeId = String(nextNodeId++);
    workflow[encodeId] = {
      class_type: "VAEEncode",
      inputs: {
        pixels: encodePixels,
        vae: ["1", 2]
      }
    };
    latentLink = [encodeId, 0];
  }

  const samplerId = String(nextNodeId++);
  const decodeId = String(nextNodeId++);
  const saveId = String(nextNodeId++);
  workflow[samplerId] = {
    class_type: "KSampler",
    inputs: {
      model: modelLink,
      seed: options.seed == null ? seedFor(positiveText) : Number(options.seed),
      steps: numericEnv("COMFYUI_STILL_STEPS", isHyperCheckpoint ? 6 : 24),
      cfg: numericEnv("COMFYUI_STILL_CFG", isHyperCheckpoint ? 2 : 6.5),
      sampler_name: process.env.COMFYUI_STILL_SAMPLER || process.env.COMFYUI_SAMPLER || "dpmpp_sde",
      scheduler: process.env.COMFYUI_STILL_SCHEDULER || process.env.COMFYUI_SCHEDULER || "karras",
      positive: ["2", 0],
      negative: ["3", 0],
      latent_image: latentLink,
      denoise: useImageLatent && firstImageLink
        ? Number(options.providerConfig?.referenceDenoise || (options.variant === "master" ? 0.45 : 0.35))
        : 1
    }
  };
  workflow[decodeId] = {
    class_type: "VAEDecode",
    inputs: { samples: [samplerId, 0], vae: ["1", 2] }
  };
  workflow[saveId] = {
    class_type: "SaveImage",
    inputs: {
      images: [decodeId, 0],
      filename_prefix: `bricktoon/${String(options.label || "still").replace(/[^a-z0-9_-]+/gi, "_")}`
    }
  };
  return workflow;
}

async function renderComfyStill(options) {
  const comfyConfig = options.providerConfig?.comfyui || options.providerConfig || {};
  const baseUrl = comfyConfig.base_url || process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
  const timeoutMs = Number(comfyConfig.timeout_ms || process.env.COMFYUI_TIMEOUT_MS || 420000);
  const pollIntervalMs = Number(comfyConfig.poll_interval_ms || process.env.COMFYUI_POLL_INTERVAL_MS || 2000);
  const referencePaths = (options.referenceImagePaths || [])
    .filter((filePath) => filePath && fs.existsSync(filePath))
    .slice(0, 2);
  const uploadedImages = [];
  for (const referencePath of referencePaths) {
    uploadedImages.push(await uploadInputImage(baseUrl, referencePath));
  }
  const workflow = buildComfyStillWorkflow({
    ...options,
    uploadedImages,
    kind: options.kind
  });
  const queued = await queuePrompt(baseUrl, workflow);
  const completed = await waitForOutputs(baseUrl, queued.promptId, timeoutMs, pollIntervalMs);
  const assets = uniqueAssetList(completed.assets || []);
  const imageAsset = assets.find((asset) => /\.(png|jpe?g|webp)$/i.test(asset.filename));
  if (!imageAsset) {
    throw new Error(`ComfyUI prompt ${queued.promptId} produced no still image.`);
  }
  await downloadAsset(baseUrl, imageAsset, options.outputPath);
  return {
    promptId: queued.promptId,
    passResults: [{
      output_file: options.outputPath,
      status: "completed",
      comfyui_asset: imageAsset
    }],
    metrics: {
      fallback: false,
      reference_images_used: referencePaths.length,
      width: safeDimension(options.width, 1024),
      height: safeDimension(options.height, 1024)
    }
  };
}

function buildPlaceholderResult(outputPath) {
  return {
    promptId: `local_${Date.now()}`,
    passResults: [{ output_file: outputPath, status: "completed" }],
    metrics: { fallback: true }
  };
}

function createProvider(providerName, providerConfig) {
  const render = async (kind, options) => {
    if (providerName === "comfyui") {
      return renderComfyStill({
        ...options,
        kind,
        providerConfig: options.providerConfig || providerConfig,
        label: options.shotId || options.variant || kind
      });
    }
    createPlaceholderImage(
      options.outputPath,
      options.width,
      options.height,
      options.shotId || options.variant || kind
    );
    return buildPlaceholderResult(options.outputPath);
  };
  return {
    renderCharacterReference: (options) => render("character_reference", options),
    renderShotKeyframe: (options) => render("shot_keyframe", options),
    providerName,
    providerConfig
  };
}

async function withImageProvider(_label, handler) {
  const config = loadVisualGenerationConfig();
  const providerName = process.env.BRICKTOON_IMAGE_PROVIDER || config.default_image_provider || "comfyui";
  const provider = createProvider(providerName, config);
  return handler(provider, providerName, config);
}

module.exports = {
  buildComfyStillWorkflow,
  withImageProvider
};
