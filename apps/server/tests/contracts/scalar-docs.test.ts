import { describe, expect, it } from "vitest";

import {
  createScalarApiReferenceConfiguration,
  renderScalarOfflineDocsHtml,
} from "#/contracts/scalar-docs";

describe("Scalar docs configuration", () => {
  it("includes both OpenAPI and AsyncAPI sources in the preview config", () => {
    const config = createScalarApiReferenceConfiguration("/api-docs");

    expect(config.sources).toHaveLength(2);
    expect(config.sources?.[0]?.url).toBe("/api-docs/openapi.final.yaml");
    expect(config.sources?.[1]?.url).toBe("/api-docs/asyncapi.final.yaml");
  });

  it("renders offline html that references local OpenAPI and AsyncAPI files", () => {
    const html = renderScalarOfflineDocsHtml({
      openApiContent: "openapi: 3.0.0",
      asyncApiContent: "asyncapi: 2.6.0",
    });

    expect(html).toContain("openapi: 3.0.0");
    expect(html).toContain("asyncapi: 2.6.0");
    expect(html).toContain("REST 接口");
    expect(html).toContain("实时接口");
  });
});
