import { setupFileSystem } from "./filesystem";
import { cleanupTempFiles } from "./cleanup";

export async function runStartupTasks() {
  console.log("🚀 Running startup tasks...");

  // Critical tasks (throw = crash)
  await setupFileSystem();

  // Non-critical tasks (best-effort)
  await cleanupTempFiles();

  console.log("✅ Startup tasks completed");
}
