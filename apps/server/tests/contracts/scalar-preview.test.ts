import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import { mountApiDocsPreview } from "#/contracts/scalar-preview";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createDocsDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scalar-preview-"));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, "openapi.final.yaml"), "openapi: 3.0.0\n");
  fs.writeFileSync(path.join(dir, "asyncapi.final.yaml"), "asyncapi: 2.6.0\n");
  return dir;
}

async function withServer(
  handler: (baseUrl: string) => Promise<void>,
  docsDir = createDocsDir(),
) {
  const app = express();
  mountApiDocsPreview(app, [docsDir]);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Expected TCP server address");
  }

  try {
    await handler(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("mountApiDocsPreview", () => {
  it("serves the OpenAPI YAML instead of the Scalar HTML shell", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api-docs/openapi.final.yaml`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("yaml");
      expect(text).toContain("openapi: 3.0.0");
      expect(text).not.toContain("<!doctype html>");
    });
  });

  it("serves the Scalar UI index at /api-docs", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api-docs`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(text).toContain("Scalar");
      expect(text).toContain("/api-docs/openapi.final.yaml");
    });
  });
});
