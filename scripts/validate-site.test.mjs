import assert from "node:assert/strict";
import test from "node:test";

import {
  auditHtml,
  auditSessionPageIdentity,
  classifyRepositoryPath,
  expectedOpenFromEnvironment,
  findForbiddenPhrases,
  parseBooleanInput,
  parseExpectedOpenSpec,
  validateAvailability,
  validateCatalog,
  validateCourseContent,
} from "./site-lib.mjs";

function fixtureCatalog() {
  return {
    schemaVersion: "1.0.0",
    series: {
      id: "fixture",
      title: "測試課程",
      sessionDurationMinutes: 120,
    },
    sessionFlow: {
      totalDurationMinutes: 120,
      segments: [
        { durationMinutes: 60 },
        { durationMinutes: 10 },
        { durationMinutes: 20 },
        { durationMinutes: 20 },
        { durationMinutes: 10 },
      ],
    },
    cohorts: Array.from({ length: 3 }, (_, cohortIndex) => ({
      id: `cohort-${String(cohortIndex + 1).padStart(2, "0")}`,
      sequence: cohortIndex + 1,
      sessions: Array.from({ length: 2 }, (_, sessionIndex) => {
        const sequence = cohortIndex * 2 + sessionIndex + 1;
        return {
          id: `session-${String(sequence).padStart(2, "0")}`,
          sequence,
          date: `2026-${String(7 + cohortIndex).padStart(2, "0")}-${String(10 + sessionIndex).padStart(2, "0")}`,
          startTime: "10:00",
          endTime: "12:00",
          contentPath: `sessions/session-${String(sequence).padStart(2, "0")}/`,
        };
      }),
    })),
  };
}

function fixtureAvailability(openIds = ["session-01"]) {
  return {
    schemaVersion: "1.0.0",
    defaultOpen: false,
    sessions: Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => {
        const id = `session-${String(index + 1).padStart(2, "0")}`;
        return [id, { isOpen: openIds.includes(id) }];
      }),
    ),
  };
}

test("boolean checkbox values must be explicit", () => {
  assert.equal(parseBooleanInput("true"), true);
  assert.equal(parseBooleanInput("false"), false);
  assert.throws(() => parseBooleanInput(undefined), /true 或 false/);
  assert.throws(() => parseBooleanInput("1"), /true 或 false/);
});

test("initial-open expectation accepts ids and ordinal parameters", () => {
  assert.deepEqual(
    [...parseExpectedOpenSpec("1,session-03,06")].sort(),
    ["session-01", "session-03", "session-06"],
  );
  assert.deepEqual([...parseExpectedOpenSpec("")], []);
  assert.throws(() => parseExpectedOpenSpec("7"), /未知場次/);
});

test("environment snapshot requires all six checkbox values", () => {
  const env = Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => [
      `SESSION_${String(index + 1).padStart(2, "0")}_OPEN`,
      index === 0 ? "true" : "false",
    ]),
  );
  assert.deepEqual([...expectedOpenFromEnvironment(env)], ["session-01"]);
  delete env.SESSION_06_OPEN;
  assert.throws(() => expectedOpenFromEnvironment(env), /六場狀態必須一次完整提供/);
});

test("catalog contract is exactly three cohorts and six sessions", () => {
  assert.deepEqual(validateCatalog(fixtureCatalog()).errors, []);
  const invalid = fixtureCatalog();
  invalid.cohorts.pop();
  assert.match(validateCatalog(invalid).errors.join("\n"), /3 梯|6 場/);

  const unsafePath = fixtureCatalog();
  unsafePath.cohorts[0].sessions[0].contentPath = "../internal/";
  assert.match(validateCatalog(unsafePath).errors.join("\n"), /contentPath/);
});

test("availability verifies a complete expected-open snapshot", () => {
  const valid = validateAvailability(
    fixtureAvailability(["session-01"]),
    Array.from({ length: 6 }, (_, index) => `session-${String(index + 1).padStart(2, "0")}`),
    new Set(["session-01"]),
  );
  assert.deepEqual(valid.errors, []);

  const mismatch = validateAvailability(
    fixtureAvailability(["session-01"]),
    Array.from({ length: 6 }, (_, index) => `session-${String(index + 1).padStart(2, "0")}`),
    new Set(["session-02"]),
  );
  assert.match(mismatch.errors.join("\n"), /完整清單不符/);
});

test("complete course data requires the contracted timeline, prompts, and blueprint", () => {
  const spec = {
    id: "ai-deck-01",
    stage: 1,
    promptCount: 5,
    blueprintCount: 28,
    requiredOutputTerms: ["8–10", "來源", "3"],
  };
  const valid = {
    id: "ai-deck-01",
    meta: {
      stage: 1,
      title: "從資料來源到可信初稿",
      subtitle: "AI 簡報力啟動專題",
      level: "入門",
      durationMinutes: 120,
      tagline: "以來源建立可信初稿",
      completionStandard: "完成有結構、有來源、有初稿的簡報",
    },
    audience: ["學員"],
    prerequisites: ["5–8 份來源"],
    outputs: ["8–10 頁初稿", "來源清單", "3 個待查證問題"],
    objectives: ["目標一", "目標二", "目標三"],
    timeline: [
      { startMinute: 0, endMinute: 60 },
      { startMinute: 60, endMinute: 70 },
      { startMinute: 70, endMinute: 90 },
      { startMinute: 90, endMinute: 110 },
      { startMinute: 110, endMinute: 120 },
    ],
    workflow: [{}, {}, {}, {}],
    prompts: Array.from({ length: 5 }, (_, index) => ({
      title: `提示詞 ${index + 1}`,
      text: "請只根據目前來源完成指定任務，沒有依據時標示來源不足，不要自行補寫任何政策、數字、工具功能或機關立場。",
    })),
    practice: { durationMinutes: 20 },
    caseStudy: { notice: "教學虛構，不代表正式政策立場" },
    casePack: {
      isFictional: true,
      title: "癌症篩檢服務改善案",
      notice: "教學虛構，非真實個案，不得對外引用。",
      stageId: "stage-1",
      entryPath:
        "../../cases/expanded-cancer-screening/index.html#stage-1",
      suggestedFiles: ["00_先讀我_資料聲明.md"],
    },
    blueprint: Array.from({ length: 28 }, (_, index) => ({
      page: index + 1,
      title: `第 ${index + 1} 頁`,
    })),
    checklist: ["一", "二", "三", "四", "五"],
    commonReturnConditions: ["一", "二", "三", "四", "五"],
    assessment: Array.from({ length: 5 }, (_, index) => ({
      name: `構面 ${index + 1}`,
      maxPoints: 20,
      ...(index === 0 ? { completionScore: 80 } : {}),
    })),
    homework: ["完成初稿"],
    safety: ["一", "二", "三", "四"],
  };
  assert.deepEqual(validateCourseContent(valid, spec).errors, []);

  valid.timeline[0].endMinute = 59;
  valid.blueprint.pop();
  const errors = validateCourseContent(valid, spec).errors.join("\n");
  assert.match(errors, /120 分鐘/);
  assert.match(errors, /28 筆/);
});

test("public course rejects instructor-only fields and requires the case pack", () => {
  const spec = {
    id: "ai-deck-01",
    stage: 1,
    promptCount: 1,
    blueprintCount: 1,
  };
  const course = {
    id: "ai-deck-01",
    meta: {
      stage: 1,
      durationMinutes: 120,
      title: "課程",
      subtitle: "課程",
      level: "入門",
      tagline: "課程",
      completionStandard: "完成",
    },
    audience: ["學員"],
    prerequisites: ["來源"],
    outputs: ["成果"],
    objectives: ["一", "二", "三"],
    timeline: [{ durationMinutes: 120 }, {}, {}, {}, {}],
    workflow: [{}, {}, {}, {}],
    prompts: [{
      title: "提示詞",
      text: "請只根據已確認來源完成指定任務；資料不足時明確標示待補，不得自行新增政策事實、數字或機關立場。",
    }],
    practice: { durationMinutes: 20 },
    caseStudy: { notice: "教學虛構", intentionalErrors: ["答案"] },
    blueprint: [{ page: 1, title: "第一頁", speakerCue: "私密提示" }],
    checklist: ["一", "二", "三", "四", "五"],
    assessment: [
      { maxPoints: 100, completionScore: 80 },
      {}, {}, {}, {},
    ],
    safety: ["一", "二", "三", "四"],
    homework: ["作業"],
    commonReturnConditions: ["一", "二", "三", "四", "五"],
    instructor: {},
  };
  const errors = validateCourseContent(course, spec).errors.join("\n");
  assert.match(errors, /casePack 必須是物件/);
  assert.match(errors, /instructor.*講師私密欄位/);
  assert.match(errors, /speakerCue.*講師私密欄位/);
  assert.match(errors, /intentionalErrors.*講師私密欄位/);
});

test("cancelled presentation topics are detected despite spacing", () => {
  assert.ok(findForbiddenPhrases("如何提高 AI 生成的簡報物件（例如小圖示）的修改彈性").length);
  assert.ok(findForbiddenPhrases("簡報修改次數極大化的技巧").length);
  assert.deepEqual(findForbiddenPhrases("NotebookLM 建立可信簡報初稿"), []);
});

test("sensitive filenames and non-public extensions are blocked", () => {
  assert.ok(classifyRepositoryPath("docs/學員名單.xlsx").length >= 2);
  assert.ok(classifyRepositoryPath("docs/internal-budget.json").length >= 1);
  assert.ok(classifyRepositoryPath(".env.production").length >= 1);
  assert.deepEqual(
    classifyRepositoryPath(
      "docs/cases/expanded-cancer-screening/F01_來源清單與版本.csv",
    ),
    [],
  );
  assert.ok(classifyRepositoryPath("docs/data/student-export.csv").length >= 1);
  assert.deepEqual(classifyRepositoryPath("docs/assets/hero.webp"), []);
});

test("basic HTML accessibility checks ids, skip link, and images", () => {
  const html = `<!doctype html>
  <html lang="zh-Hant"><head>
    <meta name="viewport" content="width=device-width"><title>課程</title>
  </head><body>
    <a class="skip-link" href="#main-content">跳到內容</a>
    <main id="main-content"><h1>課程</h1>
      <img src="hero.webp" alt="課程情境" width="100" height="80">
    </main>
  </body></html>`;
  assert.deepEqual(auditHtml(html).errors, []);
  assert.deepEqual(auditHtml(html).references, ["hero.webp"]);
});

test("session content page declares the route-matching session id", () => {
  const valid = `<!doctype html><html lang="zh-Hant"><body>
    <main id="main-content" data-session-id="session-01"><h1>第一場</h1></main>
  </body></html>`;
  assert.deepEqual(auditSessionPageIdentity(valid, "session-01"), []);
  assert.match(
    auditSessionPageIdentity(valid, "session-02").join("\n"),
    /data-session-id="session-02"/,
  );
});
