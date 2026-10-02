/* ========================================================================
   Mine · 字卡管理（我的字卡）
   ------------------------------------------------------------------------
   · 公用字卡：所有联系人自动回复时均可使用
   · 单独字卡：仅供指定联系人自动回复时使用（通讯录联系人直接列出，
     点击联系人姓名即可添加，无需先到通讯录添加）
   · 字卡类型：字符 / emoji / 图片，每一栏一种类型，点击栏头折叠/展开
   · 数据存储于 localStorage "mine.cards.v1"：
       { public: [card...], per: { cid: [card...] } }
   · 聊天回复逻辑（chat.js）调用 getReplyPool(contactId) 获取可用字卡池：
       单独字卡(该联系人) → 公用字卡 → 联系人自带 cards（兜底）
   ======================================================================== */

window.MineCards = (function () {
  "use strict";

  var I = window.MineIcons;
  var U = window.MineUtils;
  var C = window.MineContacts;
  var STORE_KEY = "mine.cards.v1";

  var state = { public: [], per: {} };
  var expandedTypes = { text: true, emoji: true, image: true };  // 类型栏折叠状态

  /* ==================== 字卡类型判断（与 chat.js 保持同一套规则） ==================== */
  function isImageCard(card) {
    return typeof card === "string" && card.indexOf("data:image/") === 0;
  }
  function isAudioCard(card) {
    return typeof card === "string" && card.indexOf("data:audio/") === 0;
  }
  function isEmojiCard(card) {
    if (typeof card !== "string" || card.length === 0) return false;
    if (isImageCard(card)) return false;
    var stripped = card.replace(/[\uFE0F\u200D\u200C\u2640\u2642\u20E3\uFE0E]/g, "");
    var chars = Array.from(stripped);
    if (chars.length === 0 || chars.length > 4) return false;
    return chars.every(function (ch) {
      var code = ch.codePointAt(0);
      return (code >= 0x1F300 && code <= 0x1FAFF) ||
             (code >= 0x2600 && code <= 0x27BF) ||
             (code >= 0x2B50 && code <= 0x2BFF) ||
             (code >= 0x2300 && code <= 0x23FF);
    });
  }

  /* ==================== 持久化 ==================== */
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        state.public = Array.isArray(d.public) ? d.public : [];
        state.per = (d.per && typeof d.per === "object") ? d.per : {};
      }
    } catch (e) {}
    if (!Array.isArray(state.public)) state.public = [];
    if (!state.per || typeof state.per !== "object") state.per = {};
  }

  /* ==================== 数据读写 ==================== */
  function getPublicCards() { return state.public.slice(); }
  function getPerCards(cid) {
    return (cid && state.per[cid]) ? state.per[cid].slice() : [];
  }
  /* 聊天回复使用的完整字卡池：单独字卡(该联系人) + 公用字卡 */
  function getReplyPool(cid) {
    var pool = [];
    if (cid && state.per[cid] && state.per[cid].length) {
      pool = pool.concat(state.per[cid]);
    }
    if (state.public.length) pool = pool.concat(state.public);
    return pool;
  }
  function hasAnyCards() {
    return state.public.length > 0 || Object.keys(state.per).some(function (k) {
      return state.per[k] && state.per[k].length > 0;
    });
  }

  function addPublicCard(card) {
    var v = String(card || "").trim();
    if (!v) return false;
    state.public.push(v);
    save();
    return true;
  }
  function removePublicCard(idx) {
    if (idx < 0 || idx >= state.public.length) return false;
    state.public.splice(idx, 1);
    save();
    return true;
  }
  function addPerCard(cid, card) {
    var v = String(card || "").trim();
    if (!cid || !v) return false;
    if (!state.per[cid]) state.per[cid] = [];
    state.per[cid].push(v);
    save();
    return true;
  }
  function removePerCard(cid, idx) {
    if (!cid || !state.per[cid]) return false;
    if (idx < 0 || idx >= state.per[cid].length) return false;
    state.per[cid].splice(idx, 1);
    save();
    return true;
  }

  /* ==================== 工具 ==================== */
  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function contactName(cid) {
    try {
      if (C && C.loadData) C.loadData();
      if (C && C.getState) {
        var st = C.getState();
        var list = st.contacts || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === cid) return list[i].name || list[i].nickname || cid;
        }
      }
    } catch (e) {}
    return cid;
  }
  function listContacts() {
    try {
      if (C && C.loadData) C.loadData();
      if (C && C.getState) return C.getState().contacts || [];
    } catch (e) {}
    return [];
  }

  /* ==================== 管理面板 ==================== */
  var sheetEl = null;
  var overlayEl = null;
  var currentTab = "public";   // "public" | "per"
  var currentCid = null;       // 单独字卡当前选中的联系人

  function buildSheet() {
    if (sheetEl) return;
    overlayEl = document.createElement("div");
    overlayEl.className = "sheet-overlay";
    overlayEl.addEventListener("click", closeManager);

    sheetEl = document.createElement("div");
    sheetEl.className = "sheet";
    sheetEl.innerHTML =
      '<div class="sheet-handle"></div>' +
      '<div class="sheet-head"><h2>字卡</h2>' +
      '<button class="nav-btn" data-act="close">' + I.svg("close", 20) + '</button></div>' +
      '<div class="sheet-body" id="cards-sheet-body"></div>';

    document.body.appendChild(overlayEl);
    document.body.appendChild(sheetEl);
    sheetEl.querySelector('[data-act="close"]').addEventListener("click", closeManager);
    render();
  }

  function render() {
    var body = document.getElementById("cards-sheet-body");
    if (!body) return;

    var tabs =
      '<div class="card-tabs">' +
        '<button class="card-tab' + (currentTab === "public" ? " is-active" : "") + '" data-tab="public">公用字卡</button>' +
        '<button class="card-tab' + (currentTab === "per" ? " is-active" : "") + '" data-tab="per">单独字卡</button>' +
      '</div>';

    var content = "";
    if (currentTab === "public") {
      content = renderPublicTab();
    } else {
      content = renderPerTab();
    }

    body.innerHTML = tabs + content;
    bindEvents(body);
  }

  /* ---- 公用字卡 tab ---- */
  function renderPublicTab() {
    var html = '<div class="card-hint">公用字卡：所有联系人自动回复时均可使用</div>';
    html += renderCardEditor(state.public, "public", null);
    return html;
  }

  /* ---- 单独字卡 tab：通讯录联系人直接列出，点击姓名即可添加 ---- */
  function renderPerTab() {
    var html = '<div class="card-hint">单独字卡：点击联系人姓名，给 TA 添加专属字卡</div>';
    if (!currentCid) {
      /* 通讯录所有联系人直接显示 */
      var targets = listContacts();
      var items = targets.length
        ? targets.map(function (t) {
            var per = (state.per[t.id] || []).length;
            return '<button class="target-row" data-pick-cid="' + escapeHtml(t.id) + '">' +
              '<span class="target-avatar">' + (C && C.avatarHTML ? C.avatarHTML(28, "target-avatar-img") : "") + '</span>' +
              '<span class="target-name">' + escapeHtml(t.name || t.nickname || t.id) + '</span>' +
              (per ? '<span class="target-sub">' + per + ' 张</span>' : '<span class="target-sub">未设置</span>') +
              '<span class="chevron">' + I.svg("back", 18) + '</span>' +
              '</button>';
          }).join("")
        : '<div class="cm-empty">通讯录暂无联系人，可先到通讯录添加</div>';
      html += '<div class="card-target-list">' + items + '</div>';
      return html;
    }
    /* 已选择联系人 → 该联系人的单独字卡 */
    html += '<div class="card-current-row">' +
      '<span>当前联系人：' + escapeHtml(contactName(currentCid)) + '</span>' +
      '<button class="card-back" data-pick-back>' + I.svg("back", 14) + ' 切换</button>' +
      '</div>';
    var per = state.per[currentCid] || [];
    html += renderCardEditor(per, "per", currentCid, true);
    return html;
  }

  /* ---- 类型分栏编辑器：每一栏一种字卡类型，点击栏头折叠/展开
       includeAudio=true 时额外显示语音栏（单独字卡） ---- */
  function renderCardEditor(list, scope, cid, includeAudio) {
    var groups = [
      { type: "text",  name: "字符", icon: "feather", items: [] },
      { type: "emoji", name: "emoji", icon: "smile", items: [] },
      { type: "image", name: "图片", icon: "image", items: [] }
    ];
    if (includeAudio) {
      groups.push({ type: "audio", name: "语音", icon: "mic", items: [] });
    }
    (list || []).forEach(function (card, i) {
      var entry = { card: card, idx: i };
      if (isImageCard(card)) groups[2].items.push(entry);
      else if (isAudioCard(card)) {
        if (includeAudio) groups[3].items.push(entry);
        else groups[2].items.push(entry);  /* 公用字卡无语音栏时语音并入图片栏 */
      }
      else if (isEmojiCard(card)) groups[1].items.push(entry);
      else groups[0].items.push(entry);
    });

    return '<div class="card-editor">' + groups.map(function (g) {
      var expanded = expandedTypes[g.type] !== false;
      return '<div class="card-type-section">' +
        '<button class="card-type-head" data-fold="' + g.type + '">' +
          '<span class="card-type-icon">' + I.svg(g.icon, 18) + '</span>' +
          '<span class="card-type-name">' + g.name + '</span>' +
          '<span class="card-type-count">' + g.items.length + '</span>' +
          '<span class="card-type-arrow' + (expanded ? " is-open" : "") + '">' + I.svg("back", 16) + '</span>' +
        '</button>' +
        (expanded
          ? '<div class="card-type-body">' +
              renderTypeItems(g.items, scope, cid, g.type) +
              renderTypeAddRow(g.type, scope, cid) +
            '</div>'
          : '') +
        '</div>';
    }).join("") + '</div>';
  }

  /* ---- 某类型下的字卡项列表（items: [{card, idx}]，idx 为存储数组真实索引） ---- */
  function renderTypeItems(items, scope, cid, type) {
    if (!items || items.length === 0) {
      var emptyText =
        type === "text" ? "暂无字符字卡" :
        (type === "emoji" ? "暂无 emoji 字卡" :
        (type === "image" ? "暂无图片字卡" : "暂无语音字卡"));
      return '<div class="cards-empty">' + emptyText + '</div>';
    }
    return '<div class="card-list">' + items.map(function (entry) {
      var card = entry.card;
      var inner;
      if (isImageCard(card)) {
        inner = '<img class="card-img" src="' + escapeHtml(card) + '" alt="图片字卡">';
      } else if (isAudioCard(card)) {
        inner = '<span class="card-voice">' + I.svg("mic", 16) + '</span>' +
          '<audio controls preload="none" src="' + escapeHtml(card) + '"></audio>';
      } else if (isEmojiCard(card)) {
        inner = '<span class="card-emoji">' + escapeHtml(card) + '</span>';
      } else {
        inner = '<span class="card-text">' + escapeHtml(card) + '</span>';
      }
      return '<div class="card-item' + (isAudioCard(card) ? " is-voice" : "") + '">' + inner +
        '<button class="card-del" data-del-scope="' + scope + '" data-del-cid="' + (cid || "") + '" data-del-idx="' + entry.idx + '" ' +
        'aria-label="删除">' + I.svg("trash", 16) + '</button></div>';
    }).join("") + '</div>';
  }

  /* ---- 某类型的添加行 ---- */
  function renderTypeAddRow(type, scope, cid) {
    var data = 'data-add-scope="' + scope + '" data-add-cid="' + (cid || "") + '"';
    if (type === "text") {
      return '<div class="card-add-row">' +
        '<input type="text" class="card-input" id="card-input-text" ' +
          'placeholder="输入字符字卡，如：今天也要开心呀" maxlength="60">' +
        '<button class="card-add-btn" ' + data + ' data-add-type="text" aria-label="添加">' + I.svg("plus", 18) + '</button>' +
        '</div>';
    }
    if (type === "emoji") {
      return '<div class="card-add-row">' +
        '<input type="text" class="card-input" id="card-input-emoji" ' +
          'placeholder="输入 emoji，如 😊🌸" maxlength="12">' +
        '<button class="card-add-btn" ' + data + ' data-add-type="emoji" aria-label="添加">' + I.svg("plus", 18) + '</button>' +
        '</div>';
    }
    if (type === "audio") {
      return '<div class="card-add-row">' +
        '<button class="card-image-add-btn" ' + data + ' data-add-type="audio">' + I.svg("mic", 18) + ' 选择语音文件</button>' +
        '</div>';
    }
    return '<div class="card-add-row">' +
      '<button class="card-image-add-btn" ' + data + ' data-add-type="image">' + I.svg("image", 18) + ' 选择图片</button>' +
      '</div>';
  }

  function bindEvents(body) {
    /* tab 切换 */
    body.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentTab = btn.getAttribute("data-tab");
        render();
      });
    });

    /* 关闭 */
    var closeBtn = body.closest(".sheet").querySelector('[data-act="close"]');
    if (closeBtn) closeBtn.addEventListener("click", closeManager);

    /* 选择联系人（单独字卡，点击姓名即进入） */
    body.querySelectorAll("[data-pick-cid]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentCid = btn.getAttribute("data-pick-cid");
        render();
      });
    });
    var backBtn = body.querySelector("[data-pick-back]");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        currentCid = null;
        render();
      });
    }

    /* 类型栏折叠 / 展开 */
    body.querySelectorAll("[data-fold]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var type = btn.getAttribute("data-fold");
        expandedTypes[type] = expandedTypes[type] === false;
        render();
      });
    });

    /* 删除字卡（data-del-idx 为存储数组真实索引） */
    body.querySelectorAll("[data-del-scope]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var scope = btn.getAttribute("data-del-scope");
        var cid = btn.getAttribute("data-del-cid") || null;
        var idx = parseInt(btn.getAttribute("data-del-idx"), 10);
        if (scope === "public") removePublicCard(idx);
        else if (scope === "per") removePerCard(cid, idx);
        render();
      });
    });

    /* 添加字符 / emoji 字卡 */
    body.querySelectorAll("[data-add-type]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var scope = btn.getAttribute("data-add-scope");
        var cid = btn.getAttribute("data-add-cid") || null;
        var type = btn.getAttribute("data-add-type");
        var input = body.querySelector(type === "text" ? "#card-input-text" : "#card-input-emoji");
        var v = input ? input.value : "";
        if (!v) { showToast("请输入字卡内容"); return; }
        var ok = (scope === "public") ? addPublicCard(v) : addPerCard(cid, v);
        if (ok && input) input.value = "";
        render();
      });
      btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); btn.click(); }
      });
    });

    /* 添加图片 / 语音字卡 */
    body.querySelectorAll("[data-add-type='image'], [data-add-type='audio']").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var addType = btn.getAttribute("data-add-type");
        var scope = btn.getAttribute("data-add-scope");
        var cid = btn.getAttribute("data-add-cid") || null;
        var fid = addType === "audio" ? "card-audio-file" : "card-img-file";
        var fileEl = body.querySelector("#" + fid);
        if (!fileEl) {
          fileEl = document.createElement("input");
          fileEl.type = "file";
          fileEl.accept = addType === "audio" ? "audio/*" : "image/*";
          fileEl.id = fid;
          fileEl.className = "file-hidden";
          document.body.appendChild(fileEl);
          fileEl.addEventListener("change", function () {
            if (this.files && this.files[0]) {
              var f = this.files[0];
              if (addType === "audio") {
                /* 语音：读为 audio dataURL 原样存储（不做压缩） */
                var reader = new FileReader();
                reader.onload = function (ev) {
                  var dataURL = ev.target.result;
                  if (!dataURL) return;
                  if (scope === "public") addPublicCard(dataURL);
                  else if (scope === "per" && cid) addPerCard(cid, dataURL);
                  render();
                };
                reader.onerror = function () { showToast("语音文件读取失败"); };
                reader.readAsDataURL(f);
              } else {
                if (U && U.compressImage) {
                  U.compressImage(f, 600, 0.78, function (dataURL) {
                    if (!dataURL) return;
                    if (scope === "public") addPublicCard(dataURL);
                    else if (scope === "per" && cid) addPerCard(cid, dataURL);
                    render();
                  });
                }
              }
            }
            this.value = "";
          });
        }
        fileEl.click();
      });
    });
  }

  function showToast(msg) {
    try {
      if (U && U.showToast) { U.showToast(msg); return; }
      if (window.MineApp && MineApp.toast) { MineApp.toast(msg); return; }
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
    getPublicCards: getPublicCards,
    getPerCards: getPerCards,
    getReplyPool: getReplyPool,
    hasAnyCards: hasAnyCards,
    addPublicCard: addPublicCard,
    removePublicCard: removePublicCard,
    addPerCard: addPerCard,
    removePerCard: removePerCard,
    isImageCard: isImageCard,
    isAudioCard: isAudioCard,
    isEmojiCard: isEmojiCard,
    getState: function () { return JSON.parse(JSON.stringify(state)); }
  };
})();
