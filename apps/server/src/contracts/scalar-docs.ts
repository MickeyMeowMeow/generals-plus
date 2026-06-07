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
        title: "REST 接口",
        slug: "rest-api",
        url: joinDocPath(basePath, "openapi.final.yaml"),
        default: true,
      },
      {
        title: "实时接口",
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
    pageTitle: "Generals Plus 接口文档",
    config: {
      sources: [
        {
          title: "REST 接口",
          slug: "rest-api",
          content: input.openApiContent,
          default: true,
        },
        {
          title: "实时接口",
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
