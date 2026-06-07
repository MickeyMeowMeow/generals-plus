import { exportOfflineApiDocs } from "#/scripts/lib/api-docs";

async function main() {
  exportOfflineApiDocs();
}

main().catch((error) => {
  console.error("Offline export failed:", error);
  process.exit(1);
});
