import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SESSION_IDS,
  expectedOpenFromEnvironment,
  readJson,
  validateAvailability,
  validateCatalog,
} from "./site-lib.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const catalogPath = path.join(rootDirectory, "docs", "data", "course-catalog.json");
const availabilityPath = path.join(rootDirectory, "docs", "data", "availability.json");

async function main() {
  const desiredOpen = expectedOpenFromEnvironment(process.env);
  const [catalog, current] = await Promise.all([
    readJson(catalogPath),
    readJson(availabilityPath),
  ]);
  const catalogResult = validateCatalog(catalog);
  if (catalogResult.errors.length) {
    throw new Error(`更新前的 course-catalog.json 不合法：\n- ${catalogResult.errors.join("\n- ")}`);
  }

  const availabilityResult = validateAvailability(
    current,
    catalogResult.sessionIds,
  );
  if (availabilityResult.errors.length) {
    throw new Error(
      `更新前的 availability.json 不合法，為避免資料遺失已停止：\n- ${availabilityResult.errors.join("\n- ")}`,
    );
  }

  const changed = SESSION_IDS.some(
    (sessionId) => current.sessions[sessionId].isOpen !== desiredOpen.has(sessionId),
  );

  if (!changed) {
    console.log("六場開放狀態與指定完整清單相同，不修改檔案。");
    printSnapshot(desiredOpen);
    return;
  }

  const next = {
    ...current,
    updatedAt: new Date().toISOString(),
    defaultOpen: false,
    sessions: Object.fromEntries(
      SESSION_IDS.map((sessionId) => [
        sessionId,
        {
          ...current.sessions[sessionId],
          isOpen: desiredOpen.has(sessionId),
        },
      ]),
    ),
  };

  await fs.writeFile(availabilityPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log("已用六個 checkbox 的完整快照更新 docs/data/availability.json。");
  printSnapshot(desiredOpen);
}

function printSnapshot(openIds) {
  for (const sessionId of SESSION_IDS) {
    console.log(`${sessionId}: ${openIds.has(sessionId) ? "OPEN" : "CLOSED"}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
