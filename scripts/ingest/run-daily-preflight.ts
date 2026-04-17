import { runAutomationMode } from "@/lib/scheduler/kbo/runtime";

async function main() {
  const summary = await runAutomationMode("preflight");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
