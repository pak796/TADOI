import { runCli } from "./cli";

const exitCode = await runCli(process.argv.slice(2));
if (typeof exitCode === "number" && exitCode !== 0) {
  process.exitCode = exitCode;
}
