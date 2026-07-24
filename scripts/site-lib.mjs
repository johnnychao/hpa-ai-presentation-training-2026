import { promises as fs } from "node:fs";
import path from "node:path";

export const SESSION_IDS = Object.freeze(
  Array.from({ length: 6 }, (_, index) => `session-${String(index + 1).padStart(2, "0")}`),
);

export const COURSE_CONTENT_SPECS = Object.freeze([
  Object.freeze({
    id: "ai-deck-01",
    stage: 1,
    promptCount: 5,
    blueprintCount: 28,
    requiredOutputTerms: ["8–10", "來源", "3"],
  }),
  Object.freeze({
    id: "ai-deck-02",
    stage: 2,
    promptCount: 5,
    blueprintCount: 30,
    requiredOutputTerms: ["10–12", "事實核對"],
  }),
  Object.freeze({
    id: "ai-deck-03",
    stage: 3,
    promptCount: 7,
    blueprintCount: 31,
    requiredOutputTerms: ["8–10", "決策摘要", "10", "6"],
  }),
]);

export const ASSESSMENT_COURSE_IDS = Object.freeze([
  "ai-deck-01",
  "ai-deck-02",
  "ai-deck-03",
]);

const ASIA_TAIPEI_TIMEZONE = "Asia/Taipei";
const ASIA_TAIPEI_OFFSET = "+08:00";
const FORBIDDEN_ASSESSMENT_FIELD_KEYS = new Set([
  "answer",
  "answers",
  "answerkey",
  "correct",
  "correctanswer",
  "correctanswers",
  "correctoption",
  "explanation",
  "feedback",
  "iscorrect",
  "maxpoints",
  "points",
  "rationale",
  "score",
]);

export const FORBIDDEN_PUBLIC_PHRASES = Object.freeze([
  "簡報修改次數極大化",
  "修改次數極大化",
  "如何提高AI生成的簡報物件",
  "如何提高 AI 生成的簡報物件",
  "AI生成的簡報物件",
  "AI 生成的簡報物件",
  "提高 AI 生成簡報物件",
  "簡報物件",
  "小圖示",
  "修改彈性",
]);

export const BLOCKED_PUBLIC_EXTENSIONS = new Set([
  ".7z",
  ".avi",
  ".csv",
  ".db",
  ".doc",
  ".docm",
  ".docx",
  ".key",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".ods",
  ".odt",
  ".pdf",
  ".pem",
  ".pfx",
  ".ppt",
  ".pptm",
  ".pptx",
  ".rar",
  ".sqlite",
  ".sqlite3",
  ".tsv",
  ".wav",
  ".xls",
  ".xlsb",
  ".xlsm",
  ".xlsx",
  ".zip",
]);

const SENSITIVE_FILENAME_TERMS = Object.freeze([
  "attendance",
  "attendee",
  "budget",
  "contract",
  "feedback",
  "invoice",
  "participant",
  "quotation",
  "registration",
  "roster",
  "signature",
  "signed",
  "student-list",
  "個資",
  "合約",
  "名冊",
  "名單",
  "報名",
  "報價",
  "契約",
  "簽到",
  "簽名",
  "預算",
]);

const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".txt"]);
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);

export class SiteValidationError extends Error {
  constructor(errors) {
    super(`網站驗證失敗（${errors.length} 項）`);
    this.name = "SiteValidationError";
    this.errors = errors;
  }
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseBooleanInput(value, label = "boolean") {
  if (value === true || value === "true") {
    return true;
  }
  if (value === false || value === "false") {
    return false;
  }
  throw new Error(`${label} 必須明確為 true 或 false，目前為 ${JSON.stringify(value)}`);
}

export function expectedOpenFromEnvironment(env = process.env) {
  const open = new Set();
  for (const sessionId of SESSION_IDS) {
    const sequence = sessionId.slice(-2);
    const variable = `SESSION_${sequence}_OPEN`;
    if (!(variable in env)) {
      throw new Error(`缺少必要環境變數 ${variable}；六場狀態必須一次完整提供`);
    }
    if (parseBooleanInput(env[variable], variable)) {
      open.add(sessionId);
    }
  }
  return open;
}

export function parseExpectedOpenSpec(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const open = new Set();
  const tokens = String(value)
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const numeric = token.match(/^(?:session-?)?0?([1-6])$/i);
    const sessionId = numeric
      ? `session-${String(Number(numeric[1])).padStart(2, "0")}`
      : token.toLowerCase();

    if (!SESSION_IDS.includes(sessionId)) {
      throw new Error(`未知場次 ${JSON.stringify(token)}；可用值為 ${SESSION_IDS.join(", ")}`);
    }
    if (open.has(sessionId)) {
      throw new Error(`場次 ${sessionId} 重複出現`);
    }
    open.add(sessionId);
  }

  return open;
}

export function validateCatalog(catalog) {
  const errors = [];
  const cohorts = Array.isArray(catalog?.cohorts) ? catalog.cohorts : [];
  const flowSegments = Array.isArray(catalog?.sessionFlow?.segments)
    ? catalog.sessionFlow.segments
    : [];

  if (!isPlainObject(catalog)) {
    errors.push("course-catalog.json 頂層必須是物件");
  }
  if (!isPlainObject(catalog?.series)) {
    errors.push("course-catalog.json 缺少 series 物件");
  }
  if (catalog?.series?.sessionDurationMinutes !== 120) {
    errors.push("series.sessionDurationMinutes 必須是 120");
  }
  if (catalog?.series?.timezone !== ASIA_TAIPEI_TIMEZONE) {
    errors.push(`series.timezone 必須是 ${ASIA_TAIPEI_TIMEZONE}`);
  }
  if (cohorts.length !== 3) {
    errors.push(`cohorts 必須恰好有 3 梯，目前為 ${cohorts.length}`);
  }
  if (flowSegments.length === 0) {
    errors.push("sessionFlow.segments 必須至少有一個流程段落");
  }

  const flowTotal = flowSegments.reduce(
    (sum, segment) => sum + Number(segment?.durationMinutes || 0),
    0,
  );
  if (catalog?.sessionFlow?.totalDurationMinutes !== 120 || flowTotal !== 120) {
    errors.push(
      `課程流程必須合計 120 分鐘，目前宣告 ${catalog?.sessionFlow?.totalDurationMinutes ?? "未設定"}、段落合計 ${flowTotal}`,
    );
  }

  const cohortIds = new Set();
  const sessions = [];
  cohorts.forEach((cohort, cohortIndex) => {
    const expectedCohortId = `cohort-${String(cohortIndex + 1).padStart(2, "0")}`;
    const expectedCourseId = ASSESSMENT_COURSE_IDS[cohortIndex];
    if (cohort?.id !== expectedCohortId) {
      errors.push(`第 ${cohortIndex + 1} 梯 id 必須是 ${expectedCohortId}`);
    }
    if (cohort?.courseId !== expectedCourseId) {
      errors.push(`第 ${cohortIndex + 1} 梯 courseId 必須是 ${expectedCourseId}`);
    }
    if (cohortIds.has(cohort?.id)) {
      errors.push(`梯次 id 重複：${cohort?.id}`);
    }
    cohortIds.add(cohort?.id);

    const cohortSessions = Array.isArray(cohort?.sessions) ? cohort.sessions : [];
    if (cohortSessions.length !== 2) {
      errors.push(`${expectedCohortId} 必須恰好有 2 場，目前為 ${cohortSessions.length}`);
    }
    sessions.push(...cohortSessions);
  });

  if (sessions.length !== 6) {
    errors.push(`全系列必須恰好有 6 場，目前為 ${sessions.length}`);
  }

  const seenSessionIds = new Set();
  sessions.forEach((session, index) => {
    const expectedId = SESSION_IDS[index];
    const expectedContentPath = `sessions/${expectedId}/`;
    if (session?.id !== expectedId) {
      errors.push(`第 ${index + 1} 場 id 必須是 ${expectedId}`);
    }
    if (seenSessionIds.has(session?.id)) {
      errors.push(`場次 id 重複：${session?.id}`);
    }
    seenSessionIds.add(session?.id);

    if (session?.sequence !== index + 1) {
      errors.push(`${expectedId} 的 sequence 必須是 ${index + 1}`);
    }
    if (!isValidIsoDate(session?.date)) {
      errors.push(`${expectedId} 的 date 不是有效 YYYY-MM-DD 日期`);
    }
    if (!isValidTime(session?.startTime) || !isValidTime(session?.endTime)) {
      errors.push(`${expectedId} 的 startTime/endTime 必須是有效 HH:MM`);
    } else {
      const durationMinutes =
        timeToMinutes(session.endTime) - timeToMinutes(session.startTime);
      if (durationMinutes !== 120) {
        errors.push(
          `${expectedId} 的 startTime/endTime 必須相差 120 分鐘，目前為 ${durationMinutes}`,
        );
      }
    }
    if (session?.contentPath !== expectedContentPath) {
      errors.push(`${expectedId} 的 contentPath 必須是 ${expectedContentPath}`);
    }
  });

  const actualSessionIds = [...seenSessionIds].sort();
  if (
    actualSessionIds.length !== SESSION_IDS.length ||
    actualSessionIds.some((id, index) => id !== SESSION_IDS[index])
  ) {
    errors.push(`場次 id 必須完整對應 ${SESSION_IDS.join(", ")}`);
  }

  return {
    errors,
    sessionIds: actualSessionIds,
    cohortCount: cohorts.length,
    sessionPages: sessions.map((session) => ({
      id: session?.id,
      courseId: cohorts.find((cohort) =>
        Array.isArray(cohort?.sessions) &&
        cohort.sessions.some((candidate) => candidate === session),
      )?.courseId,
      date: session?.date,
      startTime: session?.startTime,
      endTime: session?.endTime,
      timezone: catalog?.series?.timezone,
      contentPath: session?.contentPath,
    })),
  };
}

export function assessmentWindowStatus({
  date,
  startTime,
  endTime,
  type,
  now,
}) {
  if (!isValidIsoDate(date)) {
    throw new Error("date 必須是有效 YYYY-MM-DD 日期");
  }
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    throw new Error("startTime/endTime 必須是有效 HH:MM");
  }
  if (!["pre", "post"].includes(type)) {
    throw new Error('type 必須是 "pre" 或 "post"');
  }

  const start = new Date(`${date}T${startTime}:00${ASIA_TAIPEI_OFFSET}`);
  const end = new Date(`${date}T${endTime}:00${ASIA_TAIPEI_OFFSET}`);
  if (end.getTime() <= start.getTime()) {
    throw new Error("endTime 必須晚於 startTime");
  }

  const current = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(current.getTime())) {
    throw new Error("now 必須是有效日期時間");
  }

  const open =
    type === "pre"
      ? new Date(start.getTime())
      : new Date(end.getTime() - 10 * 60 * 1000);
  const close =
    type === "pre"
      ? new Date(start.getTime() + 30 * 60 * 1000)
      : end;
  const currentTime = current.getTime();
  const status =
    currentTime < open.getTime()
      ? "upcoming"
      : currentTime < close.getTime()
        ? "open"
        : "closed";

  return {
    status,
    isOpen: status === "open",
    opensAt: open.toISOString(),
    closesAt: close.toISOString(),
  };
}

export function validateAvailability(
  availability,
  catalogSessionIds = SESSION_IDS,
  expectedOpen = null,
) {
  const errors = [];
  const sessions = isPlainObject(availability?.sessions) ? availability.sessions : {};
  const keys = Object.keys(sessions).sort();
  const expectedKeys = [...catalogSessionIds].sort();

  if (!isPlainObject(availability)) {
    errors.push("availability.json 頂層必須是物件");
  }
  if (availability?.defaultOpen !== false) {
    errors.push("availability.defaultOpen 必須固定為 false（讀取失敗時關閉）");
  }
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    errors.push(`availability.sessions 必須且只能包含 ${expectedKeys.join(", ")}`);
  }

  const openIds = new Set();
  for (const sessionId of expectedKeys) {
    const state = sessions[sessionId];
    if (!isPlainObject(state) || typeof state.isOpen !== "boolean") {
      errors.push(`${sessionId}.isOpen 必須是 boolean`);
      continue;
    }
    if (state.isOpen) {
      openIds.add(sessionId);
    }
  }

  if (availability?.updatedAt !== undefined) {
    const timestamp = Date.parse(availability.updatedAt);
    if (!Number.isFinite(timestamp)) {
      errors.push("availability.updatedAt 必須是有效 ISO 日期時間");
    }
  }

  if (expectedOpen instanceof Set) {
    const actual = [...openIds].sort();
    const expected = [...expectedOpen].sort();
    if (
      actual.length !== expected.length ||
      actual.some((sessionId, index) => sessionId !== expected[index])
    ) {
      errors.push(
        `開放狀態與指定完整清單不符；預期 [${expected.join(", ") || "無"}]，實際 [${actual.join(", ") || "無"}]`,
      );
    }
  }

  return { errors, openIds };
}

export function validateAssessments(assessments) {
  const errors = [];
  const formActionPattern =
    /^https:\/\/docs\.google\.com\/forms\/d\/e\/[^/?#\s]+\/formResponse$/;
  const fieldNamePattern = /^entry\.\d+$/;

  if (!isPlainObject(assessments)) {
    return { errors: ["assessments.json 頂層必須是物件"] };
  }

  function rejectAnswerFields(value, fieldPath) {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        rejectAnswerFields(item, `${fieldPath}[${index}]`),
      );
      return;
    }
    if (!isPlainObject(value)) {
      return;
    }
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = key.toLocaleLowerCase("en-US").replace(/[-_\s]/g, "");
      const nestedPath = `${fieldPath}.${key}`;
      if (FORBIDDEN_ASSESSMENT_FIELD_KEYS.has(normalizedKey)) {
        errors.push(`${nestedPath} 是答案或計分欄位，不得出現在公開 assessments.json`);
      }
      rejectAnswerFields(nestedValue, nestedPath);
    }
  }
  rejectAnswerFields(assessments, "assessments");

  if (assessments.schemaVersion !== "1.0.0") {
    errors.push('assessments.schemaVersion 必須是 "1.0.0"');
  }
  if (
    typeof assessments.questionVersion !== "string" ||
    !assessments.questionVersion.trim()
  ) {
    errors.push("assessments.questionVersion 必須是非空白字串");
  }
  if (assessments.timezone !== ASIA_TAIPEI_TIMEZONE) {
    errors.push(`assessments.timezone 必須是 ${ASIA_TAIPEI_TIMEZONE}`);
  }

  const preTiming = assessments?.timing?.pre;
  const postTiming = assessments?.timing?.post;
  if (
    !isPlainObject(preTiming) ||
    preTiming.openAt !== "start" ||
    preTiming.openDurationMinutes !== 30
  ) {
    errors.push(
      'assessments.timing.pre 必須設定 openAt="start"、openDurationMinutes=30',
    );
  }
  if (
    !isPlainObject(postTiming) ||
    postTiming.openMinutesBeforeEnd !== 10 ||
    postTiming.closeAt !== "end"
  ) {
    errors.push(
      'assessments.timing.post 必須設定 openMinutesBeforeEnd=10、closeAt="end"',
    );
  }

  const submission = assessments.submission;
  const submissionEntries = {};
  if (!isPlainObject(submission)) {
    errors.push("assessments.submission 必須是物件");
  }
  if (
    typeof submission?.payloadSchema !== "string" ||
    !submission.payloadSchema.trim()
  ) {
    errors.push("assessments.submission.payloadSchema 必須是非空白字串");
  }
  for (const type of ["pre", "post"]) {
    const configuration = submission?.[type];
    submissionEntries[type] = configuration;
    if (!isPlainObject(configuration)) {
      errors.push(`assessments.submission.${type} 必須是物件`);
      continue;
    }
    if (configuration.provider !== "google-forms") {
      errors.push(
        `assessments.submission.${type}.provider 必須是 "google-forms"`,
      );
    }
    if (!formActionPattern.test(configuration.action || "")) {
      errors.push(
        `assessments.submission.${type}.action 必須是公開 Google Forms formResponse 網址`,
      );
    }
    if (!fieldNamePattern.test(configuration.fieldName || "")) {
      errors.push(
        `assessments.submission.${type}.fieldName 必須符合 entry.<digits>`,
      );
    }
  }
  if (
    submissionEntries.pre?.action &&
    submissionEntries.pre.action === submissionEntries.post?.action
  ) {
    errors.push("前測與後測必須使用不同的 Google Forms action");
  }

  const satisfaction = assessments.satisfaction;
  if (!isPlainObject(satisfaction)) {
    errors.push("assessments.satisfaction 必須是物件");
  } else {
    if (satisfaction.appliesTo !== "post") {
      errors.push('assessments.satisfaction.appliesTo 必須是 "post"');
    }
    const scale = Array.isArray(satisfaction.scale) ? satisfaction.scale : [];
    if (scale.length !== 5) {
      errors.push(`assessments.satisfaction.scale 必須恰好有 5 筆，目前為 ${scale.length}`);
    }
    scale.forEach((item, index) => {
      if (
        !isPlainObject(item) ||
        item.value !== index + 1 ||
        typeof item.label !== "string" ||
        !item.label.trim()
      ) {
        errors.push(
          `assessments.satisfaction.scale[${index}] 必須有 value=${index + 1} 與非空白 label`,
        );
      }
    });

    const questions = Array.isArray(satisfaction.questions)
      ? satisfaction.questions
      : [];
    if (questions.length !== 5) {
      errors.push(
        `assessments.satisfaction.questions 必須恰好有 5 題，目前為 ${questions.length}`,
      );
    }
    const satisfactionIds = new Set();
    questions.forEach((question, index) => {
      const prefix = `assessments.satisfaction.questions[${index}]`;
      if (!isPlainObject(question)) {
        errors.push(`${prefix} 必須是物件`);
        return;
      }
      const keys = Object.keys(question).sort();
      if (keys.length !== 2 || keys[0] !== "id" || keys[1] !== "stem") {
        errors.push(`${prefix} 只能包含 id 與 stem`);
      }
      if (typeof question.id !== "string" || !question.id.trim()) {
        errors.push(`${prefix}.id 必須是非空白字串`);
      } else if (satisfactionIds.has(question.id)) {
        errors.push(`${prefix}.id 重複：${question.id}`);
      } else {
        satisfactionIds.add(question.id);
      }
      if (typeof question.stem !== "string" || !question.stem.trim()) {
        errors.push(`${prefix}.stem 必須是非空白字串`);
      }
    });
  }

  const courses = isPlainObject(assessments.courses) ? assessments.courses : {};
  const courseIds = Object.keys(courses).sort();
  if (
    courseIds.length !== ASSESSMENT_COURSE_IDS.length ||
    courseIds.some((courseId, index) => courseId !== ASSESSMENT_COURSE_IDS[index])
  ) {
    errors.push(
      `assessments.courses 必須且只能包含 ${ASSESSMENT_COURSE_IDS.join(", ")}`,
    );
  }

  const questionIds = new Set();
  for (const courseId of ASSESSMENT_COURSE_IDS) {
    const course = courses[courseId];
    if (!isPlainObject(course)) {
      errors.push(`assessments.courses.${courseId} 必須是物件`);
      continue;
    }
    for (const type of ["pre", "post"]) {
      const questions = Array.isArray(course?.[type]?.questions)
        ? course[type].questions
        : [];
      const prefix = `assessments.courses.${courseId}.${type}.questions`;
      if (questions.length !== 10) {
        errors.push(`${prefix} 必須恰好有 10 題，目前為 ${questions.length}`);
      }
      questions.forEach((question, index) => {
        const questionPath = `${prefix}[${index}]`;
        if (!isPlainObject(question)) {
          errors.push(`${questionPath} 必須是物件`);
          return;
        }
        const keys = Object.keys(question).sort();
        if (
          keys.length !== 3 ||
          keys[0] !== "id" ||
          keys[1] !== "options" ||
          keys[2] !== "stem"
        ) {
          errors.push(`${questionPath} 只能包含 id、stem 與 options`);
        }
        if (typeof question.id !== "string" || !question.id.trim()) {
          errors.push(`${questionPath}.id 必須是非空白字串`);
        } else if (questionIds.has(question.id)) {
          errors.push(`${questionPath}.id 重複：${question.id}`);
        } else {
          questionIds.add(question.id);
        }
        if (typeof question.stem !== "string" || !question.stem.trim()) {
          errors.push(`${questionPath}.stem 必須是非空白字串`);
        }
        if (
          !Array.isArray(question.options) ||
          question.options.length !== 4 ||
          question.options.some(
            (option) => typeof option !== "string" || !option.trim(),
          )
        ) {
          errors.push(`${questionPath}.options 必須恰好有 4 個非空白選項`);
        }
      });
    }
  }

  return {
    errors,
    courseCount: courseIds.length,
    questionCount: questionIds.size,
    satisfactionQuestionCount: Array.isArray(satisfaction?.questions)
      ? satisfaction.questions.length
      : 0,
  };
}

export function validateCourseContent(course, spec) {
  const errors = [];
  const prefix = spec?.id || "course";
  const privateKeys = new Set([
    "instructor",
    "speakerCue",
    "speakerNote",
    "feedbackPhrases",
    "referenceMiniOutline",
    "intentionalErrors",
    "correctedTitle",
    "decisionSentence",
    "recommendation",
    "answer",
  ]);
  const requiredArrays = [
    ["audience", 1],
    ["prerequisites", 1],
    ["outputs", 1],
    ["objectives", 3],
    ["timeline", 5],
    ["workflow", 4],
    ["prompts", spec?.promptCount || 1],
    ["blueprint", spec?.blueprintCount || 1],
    ["checklist", 5],
    ["assessment", 5],
    ["safety", 4],
  ];

  if (!isPlainObject(course)) {
    return { errors: [`${prefix} 頂層必須是物件`] };
  }

  function rejectPrivateFields(value, pathPrefix) {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        rejectPrivateFields(item, `${pathPrefix}[${index}]`),
      );
      return;
    }
    if (!isPlainObject(value)) {
      return;
    }
    for (const [key, nestedValue] of Object.entries(value)) {
      const fieldPath = `${pathPrefix}.${key}`;
      if (privateKeys.has(key)) {
        errors.push(`${fieldPath} 是講師私密欄位，不得出現在公開課程`);
      }
      rejectPrivateFields(nestedValue, fieldPath);
    }
  }
  rejectPrivateFields(course, prefix);

  if (course.id !== spec?.id) {
    errors.push(`${prefix}.id 必須是 ${spec?.id}`);
  }
  if (!isPlainObject(course.meta)) {
    errors.push(`${prefix}.meta 必須是物件`);
  } else {
    if (course.meta.stage !== spec?.stage) {
      errors.push(`${prefix}.meta.stage 必須是 ${spec?.stage}`);
    }
    if (course.meta.durationMinutes !== 120) {
      errors.push(`${prefix}.meta.durationMinutes 必須是 120`);
    }
    for (const field of ["title", "subtitle", "level", "tagline", "completionStandard"]) {
      if (typeof course.meta[field] !== "string" || !course.meta[field].trim()) {
        errors.push(`${prefix}.meta.${field} 必須是非空字串`);
      }
    }
  }

  for (const [field, minimum] of requiredArrays) {
    const value = course[field];
    if (!Array.isArray(value) || value.length < minimum) {
      const exact =
        field === "prompts" || field === "blueprint"
          ? `恰好 ${minimum}`
          : `至少 ${minimum}`;
      errors.push(`${prefix}.${field} 必須${exact} 筆`);
      continue;
    }
    if (
      (field === "prompts" || field === "blueprint") &&
      value.length !== minimum
    ) {
      errors.push(`${prefix}.${field} 必須恰好 ${minimum} 筆，目前為 ${value.length}`);
    }
  }

  const timeline = Array.isArray(course.timeline) ? course.timeline : [];
  const timelineTotal = timeline.reduce((total, segment) => {
    const direct = Number(segment?.durationMinutes ?? segment?.minutes);
    if (Number.isFinite(direct) && direct >= 0) {
      return total + direct;
    }
    const start = Number(segment?.startMinute);
    const end = Number(segment?.endMinute);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start
      ? total + (end - start)
      : total;
  }, 0);
  if (timeline.length && timelineTotal !== 120) {
    errors.push(`${prefix}.timeline 必須合計 120 分鐘，目前為 ${timelineTotal}`);
  }

  const prompts = Array.isArray(course.prompts) ? course.prompts : [];
  prompts.forEach((prompt, index) => {
    if (!isPlainObject(prompt)) {
      errors.push(`${prefix}.prompts[${index}] 必須是物件`);
      return;
    }
    if (typeof prompt.title !== "string" || !prompt.title.trim()) {
      errors.push(`${prefix}.prompts[${index}].title 必須是非空字串`);
    }
    if (typeof prompt.text !== "string" || prompt.text.trim().length < 40) {
      errors.push(`${prefix}.prompts[${index}].text 必須是可實際使用的完整提示詞`);
    }
  });

  const blueprint = Array.isArray(course.blueprint) ? course.blueprint : [];
  blueprint.forEach((page, index) => {
    const pageNumber = Number(page?.page ?? page?.pageNumber);
    if (pageNumber !== index + 1) {
      errors.push(`${prefix}.blueprint[${index}] 頁碼必須是 ${index + 1}`);
    }
    if (typeof page?.title !== "string" || !page.title.trim()) {
      errors.push(`${prefix}.blueprint[${index}].title 必須是非空字串`);
    }
  });

  const outputText = (Array.isArray(course.outputs) ? course.outputs : [])
    .map((value) => String(value))
    .join(" ");
  for (const term of spec?.requiredOutputTerms || []) {
    if (!outputText.includes(term)) {
      errors.push(`${prefix}.outputs 缺少完成標準關鍵字 ${term}`);
    }
  }

  if (!isPlainObject(course.practice)) {
    errors.push(`${prefix}.practice 必須是物件`);
  } else if (course.practice.durationMinutes !== 20) {
    errors.push(`${prefix}.practice.durationMinutes 必須是 20`);
  }
  if (!isPlainObject(course.caseStudy)) {
    errors.push(`${prefix}.caseStudy 必須是物件`);
  } else if (!JSON.stringify(course.caseStudy).includes("虛構")) {
    errors.push(`${prefix}.caseStudy 必須明示為教學虛構`);
  }
  if (!isPlainObject(course.casePack)) {
    errors.push(`${prefix}.casePack 必須是物件`);
  } else {
    if (course.casePack.isFictional !== true) {
      errors.push(`${prefix}.casePack.isFictional 必須是 true`);
    }
    if (!String(course.casePack.notice || "").includes("虛構")) {
      errors.push(`${prefix}.casePack.notice 必須明示為教學虛構`);
    }
    const expectedStage = `stage-${spec?.stage}`;
    if (course.casePack.stageId !== expectedStage) {
      errors.push(`${prefix}.casePack.stageId 必須是 ${expectedStage}`);
    }
    const expectedEntryPath =
      `../../cases/expanded-cancer-screening/index.html#${expectedStage}`;
    if (course.casePack.entryPath !== expectedEntryPath) {
      errors.push(`${prefix}.casePack.entryPath 必須是 ${expectedEntryPath}`);
    }
    if (
      !Array.isArray(course.casePack.suggestedFiles) ||
      course.casePack.suggestedFiles.length < 1
    ) {
      errors.push(`${prefix}.casePack.suggestedFiles 必須至少有 1 筆`);
    }
  }
  const assessment = Array.isArray(course.assessment) ? course.assessment : [];
  const assessmentTotal = assessment.reduce(
    (total, item) => total + Number(item?.maxPoints || 0),
    0,
  );
  if (assessment.length && assessmentTotal !== 100) {
    errors.push(`${prefix}.assessment 最高分必須合計 100，目前為 ${assessmentTotal}`);
  }
  if (
    assessment.length &&
    !assessment.some((item) => Number(item?.completionScore) === 80)
  ) {
    errors.push(`${prefix}.assessment 必須明示 80 分完成標準`);
  }
  if (
    !Array.isArray(course.commonReturnConditions) ||
    course.commonReturnConditions.length !== 5
  ) {
    errors.push(`${prefix}.commonReturnConditions 必須恰好有 5 筆`);
  }
  const homeworkIsArray = Array.isArray(course.homework) && course.homework.length > 0;
  const homeworkIsObject =
    isPlainObject(course.homework) &&
    Array.isArray(course.homework.tasks) &&
    course.homework.tasks.length > 0;
  if (!homeworkIsArray && !homeworkIsObject) {
    errors.push(`${prefix}.homework 必須包含至少一項課後任務`);
  }

  return { errors };
}

export function normalizePublicText(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s()[\]{}（）【】「」『』〈〉《》、，,。.：:；;!！?？·/_-]+/g, "");
}

export function findForbiddenPhrases(text, phrases = FORBIDDEN_PUBLIC_PHRASES) {
  const normalizedText = normalizePublicText(text);
  return phrases.filter((phrase) => normalizedText.includes(normalizePublicText(phrase)));
}

export function classifyRepositoryPath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  const lower = normalized.toLocaleLowerCase("en-US");
  const parts = lower.split("/");
  const extension = path.extname(lower);
  const findings = [];

  if (parts.some((part) => part === ".env" || part.startsWith(".env."))) {
    findings.push("環境變數檔不得進入公開 repo");
  }
  const isApprovedSyntheticCaseCsv =
    extension === ".csv" &&
    lower.startsWith("docs/cases/expanded-cancer-screening/");
  if (BLOCKED_PUBLIC_EXTENSIONS.has(extension) && !isApprovedSyntheticCaseCsv) {
    findings.push(`禁止公開的副檔名 ${extension}`);
  }
  const sensitiveTerm = SENSITIVE_FILENAME_TERMS.find((term) => lower.includes(term));
  if (sensitiveTerm) {
    findings.push(`檔名含敏感詞 ${sensitiveTerm}`);
  }

  return findings;
}

export function auditHtml(html, fileLabel = "index.html") {
  const errors = [];
  const references = [];
  const idCounts = new Map();
  const idPattern = /\bid\s*=\s*(["'])(.*?)\1/gi;
  let match;

  while ((match = idPattern.exec(html))) {
    idCounts.set(match[2], (idCounts.get(match[2]) || 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      errors.push(`${fileLabel} 的 id="${id}" 重複 ${count} 次`);
    }
  }

  if (!/<!doctype\s+html>/i.test(html)) {
    errors.push(`${fileLabel} 缺少 HTML doctype`);
  }
  if (!/<html\b[^>]*\blang\s*=\s*(["'])zh-Hant\1/i.test(html)) {
    errors.push(`${fileLabel} 必須設定 html lang="zh-Hant"`);
  }
  if (!/<meta\b[^>]*\bname\s*=\s*(["'])viewport\1/i.test(html)) {
    errors.push(`${fileLabel} 缺少 viewport meta`);
  }
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(html)) {
    errors.push(`${fileLabel} 缺少非空 title`);
  }
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) {
    errors.push(`${fileLabel} 必須恰好有一個 h1，目前為 ${h1Count}`);
  }
  if (!/<main\b[^>]*\bid\s*=\s*(["'])main-content\1/i.test(html)) {
    errors.push(`${fileLabel} 缺少 id="main-content" 的 main`);
  }
  if (!/<a\b[^>]*\bclass\s*=\s*(["'])[^"']*\bskip-link\b[^"']*\1[^>]*\bhref\s*=\s*(["'])#main-content\2/i.test(html)) {
    errors.push(`${fileLabel} 缺少指向 #main-content 的 skip-link`);
  }
  if (/<form\b|<textarea\b|<input\b/i.test(html)) {
    errors.push(`${fileLabel} 不得包含蒐集資料的 form/input/textarea`);
  }

  const imagePattern = /<img\b[^>]*>/gi;
  while ((match = imagePattern.exec(html))) {
    const tag = match[0];
    if (!/\balt\s*=\s*(["'])[^"']+\1/i.test(tag)) {
      errors.push(`${fileLabel} 有 img 缺少非空 alt`);
    }
    if (!/\bwidth\s*=\s*(["'])\d+\1/i.test(tag) || !/\bheight\s*=\s*(["'])\d+\1/i.test(tag)) {
      errors.push(`${fileLabel} 有 img 缺少數值 width/height`);
    }
  }

  const attributeReferencePattern = /\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi;
  while ((match = attributeReferencePattern.exec(html))) {
    const value = match[2].trim();
    if (value.startsWith("#")) {
      const target = value.slice(1);
      if (target && !idCounts.has(target)) {
        errors.push(`${fileLabel} 的片段連結 ${value} 找不到目標 id`);
      }
    } else {
      references.push(value);
    }
  }

  const ariaReferencePattern = /\baria-(?:labelledby|describedby)\s*=\s*(["'])(.*?)\1/gi;
  while ((match = ariaReferencePattern.exec(html))) {
    for (const target of match[2].trim().split(/\s+/).filter(Boolean)) {
      if (!idCounts.has(target)) {
        errors.push(`${fileLabel} 的 ARIA 參照找不到 id="${target}"`);
      }
    }
  }

  return { errors, references };
}

export function auditSessionPageIdentity(
  html,
  sessionOrId,
  fileLabel = "session page",
) {
  const errors = [];
  const mainTag = html.match(/<main\b[^>]*>/i)?.[0] || "";
  const expected =
    typeof sessionOrId === "string"
      ? { id: sessionOrId }
      : isPlainObject(sessionOrId)
        ? sessionOrId
        : {};
  const attributes = [
    ["id", "data-session-id"],
    ["courseId", "data-course-id"],
    ["date", "data-session-date"],
    ["startTime", "data-start-time"],
    ["endTime", "data-end-time"],
    ["timezone", "data-timezone"],
  ];

  for (const [field, attribute] of attributes) {
    const value = expected[field];
    if (typeof value !== "string" || !value) {
      continue;
    }
    const expectedAttribute = new RegExp(
      `\\b${attribute}\\s*=\\s*(["'])${escapeRegularExpression(value)}\\1`,
      "i",
    );
    if (!mainTag || !expectedAttribute.test(mainTag)) {
      errors.push(`${fileLabel} 的 main 必須宣告 ${attribute}="${value}"`);
    }
  }

  return errors;
}

export function collectCssReferences(css) {
  const references = [];
  const pattern = /url\(\s*(?:(["'])(.*?)\1|([^)"']+))\s*\)/gi;
  let match;
  while ((match = pattern.exec(css))) {
    references.push((match[2] || match[3] || "").trim());
  }
  return references;
}

export function collectJavascriptPublicReferences(javascript) {
  const references = [];
  const pattern = /(["'`])((?:assets|data)\/[^"'`?#\s]+)\1/g;
  let match;
  while ((match = pattern.exec(javascript))) {
    references.push(match[2]);
  }
  return references;
}

export async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${filePath} 不是有效 JSON：${error.message}`);
  }
}

export async function listRepositoryFiles(rootDirectory) {
  const files = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        files.push(path.relative(rootDirectory, absolute).replaceAll("\\", "/"));
      }
    }
  }

  await visit(rootDirectory);
  return files;
}

export async function validateSite(rootDirectory, options = {}) {
  const errors = [];
  const docsDirectory = path.join(rootDirectory, "docs");
  const catalogPath = path.join(docsDirectory, "data", "course-catalog.json");
  const availabilityPath = path.join(docsDirectory, "data", "availability.json");
  const assessmentsPath = path.join(docsDirectory, "data", "assessments.json");
  const courseContentPaths = COURSE_CONTENT_SPECS.map((spec) =>
    path.join(docsDirectory, "data", "courses", `${spec.id}.json`),
  );
  const instructorPromptsPath = path.join(
    docsDirectory,
    "data",
    "instructor-prompts.json",
  );
  const indexPath = path.join(docsDirectory, "index.html");
  const requiredFiles = [
    catalogPath,
    availabilityPath,
    assessmentsPath,
    indexPath,
    ...courseContentPaths,
  ];

  for (const requiredFile of requiredFiles) {
    if (!(await fileExists(requiredFile))) {
      errors.push(`缺少必要檔案 ${path.relative(rootDirectory, requiredFile)}`);
    }
  }
  if (errors.length) {
    throw new SiteValidationError(errors);
  }
  if (await fileExists(instructorPromptsPath)) {
    errors.push(
      "docs/data/instructor-prompts.json 是講師私密教材，不得存在於公開網站",
    );
  }

  let catalog;
  let availability;
  let assessments;
  let courseContents;
  try {
    const loaded = await Promise.all([
      readJson(catalogPath),
      readJson(availabilityPath),
      readJson(assessmentsPath),
      ...courseContentPaths.map((filePath) => readJson(filePath)),
    ]);
    [catalog, availability, assessments] = loaded;
    courseContents = loaded.slice(3, 3 + COURSE_CONTENT_SPECS.length);
  } catch (error) {
    throw new SiteValidationError([error.message]);
  }

  const catalogResult = validateCatalog(catalog);
  errors.push(...catalogResult.errors);
  const availabilityResult = validateAvailability(
    availability,
    catalogResult.sessionIds.length ? catalogResult.sessionIds : SESSION_IDS,
    options.expectedOpen ?? null,
  );
  errors.push(...availabilityResult.errors);
  const assessmentsResult = validateAssessments(assessments);
  errors.push(...assessmentsResult.errors);
  courseContents.forEach((course, index) => {
    errors.push(...validateCourseContent(course, COURSE_CONTENT_SPECS[index]).errors);
  });

  const caseDirectory = path.join(
    docsDirectory,
    "cases",
    "expanded-cancer-screening",
  );
  const caseEntryPath = path.join(caseDirectory, "index.html");
  let caseEntryHtml = "";
  if (!(await fileExists(caseEntryPath))) {
    errors.push(
      "缺少學生操作資料包 docs/cases/expanded-cancer-screening/index.html",
    );
  } else {
    caseEntryHtml = await fs.readFile(caseEntryPath, "utf8");
  }
  for (const course of courseContents) {
    const casePack = isPlainObject(course.casePack) ? course.casePack : {};
    const stageId = String(casePack.stageId || "");
    if (
      caseEntryHtml &&
      stageId &&
      !caseEntryHtml.includes(`id="${stageId}"`)
    ) {
      errors.push(`學生操作資料包缺少 #${stageId} 課程定位點`);
    }
    for (const fileName of Array.isArray(casePack.suggestedFiles)
      ? casePack.suggestedFiles
      : []) {
      if (
        typeof fileName !== "string" ||
        !fileName ||
        path.basename(fileName) !== fileName
      ) {
        errors.push(`${course.id}.casePack.suggestedFiles 含不安全檔名`);
        continue;
      }
      if (!(await fileExists(path.join(caseDirectory, fileName)))) {
        errors.push(`${course.id}.casePack 建議檔案不存在：${fileName}`);
      }
    }
  }

  const repositoryFiles = await listRepositoryFiles(rootDirectory);
  for (const relativePath of repositoryFiles) {
    for (const finding of classifyRepositoryPath(relativePath)) {
      errors.push(`${relativePath}：${finding}`);
    }
  }

  const docsFiles = repositoryFiles.filter((file) => file.startsWith("docs/"));
  const privatePublicMarkers = [
    "instructor-prompts.json",
    "講師模式",
    "data-instructor-only",
    "speakerCue",
    "speakerNote",
    "feedbackPhrases",
    "referenceMiniOutline",
    "intentionalErrors",
    "correctedTitle",
  ];

  for (const sessionPage of catalogResult.sessionPages) {
    const expectedContentPath = `sessions/${sessionPage.id}/`;
    if (
      !SESSION_IDS.includes(sessionPage.id) ||
      sessionPage.contentPath !== expectedContentPath
    ) {
      continue;
    }
    const expectedRelativePath = `docs/${sessionPage.contentPath}index.html`;
    const pagePath = path.join(rootDirectory, ...expectedRelativePath.split("/"));
    if (!(await fileExists(pagePath))) {
      errors.push(`${sessionPage.id} 找不到對應內容頁 ${expectedRelativePath}`);
      continue;
    }
    const sessionHtml = await fs.readFile(pagePath, "utf8");
    errors.push(
      ...auditSessionPageIdentity(sessionHtml, sessionPage, expectedRelativePath),
    );
  }

  for (const relativePath of docsFiles) {
    if (!TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
      continue;
    }
    const text = await fs.readFile(path.join(rootDirectory, relativePath), "utf8");
    if (
      path.extname(relativePath).toLowerCase() === ".csv" &&
      relativePath.startsWith("docs/cases/expanded-cancer-screening/")
    ) {
      const rows = text.trim().split(/\r?\n/);
      if (
        !rows[0]?.startsWith("data_status,") ||
        rows.slice(1).some((row) => row && !row.startsWith("教學合成資料,"))
      ) {
        errors.push(
          `${relativePath} 必須以 data_status 欄逐列標示為教學合成資料`,
        );
      }
    }
    const forbidden = findForbiddenPhrases(text);
    if (forbidden.length) {
      errors.push(`${relativePath} 含已取消內容：${forbidden.join("、")}`);
    }
    const privateMarkers = privatePublicMarkers.filter((marker) =>
      text.includes(marker),
    );
    if (privateMarkers.length) {
      errors.push(
        `${relativePath} 含講師私密內容標記：${privateMarkers.join("、")}`,
      );
    }
  }

  let checkedReferences = 0;
  const htmlFiles = docsFiles.filter((file) => path.extname(file).toLowerCase() === ".html");
  for (const relativePath of htmlFiles) {
    const absolutePath = path.join(rootDirectory, relativePath);
    const html = await fs.readFile(absolutePath, "utf8");
    const audit = auditHtml(html, relativePath);
    errors.push(...audit.errors);
    for (const reference of audit.references) {
      const referenceError = await validateLocalReference(
        reference,
        path.dirname(absolutePath),
        docsDirectory,
      );
      if (referenceError) {
        errors.push(`${relativePath}：${referenceError}`);
      } else if (isLocalReference(reference)) {
        checkedReferences += 1;
      }
    }
  }

  const cssFiles = docsFiles.filter((file) => path.extname(file).toLowerCase() === ".css");
  for (const relativePath of cssFiles) {
    const absolutePath = path.join(rootDirectory, relativePath);
    const css = await fs.readFile(absolutePath, "utf8");
    for (const reference of collectCssReferences(css)) {
      const referenceError = await validateLocalReference(
        reference,
        path.dirname(absolutePath),
        docsDirectory,
      );
      if (referenceError) {
        errors.push(`${relativePath}：${referenceError}`);
      } else if (isLocalReference(reference)) {
        checkedReferences += 1;
      }
    }
  }

  const jsFiles = docsFiles.filter((file) => path.extname(file).toLowerCase() === ".js");
  for (const relativePath of jsFiles) {
    const javascript = await fs.readFile(path.join(rootDirectory, relativePath), "utf8");
    for (const reference of collectJavascriptPublicReferences(javascript)) {
      const referenceError = await validateLocalReference(reference, docsDirectory, docsDirectory);
      if (referenceError) {
        errors.push(`${relativePath}：${referenceError}`);
      } else {
        checkedReferences += 1;
      }
    }
  }

  if (errors.length) {
    throw new SiteValidationError(errors);
  }

  return {
    cohortCount: catalogResult.cohortCount,
    sessionCount: catalogResult.sessionIds.length,
    contentPageCount: catalogResult.sessionPages.length,
    courseContentCount: courseContents.length,
    assessmentQuestionCount: assessmentsResult.questionCount,
    satisfactionQuestionCount: assessmentsResult.satisfactionQuestionCount,
    privateInstructorContentExcluded: true,
    openIds: [...availabilityResult.openIds].sort(),
    repositoryFileCount: repositoryFiles.length,
    checkedReferences,
  };
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) {
    return false;
  }
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function timeToMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function isLocalReference(reference) {
  const value = String(reference || "").trim();
  return Boolean(value) &&
    !value.startsWith("#") &&
    !value.startsWith("//") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

async function validateLocalReference(reference, baseDirectory, docsDirectory) {
  if (!isLocalReference(reference)) {
    return null;
  }

  const withoutQuery = String(reference).split(/[?#]/, 1)[0];
  if (withoutQuery.startsWith("/")) {
    return `不得使用根目錄絕對連結 ${reference}；GitHub project Pages 需相對路徑`;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return `連結不是有效 URI：${reference}`;
  }

  const absolute = path.resolve(baseDirectory, decoded);
  const relativeToDocs = path.relative(docsDirectory, absolute);
  if (relativeToDocs.startsWith("..") || path.isAbsolute(relativeToDocs)) {
    return `連結越出 docs 公開根目錄：${reference}`;
  }

  if (!(await fileExists(absolute))) {
    return `找不到本機資產 ${reference}`;
  }
  return null;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function escapeRegularExpression(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
