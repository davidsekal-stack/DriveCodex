// Pre-push hook for Claude Code
// Runs ESLint + Vite build before any "git push" command
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(__dirname, "..", "web");

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(data);
  const cmd = input.tool_input?.command || "";

  // Only intercept git push commands
  if (!/^git push/.test(cmd.trim())) {
    process.exit(0);
  }

  try {
    execSync("npx eslint src --max-warnings=30 --quiet", {
      cwd: webDir,
      stdio: "pipe",
    });
  } catch (e) {
    const out = e.stdout?.toString() || e.message;
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `ESLint failed — push blocked.\n${out.slice(0, 500)}`,
      })
    );
    process.exit(0);
  }

  try {
    execSync("npx vite build", { cwd: webDir, stdio: "pipe" });
  } catch (e) {
    const out = e.stdout?.toString() || e.message;
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `Build failed — push blocked.\n${out.slice(0, 500)}`,
      })
    );
    process.exit(0);
  }

  // All checks passed
  process.exit(0);
});
