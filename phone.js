/* ========================================================================
   Mine · 电话模块
   ------------------------------------------------------------------------
   功能：
   · 主动拨打：从通讯录选联系人一对一通话
   · 群聊通话：邀请多位联系人参与群聊通话
   · 接听/挂断：95%概率接通，5%概率挂断并留留言钩子
   · 来电：联系人主动拨打电话（由 chat.js 字卡触发概率调用）
   UI 设计清晰分层，方便后期增删功能
   ======================================================================== */
window.MinePhone = (function () {
  "use strict";
  var I = window.MineIcons;
  var C = window.MineContacts;

  /* ---------------- 概率配置（方便后期调整） ---------------- */
  var PROB = {
    answerRate: 0.95,         // 主动拨打时对方接通率
    hangupRate: 0.05,         // 主动拨打时对方挂断率
    incomingFromContact: 0.01, // 当前对话联系人每发一张字卡来电概率
    incomingFromOther: 0.002   // 其他联系人每发一张字卡来电概率
  };

  /* ---------------- 状态机 ---------------- */
  var CallState = {
    IDLE: "idle",
    OUTGOING: "outgoing",      // 正在拨出，等待接听
    ACTIVE: "active",          // 通话中
    INCOMING: "incoming",      // 来电中
    ENDED: "ended"             // 通话结束
  };

  var currentCall = null;      // { state, type, participants, startTime, direction }
  var pageEl = null;

  /* ---------------- 移动端点击兼容 ----------------
     同时绑定 click + touchend，防止部分移动浏览器不触发 click */
  function onTap(el, handler) {
    if (!el) return;
    var touched = false;
    el.addEventListener("touchend", function (e) {
      touched = true;
      e.preventDefault();
      handler.call(el, e);
      setTimeout(function () { touched = false; }, 350);
    }, { passive: false });
    el.addEventListener("click", function (e) {
      if (touched) return; // touchend 已处理，跳过重复 click
      handler.call(el, e);
    });
  }

  /* ========================================================================
     页面入口
     ======================================================================== */
  function renderPage() {
    if (!pageEl) pageEl = document.getElementById("page-phone");
    if (!pageEl) return;
    renderMainPage();
  }

  /* ========================================================================
     主页面：拨打电话
     ======================================================================== */
  function renderMainPage() {
    if (!pageEl) pageEl = document.getElementById("page-phone");
    if (!pageEl) return;

    var navHtml =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + I.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">电话</span>' +
        '<span class="nav-right"></span>' +
      '</div>';

    var bodyHtml =
      '<div class="scroll phone-main">' +
        '<div class="phone-hero">' +
          '<div class="phone-hero-icon">' + I.svg("phone", 48) + '</div>' +
          '<div class="phone-hero-title">拨打电话</div>' +
          '<div class="phone-hero-sub">选择联系人开始通话</div>' +
        '</div>' +
        '<div class="phone-actions">' +
          '<div class="phone-action-card" id="phone-single-call">' +
            '<span class="phone-action-icon">' + I.svg("phone", 24) + '</span>' +
            '<div class="phone-action-text">' +
              '<div class="phone-action-name">单人通话</div>' +
              '<div class="phone-action-desc">拨打给一位联系人</div>' +
            '</div>' +
          '</div>' +
          '<div class="phone-action-card" id="phone-group-call">' +
            '<span class="phone-action-icon">' + I.svg("users", 24) + '</span>' +
            '<div class="phone-action-text">' +
              '<div class="phone-action-name">群聊通话</div>' +
              '<div class="phone-action-desc">邀请多位联系人通话</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    pageEl.innerHTML = navHtml + bodyHtml;
    onTap(pageEl.querySelector('[data-act="back"]'), function () {
      if (window.MineApp) MineApp.goHome();
    });
    onTap(pageEl.querySelector("#phone-single-call"), showSingleCallPicker);
    onTap(pageEl.querySelector("#phone-group-call"), showGroupCallPicker);
  }

  /* ========================================================================
     单人通话：选择联系人
     ======================================================================== */
  function showSingleCallPicker() {
    if (!C || !C.getState) return;
    C.loadData();
    var state = C.getState();
    var contacts = state.contacts || [];

    var listHtml = contacts.map(function (c) {
      return '<div class="phone-contact-row" data-contact-id="' + c.id + '">' +
        '<div class="phone-contact-avatar">' + C.avatarHTML(c, 40, "avatar-gen") + '</div>' +
        '<div class="phone-contact-info">' +
          '<div class="phone-contact-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="phone-contact-status">' + escapeHtml(c.status || "在线") + '</div>' +
        '</div>' +
        '<span class="phone-call-btn">' + I.svg("phone", 18) + '</span>' +
      '</div>';
    }).join("");

    var navHtml =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + I.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">选择联系人</span>' +
        '<span class="nav-right"></span>' +
      '</div>';

    var bodyHtml =
      '<div class="scroll phone-picker">' +
        (contacts.length === 0 ?
          '<div class="empty-state"><div class="empty-desc">暂无联系人</div></div>' :
          listHtml) +
      '</div>';

    pageEl.innerHTML = navHtml + bodyHtml;
    onTap(pageEl.querySelector('[data-act="back"]'), renderMainPage);
    pageEl.querySelectorAll(".phone-contact-row").forEach(function (row) {
      onTap(row, function () {
        var contactId = row.getAttribute("data-contact-id");
        startOutgoingCall(contactId);
      });
    });
  }

  /* ========================================================================
     群聊通话：选择多位联系人
     ======================================================================== */
  var groupCallSelection = {};

  function showGroupCallPicker() {
    if (!C || !C.getState) return;
    C.loadData();
    var state = C.getState();
    var contacts = state.contacts || [];
    groupCallSelection = {};

    var listHtml = contacts.map(function (c) {
      return '<div class="phone-contact-row" data-contact-id="' + c.id + '">' +
        '<div class="phone-contact-avatar">' + C.avatarHTML(c, 40, "avatar-gen") + '</div>' +
        '<div class="phone-contact-info">' +
          '<div class="phone-contact-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="phone-contact-status">' + escapeHtml(c.status || "在线") + '</div>' +
        '</div>' +
        '<span class="phone-check">' + I.svg("circle", 22) + '</span>' +
      '</div>';
    }).join("");

    var navHtml =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + I.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">邀请通话</span>' +
        '<button class="nav-btn phone-start-group-btn" data-act="start" disabled>开始</button>' +
      '</div>';

    var bodyHtml =
      '<div class="scroll phone-picker">' +
        (contacts.length === 0 ?
          '<div class="empty-state"><div class="empty-desc">暂无联系人</div></div>' :
          listHtml) +
      '</div>';

    pageEl.innerHTML = navHtml + bodyHtml;
    onTap(pageEl.querySelector('[data-act="back"]'), renderMainPage);

    var startBtn = pageEl.querySelector('[data-act="start"]');

    pageEl.querySelectorAll(".phone-contact-row").forEach(function (row) {
      onTap(row, function () {
        var id = row.getAttribute("data-contact-id");
        if (groupCallSelection[id]) {
          delete groupCallSelection[id];
          row.classList.remove("is-selected");
          row.querySelector(".phone-check").innerHTML = I.svg("circle", 22);
        } else {
          groupCallSelection[id] = true;
          row.classList.add("is-selected");
          row.querySelector(".phone-check").innerHTML = I.svg("checkCircle", 22);
        }
        var count = Object.keys(groupCallSelection).length;
        startBtn.disabled = count === 0;
        startBtn.textContent = count > 0 ? "开始 (" + count + ")" : "开始";
      });
    });

    onTap(startBtn, function () {
      if (Object.keys(groupCallSelection).length === 0) return;
      startGroupCall(Object.keys(groupCallSelection));
    });
  }

  /* ========================================================================
     通话界面：拨出
     ======================================================================== */
  function startOutgoingCall(contactId) {
    if (!C) return;
    C.loadData();
    var contact = C.findContact(contactId);
    if (!contact) return;

    currentCall = {
      state: CallState.OUTGOING,
      type: "single",
      direction: "outgoing",
      participants: [contact],
      startTime: 0
    };

    renderCallScreen();

    // 模拟拨号等待 2-4 秒
    var delay = 2000 + Math.random() * 2000;
    setTimeout(function () {
      if (!currentCall || currentCall.state !== CallState.OUTGOING) return;
      var r = Math.random();
      if (r < PROB.answerRate) {
        // 接通
        currentCall.state = CallState.ACTIVE;
        currentCall.startTime = Date.now();
        renderCallScreen();
        startCallTimer();
      } else {
        // 挂断
        currentCall.state = CallState.ENDED;
        currentCall.endReason = "declined";
        // 留言钩子（后期实现）
        // hook: onVoicemailLeft(contact)
        renderCallScreen();
      }
    }, delay);
  }

  /* ========================================================================
     通话界面：群聊通话
     ======================================================================== */
  function startGroupCall(contactIds) {
    if (!C) return;
    C.loadData();
    var participants = contactIds.map(function (id) {
      return C.findContact(id);
    }).filter(function (c) { return c; });

    if (participants.length === 0) return;

    currentCall = {
      state: CallState.OUTGOING,
      type: "group",
      direction: "outgoing",
      participants: participants,
      startTime: 0,
      answered: []
    };

    renderCallScreen();

    // 群聊通话：每个参与者独立判定接通/挂断
    participants.forEach(function (p, idx) {
      var delay = 2000 + Math.random() * 3000 + idx * 500;
      setTimeout(function () {
        if (!currentCall || currentCall.state !== CallState.OUTGOING) return;
        var r = Math.random();
        if (r < PROB.answerRate) {
          currentCall.answered.push(p.id);
          renderCallScreen();
          // 第一人接通后进入通话状态
          if (currentCall.state === CallState.OUTGOING) {
            currentCall.state = CallState.ACTIVE;
            currentCall.startTime = Date.now();
            startCallTimer();
          }
        }
      }, delay);
    });
  }

  /* ========================================================================
     来电界面：联系人主动拨打
     ======================================================================== */
  function startIncomingCall(contactId, isFromOther) {
    if (!C) return;
    C.loadData();
    var contact = C.findContact(contactId);
    if (!contact) return;

    // 如果当前正在通话，则忽略来电
    if (currentCall && (currentCall.state === CallState.ACTIVE || currentCall.state === CallState.OUTGOING || currentCall.state === CallState.INCOMING)) {
      return;
    }

    currentCall = {
      state: CallState.INCOMING,
      type: "single",
      direction: "incoming",
      participants: [contact],
      startTime: 0,
      isFromOther: !!isFromOther
    };

    renderCallScreen();
  }

  /* ========================================================================
     渲染通话界面
     ======================================================================== */
  function renderCallScreen() {
    if (!pageEl) pageEl = document.getElementById("page-phone");
    if (!pageEl || !currentCall) return;

    var call = currentCall;
    var isGroup = call.type === "group";
    var mainContact = call.participants[0] || {};

    // 头像区域
    var avatarHtml = isGroup ?
      '<div class="phone-call-avatars">' +
        call.participants.slice(0, 3).map(function (p) {
          return C.avatarHTML(p, 56, "avatar-gen phone-call-avatar-item");
        }).join("") +
        (call.participants.length > 3 ?
          '<div class="phone-call-avatar-more">+' + (call.participants.length - 3) + '</div>' : '') +
      '</div>' :
      '<div class="phone-call-avatar-single">' +
        C.avatarHTML(mainContact, 80, "avatar-gen") +
      '</div>';

    // 名称
    var nameHtml = isGroup ?
      '<div class="phone-call-name">' + escapeHtml(call.participants.map(function (p) { return p.name; }).join("、")) + '</div>' :
      '<div class="phone-call-name">' + escapeHtml(mainContact.name || "未知") + '</div>';

    // 状态文案
    var statusText = "";
    var statusClass = "";
    switch (call.state) {
      case CallState.OUTGOING:
        if (isGroup) {
          var answeredCount = (call.answered || []).length;
          statusText = "正在呼叫… (" + answeredCount + "/" + call.participants.length + " 已接通)";
        } else {
          statusText = "正在呼叫…";
        }
        statusClass = "phone-status-calling";
        break;
      case CallState.INCOMING:
        statusText = "来电中…";
        statusClass = "phone-status-incoming";
        break;
      case CallState.ACTIVE:
        statusText = formatDuration(call.startTime);
        statusClass = "phone-status-active";
        break;
      case CallState.ENDED:
        statusText = call.endReason === "declined" ? "对方已挂断" : "通话已结束";
        statusClass = "phone-status-ended";
        break;
    }

    // 按钮区域
    var buttonsHtml = "";
    switch (call.state) {
      case CallState.OUTGOING:
        buttonsHtml =
          '<div class="phone-call-buttons">' +
            '<button class="phone-btn-hangup" id="phone-hangup-out">' + I.svg("phone", 28) + '</button>' +
          '</div>';
        break;
      case CallState.INCOMING:
        buttonsHtml =
          '<div class="phone-call-buttons phone-call-buttons-incoming">' +
            '<button class="phone-btn-decline" id="phone-decline">' + I.svg("phone", 28) + '</button>' +
            '<button class="phone-btn-answer" id="phone-answer">' + I.svg("phone", 28) + '</button>' +
          '</div>';
        break;
      case CallState.ACTIVE:
        buttonsHtml =
          '<div class="phone-call-buttons">' +
            '<button class="phone-btn-hangup" id="phone-hangup-active">' + I.svg("phone", 28) + '</button>' +
          '</div>';
        break;
      case CallState.ENDED:
        buttonsHtml =
          '<div class="phone-call-buttons">' +
            '<button class="phone-btn-done" id="phone-done">完成</button>' +
          '</div>';
        break;
    }

    // 留言提示（钩子，后期实现）
    var voicemailHtml = "";
    if (call.state === CallState.ENDED && call.endReason === "declined") {
      voicemailHtml =
        '<div class="phone-voicemail-hook">' +
          '<span class="phone-voicemail-icon">' + I.svg("mail", 18) + '</span>' +
          '<span class="phone-voicemail-text">对方留下了一段电话留言</span>' +
        '</div>';
    }

    var html =
      '<div class="phone-call-screen' + (call.direction === "incoming" ? " is-incoming" : "") + '">' +
        '<div class="phone-call-top">' +
          '<button class="phone-call-minimize" id="phone-minimize">' + I.svg("close", 20) + '</button>' +
        '</div>' +
        '<div class="phone-call-body">' +
          avatarHtml +
          nameHtml +
          '<div class="phone-call-status ' + statusClass + '" id="phone-call-status">' + statusText + '</div>' +
          voicemailHtml +
        '</div>' +
        buttonsHtml +
      '</div>';

    pageEl.innerHTML = html;

    // 切换到 phone 页面
    if (window.MineApp) MineApp.switchPage("phone");

    // 绑定按钮
    bindCallButtons();
  }

  /* ========================================================================
     绑定通话按钮
     ======================================================================== */
  function bindCallButtons() {
    onTap(document.getElementById("phone-hangup-out"), function () {
      endCall("cancelled");
    });

    onTap(document.getElementById("phone-hangup-active"), function () {
      endCall("ended");
    });

    onTap(document.getElementById("phone-decline"), function () {
      endCall("declined");
    });

    onTap(document.getElementById("phone-answer"), function () {
      if (!currentCall) return;
      currentCall.state = CallState.ACTIVE;
      currentCall.startTime = Date.now();
      renderCallScreen();
      startCallTimer();
    });

    onTap(document.getElementById("phone-done"), function () {
      currentCall = null;
      renderMainPage();
    });

    onTap(document.getElementById("phone-minimize"), function () {
      currentCall = null;
      if (window.MineApp) MineApp.goHome();
    });
  }

  /* ========================================================================
     通话计时器
     ======================================================================== */
  var timerInterval = null;
  function startCallTimer() {
    stopCallTimer();
    timerInterval = setInterval(function () {
      if (!currentCall || currentCall.state !== CallState.ACTIVE) {
        stopCallTimer();
        return;
      }
      var statusEl = document.getElementById("phone-call-status");
      if (statusEl) statusEl.textContent = formatDuration(currentCall.startTime);
    }, 1000);
  }
  function stopCallTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function endCall(reason) {
    stopCallTimer();
    if (!currentCall) return;
    currentCall.state = CallState.ENDED;
    currentCall.endReason = reason || "ended";
    renderCallScreen();
  }

  /* ========================================================================
     概率触发：联系人来电
     由 chat.js 在收到字卡时调用
     ======================================================================== */
  function maybeTriggerIncomingCall(contactId, isOtherContact) {
    if (!currentCall) {
      // 当前无通话，正常判定
    } else {
      // 通话中不触发
      return;
    }

    var prob = isOtherContact ? PROB.incomingFromOther : PROB.incomingFromContact;
    if (Math.random() < prob) {
      startIncomingCall(contactId, isOtherContact);
    }
  }

  /* ========================================================================
     工具函数
     ======================================================================== */
  function formatDuration(start) {
    var elapsed = Math.floor((Date.now() - start) / 1000);
    var m = Math.floor(elapsed / 60);
    var s = elapsed % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ========================================================================
     公开 API
     ======================================================================== */
  return {
    renderPage: renderPage,
    maybeTriggerIncomingCall: maybeTriggerIncomingCall,
    startIncomingCall: startIncomingCall,
    getProb: function () { return PROB; },
    setProb: function (key, val) { if (PROB.hasOwnProperty(key)) PROB[key] = val; }
  };
})();
