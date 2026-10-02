/* ========================================================================
   Mine · 概率修改（个人中心）
   ------------------------------------------------------------------------
   所有系统预设概率均可自行修改（0% ~ 100%），通过加减号或打字输入。
   数据存储于 localStorage "mine.probabilities.v1"：
       { imageCard: 5, emojiCard: 10, audioCard: 3, emojiAttach: 15,
         silentChance: 1, groupSecond: 40 }
   聊天模块（chat.js）通过 get(key) 实时读取（除以 100 后使用）。
   ======================================================================== */

window.MineProbs = (function () {
  "use strict";

  var I = window.MineIcons;
  var U = window.MineUtils;
  var STORE_KEY = "mine.probabilities.v1";

  /* 系统预设概率一览（key: 默认值(百分比)） */
  var DEFAULTS = {
    imageCard:     5,   // 图片字卡发送概率
    emojiCard:    10,   // emoji 字卡发送概率
    audioCard:     3,   // 语音字卡发送概率
    emojiAttach:  15,   // 文字字卡附带 emoji 概率
    silentChance:  1,   // 自动回复沉默概率
    groupSecond:  40    // 群聊(≤2人)第二条回复概率
  };

  var state = null;

  function cloneDefaults() {
    var s = {};
    for (var k in DEFAULTS) s[k] = DEFAULTS[k];
    return s;
  }
  function clamp(v) {
    v = parseInt(v, 10);
    if (isNaN(v)) return 0;
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
  }
  function load() {
    if (state) return;
    state = cloneDefaults();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && typeof d === "object") {
          for (var k in DEFAULTS) {
            if (typeof d[k] === "number" && !isNaN(d[k])) state[k] = clamp(d[k]);
          }
        }
      }
    } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /** 读取某个概率（0~100 的整数），供 chat.js 使用 */
  function get(key) {
    load();
    if (state[key] === undefined) return DEFAULTS[key] !== undefined ? DEFAULTS[key] : 0;
    return state[key];
  }
  function set(key, value) {
    load();
    if (DEFAULTS[key] === undefined) return false;
    state[key] = clamp(value);
    save();
    return true;
  }
  function resetAll() {
    load();
    state = cloneDefaults();
    save();
    return true;
  }

  /* ==================== 管理面板 ==================== */
  var sheetEl = null;
  var overlayEl = null;

  var ITEMS = [
    { key: "imageCard",    name: "图片字卡发送", desc: "对方回复时发送图片字卡的概率" },
    { key: "emojiCard",    name: "emoji 字卡发送", desc: "对方回复时发送 emoji 字卡的概率" },
    { key: "audioCard",    name: "语音字卡发送", desc: "对方回复时发送语音字卡的概率" },
    { key: "emojiAttach",  name: "文字附带 emoji", desc: "文字回复时附带 emoji 字卡的概率" },
    { key: "silentChance", name: "自动回复沉默", desc: "触发自动回复（而非普通回复）的概率" },
    { key: "groupSecond",  name: "群聊第二条回复", desc: "群聊（≤2 人）出现第二条回复的概率" }
  ];

  function buildSheet() {
    if (sheetEl) return;
    overlayEl = document.createElement("div");
    overlayEl.className = "sheet-overlay";
    overlayEl.addEventListener("click", closeManager);

    sheetEl = document.createElement("div");
    sheetEl.className = "sheet";
    sheetEl.innerHTML =
      '<div class="sheet-handle"></div>' +
      '<div class="sheet-head"><h2>概率修改</h2>' +
      '<button class="nav-btn" data-act="close">' + I.svg("close", 20) + '</button></div>' +
      '<div class="sheet-body" id="probs-sheet-body"></div>';

    document.body.appendChild(overlayEl);
    document.body.appendChild(sheetEl);
    sheetEl.querySelector('[data-act="close"]').addEventListener("click", closeManager);
    render();
  }

  function render() {
    var body = document.getElementById("probs-sheet-body");
    if (!body) return;
    load();

    var html = '<div class="card-hint">修改范围为 0~100%，点击加减号或直接输入数字，立即生效</div>';
    html += '<div class="prob-list">' + ITEMS.map(function (it) {
      var val = state[it.key];
      return '<div class="prob-item">' +
        '<div class="prob-head">' +
          '<span class="prob-name">' + it.name + '</span>' +
          '<span class="prob-value">' + val + '%</span>' +
        '</div>' +
        '<div class="prob-desc">' + it.desc + '</div>' +
        '<div class="prob-ctl">' +
          '<button class="prob-step" data-step="' + it.key + '" data-delta="-1" aria-label="减">' + I.svg("minus", 18) + '</button>' +
          '<input type="number" class="prob-input" data-key="' + it.key + '" min="0" max="100" value="' + val + '">' +
          '<span class="prob-unit">%</span>' +
          '<button class="prob-step" data-step="' + it.key + '" data-delta="1" aria-label="加">' + I.svg("plus", 18) + '</button>' +
          '<button class="prob-step" data-step="' + it.key + '" data-delta="-5" aria-label="减5">' + I.svg("minus", 18) + '5</button>' +
          '<button class="prob-step" data-step="' + it.key + '" data-delta="5" aria-label="加5">' + I.svg("plus", 18) + '5</button>' +
        '</div>' +
      '</div>';
    }).join("") + '</div>';

    html += '<div style="padding:var(--sp-4) var(--sp-5);">' +
      '<button class="btn btn-block" data-act="reset-probs">' + I.svg("refresh", 16) + ' 恢复默认</button>' +
      '</div>';

    body.innerHTML = html;
    bindEvents(body);
  }

  function bindEvents(body) {
    /* 加减号（±1 / ±5） */
    body.querySelectorAll("[data-step]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-step");
        var delta = parseInt(btn.getAttribute("data-delta"), 10);
        set(key, get(key) + delta);
        var input = body.querySelector('[data-key="' + key + '"]');
        if (input) input.value = get(key);
        var val = body.querySelector('.prob-item [data-key="' + key + '"]');
        /* 同步该行百分比显示 */
        var row = input ? input.closest(".prob-item") : null;
        if (row) row.querySelector(".prob-value").textContent = get(key) + "%";
      });
    });

    /* 打字输入 */
    body.querySelectorAll(".prob-input").forEach(function (input) {
      var commit = function () {
        var key = input.getAttribute("data-key");
        var v = parseInt(input.value, 10);
        if (isNaN(v)) { input.value = get(key); return; }
        set(key, v);
        input.value = get(key);
        var row = input.closest(".prob-item");
        if (row) row.querySelector(".prob-value").textContent = get(key) + "%";
      };
      input.addEventListener("change", commit);
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
      });
    });

    /* 恢复默认 */
    var resetBtn = body.querySelector('[data-act="reset-probs"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetAll();
        render();
        showToast("已恢复默认概率");
      });
    }
  }

  function showToast(msg) {
    try {
      if (U && U.showToast) { U.showToast(msg); return; }
    } catch (e) {}
    try {
      var t = document.createElement("div");
      t.className = "mini-toast";
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 2000);
    } catch (e) {}
  }

  function openManager() {
    load();
    buildSheet();
    requestAnimationFrame(function () {
      overlayEl.classList.add("is-open");
      sheetEl.classList.add("is-open");
    });
  }
  function closeManager() {
    if (!sheetEl) return;
    overlayEl.classList.remove("is-open");
    sheetEl.classList.remove("is-open");
  }

  /* ==================== 初始化 ==================== */
  function init() {
    load();
  }

  return {
    init: init,
    openManager: openManager,
    closeManager: closeManager,
    get: get,
    set: set,
    resetAll: resetAll,
    getDefaults: function () { return JSON.parse(JSON.stringify(DEFAULTS)); },
    getState: function () { load(); return JSON.parse(JSON.stringify(state)); }
  };
})();
