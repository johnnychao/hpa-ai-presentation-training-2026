import { promises as fs } from "node:fs";
import path from "node:path";

export const SESSION_IDS = Object.freeze(
  Array.from({ length: 6 }, (_, index) => `session-${String(index + 1).padStart(2, "0")}`),
);

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
    if (cohort?.id !== expectedCohortId) {
      errors.push(`第 ${cohortIndex + 1} 梯 id 必須是 ${expectedCohortId}`);
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
      contentPath: session?.contentPath,
    })),
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
  if (BLOCKED_PUBLIC_EXTENSIONS.has(extension)) {
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

export function auditSessionPageIdentity(html, sessionId, fileLabel = "session page") {
  const errors = [];
  const mainTag = html.match(/<main\b[^>]*>/i)?.[0] || "";
  const expectedAttribute = new RegExp(
    `\\bdata-session-id\\s*=\\s*(["'])${escapeRegularExpression(sessionId)}\\1`,
    "i",
  );

  if (!mainTag || !expectedAttribute.test(mainTag)) {
    errors.push(`${fileLabel} 的 main 必須宣告 data-session-id="${sessionId}"`);
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
  const indexPath = path.join(docsDirectory, "index.html");
  const requiredFiles = [catalogPath, availabilityPath, indexPath];

  for (const requiredFile of requiredFiles) {
    if (!(await fileExists(requiredFile))) {
      errors.push(`缺少必要檔案 ${path.relative(rootDirectory, requiredFile)}`);
    }
  }
  if (errors.length) {
    throw new SiteValidationError(errors);
  }

  let catalog;
  let availability;
  try {
    [catalog, availability] = await Promise.all([
      readJson(catalogPath),
      readJson(availabilityPath),
    ]);
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

  const repositoryFiles = await listRepositoryFiles(rootDirectory);
  for (const relativePath of repositoryFiles) {
    for (const finding of classifyRepositoryPath(relativePath)) {
      errors.push(`${relativePath}：${finding}`);
    }
  }

  const docsFiles = repositoryFiles.filter((file) => file.startsWith("docs/"));

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
      ...auditSessionPageIdentity(sessionHtml, sessionPage.id, expectedRelativePath),
    );
  }

  for (const relativePath of docsFiles) {
    if (!TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
      continue;
    }
    const text = await fs.readFile(path.join(rootDirectory, relativePath), "utf8");
    const forbidden = findForbiddenPhrases(text);
    if (forbidden.length) {
      errors.push(`${relativePath} 含已取消內容：${forbidden.join("、")}`);
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
