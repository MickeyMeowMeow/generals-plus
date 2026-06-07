import { generateApiDocsArtifacts } from "#/scripts/lib/api-docs";

async function main() {
  generateApiDocsArtifacts();
  console.log("API docs generation complete.");
}

main().catch((error) => {
  console.error("Generation failed:", error);
  process.exit(1);
});
