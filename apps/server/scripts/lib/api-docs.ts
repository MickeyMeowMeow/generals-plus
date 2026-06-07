import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import { generateOpenApiSpec } from "#/contracts/rest/index";
import { renderScalarOfflineDocsHtml } from "#/contracts/scalar-docs";
import { generateAsyncApiSpec } from "#/contracts/ws/index";

const SCRIPT_LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.dirname(SCRIPT_LIB_DIR);
const SERVER_DIR = path.dirname(SCRIPTS_DIR);
const APPS_DIR = path.dirname(SERVER_DIR);
const PROJECT_DIR = path.dirname(APPS_DIR);

export const DOCS_DIR = path.join(PROJECT_DIR, "docs/api");
export const DIST_DIR = path.join(DOCS_DIR, "dist");
export const OFFLINE_DIR = path.join(DOCS_DIR, "offline");
export const OPENAPI_GENERATED_PATH = path.join(
  DIST_DIR,
  "openapi.generated.yaml",
);
export const ASYNCAPI_GENERATED_PATH = path.join(
  DIST_DIR,
  "asyncapi.generated.yaml",
);
export const OPENAPI_FINAL_PATH = path.join(DIST_DIR, "openapi.final.yaml");
export const ASYNCAPI_FINAL_PATH = path.join(DIST_DIR, "asyncapi.final.yaml");
export const OPENAPI_OVERLAY_PATH = path.join(DOCS_DIR, "openapi.zh-CN.yaml");
export const ASYNCAPI_TRANSLATION_PATH = path.join(
  DOCS_DIR,
  "asyncapi.zh-CN.yaml",
);

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
  const spec = loadYaml<Record<string, unknown>>(inputPath) as Record<
    string,
    any
  >;

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

export function generateApiDocsArtifacts() {
  ensureDir(DOCS_DIR);
  ensureDir(DIST_DIR);

  writeYaml(OPENAPI_GENERATED_PATH, generateOpenApiSpec());
  writeYaml(ASYNCAPI_GENERATED_PATH, generateAsyncApiSpec());
  applyOpenApiOverlay(
    OPENAPI_GENERATED_PATH,
    OPENAPI_OVERLAY_PATH,
    OPENAPI_FINAL_PATH,
  );
  applyAsyncApiTranslations(
    ASYNCAPI_GENERATED_PATH,
    ASYNCAPI_TRANSLATION_PATH,
    ASYNCAPI_FINAL_PATH,
  );
}

export function exportOfflineApiDocs() {
  generateApiDocsArtifacts();
  ensureDir(OFFLINE_DIR);

  const openApiContent = fs.readFileSync(OPENAPI_FINAL_PATH, "utf8");
  const asyncApiContent = fs.readFileSync(ASYNCAPI_FINAL_PATH, "utf8");

  fs.writeFileSync(
    path.join(OFFLINE_DIR, "index.html"),
    renderScalarOfflineDocsHtml({
      openApiContent,
      asyncApiContent,
    }),
    "utf8",
  );
  fs.copyFileSync(
    OPENAPI_FINAL_PATH,
    path.join(OFFLINE_DIR, "openapi.final.yaml"),
  );
  fs.copyFileSync(
    ASYNCAPI_FINAL_PATH,
    path.join(OFFLINE_DIR, "asyncapi.final.yaml"),
  );

  console.log(`Written: ${path.join(OFFLINE_DIR, "index.html")}`);
  console.log("Offline API docs export complete.");
}
