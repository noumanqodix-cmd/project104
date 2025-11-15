import { spawn, type ChildProcess } from "child_process";

let drizzleProcess: ChildProcess | null = null;

/**
 * Starts Drizzle Studio without authentication
 * WARNING: This exposes your database publicly without any protection!
 */
export function startDrizzleStudio(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🎨 [DRIZZLE] Starting Drizzle Studio (PUBLIC - NO AUTH)...");
    console.warn("⚠️  [DRIZZLE] WARNING: Database is exposed without authentication!");

    drizzleProcess = spawn(
      "npx",
      [
        "drizzle-kit", 
        "studio", 
        "--host", "0.0.0.0",  // Listen on all network interfaces
        "--port", "4983"
      ],
      {
        stdio: "pipe",
        shell: true,
      }
    );

    drizzleProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Drizzle Studio is up and running")) {
        console.log("✅ [DRIZZLE] Studio is ready on http://0.0.0.0:4983");
        console.log("🌍 [DRIZZLE] Accessible from any IP address");
        resolve();
      }
      // Log other output
      output.split("\n").forEach((line: string) => {
        if (line.trim()) console.log(`📊 [DRIZZLE] ${line.trim()}`);
      });
    });

    drizzleProcess.stderr?.on("data", (data) => {
      const errorMsg = data.toString();
      console.error(`❌ [DRIZZLE] Error: ${errorMsg}`);
    });

    drizzleProcess.on("error", (error) => {
      console.error(`❌ [DRIZZLE] Failed to start: ${error.message}`);
      reject(error);
    });

    drizzleProcess.on("close", (code) => {
      console.log(`🔴 [DRIZZLE] Process exited with code ${code}`);
      drizzleProcess = null;
    });

    // Resolve after timeout if ready message not received
    setTimeout(() => {
      console.log("⏱️  [DRIZZLE] Startup timeout reached, assuming ready");
      resolve();
    }, 8000);
  });
}

/**
 * Stops the Drizzle Studio process
 */
export function stopDrizzleStudio(): void {
  if (drizzleProcess) {
    console.log("🛑 [DRIZZLE] Stopping Drizzle Studio...");
    drizzleProcess.kill("SIGTERM");
    drizzleProcess = null;
  }
}

/**
 * Checks if Drizzle Studio is currently running
 */
export function isDrizzleRunning(): boolean {
  return drizzleProcess !== null && !drizzleProcess.killed;
}

/**
 * Restarts Drizzle Studio
 */
export async function restartDrizzleStudio(): Promise<void> {
  console.log("🔄 [DRIZZLE] Restarting Drizzle Studio...");
  stopDrizzleStudio();
  
  // Wait a bit before restarting
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return startDrizzleStudio();
}

// Cleanup handlers
function cleanup() {
  console.log("\n🧹 [DRIZZLE] Cleaning up...");
  stopDrizzleStudio();
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
process.on("uncaughtException", (error) => {
  console.error("❌ [DRIZZLE] Uncaught exception:", error);
  cleanup();
  process.exit(1);
});