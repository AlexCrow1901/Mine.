/* ========================================================================
   Mine · 电话模块
   ------------------------------------------------------------------------
   功能：
   · 主动拨打：从通讯录选联系人一对一通话
   · 群聊通话：邀请多位联系人参与群聊通话
   · 接听/挂断：95%概率接通，5%概率挂断并留留言钩子
   · 来电：联系人主动拨打电话（由 chat.js 字卡触发概率调用）
   注意：所有可点击元素使用 <button>，事件用委托模式，
         兼容 Vivo/OPPO 等浏览器对 div click 不触发的问题。
   ======================================================================== */
window.MinePhone = (function () {
  "use strict";
  var I = window.MineIcons;
  var C = window.MineContacts;

  /* ---------------- 概率配置（方便后期调整） ---------------- */
  var PROB = {
    answerRate: 0.95,
    hangupRate: 0.05,
    incomingFromContact: 0.01,
    incomingFromOther: 0.002
  };

  /* ---------------- 状态机 ---------------- */
  var CallState = {
    IDLE: "idle",
    OUTGOING: "outgoing",
    ACTIVE: "active",
    INCOMING: "incoming",
    ENDED: "ended"
  };

  var currentCall = null;
  var pageEl = null;

  /* ========================================================================
     事件委托：在 pageEl 上监听所有 click，通过 data-act 分发
     这样无论 DOM 怎么重建，只需绑定一次
     ======================================================================== */
  function setupDelegation() {
    if (!pageEl) return;
    pageEl.addEventListener("click", function (e) {
      var target = e.target;
      while (target && target !== pageEl) {
        var act = target.getAttribute("data-act");
        if (act) {
          handleAction(act, target, e);
          return;
        }
        var contactId = target.getAttribute("data-contact-id");
        if (contactId) {
          handleContactTap(contactId, target);
          return;
        }
        target = target.parentElement;
      }
    });
  }

  function handleAction(act, el, e) {
    switch (act) {
      case "back-home":
        if (window.MineApp) MineApp.goHome();
        break;
      case "back-main":
        renderMainPage();
        break;
      case "single-call":
        showSingleCallPicker();
        break;
      case "group-call":
        showGroupCallPicker();
        break;
      case "start-group":
        if (Object.keys(groupCallSelection).length > 0) {
          startGroupCall(Object.keys(groupCallSelection));
        }
        break;
      case "hangup-out":
        endCall("cancelled");
        break;
      case "hangup-active":
        endCall("ended");
        break;
      case "decline":
        endCall("declined");
        break;
      case "answer":
        if (!currentCall) return;
        currentCall.state = CallState.ACTIVE;
        currentCall.startTime = Date.now();
        renderCallScreen();
        startCallTimer();
        break;
      case "done":
        currentCall = null;
        renderMainPage();
        break;
      case "minimize":
        currentCall = null;
        if (window.MineApp) MineApp.goHome();
        break;
    }
  }

  function handleContactTap(contactId, el) {
    var mode = el.getAttribute("data-mode");
    if (mode === "single") {
      startOutgoingCall(contactId);
    } else if (mode === "group") {
      if (groupCallSelection[contactId]) {
        delete groupCallSelection[contactId];
        el.classList.remove("is-selected");
        var check = el.querySelector(".phone-check");
        if (check) check.innerHTML = I.svg("circle", 22);
      } else {
        groupCallSelection[contactId] = true;
        el.classList.add("is-selected");
        var check2 = el.querySelector(".phone-check");
        if (check2) check2.innerHTML = I.svg("checkCircle", 22);
      }
      var startBtn = pageEl.querySelector('[data-act="start-group"]');
      if (startBtn) {
        var count = Object.keys(groupCallSelection).length;
        startBtn.disabled = count === 0;
        startBtn.textContent = count > 0 ? "开始 (" + count + ")" : "开始";
      }
    }
  }

  /* ========================================================================
     页面入口
     ======================================================================== */
  function renderPage() {
    if (!pageEl) pageEl = document.getElementById("page-phone");
    if (!pageEl) return;
    if (!pageEl._delegated) {
      setupDelegation();
      pageEl._delegated = true;
    }
    renderMainPage();
  }

  /* ========================================================================
     主页面
     ======================================================================== */
  function renderMainPage() {
    if (!pageEl) pageEl = document.getElementById("page-phone");
    if (!pageEl) return;

    var navHtml =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back-home">' + I.svg("back", 20) + '返回</button>' +
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
          '<button class="phone-action-card" data-act="single-call">' +
            '<span class="phone-action-icon">' + I.svg("phone", 24) + '</span>' +
            '<div class="phone-action-text">' +
              '<div class="phone-action-name">单人通话</div>' +
              '<div class="phone-action-desc">拨打给一位联系人</div>' +
            '</div>' +
          '</button>' +
          '<button class="phone-action-card" data-act="group-call">' +
            '<span class="phone-action-icon">' + I.svg("users", 24) + '</span>' +
            '<div class="phone-action-text">' +
              '<div class="phone-action-name">群聊通话</div>' +
              '<div class="phone-action-desc">邀请多位联系人通话</div>' +
            '</div>' +
          '</button>' +
        '</div>' +
      '</div>';

    pageEl.innerHTML = navHtml + bodyHtml;
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
      return '<button class="phone-contact-row" data-contact-id="' + c.id + '" data-mode="single">' +
        '<span class="phone-contact-avatar">' + C.avatarHTML(c, 40, "avatar-gen") + '</span>' +
        '<div class="phone-contact-info">' +
          '<div class="phone-contact-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="phone-contact-status">' + escapeHtml(c.status || "在线") + '</div>' +
        '</div>' +
        '<span class="phone-call-btn">' + I.svg("phone", 18) + '</span>' +
      '</button>';
    }).join("");

    var navHtml =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back-main">' + I.svg("back", 20) + '返回</button>' +
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
      return '<button class="phone-contact-row" data-contact-id="' + c.id + '" data-mode="group">' +
        '<span class="phone-contact-avatar">' + C.avatarHTML(c, 40, "avatar-gen") + '</span>' +
        '<div class="phone-contact-info">' +
          '<div class="phone-contact-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="phone-contact-status">' + escapeHtml(c.status || "在线") + '</div>' +
        '</div>' +
        '<span class="phone-check">' + I.svg("circle", 22) + '</span>' +
      '</button>';
    }).join("");

    var navHtml =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back-main">' + I.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">邀请通话</span>' +
        '<button class="nav-btn phone-start-group-btn" data-act="start-group" disabled>开始</button>' +
      '</div>';

    var bodyHtml =
      '<div class="scroll phone-picker">' +
        (contacts.length === 0 ?
          '<div class="empty-state"><div class="empty-desc">暂无联系人</div></div>' :
          listHtml) +
      '</div>';

    pageEl.innerHTML = navHtml + bodyHtml;
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

    var delay = 2000 + Math.random() * 2000;
    setTimeout(function () {
      if (!currentCall || currentCall.state !== CallState.OUTGOING) return;
      var r = Math.random();
      if (r < PROB.answerRate) {
        currentCall.state = CallState.ACTIVE;
        currentCall.startTime = Date.now();
        renderCallScreen();
        startCallTimer();
      } else {
        currentCall.state = CallState.ENDED;
        currentCall.endReason = "declined";
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

    participants.forEach(function (p, idx) {
      var delay = 2000 + Math.random() * 3000 + idx * 500;
      setTimeout(function () {
        if (!currentCall || currentCall.state !== CallState.OUTGOING) return;
        var r = Math.random();
        if (r < PROB.answerRate) {
          currentCall.answered.push(p.id);
          renderCallScreen();
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
     来电界面
     ======================================================================== */
  function startIncomingCall(contactId, isFromOther) {
    if (!C) return;
    C.loadData();
    var contact = C.findContact(contactId);
    if (!contact) return;

    if (currentCall && currentCall.state !== CallState.IDLE && currentCall.state !== CallState.ENDED) {
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

    var nameHtml = isGroup ?
      '<div class="phone-call-name">' + escapeHtml(call.participants.map(function (p) { return p.name; }).join("、")) + '</div>' :
      '<div class="phone-call-name">' + escapeHtml(mainContact.name || "未知") + '</div>';

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

    var buttonsHtml = "";
    switch (call.state) {
      case CallState.OUTGOING:
        buttonsHtml =
          '<div class="phone-call-buttons">' +
            '<button class="phone-btn-hangup" data-act="hangup-out">' + I.svg("phone", 28) + '</button>' +
          '</div>';
        break;
      case CallState.INCOMING:
        buttonsHtml =
          '<div class="phone-call-buttons phone-call-buttons-incoming">' +
            '<button class="phone-btn-decline" data-act="decline">' + I.svg("phone", 28) + '</button>' +
            '<button class="phone-btn-answer" data-act="answer">' + I.svg("phone", 28) + '</button>' +
          '</div>';
        break;
      case CallState.ACTIVE:
        buttonsHtml =
          '<div class="phone-call-buttons">' +
            '<button class="phone-btn-hangup" data-act="hangup-active">' + I.svg("phone", 28) + '</button>' +
          '</div>';
        break;
      case CallState.ENDED:
        buttonsHtml =
          '<div class="phone-call-buttons">' +
            '<button class="phone-btn-done" data-act="done">完成</button>' +
          '</div>';
        break;
    }

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
          '<button class="phone-call-minimize" data-act="minimize">' + I.svg("close", 20) + '</button>' +
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

    if (window.MineApp) MineApp.switchPage("phone");
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
     ======================================================================== */
  function maybeTriggerIncomingCall(contactId, isOtherContact) {
    if (currentCall && currentCall.state !== CallState.IDLE && currentCall.state !== CallState.ENDED) {
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
