// Pre-merge hook for Claude Code
// Runs `npm test` in web/ before any `git merge` that targets main
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(data);
  const cmd = input.tool_input?.command || "";

  // Only intercept git merge commands that target main
  if (!/git merge/.test(cmd)) {
    process.exit(0);
  }
  if (!/\bmain\b/.test(cmd)) {
    process.exit(0);
  }

  console.error("Running npm test before merge to main...");

  try {
    execSync("npm test", { cwd: rootDir, stdio: "inherit" });
  } catch {
    console.log(
      JSON.stringify({
        decision: "block",
        reason: "Tests failed — merge to main blocked. Fix failing tests first.",
      })
    );
    process.exit(0);
  }

  // Tests passed
  process.exit(0);
});
