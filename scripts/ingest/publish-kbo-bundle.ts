import { buildPublishedKboBundleFromNormalized, writePublishedKboBundle } from "@/lib/repositories/kbo/published-bundle";

async function main() {
  const bundle = await buildPublishedKboBundleFromNormalized();
  await writePublishedKboBundle(bundle);
  console.log("Published ingest-backed KBO app bundle to data/normalized/kbo/app-bundle/latest.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
