import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const defaultOutput = path.join(rootDirectory, "docs", "data", "assessments.json");

const courseIdMap = Object.freeze({
  course_1: "ai-deck-01",
  course_2: "ai-deck-02",
  course_3: "ai-deck-03",
});

const satisfaction = Object.freeze({
  appliesTo: "post",
  scale: [
    { value: 1, label: "非常不同意" },
    { value: 2, label: "不同意" },
    { value: 3, label: "普通" },
    { value: 4, label: "同意" },
    { value: 5, label: "非常同意" },
  ],
  questions: [
    { id: "satisfaction_01", stem: "本次課程內容符合我的工作需求。" },
    { id: "satisfaction_02", stem: "本次課程的操作步驟與進度讓我能跟上。" },
    { id: "satisfaction_03", stem: "本次課程教材清楚且可直接使用。" },
    { id: "satisfaction_04", stem: "完成本次課程後，我有信心完成指定產出。" },
    { id: "satisfaction_05", stem: "整體而言，我對本次課程感到滿意。" },
  ],
});

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} 必須是非空白字串`);
  }
  return value.trim();
}

function sanitizeQuestions(value, label) {
  if (!Array.isArray(value) || value.length !== 10) {
    throw new Error(`${label} 必須恰好有 10 題`);
  }
  return value.map((question, index) => {
    const prefix = `${label}[${index}]`;
    const options = Array.isArray(question?.options) ? question.options : [];
    if (
      options.length !== 4 ||
      options.some((option) => typeof option !== "string" || !option.trim())
    ) {
      throw new Error(`${prefix}.options 必須恰好有 4 個非空白選項`);
    }
    return {
      id: requiredText(question?.id, `${prefix}.id`),
      stem: requiredText(question?.stem, `${prefix}.stem`),
      options: options.map((option) => option.trim()),
    };
  });
}

async function main() {
  const source = argumentValue("--source");
  const output = path.resolve(argumentValue("--output") || defaultOutput);
  if (!source) {
    throw new Error(
      "請使用 --source 指定私有題庫 quiz_data.json；公開輸出不會包含正解與解析。",
    );
  }

  const sourceData = JSON.parse(await fs.readFile(path.resolve(source), "utf8"));
  const sourceCourses = Array.isArray(sourceData?.courses) ? sourceData.courses : [];
  if (sourceCourses.length !== 3) {
    throw new Error(`題庫必須恰好有 3 階，目前為 ${sourceCourses.length}`);
  }

  const courses = {};
  sourceCourses.forEach((course) => {
    const publicId = courseIdMap[course?.course_id];
    if (!publicId) {
      throw new Error(`未知課程代碼：${course?.course_id}`);
    }
    courses[publicId] = {
      pre: {
        questions: sanitizeQuestions(
          course?.tests?.pre,
          `${course.course_id}.tests.pre`,
        ),
      },
      post: {
        questions: sanitizeQuestions(
          course?.tests?.post,
          `${course.course_id}.tests.post`,
        ),
      },
    };
  });

  const publicAssessments = {
    schemaVersion: "1.0.0",
    questionVersion: requiredText(sourceData?.version, "題庫 version"),
    timezone: "Asia/Taipei",
    recommendedMinutes: requiredText(
      sourceData?.assessment_design?.recommended_time_minutes,
      "recommended_time_minutes",
    ),
    timing: {
      pre: {
        openMinutesBeforeStart: 30,
        closeAt: "start",
      },
      post: {
        openMinutesBeforeEnd: 10,
        closeAt: "end",
      },
    },
    submission: {
      payloadSchema: "hpa-assessment-response-v1",
      pre: {
        provider: "google-forms",
        action:
          "https://docs.google.com/forms/d/e/1FAIpQLSfDQGzPsw8joT6fifng4wlrPF_wKSycEJN_F9rhpkn24wFrBw/formResponse",
        fieldName: "entry.1571631749",
      },
      post: {
        provider: "google-forms",
        action:
          "https://docs.google.com/forms/d/e/1FAIpQLScQhPnydpeY0hw_JrhLtHT4UFQ1fJNlf2WaokQ-VLlWHWsyZA/formResponse",
        fieldName: "entry.1571631749",
      },
    },
    satisfaction,
    courses,
  };

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(publicAssessments, null, 2)}\n`, "utf8");
  console.log(
    `已建立 ${path.relative(rootDirectory, output)}：60 題評量＋5 題後測滿意度；公開檔不含正解與解析。`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
