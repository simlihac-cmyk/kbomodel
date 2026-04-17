import { refreshCurrentLiveBundle } from "@/lib/data-sources/kbo/pipeline/refresh-current";

async function main() {
  await refreshCurrentLiveBundle();
  console.log("Published live current-season KBO bundle.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
