import { spawn } from "child_process";

console.log("🎨 ========================================");
console.log("🎨 Starting Standalone Drizzle Studio");
console.log("🎨 ========================================\n");

const drizzle = spawn(
  "npx",
  [
    "drizzle-kit", 
    "studio", 
    "--host", "0.0.0.0",
    "--port", "4983"
  ],
  {
    stdio: "inherit",
    shell: true,
  }
);

drizzle.on("error", (error) => {
  console.error("❌ Failed to start Drizzle Studio:", error);
  process.exit(1);
});

drizzle.on("close", (code) => {
  console.log(`🔴 Drizzle Studio exited with code ${code}`);
  process.exit(code || 0);
});

console.log("✅ Drizzle Studio process started");
console.log("📍 Access at: http://31.97.140.2:4983\n");