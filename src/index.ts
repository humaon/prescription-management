import { startServer } from "./server";

startServer().catch((err) => {
  console.error("❌ Application failed to start:", err);
  process.exit(1);
});
