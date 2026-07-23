(() => {
  "use strict";

  document.documentElement.classList.add("js");

  const DATA_PATHS = {
    catalog: "data/course-catalog.json",
    availability: "data/availability.json",
  };

  const STAGE_IMAGES = [
    "assets/images/stage-foundation.webp",
    "assets/images/stage-refinement.webp",
    "assets/images/stage-decision.webp",
  ];

  const FALLBACK_STAGE_ALT = [
    "微縮卡通風格的學員整理資料來源並建立簡報初稿",
    "微縮卡通風格的學員共同檢查圖表、文字與簡報品質",
    "微縮卡通風格的主管團隊運用決策簡報討論行動方案",
  ];

  const elements = {
    title: document.querySelector("[data-series-title]"),
    description: document.querySelector("[data-series-description]"),
    flow: document.querySelector("#flow-summary"),
    stageList: document.querySelector("#stage-list"),
    catalogStatus: document.querySelector("#catalog-status"),
    sessionList: document.querySelector("#session-list"),
    sessionStatus: document.querySelector("#session-status"),
    scheduleSummary: document.querySelector("#schedule-summary"),
    availabilityUpdated: document.querySelector("#availability-updated"),
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

    if (typeof value === "number") {
      return String(value);
    }

    return fallback;
  }

  function slugValue(value, fallback) {
    const safe = textValue(value, fallback)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return safe || fallback;
  }

  async function fetchJson(path) {
    const response = await fetch(path, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`${path} 回應 ${response.status}`);
    }

    return response.json();
  }

  function normalizeCatalog(rawCatalog) {
    const catalog = rawCatalog && typeof rawCatalog === "object" ? rawCatalog : {};
    const cohorts = Array.isArray(catalog.cohorts) ? catalog.cohorts : [];
    const normalizedCohorts = cohorts.map((cohort, index) => {
      const cohortId = slugValue(cohort.id, `cohort-${index + 1}`);
      const sessions = Array.isArray(cohort.sessions) ? cohort.sessions : [];

      return {
        ...cohort,
        id: cohortId,
        sessions: sessions.map((session, sessionIndex) => ({
          ...session,
          id: slugValue(
            session.id,
            `session-${String(index * 2 + sessionIndex + 1).padStart(2, "0")}`,
          ),
          cohortId,
        })),
      };
    });

    return {
      series: catalog.series && typeof catalog.series === "object" ? catalog.series : {},
      sessionFlow:
        catalog.sessionFlow && typeof catalog.sessionFlow === "object"
          ? catalog.sessionFlow
          : {},
      cohorts: normalizedCohorts,
      sessions: normalizedCohorts.flatMap((cohort) => cohort.sessions),
    };
  }

  function normalizeAvailability(rawAvailability) {
    const source =
      rawAvailability &&
      typeof rawAvailability === "object" &&
      rawAvailability.sessions &&
      typeof rawAvailability.sessions === "object"
        ? rawAvailability.sessions
        : {};

    const sessions = Object.fromEntries(
      Object.entries(source).map(([sessionId, state]) => [
        sessionId,
        state === true ||
          Boolean(state && typeof state === "object" && state.isOpen === true),
      ]),
    );

    return {
      sessions,
      updatedAt: textValue(rawAvailability && rawAvailability.updatedAt),
    };
  }

  function updateSeries(series) {
    const title = textValue(series.title || series.name);
    const description = textValue(series.description || series.summary);

    if (title) {
      elements.title.textContent = title;
      document.title = `${title}｜課程入口`;
    }

    if (description) {
      elements.description.textContent = description;
    }

  }

  function appendDefinition(list, label, value) {
    const content = textValue(value, "依該梯次課程規劃進行");
    list.append(
      createElement("dt", { text: label }),
      createElement("dd", { text: content }),
    );
  }

  function createFlowDetails(sessionFlow, className = "") {
    const segments = Array.isArray(sessionFlow.segments)
      ? [...sessionFlow.segments].sort(
          (left, right) => Number(left.order || 0) - Number(right.order || 0),
        )
      : [];
    const total = Number(sessionFlow.totalDurationMinutes);
    const details = createElement("details", {
      className: `flow-details ${className}`.trim(),
    });
    const flowTitle = textValue(sessionFlow.title, "課程流程");
    const summaryText = Number.isFinite(total)
      ? `${flowTitle}｜共 ${total} 分鐘`
      : flowTitle;
    const summary = createElement("summary");
    summary.append(
      document.createTextNode(summaryText),
      createElement("span", { text: "展開", attributes: { "aria-hidden": "true" } }),
    );
    details.append(summary);

    if (!segments.length) {
      details.append(createElement("p", { text: "流程細節由承辦單位公告。" }));
      return details;
    }

    const list = createElement("ol", { className: "flow-segments" });
    segments.forEach((segment) => {
      const item = createElement("li");
      const heading = createElement("div", { className: "flow-segment-heading" });
      heading.append(
        createElement("strong", {
          text: textValue(segment.title, "課程單元"),
        }),
        createElement("span", {
          text: `${Number(segment.durationMinutes) || 0} 分鐘`,
        }),
      );
      item.append(
        heading,
        createElement("p", { text: textValue(segment.description) }),
      );
      list.append(item);
    });
    details.append(list);
    return details;
  }

  function renderStages(cohorts, sessionFlow) {
    elements.stageList.replaceChildren();
    elements.stageList.classList.remove("is-loading");
    elements.stageList.setAttribute("aria-busy", "false");

    if (!cohorts.length) {
      const empty = createElement("div", { className: "empty-state" });
      empty.append(
        createElement("h3", { text: "課程路徑準備中" }),
        createElement("p", { text: "目前沒有可顯示的梯次資料，請稍後重新整理。" }),
      );
      elements.stageList.append(empty);
      elements.catalogStatus.textContent = "";
      return;
    }

    const fragment = document.createDocumentFragment();

    cohorts.forEach((cohort, index) => {
      const article = createElement("article", {
        className: "stage-card",
        attributes: { id: cohort.id, tabindex: "-1" },
      });
      const figure = createElement("div", { className: "stage-illustration" });
      const image = createElement("img", {
        attributes: {
          src: textValue(cohort.image, STAGE_IMAGES[index] || STAGE_IMAGES[STAGE_IMAGES.length - 1]),
          alt: textValue(
            cohort.imageAlt,
            FALLBACK_STAGE_ALT[index] || "微縮卡通風格的 AI 簡報課程實作情境",
          ),
          width: "720",
          height: "450",
          loading: "lazy",
          decoding: "async",
        },
      });
      figure.append(image);

      const body = createElement("div", { className: "stage-body" });
      const meta = createElement("div", { className: "stage-meta" });
      meta.append(
        createElement("span", {
          className: "stage-number",
          text: textValue(cohort.label, `第 ${index + 1} 梯`),
        }),
        createElement("span", {
          className: "stage-level",
          text: textValue(cohort.difficulty, "實作課程"),
        }),
      );

      const heading = createElement("h3", {
        text: textValue(cohort.courseName || cohort.title, `第 ${index + 1} 梯課程`),
      });
      const detail = createElement("dl", { className: "stage-detail" });

      appendDefinition(detail, "課程目標", cohort.goal || cohort.objective);
      appendDefinition(detail, "課程主軸", cohort.theme);
      appendDefinition(detail, "學員產出", cohort.learnerOutput || cohort.output);

      body.append(meta, heading);
      body.append(detail);
      body.append(createFlowDetails(sessionFlow, "stage-flow"));
      article.append(figure, body);
      fragment.append(article);
    });

    elements.stageList.append(fragment);
    elements.catalogStatus.textContent = "";
  }

  function cohortForSession(session, cohorts) {
    const target = textValue(session.cohortId);
    return cohorts.find((cohort) => cohort.id === target || textValue(cohort.id) === target) || null;
  }

  function sessionDateText(session) {
    const provided = textValue(session.displayDate);
    if (provided) {
      return provided;
    }

    const dateValue = textValue(session.date);
    if (!dateValue) {
      return "日期由承辦單位公告";
    }

    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(date);
  }

  function sessionHref(session) {
    const contentPath = textValue(session && session.contentPath);
    const expectedPath = session && session.id ? `sessions/${session.id}/` : "";
    return contentPath === expectedPath ? contentPath : "";
  }

  function isSessionOpen(availabilityMap, sessionId) {
    return availabilityMap[sessionId] === true;
  }

  function renderSessions(
    sessions,
    cohorts,
    sessionFlow,
    availability,
    availabilityLoaded,
  ) {
    elements.sessionList.replaceChildren();
    elements.sessionList.classList.remove("is-loading");
    elements.sessionList.setAttribute("aria-busy", "false");

    if (!sessions.length) {
      const empty = createElement("div", { className: "empty-state" });
      empty.append(
        createElement("h3", { text: "場次資訊準備中" }),
        createElement("p", { text: "目前沒有可顯示的場次，請以承辦單位通知為準。" }),
      );
      elements.sessionList.append(empty);
      elements.sessionStatus.textContent = "";
      elements.scheduleSummary.textContent = "目前 0 場開放";
      return;
    }

    const openCount = sessions.filter((session) =>
      isSessionOpen(availability.sessions, session.id),
    ).length;
    const fragment = document.createDocumentFragment();

    sessions.forEach((session, index) => {
      const cohort = cohortForSession(session, cohorts);
      const isOpen = availabilityLoaded && isSessionOpen(availability.sessions, session.id);
      const article = createElement("article", {
        className: `session-card ${isOpen ? "is-open" : "is-closed"}`,
        attributes: { id: `card-${session.id}` },
      });

      const main = createElement("div", { className: "session-main" });
      const topline = createElement("div", { className: "session-topline" });
      const sessionNumber = textValue(session.sessionNumber, index + 1);
      const cohortLabel = cohort
        ? textValue(cohort.label, "課程")
        : textValue(session.cohortLabel, "課程");
      const sessionLabel = textValue(session.label, `第 ${sessionNumber} 場`);
      topline.append(
        createElement("p", {
          className: "session-index",
          text: `${cohortLabel} · ${sessionLabel}`,
        }),
        createElement("span", {
          className: "session-state",
          text: isOpen ? "已開放" : "準備中",
        }),
      );

      const heading = createElement("h3", {
        text: textValue(
          session.title || (cohort && (cohort.courseName || cohort.title)),
          `第 ${sessionNumber} 場課程`,
        ),
      });
      const theme = createElement("p", {
        className: "session-theme",
        text: textValue(session.theme || (cohort && cohort.theme)),
      });
      const dateRow = createElement("p", { className: "session-date" });
      dateRow.append(
        createElement("time", {
          text: sessionDateText(session),
          attributes: { datetime: textValue(session.date) },
        }),
      );

      const time = textValue(
        session.time ||
          (session.startTime && session.endTime
            ? `${session.startTime}–${session.endTime}`
            : session.startTime),
      );
      if (time) {
        dateRow.append(createElement("span", { text: time }));
      }

      main.append(topline, heading);
      if (theme.textContent) {
        main.append(theme);
      }
      main.append(dateRow);

      const courseDetail = createElement("dl", { className: "session-detail" });
      appendDefinition(courseDetail, "課程目標", cohort && (cohort.goal || cohort.objective));
      appendDefinition(courseDetail, "課程主軸", cohort && cohort.theme);
      appendDefinition(
        courseDetail,
        "學員產出",
        cohort && (cohort.learnerOutput || cohort.output),
      );
      main.append(courseDetail, createFlowDetails(sessionFlow, "session-flow"));

      let action;
      const target = sessionHref(session);
      if (isOpen && target) {
        action = createElement("a", {
          className: "session-action",
          attributes: {
            href: target,
            "aria-label": `進入${cohortLabel}${sessionLabel}：${heading.textContent}`,
          },
        });
        action.append(
          document.createTextNode("進入本場課程"),
          createElement("span", { text: "→", attributes: { "aria-hidden": "true" } }),
        );
      } else if (!isOpen) {
        action = createElement("span", {
          className: "session-action is-disabled",
          text: "尚未開放",
          attributes: {
            "aria-disabled": "true",
            title: availabilityLoaded ? "本場次尚未開放" : "目前無法取得開放狀態",
          },
        });
      } else {
        action = createElement("span", {
          className: "session-action is-disabled",
          text: "課程資料待確認",
          attributes: {
            "aria-disabled": "true",
          },
        });
      }

      article.append(main, action);
      fragment.append(article);
    });

    elements.sessionList.append(fragment);
    elements.sessionStatus.textContent = availabilityLoaded
      ? ""
      : "開放狀態暫時無法取得；為避免顯示錯誤，所有場次目前皆暫停進入。";
    elements.sessionStatus.classList.toggle("is-error", !availabilityLoaded);
    elements.scheduleSummary.textContent = availabilityLoaded
      ? `目前 ${openCount} 場開放 · 共 ${sessions.length} 場`
      : `狀態待確認 · 共 ${sessions.length} 場`;
  }

  function formatUpdatedAt(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return `開放狀態更新：${value}`;
    }

    return `開放狀態更新：${new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Taipei",
    }).format(date)}`;
  }

  function showCatalogError() {
    const message = "課程資料暫時無法載入，請確認網路後重新整理；如仍無法顯示，請以承辦單位通知為準。";

    elements.stageList.replaceChildren();
    elements.stageList.classList.remove("is-loading");
    elements.stageList.setAttribute("aria-busy", "false");
    elements.catalogStatus.textContent = message;
    elements.catalogStatus.classList.add("is-error");

    elements.sessionList.replaceChildren();
    elements.sessionList.classList.remove("is-loading");
    elements.sessionList.setAttribute("aria-busy", "false");
    elements.sessionStatus.textContent = message;
    elements.sessionStatus.classList.add("is-error");
    elements.scheduleSummary.textContent = "資料暫時無法取得";
  }

  async function initialize() {
    const [catalogResult, availabilityResult] = await Promise.allSettled([
      fetchJson(DATA_PATHS.catalog),
      fetchJson(DATA_PATHS.availability),
    ]);

    if (catalogResult.status !== "fulfilled") {
      showCatalogError();
      return;
    }

    const catalog = normalizeCatalog(catalogResult.value);
    const availabilityLoaded = availabilityResult.status === "fulfilled";
    const availability = availabilityLoaded
      ? normalizeAvailability(availabilityResult.value)
      : normalizeAvailability({});

    updateSeries(catalog.series);
    renderStages(catalog.cohorts, catalog.sessionFlow);
    renderSessions(
      catalog.sessions,
      catalog.cohorts,
      catalog.sessionFlow,
      availability,
      availabilityLoaded,
    );

    if (availabilityLoaded) {
      elements.availabilityUpdated.textContent = formatUpdatedAt(availability.updatedAt);
    }
  }

  initialize().catch(() => {
    showCatalogError();
  });
})();
