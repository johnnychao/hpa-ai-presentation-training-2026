import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const docsDirectory = path.join(rootDirectory, "docs");
const catalogPath = path.join(docsDirectory, "data", "course-catalog.json");
const coursesDirectory = path.join(docsDirectory, "data", "courses");
const sessionsDirectory = path.join(docsDirectory, "sessions");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textValue(value, fallback = "") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function firstText(...values) {
  for (const value of values) {
    const result = textValue(value);
    if (result) {
      return result;
    }
  }
  return "";
}

function padSequence(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 99) {
    throw new Error(`無效的梯次序號：${value}`);
  }
  return String(number).padStart(2, "0");
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) {
    return { full: dateValue, stamp: dateValue, year: "" };
  }

  return {
    full: new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      timeZone: "Asia/Taipei",
    }).format(date),
    stamp: new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Taipei",
    })
      .format(date)
      .replace("/", "."),
    year: new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Asia/Taipei",
    }).format(date),
  };
}

function renderPage({ cohort, session, course, courseId, timezone }) {
  const meta = course && typeof course.meta === "object" ? course.meta : {};
  const topicTitle = textValue(meta.title);
  const seriesTitle = textValue(meta.subtitle);
  const title =
    topicTitle && seriesTitle
      ? `${seriesTitle}：${topicTitle}`
      : firstText(
          topicTitle,
          seriesTitle,
          cohort.courseName,
          "AI 簡報教育訓練",
        );
  const subtitle = textValue(meta.tagline, textValue(cohort.goal, "完整課程內容"));
  const level = textValue(meta.level, textValue(cohort.difficulty, "實作課程"));
  const cohortLabel = textValue(cohort.label, `第${cohort.sequence}梯`);
  const sessionLabel = textValue(session.label, `第${session.sequence}場次`);
  const date = formatDate(session.date);
  const startTime = textValue(session.startTime, "10:00");
  const endTime = textValue(session.endTime, "12:00");
  const description = `${cohortLabel}${sessionLabel}：${title}，完整課程內容與實作工具。`;
  const courseSource = `../../data/courses/${courseId}.json`;
  const assessmentSource = "../../data/assessments.json";

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#008579">
    <title>${escapeHtml(cohortLabel)}${escapeHtml(sessionLabel)}｜${escapeHtml(title)}</title>
    <link rel="icon" href="../../assets/images/hpa-favicon.ico">
    <link rel="stylesheet" href="../../assets/styles.css">
    <script src="../../assets/course-page.js" defer></script>
  </head>
  <body class="session-page course-content-page">
    <a class="skip-link" href="#main-content">跳至主要內容</a>
    <header class="site-header">
      <div class="shell header-inner">
        <a class="brand" href="../../index.html#top" aria-label="國民健康署 AI 簡報教育訓練課程專用入口，回到首頁">
          <img class="brand-logo" src="../../assets/images/hpa-logo.png" alt="衛生福利部國民健康署" width="575" height="162">
          <span class="brand-copy">
            <strong>AI 簡報教育訓練</strong>
            <span class="brand-separator" aria-hidden="true">｜</span>
            <small>課程專用入口</small>
          </span>
        </a>
        <nav class="site-nav" aria-label="場次導覽">
          <a href="../../index.html#schedule">返回場次入口</a>
        </nav>
      </div>
    </header>

    <main
      id="main-content"
      tabindex="-1"
      data-session-id="${escapeHtml(session.id)}"
      data-course-id="${escapeHtml(courseId)}"
      data-session-date="${escapeHtml(session.date)}"
      data-start-time="${escapeHtml(startTime)}"
      data-end-time="${escapeHtml(endTime)}"
      data-timezone="${escapeHtml(timezone)}"
    >
      <section class="session-page-hero course-page-hero" aria-labelledby="session-title">
        <div class="shell session-page-hero-layout">
          <div>
            <a class="session-back-link" href="../../index.html#schedule">
              <span aria-hidden="true">←</span> 返回場次入口
            </a>
            <p class="session-page-label">${escapeHtml(cohortLabel)} · ${escapeHtml(sessionLabel)} · ${escapeHtml(level)}</p>
            <h1 id="session-title">${escapeHtml(title)}</h1>
            <p class="session-page-lead">${escapeHtml(subtitle)}</p>
          </div>
          <div class="session-date-panel" aria-label="上課日期與時間">
            <span>${escapeHtml(date.year)}</span>
            <strong>${escapeHtml(date.stamp)}</strong>
            <p>${escapeHtml(date.full)}<br>${escapeHtml(startTime)}–${escapeHtml(endTime)}</p>
          </div>
        </div>
      </section>

      <section class="course-app-section" aria-label="完整課程內容">
        <div class="shell">
          <div
            id="course-page-root"
            class="course-page-root"
            data-course-src="${escapeHtml(courseSource)}"
            data-assessment-src="${escapeHtml(assessmentSource)}"
            aria-busy="true"
          >
            <div class="course-page-loading" role="status">
              <span class="course-loading-mark" aria-hidden="true"></span>
              <div>
                <strong>正在載入完整課程內容</strong>
                <p>課程會自動顯示，不需要再次點擊。</p>
              </div>
            </div>
          </div>
          <noscript>
            <div class="course-page-error">
              <h2>需要啟用 JavaScript</h2>
              <p>請啟用 JavaScript 後重新整理，即可直接查看完整課程內容。</p>
            </div>
          </noscript>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="shell footer-inner">
        <p><strong>國民健康署 AI 簡報教育訓練</strong><br>${escapeHtml(cohortLabel)} · ${escapeHtml(sessionLabel)}</p>
        <div class="footer-links">
          <a href="https://www.hpa.gov.tw/home/index.aspx" target="_blank" rel="noopener">國民健康署官方網站 <span aria-hidden="true">↗</span></a>
          <a href="#main-content">回到頁首 <span aria-hidden="true">↑</span></a>
        </div>
      </div>
    </footer>
  </body>
</html>
`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const catalog = await readJson(catalogPath);
  if (!Array.isArray(catalog.cohorts) || catalog.cohorts.length !== 3) {
    throw new Error("course-catalog.json 必須包含三個 cohorts");
  }

  let generatedCount = 0;
  for (const cohort of catalog.cohorts) {
    const courseId = `ai-deck-${padSequence(cohort.sequence)}`;
    const coursePath = path.join(coursesDirectory, `${courseId}.json`);
    const course = await readJson(coursePath);
    const declaredCourseId = textValue(course.id || course.meta?.id, courseId);

    if (declaredCourseId !== courseId) {
      throw new Error(
        `${path.relative(rootDirectory, coursePath)} 的課程 id 必須是 ${courseId}，目前為 ${declaredCourseId}`,
      );
    }
    if (!Array.isArray(cohort.sessions) || cohort.sessions.length !== 2) {
      throw new Error(`${cohort.id} 必須包含兩個 sessions`);
    }

    for (const session of cohort.sessions) {
      const expectedContentPath = `sessions/${session.id}/`;
      if (session.contentPath !== expectedContentPath) {
        throw new Error(`${session.id}.contentPath 必須是 ${expectedContentPath}`);
      }

      const outputDirectory = path.join(sessionsDirectory, session.id);
      const outputPath = path.join(outputDirectory, "index.html");
      const html = renderPage({
        cohort,
        session,
        course,
        courseId,
        timezone: catalog?.series?.timezone || "Asia/Taipei",
      });
      await fs.mkdir(outputDirectory, { recursive: true });
      await fs.writeFile(outputPath, html, "utf8");
      generatedCount += 1;
    }
  }

  console.log(`✓ 已產生 ${generatedCount} 個場次課程頁`);
}

main().catch((error) => {
  console.error(`產生場次頁失敗：${error.message}`);
  process.exitCode = 1;
});
