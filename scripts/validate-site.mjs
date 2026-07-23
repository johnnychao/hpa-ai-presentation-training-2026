import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SiteValidationError,
  expectedOpenFromEnvironment,
  parseExpectedOpenSpec,
  validateSite,
} from "./site-lib.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");

function parseArguments(argv) {
  let expectedOpen = null;
  let expectationSource = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--expect-open-from-env") {
      if (expectationSource) {
        throw new Error("只能選擇一種開放狀態驗證方式");
      }
      expectedOpen = expectedOpenFromEnvironment(process.env);
      expectationSource = "environment";
    } else if (argument === "--expect-open") {
      if (expectationSource) {
        throw new Error("只能選擇一種開放狀態驗證方式");
      }
      index += 1;
      if (index >= argv.length) {
        throw new Error("--expect-open 後需要逗號分隔的場次；全部關閉請使用空字串");
      }
      expectedOpen = parseExpectedOpenSpec(argv[index]);
      expectationSource = "argument";
    } else if (argument.startsWith("--expect-open=")) {
      if (expectationSource) {
        throw new Error("只能選擇一種開放狀態驗證方式");
      }
      expectedOpen = parseExpectedOpenSpec(argument.slice("--expect-open=".length));
      expectationSource = "argument";
    } else if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`未知參數 ${argument}`);
    }
  }

  return { expectedOpen };
}

function printHelp() {
  console.log(`用法：
  node scripts/validate-site.mjs
  node scripts/validate-site.mjs --expect-open=session-01,session-03
  node scripts/validate-site.mjs --expect-open-from-env

--expect-open 會核對完整開放清單；空字串代表六場全關閉。
--expect-open-from-env 會要求 SESSION_01_OPEN 至 SESSION_06_OPEN 全部存在。`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const report = await validateSite(rootDirectory, options);
  console.log(`✓ 課程結構：${report.cohortCount} 梯、${report.sessionCount} 場`);
  console.log(`✓ 完整教學內容：${report.courseContentCount} 階`);
  console.log("✓ 公開教材私密內容隔離：通過");
  console.log(`✓ 場次內容頁：${report.contentPageCount} 頁`);
  console.log(`✓ 完整開放清單：${report.openIds.join(", ") || "無（全部關閉）"}`);
  console.log(`✓ 公開檔案安全掃描：${report.repositoryFileCount} 個檔案`);
  console.log(`✓ HTML/資產基本可及性：${report.checkedReferences} 個本機連結`);
  console.log("✓ 已取消內容未出現在 docs 公開內容");
}

main().catch((error) => {
  if (error instanceof SiteValidationError) {
    console.error(`網站驗證失敗：\n- ${error.errors.join("\n- ")}`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});
