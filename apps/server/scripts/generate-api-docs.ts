import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import { generateOpenApiSpec } from "../src/contracts/rest/index";
import { generateAsyncApiSpec } from "../src/contracts/ws/index";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(SCRIPT_DIR, "..");
const DOCS_DIR = path.resolve(SCRIPT_DIR, "../../../docs/api");
const DIST_DIR = path.join(DOCS_DIR, "dist");

type AsyncApiTranslationMap = {
  channels?: Record<
    string,
    {
      description?: string;
      publishSummary?: string;
      subscribeSummary?: string;
    }
  >;
  messages?: Record<
    string,
    {
      title?: string;
    }
  >;
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeYaml(filePath: string, data: unknown) {
  const content = yaml.dump(data, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`Written: ${filePath}`);
}

function loadYaml<T>(filePath: string): T {
  return yaml.load(fs.readFileSync(filePath, "utf8")) as T;
}

function applyOpenApiOverlay(
  inputPath: string,
  overlayPath: string,
  outputPath: string,
) {
  if (!fs.existsSync(overlayPath)) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  const merged = execFileSync(
    "pnpm",
    ["exec", "overlayjs", "--openapi", inputPath, "--overlay", overlayPath],
    {
      cwd: SERVER_DIR,
      encoding: "utf8",
    },
  );
  fs.writeFileSync(outputPath, merged, "utf8");
}

function applyAsyncApiTranslations(
  inputPath: string,
  translationPath: string,
  outputPath: string,
) {
  const spec = loadYaml<Record<string, any>>(inputPath);

  if (!fs.existsSync(translationPath)) {
    writeYaml(outputPath, spec);
    return;
  }

  const translations = loadYaml<AsyncApiTranslationMap>(translationPath);

  for (const [channelName, translation] of Object.entries(
    translations.channels ?? {},
  )) {
    const channel = spec.channels?.[channelName];
    if (!channel) continue;

    if (translation.description) channel.description = translation.description;
    if (translation.publishSummary && channel.publish) {
      channel.publish.summary = translation.publishSummary;
    }
    if (translation.subscribeSummary && channel.subscribe) {
      channel.subscribe.summary = translation.subscribeSummary;
    }
  }

  for (const [messageName, translation] of Object.entries(
    translations.messages ?? {},
  )) {
    const message = spec.components?.messages?.[messageName];
    if (!message) continue;

    if (translation.title) {
      message.title = translation.title;
    }
  }

  writeYaml(outputPath, spec);
}

async function main() {
  ensureDir(DOCS_DIR);
  ensureDir(DIST_DIR);

  const openApiGeneratedPath = path.join(DIST_DIR, "openapi.generated.yaml");
  const asyncApiGeneratedPath = path.join(DIST_DIR, "asyncapi.generated.yaml");
  const openApiFinalPath = path.join(DIST_DIR, "openapi.final.yaml");
  const asyncApiFinalPath = path.join(DIST_DIR, "asyncapi.final.yaml");
  const openApiOverlayPath = path.join(DOCS_DIR, "openapi.zh-CN.yaml");
  const asyncApiTranslationPath = path.join(DOCS_DIR, "asyncapi.zh-CN.yaml");

  writeYaml(openApiGeneratedPath, generateOpenApiSpec());
  writeYaml(asyncApiGeneratedPath, generateAsyncApiSpec());
  applyOpenApiOverlay(
    openApiGeneratedPath,
    openApiOverlayPath,
    openApiFinalPath,
  );
  applyAsyncApiTranslations(
    asyncApiGeneratedPath,
    asyncApiTranslationPath,
    asyncApiFinalPath,
  );

  console.log("API docs generation complete.");
}

main().catch((error) => {
  console.error("Generation failed:", error);
  process.exit(1);
});
