/* ========================================================================
   Mine · 电话模块（v2）
   ------------------------------------------------------------------------
   规则（按需求设定）：
   · 主动来电：每个联系人独立调度，每小时一次抽取机会，触发概率 0.5%
   · 呼出电话：对方 2% 概率直接挂断；挂断后 49% 附字卡留言（取自该联系人
     主页"自动回复字卡"内容）/ 49% 附语音留言（预留，后期植入）/ 2% 不回复
   · 群聊电话：暂不设置（入口占位保留）
   通话记录持久化（localStorage，配合 storage.js 大容量存储）
   概率全部集中在顶部 CONFIG，后期可随时调整。
   ======================================================================== */

window.MinePhone = (function () {
  "use strict";

  /* ==================== 配置（后期可调，勿删注释） ==================== */
  var CONFIG = {
    /* —— 联系人主动来电：每个联系人独立，每小时一次抽取 —— */
    incomingEnabled: true,          // 总开关：是否允许联系人主动来电
    perContactRollMinutes: 60,      // 每个联系人每多少分钟独立抽取一次（当前：每小时一次）
    incomingChance: 0.005,          // 每个联系人每次抽取触发来电的概率（0.5%）
    incomingRingSec: 20,            // 来电无人接听的最长响铃秒数（超时记为未接）
    /* —— 呼出通话 —— */
    answerMaxSec: 2,                // 正常接听前随机延迟上限（秒）
    hangupChance: 0.02,             // 我拨出时对方直接挂断的概率（2%）
    cardMessageChance: 0.49,        // 挂断后附赠"字卡留言"概率（49%，内容取自动回复字卡）
    voiceMessageChance: 0.49,       // 挂断后附赠"语音留言"概率（49%，预留，后期植入）
    connectedMinSec: 25,            // 接通后最短通话秒数
    connectedMaxSec: 150,           // 接通后最长通话秒数（超时自动挂断）
    /* —— 群聊电话模式（暂不设置，入口占位保留） —— */
    groupCallEnabled: false
  };

  var STORE_KEY = "mine.phone.log.v1";
  var MAX_LOG = 200;
  var I = window.MineIcons;

  /* ---------------- 通话记录 ---------------- */
  var callLog = [];

  function loadLog() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) callLog = JSON.parse(raw) || [];
    } catch (e) {}
    if (!Array.isArray(callLog)) callLog = [];
  }

  function saveLog() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(callLog.slice(-MAX_LOG))); } catch (e) {}
  }

  function addLog(entry) {
    callLog.push(entry);
    saveLog();
  }

  /* ---------------- 当前通话状态 ---------------- */
  var active = null;     // { dir:"out"|"in", contactId, state:"ringing"|"connected", startedAt, connectedAt }
  var overlayEl = null;
  var timerInt = null;
  var timers = [];       // 收集所有延时器，便于统一清理

  function clearTimers() {
    timers.forEach(function (t) { clearTimeout(t); });
    timers = [];
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function findContact(id) {
    return (window.MineContacts && MineContacts.findContact) ? MineContacts.findContact(id) : null;
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;

  function showToast(msg) {
    var el = document.querySelector(".phone-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "phone-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-show"); }, 2200);
  }

  /* ==================== 通话界面 ==================== */
  function buildOverlay(contact, incoming) {
    var I = window.MineIcons;
    var avatarHTML = "";
    if (window.MineContacts && MineContacts.avatarHTML) {
      avatarHTML = MineContacts.avatarHTML(contact, 96, "phone-avatar avatar-gen");
    } else {
      avatarHTML = '<div class="avatar avatar-gen phone-avatar">' +
        esc((contact && contact.name || "?").charAt(0)) + '</div>';
    }

    var ov = document.createElement("div");
    ov.className = "phone-overlay";
    ov.innerHTML =
      '<div class="phone-screen">' +
        '<div class="phone-top"><span class="phone-brand">Mine · 电话</span></div>' +
        '<div class="phone-stage">' +
          '<div class="phone-avatar-wrap">' +
            '<span class="phone-ring r1"></span>' +
            '<span class="phone-ring r2"></span>' +
            avatarHTML +
          '</div>' +
          '<div class="phone-name">' + esc(contact ? contact.name : "未知") + '</div>' +
          '<div class="phone-state" id="phone-state">' + (incoming ? "正在呼入…" : "正在呼叫…") + '</div>' +
          '<div class="phone-timer" id="phone-timer">00:00</div>' +
        '</div>' +
        '<div class="phone-controls">' +
          '<button class="phone-ctl" data-ctl="mute" title="静音">' + I.svg("mic", 22) + '</button>' +
          (incoming
            ? '<button class="phone-ctl is-accept" data-ctl="accept" title="接听">' + I.svg("phone", 22) + '</button>'
            : '') +
          '<button class="phone-ctl is-danger" data-ctl="hangup" title="挂断">' + I.svg("phoneOff", 22) + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("is-open"); });

    ov.addEventListener("click", function (e) {
      var btn = (e.target && e.target.closest) ? e.target.closest("[data-ctl]") : null;
      if (!btn) return;
      handleCtl(btn.getAttribute("data-ctl"));
    });
    return ov;
  }

  function setStateText(text) {
    if (overlayEl) {
      var st = overlayEl.querySelector("#phone-state");
      if (st) st.textContent = text;
    }
  }

  /* 接通：进入通话计时状态 */
  function enterConnected() {
    if (!active || active.state !== "ringing") return;
    active.state = "connected";
    active.connectedAt = Date.now();
    if (!overlayEl) return;

    overlayEl.classList.remove("is-ringing");
    overlayEl.classList.add("is-connected");
    setStateText("已接通");

    var timerEl = overlayEl.querySelector("#phone-timer");
    timerInt = setInterval(function () {
      if (timerEl && active && active.state === "connected") {
        timerEl.textContent = fmtDuration((Date.now() - active.connectedAt) / 1000);
      }
    }, 1000);

    // 随机时长后自动结束（模拟对方挂断）
    var dur = CONFIG.connectedMinSec +
      Math.random() * (CONFIG.connectedMaxSec - CONFIG.connectedMinSec);
    timers.push(setTimeout(function () {
      if (active && active.state === "connected") endCall("通话结束");
    }, dur * 1000));
  }

  /* 结束通话（notice 可选，结束时弹 toast） */
  function endCall(notice) {
    if (!active) return;
    var entry = {
      dir: active.dir,
      kind: active.state === "connected" ? "answered"
          : (active.dir === "in" ? "missed" : "canceled"),
      contactId: active.contactId,
      time: active.startedAt,
      duration: active.state === "connected"
        ? Math.round((Date.now() - active.connectedAt) / 1000) : 0
    };
    addLog(entry);

    clearTimers();
    var ov = overlayEl;
    active = null;
    overlayEl = null;
    if (ov) {
      ov.classList.remove("is-open");
      setTimeout(function () { ov.remove(); }, 350);
    }
    if (notice) showToast(notice);
  }

  /* ---------------- 控件处理 ---------------- */
  function handleCtl(ctl) {
    if (!active || !overlayEl) return;
    if (ctl === "mute") {
      toggleMute();
    } else if (ctl === "accept") {
      if (active.dir === "in" && active.state === "ringing") enterConnected();
    } else if (ctl === "hangup") {
      if (active.state === "ringing") {
        endCall(active.dir === "in" ? "已拒绝来电" : "");
      } else {
        endCall();
      }
    }
  }

  function toggleMute() {
    var btn = overlayEl.querySelector('[data-ctl="mute"]');
    if (!btn) return;
    var muted = btn.classList.toggle("is-muted");
    if (window.MineIcons) {
      btn.innerHTML = MineIcons.svg(muted ? "micOff" : "mic", 22);
    }
    setStateText(muted ? "已静音" : (active.state === "connected" ? "已接通" : "正在呼叫…"));
  }

  /* ==================== 呼出电话 ==================== */
  function callContact(contactId) {
    if (active) { showToast("通话中，请先挂断"); return; }
    var c = findContact(contactId);
    if (!c) return;

    overlayEl = buildOverlay(c, false);
    active = { dir: "out", contactId: contactId, state: "ringing", startedAt: Date.now() };
    overlayEl.classList.add("is-ringing");

    // 响铃片刻后：2% 概率对方直接挂断，否则正常接听
    var delay = Math.max(900, Math.random() * CONFIG.answerMaxSec * 1000);
    timers.push(setTimeout(function () {
      if (!active || active.dir !== "out" || active.state !== "ringing") return;
      if (Math.random() < CONFIG.hangupChance) {
        counterpartHangup(c);
      } else {
        enterConnected();
      }
    }, delay));
  }

  /* ---------- 对方挂断：49% 字卡留言 / 49% 语音留言（预留）/ 2% 不回复 ---------- */
  function counterpartHangup(c) {
    endCall();   // 结束并记录本次呼出（挂断）
    var r = Math.random();
    if (r < CONFIG.cardMessageChance) {
      // 字卡留言：内容取自联系人主页"自动回复字卡"（c.autoCards）
      var cards = (c && c.autoCards) || [];
      var pick = cards.length ? cards[Math.floor(Math.random() * cards.length)] : null;
      showCardMessage(c, pick);
    } else if (r < CONFIG.cardMessageChance + CONFIG.voiceMessageChance) {
      // 语音留言：预留（后期植入）
      showVoiceMessage(c);
    } else {
      showToast("对方挂断了电话");
    }
  }

  /* ---------- 留言弹层（字卡 / 语音，样式复用 sheet + phone-reserved） ---------- */
  function showMessageSheet(title, c, descHtml) {
    var ov = document.createElement("div");
    ov.className = "sheet-overlay";
    ov.innerHTML =
      '<div class="sheet">' +
        '<div class="sheet-handle"></div>' +
        '<div class="sheet-head"><h2>' + title + '</h2>' +
          '<button class="sheet-close" data-close="1">' + MineIcons.svg("close", 20) + '</button></div>' +
        '<div class="sheet-body">' +
          '<div class="phone-reserved">' +
            '<div class="phone-reserved-icon">' +
              (title === "语音留言" ? MineIcons.svg("mic", 26) : MineIcons.svg("feather", 26)) +
            '</div>' +
            '<div class="phone-reserved-title">来自 ' + esc(c ? c.name : "未知") + '</div>' +
            '<div class="phone-reserved-desc">' + descHtml + '</div>' +
            '<button class="btn btn-primary" data-close="1">收到</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);
    requestAnimationFrame(function () {
      ov.classList.add("is-open");
      var sheet = ov.querySelector(".sheet");
      if (sheet) sheet.classList.add("is-open");
    });

    ov.addEventListener("click", function (e) {
      var closeHit = (e.target === ov) ||
        (e.target && e.target.closest && e.target.closest("[data-close]"));
      if (closeHit) {
        ov.classList.remove("is-open");
        setTimeout(function () { ov.remove(); }, 300);
      }
    });
  }

  /* 字卡留言：内容取自联系人主页"自动回复字卡"（c.autoCards） */
  function showCardMessage(c, card) {
    var desc;
    if (card == null) {
      desc = "对方挂断了电话，没有留下字卡。";
    } else if (/^data:image\//i.test(card) ||
               /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(card)) {
      desc = '<img src="' + card +
        '" style="max-width:100%;max-height:180px;border-radius:12px;display:block;margin:6px auto;" />';
    } else {
      desc = esc(card);
    }
    showMessageSheet("字卡留言", c, desc);
  }

  /* 语音留言：预留占位（后期植入） */
  function showVoiceMessage(c) {
    showMessageSheet("语音留言", c,
      '收到一段来自雾中的语音留言。<br>语音功能开发中，敬请期待。');
  }

  /* ==================== 呼入电话 ==================== */
  function receiveCall(contactId) {
    if (active) return;   // 忙线：不打断当前通话
    var c = findContact(contactId);
    if (!c) return;

    overlayEl = buildOverlay(c, true);
    active = { dir: "in", contactId: contactId, state: "ringing", startedAt: Date.now() };
    overlayEl.classList.add("is-ringing");

    // 响铃超时 → 未接
    timers.push(setTimeout(function () {
      if (active && active.dir === "in" && active.state === "ringing") {
        endCall("未接来电 · " + c.name);
      }
    }, CONFIG.incomingRingSec * 1000));
  }

  /* ==================== 群聊电话模式（暂不设置，入口占位保留） ==================== */
  function openGroupCall(groupId) {
    var g = (window.MineContacts && MineContacts.findGroup)
      ? MineContacts.findGroup(groupId) : null;
    var name = g ? g.name : "群聊";

    var ov = document.createElement("div");
    ov.className = "sheet-overlay";
    ov.innerHTML =
      '<div class="sheet">' +
        '<div class="sheet-handle"></div>' +
        '<div class="sheet-head"><h2>群电话模式</h2>' +
          '<button class="sheet-close" data-close="1">' + MineIcons.svg("close", 20) + '</button></div>' +
        '<div class="sheet-body">' +
          '<div class="phone-reserved">' +
            '<div class="phone-reserved-icon">' + MineIcons.svg("users", 26) + '</div>' +
            '<div class="phone-reserved-title">' + esc(name) + ' · 群电话</div>' +
            '<div class="phone-reserved-desc">群聊电话模式已预留入口，<br>具体规则与交互将在后期版本开放。</div>' +
            '<button class="btn btn-primary" data-close="1">知道了</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);
    requestAnimationFrame(function () {
      ov.classList.add("is-open");
      var sheet = ov.querySelector(".sheet");
      if (sheet) sheet.classList.add("is-open");
    });

    ov.addEventListener("click", function (e) {
      var closeHit = (e.target === ov) ||
        (e.target && e.target.closest && e.target.closest("[data-close]"));
      if (closeHit) {
        ov.classList.remove("is-open");
        setTimeout(function () { ov.remove(); }, 300);
      }
    });
  }

  /* ==================== 电话页（Dock「电话」入口 · 通话记录） ==================== */
  function fmtLogTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    var hm = (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" +
             (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
    if (d.toDateString() === now.toDateString()) return "今天 " + hm;
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + hm;
  }

  function logRowHTML(entry) {
    var c = findContact(entry.contactId);
    var name = c ? c.name : "未知";
    var iconName = entry.dir === "out" ? "phoneOut"
      : (entry.kind === "answered" ? "phoneIn" : "phoneMissed");
    var kindText = entry.dir === "out" ? "呼出"
      : (entry.kind === "answered" ? "呼入" : "未接");
    var durText = entry.duration > 0 ? fmtDuration(entry.duration) : "";
    return '<div class="phone-log-row">' +
      '<div class="phone-log-icon">' + I.svg(iconName, 18) + '</div>' +
      '<div class="phone-log-info">' +
        '<span class="phone-log-name">' + esc(name) + '</span>' +
        '<span class="phone-log-kind' + (entry.kind === "missed" ? " is-missed" : "") + '">' +
          kindText + ' · ' + fmtLogTime(entry.time) + '</span>' +
      '</div>' +
      '<span class="phone-log-dur">' + durText + '</span>' +
    '</div>';
  }

  function renderPage() {
    var detail = document.getElementById("page-detail");
    if (!detail) return;
    var I = window.MineIcons;
    var rows = callLog.slice().reverse();
    var listHtml = "";
    if (rows.length === 0) {
      listHtml = '<div class="empty-state">' +
        '<div class="empty-icon">' + I.svg("phone", 28) + '</div>' +
        '<div class="empty-title">暂无通话记录</div>' +
        '<div class="empty-desc">呼叫联系人，或等待一次来自雾中的来电。</div>' +
      '</div>';
    } else {
      listHtml = rows.map(logRowHTML).join("");
    }
    var html =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + I.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">电话</span>' +
        '<span class="nav-right"></span>' +
      '</div>' +
      '<div class="scroll phone-log-scroll">' +
        '<div class="phone-log-head">通话记录 <span class="count">' + callLog.length + '</span></div>' +
        listHtml +
        '<div class="phone-log-hint">在通讯录或聊天页点 <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> 图标可呼叫联系人 · 联系人也会每小时按概率主动来电</div>' +
      '</div>';
    detail.innerHTML = html;
    detail.querySelector('[data-act="back"]').addEventListener("click", function () {
      if (window.MineApp && MineApp.goHome) MineApp.goHome();
    });
    if (window.MineApp && MineApp.switchPage) MineApp.switchPage("detail");
  }

  /* ==================== 联系人主动来电调度（每小时一次，互相独立） ==================== */
  var schedulerInt = null;
  var callSchedule = {};     // contactId -> 下一次抽取时间戳

  function schedulerTick() {
    if (!CONFIG.incomingEnabled) return;
    if (active) return;                        // 通话 / 来电进行中不打扰
    var now = Date.now();
    var st = (window.MineContacts && MineContacts.getState)
      ? MineContacts.getState() : null;
    var list = (st && st.contacts) || [];
    if (list.length === 0) return;

    var rollMs = Math.max(1, CONFIG.perContactRollMinutes) * 60000;
    var hit = null;
    list.forEach(function (c) {
      if (hit) return;                         // 每轮最多触发一个来电
      var t = callSchedule[c.id];
      if (!t) {
        // 首次调度：在当前小时内的随机时刻安排抽取（避免打开即触发）
        callSchedule[c.id] = now + Math.floor(Math.random() * rollMs);
        return;
      }
      if (t <= now) {
        // 到点：安排下一次（每个联系人独立、每小时一次）
        callSchedule[c.id] = now + rollMs;
        if (Math.random() < CONFIG.incomingChance) hit = c;
      }
    });
    if (hit) receiveCall(hit.id);
  }

  /* ==================== 初始化 ==================== */
  function init() {
    loadLog();
    callSchedule = {};                         // 重置调度表
    if (schedulerInt) clearInterval(schedulerInt);
    schedulerInt = setInterval(schedulerTick, 10000);   // 每 10 秒检查一次
  }

  /* ==================== 列表行内电话按钮（事件委托，捕获阶段拦截行点击） ==================== */
  document.addEventListener("click", function (e) {
    var btn = (e.target && e.target.closest) ? e.target.closest(".contact-call-btn") : null;
    if (!btn) return;
    var id = btn.getAttribute("data-call");
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();   // 阻止通讯录行的跳转
    callContact(id);
  }, true);

  /* ---------------- 公共方法 ---------------- */
  return {
    init: init,
    callContact: callContact,
    receiveCall: receiveCall,
    openGroupCall: openGroupCall,
    renderPage: renderPage,
    /* 通话记录（后期可扩展"通话记录"详情页） */
    getLog: function () { return callLog.slice(); }
  };
})();
