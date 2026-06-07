import * as fs from "node:fs";
import * as path from "node:path";

import { apiReference } from "@scalar/express-api-reference";
import type { Application } from "express";

function findDocsDir(candidateDocsDirs: string[]) {
  return candidateDocsDirs.find((dir) =>
    fs.existsSync(path.join(dir, "openapi.final.yaml")),
  );
}

export function mountApiDocsPreview(
  app: Application,
  candidateDocsDirs: string[],
) {
  const docsDir = findDocsDir(candidateDocsDirs);
  if (!docsDir) return false;

  app.get("/api-docs/openapi.final.yaml", (_req, res) => {
    res.type("application/yaml");
    res.sendFile(path.join(docsDir, "openapi.final.yaml"));
  });

  app.get("/api-docs/asyncapi.final.yaml", (_req, res) => {
    res.type("application/yaml");
    res.sendFile(path.join(docsDir, "asyncapi.final.yaml"));
  });

  const scalarHandler = apiReference({
    spec: {
      url: "/api-docs/openapi.final.yaml",
    },
    theme: "default",
  });

  app.get("/api-docs", scalarHandler);
  app.get("/api-docs/", scalarHandler);

  return true;
}
