(() => {
  "use strict";

  const root = document.querySelector("#course-page-root");
  const main = document.querySelector("main[data-session-id][data-course-id]");
  if (!root || !main) {
    return;
  }

  const FIELD_LABELS = {
    action: "操作",
    actions: "操作",
    answer: "參考答案",
    audience: "適用對象",
    boundary: "適用邊界",
    check: "完成檢查",
    completionScore: "完成分數",
    content: "內容",
    context: "情境",
    correctedTitle: "修正後標題",
    coreMessage: "核心訊息",
    courseTotalPoints: "課程總分",
    criteria: "評量標準",
    decisionSentence: "決策句",
    deliverable: "交付成果",
    deliverables: "交付成果",
    demo: "示範流程",
    demoDurationMinutes: "示範時間",
    demoMaterial: "示範材料",
    demoSteps: "示範步驟",
    description: "說明",
    disclaimer: "教學聲明",
    duration: "時間",
    durationMinutes: "時間",
    endMinute: "結束時間",
    evidence: "證據",
    evaluability: "可評估性",
    expectedOutput: "預期產出",
    feedbackPhrases: "講評語句",
    fictionalEvidence: "虛構證據",
    fictionalOptions: "虛構選項",
    fileName: "檔名",
    finding: "資料發現",
    focus: "學習焦點",
    goal: "目標",
    groupSize: "建議分組",
    humanCheck: "人工檢查",
    intentionalErrors: "刻意錯誤",
    instruction: "操作說明",
    instructions: "操作說明",
    label: "標示",
    learnerOutput: "學員產出",
    levels: "評分級距",
    limitation: "資料限制",
    limitations: "資料限制",
    mainRisk: "主要風險",
    materials: "使用材料",
    maxPoints: "最高分",
    method: "資料方法",
    minutes: "分鐘",
    objective: "目標",
    options: "選項",
    order: "步驟",
    output: "產出",
    page: "頁碼",
    period: "資料期間",
    presentation: "成果展示",
    problemSlide: "問題頁",
    problemFocus: "問題焦點",
    prompt: "提示詞",
    promptId: "提示詞代碼",
    promptIds: "搭配提示詞",
    provider: "提供單位",
    purpose: "用途",
    question: "題目",
    rationale: "理由",
    reason: "理由",
    recommendation: "建議",
    referenceMiniOutline: "參考迷你大綱",
    resourceNeed: "資源需求",
    returnConditions: "退回條件",
    returnIf: "退回條件",
    reversibility: "可逆性",
    role: "角色",
    rubric: "評分規準",
    scenario: "案例情境",
    schedule: "時間配置",
    scoreLabel: "得分",
    script: "講解詞",
    seconds: "秒數",
    showcase: "成果展示",
    slide: "投影片",
    source: "來源",
    sourceCards: "來源卡",
    sourceChoice: "來源選擇",
    sourceId: "來源代碼",
    speakerCue: "講者提示",
    speakerNote: "講者提示",
    startMinute: "開始時間",
    startSpeed: "啟動速度",
    statement: "敘述",
    steps: "操作步驟",
    submission: "繳交內容",
    task: "任務",
    tasks: "任務",
    teachingPoint: "教學重點",
    timebox: "建議時間",
    tips: "提示",
    template: "操作範本",
    title: "標題",
    visual: "視覺建議",
    work: "工作內容",
    why: "為什麼這樣做",
  };

  const state = {
    course: null,
    courseId: main.dataset.courseId,
    sessionId: main.dataset.sessionId,
    instructorMode: false,
    instructorPromptLibrary: {
      title: "NotebookLM 講師簡報生成提示詞",
      usageNote: "",
      items: [],
      error: "",
    },
    printDetails: [],
  };

  function createElement(tagName, options = {}) {
    const node = document.createElement(tagName);
    if (options.className) {
      node.className = options.className;
    }
    if (options.text !== undefined && options.text !== null) {
      node.textContent = String(options.text);
    }
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([name, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          node.setAttribute(name, String(value));
        }
      });
    }
    return node;
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

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function hasContent(value) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (isObject(value)) {
      return Object.keys(value).length > 0;
    }
    return Boolean(textValue(value));
  }

  function arrayFrom(value, keys = []) {
    if (Array.isArray(value)) {
      return value;
    }
    if (!isObject(value)) {
      return value === undefined || value === null || value === "" ? [] : [value];
    }
    for (const key of keys) {
      if (Array.isArray(value[key])) {
        return value[key];
      }
    }
    return [value];
  }

  function safeToken(value, fallback = "item") {
    const token = textValue(value, fallback)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return token || fallback;
  }

  function humanLabel(key) {
    if (FIELD_LABELS[key]) {
      return FIELD_LABELS[key];
    }
    if (/^\d+$/.test(String(key))) {
      return `${key} 分`;
    }
    const scoreMatch = String(key).match(/^(\d+)OrBelow$/);
    if (scoreMatch) {
      return `${scoreMatch[1]} 分以下`;
    }
    return String(key)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/^./, (letter) => letter.toUpperCase());
  }

  function itemTitle(item, fallback) {
    if (!isObject(item)) {
      return textValue(item, fallback);
    }
    return firstText(
      item.title,
      item.name,
      item.module,
      item.phase,
      item.stepTitle,
      item.task,
      item.question,
      fallback,
    );
  }

  function itemDescription(item) {
    if (!isObject(item)) {
      return "";
    }
    return firstText(
      item.description,
      item.detail,
      item.focus,
      item.instruction,
      item.context,
      item.purpose,
      item.why,
    );
  }

  function appendTextList(parent, value, className = "course-bullet-list") {
    const values = arrayFrom(value, ["items", "list", "points", "criteria"]);
    if (!values.length) {
      parent.append(
        createElement("p", {
          className: "course-fallback",
          text: "此項內容將由講師於課堂中說明。",
        }),
      );
      return;
    }

    const list = createElement("ul", { className });
    values.forEach((item) => {
      const text = isObject(item)
        ? firstText(
            item.text,
            item.label,
            item.title,
            item.description,
            item.goal,
            item.output,
          )
        : textValue(item);
      if (!text) {
        return;
      }
      list.append(createElement("li", { text }));
    });
    if (list.children.length) {
      parent.append(list);
    }
  }

  function appendValue(parent, value, options = {}) {
    const depth = Number(options.depth) || 0;
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      if (!value.some((item) => isObject(item))) {
        appendTextList(parent, value, options.className);
        return;
      }

      const cards = createElement("div", { className: "course-nested-cards" });
      value.forEach((item, index) => {
        if (!isObject(item)) {
          cards.append(
            createElement("p", {
              className: "course-nested-text",
              text: textValue(item),
            }),
          );
          return;
        }

        const card = createElement("article", { className: "course-nested-card" });
        const title = itemTitle(item, "");
        if (title) {
          card.append(createElement("h4", { text: title }));
        }
        const description = itemDescription(item);
        if (description && description !== title) {
          card.append(createElement("p", { text: description }));
        }
        const excluded = new Set([
          "id",
          "slug",
          "title",
          "name",
          "module",
          "phase",
          "stepTitle",
          "task",
          "question",
          "description",
          "detail",
          "focus",
          "instruction",
          "context",
          "purpose",
          "why",
        ]);
        const remainder = Object.fromEntries(
          Object.entries(item).filter(
            ([key, nested]) => !excluded.has(key) && hasContent(nested),
          ),
        );
        appendValue(card, remainder, { depth: depth + 1 });
        cards.append(card);
      });
      parent.append(cards);
      return;
    }
    if (isObject(value)) {
      if (depth > 5) {
        parent.append(
          createElement("p", {
            className: "course-fallback",
            text: "詳細內容請依課堂說明確認。",
          }),
        );
        return;
      }
      const list = createElement("dl", { className: "course-data-list" });
      Object.entries(value).forEach(([key, nestedValue]) => {
        if (
          nestedValue === undefined ||
          nestedValue === null ||
          nestedValue === "" ||
          ["id", "slug"].includes(key)
        ) {
          return;
        }
        const term = createElement("dt", { text: humanLabel(key) });
        const detail = createElement("dd");
        appendValue(detail, nestedValue, {
          className: "course-inline-list",
          depth: depth + 1,
        });
        list.append(term, detail);
      });
      if (list.children.length) {
        parent.append(list);
      }
      return;
    }
    parent.append(createElement("p", { text: value }));
  }

  function createSection(id, kicker, title, lead = "") {
    const section = createElement("section", {
      className: "course-content-section",
      attributes: {
        id,
        "aria-labelledby": `${id}-title`,
        tabindex: "-1",
      },
    });
    const heading = createElement("header", { className: "course-section-heading" });
    heading.append(
      createElement("p", { className: "section-kicker", text: kicker }),
      createElement("h2", {
        text: title,
        attributes: { id: `${id}-title` },
      }),
    );
    if (lead) {
      heading.append(createElement("p", { text: lead }));
    }
    section.append(heading);
    return section;
  }

  function renderOverview(course) {
    const meta = isObject(course.meta) ? course.meta : {};
    const section = createSection(
      "course-overview",
      "Course outcome",
      "完成標準與課前準備",
      "先確認本課的交付標準，再依序進入操作與實作。",
    );
    const standard = createElement("article", { className: "completion-standard" });
    standard.append(
      createElement("span", { text: "完成標準" }),
      createElement("h3", {
        text: firstText(
          meta.completionStandard,
          course.completionStandard,
          "能依課程流程完成一份可檢查、可溝通的簡報成果。",
        ),
      }),
    );

    const facts = createElement("dl", { className: "course-meta-strip" });
    const metaFacts = [
      ["主要工具", firstText(meta.primaryTool, "NotebookLM")],
      [
        "課程時間",
        meta.durationMinutes ? `${meta.durationMinutes} 分鐘` : "依場次公告",
      ],
      [
        "建議頁數",
        meta.recommendedSlides ? `${meta.recommendedSlides} 頁藍圖` : "依任務調整",
      ],
      ["課程層級", firstText(meta.level, "實作課程")],
    ];
    metaFacts.forEach(([label, value]) => {
      facts.append(
        createElement("div", { className: "course-meta-fact" }),
      );
      facts.lastElementChild.append(
        createElement("dt", { text: label }),
        createElement("dd", { text: value }),
      );
    });

    const overviewGrid = createElement("div", { className: "course-overview-grid" });
    const overviewItems = [
      ["適用對象", course.audience],
      ["課前準備", course.prerequisites],
      ["學習目標", course.objectives],
      ["預期產出", course.outputs],
    ];
    overviewItems.forEach(([title, value]) => {
      const card = createElement("article", { className: "course-summary-card" });
      card.append(createElement("h3", { text: title }));
      appendTextList(card, value);
      overviewGrid.append(card);
    });
    section.append(standard, facts, overviewGrid);
    return section;
  }

  function renderTimeline(course) {
    const items = arrayFrom(course.timeline, ["items", "segments", "modules"]);
    const section = createSection(
      "course-timeline",
      "Learning path",
      "課程時間軸",
      "依時間順序掌握每一段任務、焦點與預期產出。",
    );
    const timeline = createElement("ol", { className: "full-course-timeline" });
    items.forEach((item, index) => {
      const record = isObject(item) ? item : { module: item };
      const start = Number(record.startMinute);
      const end = Number(record.endMinute);
      const duration = Number(record.durationMinutes);
      const range =
        Number.isFinite(start) && Number.isFinite(end)
          ? `${start}–${end}`
          : Number.isFinite(duration)
            ? `${duration}`
            : String(index + 1).padStart(2, "0");
      const timeSuffix =
        Number.isFinite(start) || Number.isFinite(end) || Number.isFinite(duration)
          ? "分鐘"
          : "段";
      const row = createElement("li");
      const time = createElement("div", { className: "full-timeline-time" });
      time.append(
        createElement("strong", { text: range }),
        createElement("span", { text: timeSuffix }),
      );
      const copy = createElement("div", { className: "full-timeline-copy" });
      copy.append(
        createElement("p", {
          className: "timeline-step",
          text: `MODULE ${String(index + 1).padStart(2, "0")}`,
        }),
        createElement("h3", {
          text: firstText(record.module, record.title, `課程單元 ${index + 1}`),
        }),
      );
      const focus = firstText(record.focus, record.description, record.detail);
      if (focus) {
        copy.append(createElement("p", { text: focus }));
      }
      const learnerOutput = firstText(
        record.learnerOutput,
        record.output,
        record.deliverable,
      );
      if (learnerOutput) {
        copy.append(
          createElement("p", {
            className: "timeline-output",
            text: `產出｜${learnerOutput}`,
          }),
        );
      }
      row.append(time, copy);
      timeline.append(row);
    });
    if (!timeline.children.length) {
      timeline.append(
        createElement("li", {
          className: "course-fallback",
          text: "時間軸將由講師於課堂開始時說明。",
        }),
      );
    }
    section.append(timeline);
    return section;
  }

  function renderWorkflow(course) {
    const items = arrayFrom(course.workflow, ["steps", "items"]);
    const section = createSection(
      "course-workflow",
      "NotebookLM workflow",
      "NotebookLM 操作工作流",
      "照著步驟完成來源整理、摘要、架構與輸出檢查。",
    );
    const workflow = createElement("ol", { className: "workflow-grid" });
    items.forEach((item, index) => {
      const record = isObject(item) ? item : { title: item };
      const card = createElement("li", { className: "workflow-card" });
      card.append(
        createElement("span", {
          className: "workflow-number",
          text: String(record.step || record.order || index + 1).padStart(2, "0"),
        }),
        createElement("h3", {
          text: itemTitle(record, `操作步驟 ${index + 1}`),
        }),
      );
      const description = itemDescription(record);
      if (description) {
        card.append(createElement("p", { text: description }));
      }
      const details = {};
      [
        "actions",
        "action",
        "template",
        "input",
        "output",
        "humanCheck",
        "check",
        "promptIds",
        "tips",
      ].forEach((key) => {
        if (hasContent(record[key])) {
          details[key] = record[key];
        }
      });
      appendValue(card, details);
      workflow.append(card);
    });
    section.append(workflow);
    return section;
  }

  function promptText(item) {
    if (!isObject(item)) {
      return textValue(item);
    }
    return firstText(
      item.prompt,
      item.text,
      item.template,
      item.content,
      item.body,
      item.example,
    );
  }

  function renderPrompts(course) {
    const items = arrayFrom(course.prompts, ["items", "templates", "prompts"]);
    const section = createSection(
      "course-prompts",
      "Prompt library",
      "可複製提示詞",
      "依用途選擇提示詞；複製後請先移除或改寫任何敏感內容。",
    );
    const grid = createElement("div", { className: "prompt-grid" });
    items.forEach((item, index) => {
      const record = isObject(item) ? item : { prompt: item };
      const text = promptText(record);
      const codeId = `prompt-${index + 1}`;
      const card = createElement("article", { className: "prompt-card" });
      const header = createElement("header");
      const copy = createElement("button", {
        className: "copy-prompt-button",
        text: "複製",
        attributes: {
          type: "button",
          "data-copy-target": codeId,
          "aria-label": `複製提示詞：${itemTitle(record, `提示詞 ${index + 1}`)}`,
        },
      });
      header.append(
        createElement("div", { className: "prompt-title" }),
        copy,
      );
      header.firstElementChild.append(
        createElement("span", { text: `PROMPT ${String(index + 1).padStart(2, "0")}` }),
        createElement("h3", { text: itemTitle(record, `提示詞 ${index + 1}`) }),
      );
      const purpose = firstText(record.purpose, record.whenToUse, record.description);
      if (purpose) {
        card.append(header, createElement("p", { className: "prompt-purpose", text: purpose }));
      } else {
        card.append(header);
      }
      const pre = createElement("pre");
      pre.append(
        createElement("code", {
          text: text || "提示詞內容將由講師於課堂中提供。",
          attributes: { id: codeId },
        }),
      );
      card.append(pre);
      const expectedOutput = firstText(
        record.expectedOutput,
        record.output,
        record.deliverable,
      );
      if (expectedOutput) {
        const output = createElement("p", {
          className: "prompt-output",
          text: `預期產出｜${expectedOutput}`,
        });
        card.append(output);
      }
      grid.append(card);
    });
    section.append(grid);
    return section;
  }

  function genericCard(item, index, className = "structured-card") {
    const record = isObject(item) ? item : { title: item };
    const card = createElement("article", { className });
    card.append(
      createElement("h3", {
        text: itemTitle(record, `項目 ${index + 1}`),
      }),
    );
    const description = itemDescription(record);
    if (description) {
      card.append(createElement("p", { text: description }));
    }
    const excluded = new Set([
      "id",
      "slug",
      "title",
      "name",
      "module",
      "phase",
      "stepTitle",
      "description",
      "detail",
      "focus",
      "instruction",
      "context",
      "purpose",
      "why",
    ]);
    const remainder = Object.fromEntries(
      Object.entries(record).filter(
        ([key, value]) => !excluded.has(key) && hasContent(value),
      ),
    );
    appendValue(card, remainder);
    return card;
  }

  function renderPractice(course) {
    const practice = course.practice;
    const section = createSection(
      "course-practice",
      "Team exercise",
      "分組實作",
      "依任務分工、限時完成，並用清楚的交付成果收斂討論。",
    );
    const source = isObject(practice) ? practice : { tasks: practice };
    const intro = createElement("div", { className: "practice-brief" });
    const summaryFields = {};
    [
      "title",
      "task",
      "sourceChoice",
      "durationMinutes",
      "timebox",
      "groupSize",
      "goal",
      "deliverable",
      "deliverables",
    ].forEach((key) => {
      if (hasContent(source[key])) {
        summaryFields[key] = source[key];
      }
    });
    appendValue(intro, summaryFields);
    const taskSource =
      source.tasks || source.steps || source.items || source.instructions;
    const tasks = taskSource
      ? arrayFrom(taskSource, ["tasks", "steps", "items", "instructions"])
      : [];
    const grid = createElement("div", { className: "practice-grid" });
    tasks.forEach((item, index) => {
      grid.append(genericCard(item, index, "practice-card"));
    });
    const support = createElement("div", { className: "practice-support-grid" });
    [
      ["時間配置", source.schedule],
      ["成果展示", source.presentation || source.showcase],
    ].forEach(([title, value]) => {
      if (!hasContent(value)) {
        return;
      }
      const card = createElement("article", { className: "practice-support-card" });
      card.append(createElement("h3", { text: title }));
      appendValue(card, value);
      support.append(card);
    });
    section.append(intro);
    if (grid.children.length) {
      section.append(grid);
    }
    if (support.children.length) {
      section.append(support);
    }
    return section;
  }

  function renderCaseStudy(course) {
    const caseStudy = course.caseStudy;
    const section = createSection(
      "course-case",
      "Practice scenario",
      "虛構案例",
      "以下案例只供課堂練習，不代表任何真實單位、人物或政策資料。",
    );
    const caseCard = createElement("article", { className: "case-study-card" });
    caseCard.append(
      createElement("span", { className: "fiction-badge", text: "教學虛構" }),
    );
    if (isObject(caseStudy)) {
      caseCard.append(
        createElement("h3", {
          text: firstText(caseStudy.title, caseStudy.name, "課堂案例"),
        }),
      );
      const fields = Object.fromEntries(
        Object.entries(caseStudy).filter(
          ([key, value]) =>
            !["id", "title", "name"].includes(key) && hasContent(value),
        ),
      );
      appendValue(caseCard, fields);
    } else {
      caseCard.append(createElement("h3", { text: "課堂案例" }));
      appendValue(caseCard, caseStudy);
    }
    section.append(caseCard);
    return section;
  }

  function renderBlueprint(course) {
    const slides = arrayFrom(course.blueprint, ["slides", "pages", "items"]);
    const section = createSection(
      "course-blueprint",
      "Slide architecture",
      "投影片藍圖",
      `共 ${slides.length || "多"} 頁；逐頁確認核心訊息、視覺與講者提示。`,
    );
    const fictionNote = createElement("aside", {
      className: "course-safety-note blueprint-fiction-note",
      attributes: { "aria-label": "投影片藍圖虛構案例提醒" },
    });
    fictionNote.append(
      createElement("strong", { text: "教學虛構" }),
      createElement("p", {
        text:
          "教學虛構：本藍圖中的案例機關、數字、方案、時程與資源僅供教學，不代表國民健康署正式資料或政策立場。",
      }),
    );
    const groups = createElement("div", { className: "blueprint-groups" });
    const groupSize = 5;
    for (let start = 0; start < slides.length; start += groupSize) {
      const batch = slides.slice(start, start + groupSize);
      const firstNumber = Number(batch[0]?.number || batch[0]?.page) || start + 1;
      const lastNumber =
        Number(
          batch[batch.length - 1]?.number || batch[batch.length - 1]?.page,
        ) || start + batch.length;
      const details = createElement("details", {
        className: "blueprint-group",
        attributes: start === 0 ? { open: "open" } : {},
      });
      const summary = createElement("summary");
      summary.append(
        createElement("span", {
          text: `第 ${firstNumber}–${lastNumber} 頁`,
        }),
        createElement("strong", {
          text: `${batch.length} 頁藍圖`,
        }),
      );
      const list = createElement("div", { className: "blueprint-list" });
      batch.forEach((slide, index) => {
        const record = isObject(slide) ? slide : { title: slide };
        const number = Number(record.number || record.page) || start + index + 1;
        const card = createElement("article", { className: "blueprint-card" });
        card.append(
          createElement("span", {
            className: "blueprint-number",
            text: String(number).padStart(2, "0"),
          }),
          createElement("h3", {
            text: firstText(record.title, `第 ${number} 頁`),
          }),
        );
        const fields = [
          ["核心訊息", record.coreMessage || record.message],
          ["視覺建議", record.visual || record.visualDirection],
        ];
        fields.forEach(([label, value]) => {
          if (!hasContent(value)) {
            return;
          }
          const row = createElement("div", { className: "blueprint-field" });
          row.append(
            createElement("strong", { text: label }),
            createElement("p", { text: textValue(value) }),
          );
          card.append(row);
        });
        const speakerCue = firstText(record.speakerCue, record.speakerNote);
        if (speakerCue) {
          const cue = createElement("div", {
            className: "blueprint-field instructor-cue",
            attributes: { "data-instructor-only": "true" },
          });
          cue.append(
            createElement("strong", { text: "講者提示" }),
            createElement("p", { text: speakerCue }),
          );
          card.append(cue);
        }
        list.append(card);
      });
      details.append(summary, list);
      groups.append(details);
    }
    if (!slides.length) {
      groups.append(
        createElement("p", {
          className: "course-fallback",
          text: "投影片藍圖將由講師於課堂中逐頁說明。",
        }),
      );
    }
    section.append(fictionNote, groups);
    return section;
  }

  function flattenChecklist(value) {
    const direct = arrayFrom(value, ["items", "checks"]);
    const output = [];
    direct.forEach((item) => {
      if (isObject(item) && Array.isArray(item.items)) {
        item.items.forEach((nested) => {
          output.push({
            ...((isObject(nested) && nested) || { text: nested }),
            group: firstText(item.title, item.group),
          });
        });
      } else {
        output.push(item);
      }
    });
    return output;
  }

  function storageKey() {
    return `hpa-course-checklist:${state.courseId}:${state.sessionId}`;
  }

  function readChecklistState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey()) || "{}");
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeChecklistState(value) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function renderChecklist(course) {
    const items = flattenChecklist(course.checklist);
    const section = createSection(
      "course-checklist",
      "Quality gate",
      "完成檢核表",
      "勾選狀態只存於目前瀏覽器，不會送出或建立學員名單。",
    );
    const safety = createElement("aside", {
      className: "course-safety-note",
      attributes: { role: "note" },
    });
    safety.append(
      createElement("strong", { text: "個資與敏感資料提醒" }),
      createElement("p", {
        text: "禁止在提示詞或課堂案例中輸入姓名、電話、電子郵件、病歷、帳號及未公開公務資料。本頁只保存勾選項目的代碼與完成狀態。",
      }),
    );
    const stored = readChecklistState();
    const checklist = createElement("div", { className: "course-checklist" });
    const progressWrap = createElement("div", { className: "checklist-progress" });
    const progress = createElement("progress", {
      attributes: {
        max: String(Math.max(items.length, 1)),
        value: "0",
        "aria-label": "完成檢核進度",
      },
    });
    const progressText = createElement("span", { text: `0 / ${items.length}` });
    const clearButton = createElement("button", {
      className: "checklist-clear-button",
      text: "清除本機勾選",
      attributes: { type: "button" },
    });
    progressWrap.append(progress, progressText, clearButton);
    const list = createElement("div", { className: "checklist-items" });

    const updateProgress = () => {
      const checked = list.querySelectorAll('input[type="checkbox"]:checked').length;
      progress.value = checked;
      progressText.textContent = `${checked} / ${items.length}`;
    };

    items.forEach((item, index) => {
      const record = isObject(item) ? item : { text: item };
      const id = `${safeToken(record.id, "check")}-${index + 1}`;
      const inputId = `${state.courseId}-${state.sessionId}-${id}`;
      const label = createElement("label", { className: "checklist-item" });
      const checkbox = createElement("input", {
        attributes: {
          type: "checkbox",
          id: inputId,
          "data-check-id": id,
        },
      });
      checkbox.checked = stored[id] === true;
      const copy = createElement("span");
      const group = firstText(record.group, record.category);
      if (group) {
        copy.append(createElement("small", { text: group }));
      }
      copy.append(
        createElement("strong", {
          text: firstText(
            record.text,
            record.label,
            record.title,
            record.check,
            `檢核項目 ${index + 1}`,
          ),
        }),
      );
      const description = firstText(record.description, record.detail, record.why);
      if (description) {
        copy.append(createElement("em", { text: description }));
      }
      checkbox.addEventListener("change", () => {
        const next = readChecklistState();
        next[id] = checkbox.checked;
        writeChecklistState(next);
        updateProgress();
      });
      label.append(checkbox, copy);
      list.append(label);
    });
    clearButton.addEventListener("click", () => {
      try {
        localStorage.removeItem(storageKey());
      } catch {
        // Browsers may block storage; the visible state can still be reset.
      }
      list.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = false;
      });
      updateProgress();
      announce("已清除這門課在本機的檢核狀態。");
    });
    updateProgress();
    checklist.append(progressWrap, list);
    section.append(safety, checklist);
    return section;
  }

  function renderAssessment(course) {
    const section = createSection(
      "course-assessment",
      "Evidence of learning",
      "評量與課後作業",
      "用明確成果確認課堂學習，並把未完成項目帶回工作情境。",
    );
    const grid = createElement("div", { className: "assessment-grid" });
    const panels = [
      ["課堂評量", course.assessment],
      ["課後作業", course.homework],
      ["全系列退回條件", course.commonReturnConditions],
    ];
    panels.forEach(([title, value]) => {
      if (!hasContent(value)) {
        return;
      }
      const panel = createElement("article", { className: "assessment-card" });
      panel.append(createElement("h3", { text: title }));
      if (Array.isArray(value) && value.some((item) => isObject(item))) {
        const items = createElement("div", { className: "assessment-items" });
        value.forEach((item, index) => {
          items.append(genericCard(item, index, "assessment-item"));
        });
        panel.append(items);
      } else if (Array.isArray(value)) {
        appendTextList(panel, value);
      } else {
        appendValue(panel, value);
      }
      grid.append(panel);
    });
    section.append(grid);
    return section;
  }

  function renderInstructorPromptLibrary() {
    const library = state.instructorPromptLibrary;
    const panel = createElement("section", {
      className: "instructor-prompt-library",
      attributes: { "aria-labelledby": "instructor-prompt-library-title" },
    });
    const heading = createElement("header", {
      className: "instructor-prompt-library-heading",
    });
    heading.append(
      createElement("p", {
        className: "section-kicker",
        text: "NotebookLM instructor kit",
      }),
      createElement("h3", {
        text: firstText(
          library.title,
          "NotebookLM 講師簡報生成提示詞",
        ),
        attributes: { id: "instructor-prompt-library-title" },
      }),
    );
    if (library.usageNote) {
      heading.append(createElement("p", { text: library.usageNote }));
    }
    panel.append(heading);

    if (library.error) {
      panel.append(
        createElement("p", {
          className: "instructor-prompt-library-error",
          text: library.error,
          attributes: { role: "status" },
        }),
      );
      return panel;
    }

    const grid = createElement("div", {
      className: "prompt-grid instructor-prompt-grid",
    });
    library.items.forEach((item, index) => {
      const record = isObject(item) ? item : { text: item };
      const codeId = `instructor-prompt-${safeToken(
        record.id,
        String(index + 1),
      )}-${index + 1}`;
      const title = itemTitle(record, `講師提示詞 ${index + 1}`);
      const card = createElement("article", {
        className: "prompt-card instructor-prompt-card",
      });
      const cardHeader = createElement("header");
      const titleWrap = createElement("div", { className: "prompt-title" });
      titleWrap.append(
        createElement("span", {
          text: `${firstText(record.scope, "講師")} PROMPT ${String(
            index + 1,
          ).padStart(2, "0")}`,
        }),
        createElement("h4", { text: title }),
      );
      cardHeader.append(
        titleWrap,
        createElement("button", {
          className: "copy-prompt-button",
          text: "複製",
          attributes: {
            type: "button",
            "data-copy-target": codeId,
            "aria-label": `複製講師提示詞：${title}`,
          },
        }),
      );
      card.append(cardHeader);
      const purpose = firstText(
        record.purpose,
        record.whenToUse,
        record.description,
      );
      if (purpose) {
        card.append(
          createElement("p", {
            className: "prompt-purpose",
            text: purpose,
          }),
        );
      }
      const pre = createElement("pre");
      pre.append(
        createElement("code", {
          text:
            promptText(record) ||
            "講師提示詞內容暫時無法顯示，請使用已確認的教學來源操作。",
          attributes: { id: codeId },
        }),
      );
      card.append(pre);
      grid.append(card);
    });
    if (!grid.children.length) {
      grid.append(
        createElement("p", {
          className: "course-fallback",
          text: "本課的講師提示詞尚未提供，其他課程內容仍可正常使用。",
        }),
      );
    }
    panel.append(grid);
    return panel;
  }

  function renderInstructor(course) {
    const section = createSection(
      "course-instructor",
      "Instructor mode",
      "講師模式",
      "顯示帶領提示、講者備註與課堂觀察重點。",
    );
    section.classList.add("instructor-section");
    section.dataset.instructorOnly = "true";
    const items = arrayFrom(course.instructor, ["items", "notes", "tips"]);
    const grid = createElement("div", { className: "instructor-grid" });
    items.forEach((item, index) => {
      const record =
        isObject(item) && !itemTitle(item, "")
          ? { title: "講師操作與回饋", ...item }
          : item;
      grid.append(genericCard(record, index, "instructor-card"));
    });
    if (!grid.children.length) {
      grid.append(
        createElement("p", {
          className: "course-fallback",
          text: "本課沒有額外講師備註。",
        }),
      );
    }
    section.append(grid, renderInstructorPromptLibrary());
    return section;
  }

  function safetyText(safety) {
    const items = arrayFrom(safety, ["items", "rules", "notes"]);
    const texts = [];
    items.forEach((item) => {
      if (isObject(item)) {
        const text = firstText(
          item.text,
          item.title,
          item.description,
          item.rule,
          item.warning,
        );
        if (text) {
          texts.push(text);
        }
      } else if (textValue(item)) {
        texts.push(textValue(item));
      }
    });
    return texts;
  }

  function createToolbar() {
    const toolbar = createElement("div", {
      className: "course-toolbar",
      attributes: { "aria-label": "課程工具" },
    });
    const printButton = createElement("button", {
      className: "course-tool-button",
      text: "列印課程",
      attributes: { type: "button" },
    });
    const instructorButton = createElement("button", {
      className: "course-tool-button instructor-toggle",
      text: "開啟講師模式",
      attributes: {
        type: "button",
        "aria-pressed": "false",
      },
    });
    printButton.addEventListener("click", () => window.print());
    instructorButton.addEventListener("click", () => {
      setInstructorMode(!state.instructorMode, instructorButton);
    });
    toolbar.append(
      createElement("p", {
        text: "完整課程已展開於本頁，可依導覽直接前往各單元。",
      }),
      createElement("div", { className: "course-tool-actions" }),
    );
    toolbar.lastElementChild.append(printButton, instructorButton);
    return toolbar;
  }

  function setInstructorMode(enabled, button) {
    state.instructorMode = enabled;
    document.body.classList.toggle("is-instructor-mode", enabled);
    if (button) {
      button.setAttribute("aria-pressed", String(enabled));
      button.textContent = enabled ? "關閉講師模式" : "開啟講師模式";
    }
    announce(enabled ? "已開啟講師模式。" : "已關閉講師模式。");
  }

  function createNavigation(sections) {
    const aside = createElement("aside", { className: "course-sidebar" });
    const nav = createElement("nav", {
      className: "course-toc",
      attributes: { "aria-label": "完整課程導覽" },
    });
    nav.append(createElement("strong", { text: "課程導覽" }));
    const list = createElement("ol");
    sections.forEach((section, index) => {
      const title = section.querySelector("h2")?.textContent || `單元 ${index + 1}`;
      const link = createElement("a", {
        text: title,
        attributes: { href: `#${section.id}` },
      });
      if (section.dataset.instructorOnly) {
        link.dataset.instructorOnly = "true";
        link.addEventListener("click", () => {
          const toggle = document.querySelector(".instructor-toggle");
          if (!state.instructorMode) {
            setInstructorMode(true, toggle);
          }
        });
      }
      const item = createElement("li");
      item.append(link);
      list.append(item);
    });
    nav.append(list);

    const safety = safetyText(state.course.safety);
    const note = createElement("aside", {
      className: "sidebar-safety",
      attributes: { "aria-label": "資料安全提醒" },
    });
    note.append(createElement("strong", { text: "資料安全" }));
    if (safety.length) {
      appendTextList(note, safety);
    } else {
      note.append(
        createElement("p", {
          text: "只使用可公開或已去識別資料；不得輸入個資與未公開公務資訊。",
        }),
      );
    }
    aside.append(nav, note);
    return aside;
  }

  function announce(message) {
    const announcer = document.querySelector("#course-page-announcer");
    if (!announcer) {
      return;
    }
    announcer.textContent = "";
    window.setTimeout(() => {
      announcer.textContent = message;
    }, 20);
  }

  async function copyPrompt(targetId, button) {
    const source = document.getElementById(targetId);
    if (!source) {
      return;
    }
    const value = source.textContent;
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(source);
      selection.removeAllRanges();
      selection.addRange(range);
      copied = document.execCommand("copy");
      selection.removeAllRanges();
    }
    if (copied) {
      const original = button.textContent;
      button.textContent = "已複製";
      button.classList.add("is-copied");
      announce("提示詞已複製。貼上前請先確認不含個資或敏感資料。");
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1800);
    } else {
      announce("無法自動複製，請選取提示詞文字後手動複製。");
    }
  }

  function renderCourse(course) {
    state.course = course;
    const declaredId = firstText(course.id, course.meta?.id);
    if (declaredId && declaredId !== state.courseId) {
      throw new Error("課程資料與本頁識別碼不一致。");
    }

    const sections = [
      renderOverview(course),
      renderTimeline(course),
      renderWorkflow(course),
      renderPrompts(course),
      renderPractice(course),
      renderCaseStudy(course),
      renderBlueprint(course),
      renderChecklist(course),
      renderAssessment(course),
      renderInstructor(course),
    ];
    const toolbar = createToolbar();
    const layout = createElement("div", { className: "full-course-layout" });
    const content = createElement("div", { className: "full-course-sections" });
    sections.forEach((section) => content.append(section));
    layout.append(createNavigation(sections), content);
    const announcer = createElement("p", {
      className: "visually-hidden",
      attributes: {
        id: "course-page-announcer",
        role: "status",
        "aria-live": "polite",
      },
    });
    root.replaceChildren(toolbar, layout, announcer);
    root.setAttribute("aria-busy", "false");

    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-copy-target]");
      if (button) {
        copyPrompt(button.dataset.copyTarget, button);
      }
    });
  }

  function renderError(message) {
    const error = createElement("div", {
      className: "course-page-error",
      attributes: { role: "alert" },
    });
    error.append(
      createElement("h2", { text: "完整課程內容暫時無法載入" }),
      createElement("p", {
        text: message || "請確認網路後重新整理；如仍無法顯示，請以講師提供的資料為準。",
      }),
      createElement("a", {
        className: "primary-link",
        text: "返回場次入口",
        attributes: { href: "../../index.html#schedule" },
      }),
    );
    root.replaceChildren(error);
    root.setAttribute("aria-busy", "false");
  }

  function normalizeInstructorPrompts(data) {
    const common = Array.isArray(data?.common) ? data.common : [];
    const courseItems = Array.isArray(data?.courses?.[state.courseId])
      ? data.courses[state.courseId]
      : [];
    if (common.length !== 5 || courseItems.length !== 2) {
      throw new Error("講師提示詞數量不完整。");
    }
    const items = [
      ...courseItems.map((item) => ({ ...item, scope: "本階" })),
      ...common.map((item) => ({ ...item, scope: "共用" })),
    ];
    if (
      items.some(
        (item) =>
          !isObject(item) ||
          !firstText(item.id) ||
          !itemTitle(item, "") ||
          !promptText(item),
      )
    ) {
      throw new Error("講師提示詞格式不完整。");
    }
    return {
      title: firstText(
        data.title,
        "NotebookLM 講師簡報生成提示詞",
      ),
      usageNote: firstText(data.usageNote),
      items,
      error: "",
    };
  }

  async function initialize() {
    const source = root.dataset.courseSrc;
    if (
      !source ||
      !/^\.\.\/\.\.\/data\/courses\/ai-deck-[0-9]{2}\.json$/.test(source)
    ) {
      throw new Error("課程資料路徑不正確。");
    }
    const instructorPromptRequest = fetch(
      "../../data/instructor-prompts.json",
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`講師提示詞資料回應 ${response.status}`);
        }
        return normalizeInstructorPrompts(await response.json());
      })
      .catch(() => ({
        title: "NotebookLM 講師簡報生成提示詞",
        usageNote: "",
        items: [],
        error:
          "講師提示詞暫時無法載入；完整課程與其他講師備註仍可正常使用。",
      }));
    const [response, instructorPromptLibrary] = await Promise.all([
      fetch(source, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
      instructorPromptRequest,
    ]);
    if (!response.ok) {
      throw new Error(`課程資料回應 ${response.status}`);
    }
    const course = await response.json();
    state.instructorPromptLibrary = instructorPromptLibrary;
    renderCourse(course);
  }

  window.addEventListener("beforeprint", () => {
    state.printDetails = [...document.querySelectorAll("details:not([open])")];
    document.querySelectorAll("details").forEach((details) => {
      details.open = true;
    });
  });

  window.addEventListener("afterprint", () => {
    state.printDetails.forEach((details) => {
      details.open = false;
    });
    state.printDetails = [];
  });

  initialize().catch((error) => {
    renderError(error.message);
  });
})();
