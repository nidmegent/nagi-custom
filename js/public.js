/* =========================================
   NAGI CUSTOM | PUBLIC API
========================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbxwnDGrUDOGGfrKLa17GM59nR4z3Ajpi3aGJniQ0rMYxzTJo3MqVIQMGr2tquu4usJZ/exec";

const NC_PUBLIC = {
  async get(action, params = {}) {
    const url = new URL(API_URL);

    url.searchParams.set("action", action);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("サーバーへの接続に失敗しました。");
    }

    const result = await response.json();

    if (result.success === false) {
      throw new Error(result.message || "データを取得できませんでした。");
    }

    return result;
  },

  escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  },

  date(value) {
    if (!value) return "未定";

    const text = String(value).trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return `${match[1]}.${match[2]}.${match[3]}`;
    }

    const parsed = new Date(text);

    if (Number.isNaN(parsed.getTime())) {
      return text;
    }

    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, "0"),
      String(parsed.getDate()).padStart(2, "0")
    ].join(".");
  },

  period(start, end) {
    if (!start && !end) return "開催日未定";

    if (start && end && start !== end) {
      return `${this.date(start)} - ${this.date(end)}`;
    }

    return this.date(start || end);
  },

  safeUrl(value) {
    const text = String(value || "").trim();

    try {
      const url = new URL(text);

      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.href;
      }
    } catch (_) {}

    return "";
  },

  imageUrl(event) {
    const value = this.safeUrl(event.thumbnailUrl);
    return value || "";
  },

  statusLabel(status) {
    const labels = {
      "公開": "開催予定",
      "終了": "大会終了",
      "中止": "開催中止",
      "下書き": "下書き"
    };

    return labels[status] || status || "開催予定";
  },

  eventCard(event, archive = false) {
    const id = encodeURIComponent(String(event.id || ""));
    const name = this.escape(event.eventName || "名称未設定");
    const game = this.escape(event.game || "ゲーム未設定");
    const status = this.escape(this.statusLabel(event.status));
    const date = this.escape(this.period(event.startDate, event.endDate));
    const description = this.escape(event.description || "大会情報の詳細をご確認ください。");
    const image = this.imageUrl(event);

    const imageHtml = image
      ? `<img class="nc-card-image" src="${this.escape(image)}" alt="" loading="lazy">`
      : `<div class="nc-card-image" aria-hidden="true"></div>`;

    return `
      <article class="nc-card">
        <a href="event.html?id=${id}" aria-label="${name}の詳細を見る">
          ${imageHtml}
        </a>
        <div class="nc-card-body">
          <div class="nc-tags">
            <span class="nc-tag orange">${game}</span>
            <span class="nc-tag">${status}</span>
          </div>
          <h3>
            <a href="event.html?id=${id}">${name}</a>
          </h3>
          <p class="nc-card-date">${date}</p>
          <p class="nc-card-description">${description}</p>
          <div style="margin-top:18px">
            <a class="nc-button" href="event.html?id=${id}">
              ${archive ? "大会情報を見る" : "DETAILS →"}
            </a>
          </div>
        </div>
      </article>
    `;
  },

  showError(container, error) {
    console.error("[NAGI CUSTOM]", error);

    container.innerHTML = `
      <div class="nc-message nc-error">
        情報を読み込めませんでした。<br>
        少し時間をおいて再読み込みしてください。
      </div>
    `;
  }
};


/* =========================================
   EVENTS LIST
========================================= */

async function initEventsPage() {
  const list = document.getElementById("event-list");
  const search = document.getElementById("event-search");
  const gameFilter = document.getElementById("game-filter");
  const count = document.getElementById("event-count");

  if (!list) return;

  let events = [];

  function render() {
    const keyword = String(search?.value || "").trim().toLowerCase();
    const selectedGame = gameFilter?.value || "";

    const filtered = events.filter(event => {
      const searchable = [
        event.eventName,
        event.game,
        event.description
      ].join(" ").toLowerCase();

      return (!keyword || searchable.includes(keyword)) &&
        (!selectedGame || event.game === selectedGame);
    });

    if (count) {
      count.textContent = `${filtered.length} EVENTS`;
    }

    list.innerHTML = filtered.length
      ? filtered.map(event => NC_PUBLIC.eventCard(event)).join("")
      : `<div class="nc-empty">該当する大会はありません。</div>`;
  }

  try {
    list.innerHTML = `<div class="nc-loading">大会情報を読み込み中...</div>`;

    const result = await NC_PUBLIC.get("publicEvents");
    events = Array.isArray(result.events) ? result.events : [];

    const games = [...new Set(events.map(event => event.game).filter(Boolean))].sort();

    if (gameFilter) {
      gameFilter.innerHTML =
        `<option value="">すべてのゲーム</option>` +
        games.map(game =>
          `<option value="${NC_PUBLIC.escape(game)}">${NC_PUBLIC.escape(game)}</option>`
        ).join("");
    }

    render();
    search?.addEventListener("input", render);
    gameFilter?.addEventListener("change", render);

  } catch (error) {
    NC_PUBLIC.showError(list, error);
  }
}


/* =========================================
   EVENT DETAIL
========================================= */

async function initEventPage() {
  const container = document.getElementById("event-detail");
  if (!container) return;

  const id = new URLSearchParams(location.search).get("id");

  if (!id) {
    container.innerHTML = `
      <div class="nc-message nc-error">
        大会IDが指定されていません。
      </div>
    `;
    return;
  }

  try {
    container.innerHTML = `<div class="nc-loading">大会情報を読み込み中...</div>`;

    const result = await NC_PUBLIC.get("publicEvent", { id });
    const event = result.event;

    if (!event) {
      throw new Error("大会が見つかりません。");
    }

    const image = NC_PUBLIC.imageUrl(event);
    const imageHtml = image
      ? `<img class="nc-detail-cover" src="${NC_PUBLIC.escape(image)}" alt="">`
      : `<div class="nc-detail-cover" aria-hidden="true"></div>`;

    const applicationUrl = NC_PUBLIC.safeUrl(event.applicationUrl);

    container.innerHTML = `
      <a class="nc-back" href="events.html">← 大会一覧に戻る</a>

      <article class="nc-detail">
        ${imageHtml}

        <div class="nc-detail-content">
          <div class="nc-tags">
            <span class="nc-tag orange">${NC_PUBLIC.escape(event.game || "ゲーム未設定")}</span>
            <span class="nc-tag">${NC_PUBLIC.escape(NC_PUBLIC.statusLabel(event.status))}</span>
          </div>

          <h1>${NC_PUBLIC.escape(event.eventName || "名称未設定")}</h1>

          <div class="nc-meta">
            <div class="nc-meta-item">
              <small>TOURNAMENT DATE / 開催日</small>
              <strong>${NC_PUBLIC.escape(NC_PUBLIC.period(event.startDate, event.endDate))}</strong>
            </div>

            <div class="nc-meta-item">
              <small>REGISTRATION / 申込期間</small>
              <strong>${NC_PUBLIC.escape(NC_PUBLIC.period(event.registrationStart, event.registrationEnd))}</strong>
            </div>
          </div>

          <section class="nc-prose">
            <h2>大会概要</h2>
            <div class="nc-prose-text">${NC_PUBLIC.escape(event.description || "大会概要は準備中です。")}</div>
          </section>

          <section class="nc-prose">
            <h2>大会ルール</h2>
            <div class="nc-prose-text">${NC_PUBLIC.escape(event.rules || "大会ルールは準備中です。")}</div>
          </section>

          <div class="nc-actions">
            ${applicationUrl && event.status === "公開"
              ? `<a class="nc-button primary" href="${NC_PUBLIC.escape(applicationUrl)}" target="_blank" rel="noopener noreferrer">参加申込はこちら ↗</a>`
              : ""}
            <a class="nc-button" href="events.html">大会一覧へ戻る</a>
          </div>
        </div>
      </article>
    `;

  } catch (error) {
    NC_PUBLIC.showError(container, error);
  }
}


/* =========================================
   ARCHIVE + RESULTS
========================================= */

async function initArchivePage() {
  const list = document.getElementById("archive-list");
  const resultsContainer = document.getElementById("archive-results");

  if (!list) return;

  try {
    list.innerHTML = `<div class="nc-loading">過去大会を読み込み中...</div>`;

    // publicArchive は Code.gs に追加する公開API
    const result = await NC_PUBLIC.get("publicArchive");

    const events = Array.isArray(result.events) ? result.events : [];
    const results = Array.isArray(result.results) ? result.results : [];

    list.innerHTML = events.length
      ? events.map(event => NC_PUBLIC.eventCard(event, true)).join("")
      : `<div class="nc-empty">過去大会はまだありません。</div>`;

    if (!resultsContainer) return;

    if (!results.length) {
      resultsContainer.innerHTML = `<div class="nc-empty">大会結果はまだありません。</div>`;
      return;
    }

    const grouped = {};

    results.forEach(item => {
      const key = item.eventId || item.eventName || "other";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    resultsContainer.innerHTML = Object.values(grouped).map(items => {
      const title = NC_PUBLIC.escape(items[0].eventName || "大会結果");

      const rows = items.map(item => `
        <tr>
          <td>${NC_PUBLIC.escape(item.rank || "-")}</td>
          <td>${NC_PUBLIC.escape(item.teamName || "-")}</td>
          <td>${NC_PUBLIC.escape(item.playerName || "-")}</td>
          <td>${NC_PUBLIC.escape(item.notes || "-")}</td>
        </tr>
      `).join("");

      return `
        <section class="nc-section">
          <div class="nc-section-head">
            <div><h2>${title}</h2></div>
          </div>
          <div class="nc-table-wrap">
            <table class="nc-table">
              <thead>
                <tr>
                  <th>順位</th>
                  <th>チーム名</th>
                  <th>選手名</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>
      `;
    }).join("");

  } catch (error) {
    NC_PUBLIC.showError(list, error);

    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="nc-message">
          大会結果を読み込めませんでした。
        </div>
      `;
    }
  }
}


/* =========================================
   AUTO START
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  initEventsPage();
  initEventPage();
  initArchivePage();
});
