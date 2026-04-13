import { promises as fs } from "fs";
import path from "path";
import {
  PRIVATE_DIR_MODE,
  PRIVATE_FILE_MODE,
  type CalendarImportReport,
} from "./shared";

export async function maybeWriteReport(
  reportPath: string | undefined,
  report: CalendarImportReport,
  cwd: string,
): Promise<string | undefined> {
  if (!reportPath) return undefined;
  const resolved = path.isAbsolute(reportPath)
    ? path.normalize(reportPath)
    : path.resolve(cwd, reportPath);
  await fs.mkdir(path.dirname(resolved), {
    recursive: true,
    mode: PRIVATE_DIR_MODE,
  });
  await fs.writeFile(resolved, JSON.stringify(report, null, 2), {
    encoding: "utf8",
    mode: PRIVATE_FILE_MODE,
  });
  return resolved;
}
