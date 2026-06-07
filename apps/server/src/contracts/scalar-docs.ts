import { renderApiReference } from "@scalar/client-side-rendering";

function joinDocPath(basePath: string, filename: string) {
  if (basePath === ".") {
    return filename;
  }

  return `${basePath.replace(/\/+$/, "")}/${filename}`;
}

export function createScalarApiReferenceConfiguration(basePath: string) {
  return {
    sources: [
      {
        title: "REST API",
        slug: "rest-api",
        url: joinDocPath(basePath, "openapi.final.yaml"),
        default: true,
      },
      {
        title: "Realtime API",
        slug: "realtime-api",
        url: joinDocPath(basePath, "asyncapi.final.yaml"),
      },
    ],
    theme: "default" as const,
    documentDownloadType: "direct" as const,
    agent: {
      disabled: true,
    },
  };
}

export function renderScalarOfflineDocsHtml(input: {
  openApiContent: string;
  asyncApiContent: string;
}) {
  return renderApiReference({
    pageTitle: "Generals Plus API Docs",
    config: {
      sources: [
        {
          title: "REST API",
          slug: "rest-api",
          content: input.openApiContent,
          default: true,
        },
        {
          title: "Realtime API",
          slug: "realtime-api",
          content: input.asyncApiContent,
        },
      ],
      theme: "default",
      documentDownloadType: "yaml",
      agent: {
        disabled: true,
      },
    },
  });
}
