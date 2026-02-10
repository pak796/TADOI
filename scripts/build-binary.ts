import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

type Target = "macos" | "windows";
type Format = "raw" | "installer";

function parseArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function asTarget(value: string | null): Target {
  if (value === "macos" || value === "windows") return value;
  console.error(`[build-binary] invalid --target. expected macos|windows, got: ${value ?? "<missing>"}`);
  process.exit(1);
}

function asFormat(value: string | null): Format {
  if (value === "raw" || value === "installer") return value;
  console.error(`[build-binary] invalid --format. expected raw|installer, got: ${value ?? "<missing>"}`);
  process.exit(1);
}

function writePlanFile(filePath: string, contents: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

function main(): void {
  const target = asTarget(parseArg("--target"));
  const format = asFormat(parseArg("--format"));
  const timestamp = new Date().toISOString();

  if (format === "raw") {
    const filePath = path.resolve("dist", "bin", target, "BUILD_PLAN.txt");
    writePlanFile(
      filePath,
      [
        "TADOI binary scaffold output",
        `Target: ${target}`,
        "Format: raw",
        `Generated: ${timestamp}`,
        "",
        "This is a scaffold-only artifact.",
        "No native binary is produced in this phase.",
        "Future phase will replace this plan with real build outputs."
      ].join("\n")
    );
    console.log(`[build-binary] scaffold written: ${filePath}`);
    return;
  }

  const filePath = path.resolve("dist", "installers", `${target.toUpperCase()}_INSTALLER_PLAN.txt`);
  writePlanFile(
    filePath,
    [
      "TADOI installer scaffold output",
      `Target: ${target}`,
      "Format: installer",
      `Generated: ${timestamp}`,
      "",
      "Installer generation is intentionally not implemented in this phase.",
      "Planned outputs:",
      target === "macos" ? "- .dmg" : "- .exe/.msi",
      "",
      "See packaging docs for signing/notarization prerequisites."
    ].join("\n")
  );
  console.log(`[build-binary] installer scaffold written: ${filePath}`);
}

main();
