/* ========================================================================
   Mine · 聊天模块
   ------------------------------------------------------------------------
   功能：
   · 一对一聊天（与联系人列表中的某个人）
   · 群聊（与群内所有人）
   · 我的输入：自由输入任意字符
   · 对方回复：从该联系人的字卡中随机抽取一条
   · 群聊中：我发消息后，随机 1-2 位成员各回一张随机字卡
   · 聊天记录持久化（localStorage）
   · 会话列表（聊天应用主页，显示最近对话）
   接入：通过 MineApp.page("chat") 钩子接管主页；
         openContact(id) / openGroup(id) 供通讯录模块调用。
   ======================================================================== */

window.MineChat = (function () {
  "use strict";

  var STORE_KEY = "mine.chat.v1";
  var UNREAD_KEY = "mine.chat.unread.v1";
  var I = window.MineIcons;
  var C = window.MineContacts;   // 通讯录数据接口

  /* ---------------- 数据：会话存储 ----------------
     conversations: {
       "contact:c1": [ { from:"me"|"c1", text, time }, ... ],
       "group:g1":    [ ... ]
     } */
  var conversations = {};

  /* ---------------- 数据：未读计数 ----------------
     unreadCounts: { "contact:c1": 3, "group:g1": 1, ... } */
  var unreadCounts = {};

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        conversations = JSON.parse(raw) || {};
        // 兼容旧数据：确保我的消息有 read 字段
        Object.keys(conversations).forEach(function (key) {
          var msgs = conversations[key];
          if (Array.isArray(msgs)) {
            msgs.forEach(function (m) {
              if (m.from === "me" && m.read === undefined) {
                // 旧消息默认视为已读
                m.read = true;
              }
            });
          }
        });
      }
    } catch (e) {}
    if (!conversations) conversations = {};

    // 加载未读计数
    try {
      var rawUnread = localStorage.getItem(UNREAD_KEY);
      if (rawUnread) unreadCounts = JSON.parse(rawUnread) || {};
    } catch (e) {}
    if (!unreadCounts) unreadCounts = {};
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(conversations)); } catch (e) {}
  }
  function saveUnread() {
    try { localStorage.setItem(UNREAD_KEY, JSON.stringify(unreadCounts)); } catch (e) {}
  }

  /* ---------------- 未读计数工具 ---------------- */
  function incrementUnread(convKey) {
    if (!unreadCounts[convKey]) unreadCounts[convKey] = 0;
    unreadCounts[convKey]++;
    saveUnread();
  }
  function clearUnread(convKey) {
    if (unreadCounts[convKey]) {
      delete unreadCounts[convKey];
      saveUnread();
    }
  }
  function getUnread(convKey) {
    return unreadCounts[convKey] || 0;
  }
  function getTotalUnread() {
    var total = 0;
    Object.keys(unreadCounts).forEach(function (k) {
      total += unreadCounts[k];
    });
    return total;
  }

  /* 判断当前是否正在查看某个会话 */
  function isViewingConv(convKey) {
    var chatPage = document.getElementById("page-chat");
    if (!chatPage || !chatPage.classList.contains("is-active")) return false;
    return ctx.convKey === convKey;
  }

  /* ---------------- 工具 ---------------- */
  function uid() { return "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1000); }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    var h = d.getHours(); var m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function fmtDateSep(ts) {
    var d = new Date(ts);
    var now = new Date();
    if (d.toDateString() === now.toDateString()) return "今天";
    var y = d.getFullYear(), mo = d.getMonth() + 1, da = d.getDate();
    return y + "年" + mo + "月" + da + "日";
  }

  /**
   * 将文本按每 N 个字符换行（保留已有换行）
   * @param {string} text - 原始文本
   * @param {number} n - 每行字符数
   * @returns {string} HTML 安全文本，含 <br> 换行
   */
  function wrapText(text, n) {
    n = n || 12;
    var safe = escapeHtml(text);
    // 先按原始换行分割
    var lines = safe.split(/\n/);
    var result = [];
    lines.forEach(function (line) {
      if (line.length === 0) { result.push(""); return; }
      // 每 n 个字符插入 <br>
      for (var i = 0; i < line.length; i += n) {
        result.push(line.substring(i, i + n));
      }
    });
    return result.join("<br>");
  }

  /**
   * 渲染抉择消息：标题行 + ABCD 选项逐行对齐
   * 使用 .choice-msg-options 容器包裹所有选项，确保字母标签列对齐
   * @param {string} text - 原始抉择消息文本
   * @returns {string} HTML
   */
  function renderChoiceText(text) {
    var lines = (text || "").split(/\n/);
    var html = "";
    var firstLine = true;
    var optionsHtml = "";
    var hasOptions = false;
    lines.forEach(function (line) {
      var safe = escapeHtml(line);
      if (firstLine) {
        // 第一行是"【抉择】问题"
        html += '<div class="choice-msg-title">' + safe + '</div>';
        firstLine = false;
      } else {
        // 选项行：A. xxx / B. xxx ...（支持 A-Z）
        var match = safe.match(/^([A-Z])\.\s*(.*)$/);
        if (match) {
          hasOptions = true;
          optionsHtml += '<div class="choice-msg-option">' +
            '<span class="choice-msg-letter">' + match[1] + '</span>' +
            '<span class="choice-msg-text">' + match[2] + '</span>' +
            '</div>';
        } else if (safe.length > 0) {
          optionsHtml += '<div class="choice-msg-line">' + safe + '</div>';
        }
      }
    });
    // 用容器包裹选项，确保所有字母标签在同一列对齐
    if (hasOptions) {
      html += '<div class="choice-msg-options">' + optionsHtml + '</div>';
    } else {
      html += optionsHtml;
    }
    return html;
  }

  /* ---------------- "我"的头像 ---------------- */
  var ME_KEY = "mine.me.v1";
  var meProfile = null;
  function loadMe() {
    try {
      var raw = localStorage.getItem(ME_KEY);
      if (raw) { meProfile = JSON.parse(raw); return; }
    } catch (e) {}
    meProfile = { name: "我", avatar: null };
    try { localStorage.setItem(ME_KEY, JSON.stringify(meProfile)); } catch (e) {}
  }
  function saveMe() {
    try { localStorage.setItem(ME_KEY, JSON.stringify(meProfile)); } catch (e) {}
  }
  function meAvatarHTML(size, cls) {
    var s = size || 32;
    var c = (cls ? " " + cls : "");
    if (meProfile && meProfile.avatar) {
      return '<div class="avatar' + c + '" style="width:' + s + 'px;height:' + s + 'px;">' +
        '<img src="' + escapeHtml(meProfile.avatar) + '" alt=""></div>';
    }
    return '<div class="avatar avatar-gen' + c + '" style="width:' + s + 'px;height:' + s + 'px;">' +
      escapeHtml(C ? C.firstChar(meProfile ? meProfile.name : "我") : "我") + '</div>';
  }

  /** 从联系人的字卡中随机抽取一条 */
  function pickRandomCard(contact) {
    if (!contact || !contact.cards || contact.cards.length === 0) return null;
    var idx = Math.floor(Math.random() * contact.cards.length);
    return contact.cards[idx];
  }

  /**
   * 群聊中合并个人字卡 + 群字卡后随机抽取
   * @param contact  回复者
   * @param group    当前群聊对象
   */
  function pickRandomCardForGroup(contact, group) {
    var pool = [];
    if (contact && contact.cards) pool = pool.concat(contact.cards);
    if (group && group.cards) pool = pool.concat(group.cards);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** 从联系人的自动回复字卡中随机抽取一条 */
  function pickRandomAutoCard(contact) {
    if (!contact || !contact.autoCards || contact.autoCards.length === 0) return null;
    return contact.autoCards[Math.floor(Math.random() * contact.autoCards.length)];
  }

  /** 群聊中合并个人自动回复字卡 + 群自动回复字卡后随机抽取 */
  function pickRandomAutoCardForGroup(contact, group) {
    var pool = [];
    if (contact && contact.autoCards) pool = pool.concat(contact.autoCards);
    if (group && group.autoCards) pool = pool.concat(group.autoCards);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * 从群成员中随机选取 n 位可回复的成员
   * 可回复 = 有个人字卡 或 群有群字卡
   */
  function pickRandomMembers(group, n) {
    var groupHasCards = group && group.cards && group.cards.length > 0;
    var members = (group.members || []).map(C.findContact).filter(function (c) {
      if (!c) return false;
      // 有个人字卡 或 群有群字卡 → 可回复
      return (c.cards && c.cards.length > 0) || groupHasCards;
    });
    if (members.length === 0) return [];
    // 洗牌
    for (var i = members.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = members[i]; members[i] = members[j]; members[j] = tmp;
    }
    return members.slice(0, Math.min(n, members.length));
  }

  /* ---------------- 当前聊天上下文 ---------------- */
  var ctx = {
    type: null,       // "contact" | "group"
    id: null,         // 联系人ID 或 群ID
    convKey: null,    // 存储键 "contact:c1" | "group:g1"
    title: "",
    subtitle: ""
  };

  var pageEl = null;
  var msgContainer = null;
  var inputEl = null;
  var sendBtn = null;

  /* ========================================================================
     打开聊天
     ======================================================================== */
  function openContact(contactId) {
    if (C && C.loadData) C.loadData();
    loadMe();
    var c = C.findContact(contactId);
    if (!c) return;
    load();
    clearUnread("contact:" + contactId);
    ctx.type = "contact";
    ctx.id = contactId;
    ctx.convKey = "contact:" + contactId;
    ctx.title = c.name;
    ctx.subtitle = c.status || "在线";
    if (!conversations[ctx.convKey]) conversations[ctx.convKey] = [];
    renderChatPage();
    if (window.MineApp && MineApp.switchPage) MineApp.switchPage("chat");
  }

  function openGroup(groupId) {
    if (C && C.loadData) C.loadData();
    loadMe();
    var g = C.findGroup(groupId);
    if (!g) return;
    load();
    clearUnread("group:" + groupId);
    ctx.type = "group";
    ctx.id = groupId;
    ctx.convKey = "group:" + groupId;
    ctx.title = g.name;
    ctx.subtitle = (g.members || []).length + " 位成员";
    if (!conversations[ctx.convKey]) conversations[ctx.convKey] = [];
    renderChatPage();
    if (window.MineApp && MineApp.switchPage) MineApp.switchPage("chat");
  }

  /* ========================================================================
     渲染聊天页
     ======================================================================== */
  function renderChatPage() {
    if (!pageEl) pageEl = document.getElementById("page-chat");
    if (!pageEl) return;

    // 导航栏
    var navHtml =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + I.svg("back", 20) + '返回</button>' +
        '<div class="chat-nav-info">' +
          '<span class="chat-nav-title">' + escapeHtml(ctx.title) + '</span>' +
          '<span class="chat-nav-sub">' + escapeHtml(ctx.subtitle) + '</span>' +
        '</div>' +
        '<span class="nav-right"></span>' +
      '</div>';

    // with me 可折叠栏目
    var withMeHtml =
      '<div class="with-me-bar" id="with-me-bar">' +
        '<div class="with-me-toggle" id="with-me-toggle">' +
          '<span class="with-me-label">with me</span>' +
          '<span class="with-me-chevron" id="with-me-chevron">' + I.svg("back", 12) + '</span>' +
        '</div>' +
        '<div class="with-me-panel" id="with-me-panel">' +
          '<div class="with-me-content" id="with-me-content">' +
            '<div class="with-me-actions">' +
              '<div class="wm-action" role="button" tabindex="0" data-wm="choice">' +
                '<span class="wm-action-icon">' + I.svg("feather", 18) + '</span>' +
                '<span class="wm-action-name">抉择</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // 消息区域
    var msgHtml = '<div class="chat-messages" id="chat-messages"></div>';

    // 输入栏
    var inputHtml =
      '<div class="chat-input-bar">' +
        '<textarea class="chat-input" id="chat-input" rows="1" ' +
        'placeholder="输入消息…" maxlength="2000"></textarea>' +
        '<button class="chat-send-btn" id="chat-send" disabled>' + I.svg("send", 18) + '</button>' +
      '</div>';

    pageEl.innerHTML = navHtml + withMeHtml + msgHtml + inputHtml;

    // 缓存 DOM
    msgContainer = pageEl.querySelector("#chat-messages");
    inputEl = pageEl.querySelector("#chat-input");
    sendBtn = pageEl.querySelector("#chat-send");

    // 渲染历史消息
    renderMessages();

    // 绑定事件
    bindChatEvents();

    // 滚到底部
    scrollToBottom();
  }

  /* ---------------- 渲染所有消息 ---------------- */
  function renderMessages() {
    var msgs = conversations[ctx.convKey] || [];
    var html = "";
    var lastDateStr = "";

    msgs.forEach(function (msg) {
      var dateStr = fmtDateSep(msg.time);
      if (dateStr !== lastDateStr) {
        html += '<div class="chat-date-sep">' + dateStr + '</div>';
        lastDateStr = dateStr;
      }
      html += msgRowHTML(msg);
    });

    msgContainer.innerHTML = html;
    scrollToBottom();
  }

  /* ---------------- 单条消息 HTML ---------------- */
  function msgRowHTML(msg) {
    var isMe = msg.from === "me";
    var sender = null;

    if (!isMe) {
      // 先尝试从通讯录查找
      if (ctx.type === "group") {
        sender = C.findContact(msg.from);
      } else {
        sender = C.findContact(ctx.id);
      }
      // 若未找到，尝试重新加载通讯录数据后重试
      if (!sender && C.loadData) {
        C.loadData();
        if (ctx.type === "group") {
          sender = C.findContact(msg.from);
        } else {
          sender = C.findContact(ctx.id);
        }
      }
    }

    var avatarHTML = "";
    var senderNameHTML = "";
    if (isMe) {
      // 我的头像显示在右侧
      avatarHTML = meAvatarHTML(32, "msg-avatar avatar-gen");
    } else {
      // 对方头像可点击跳转到主页
      var contactId = ctx.type === "group" ? msg.from : ctx.id;
      // 若 findContact 返回 null，使用消息中存储的 senderName/senderAvatar 作为 fallback
      var displayName = (sender && sender.name) ? sender.name : (msg.senderName || "未知");
      var displayAvatar = (sender && sender.avatar) ? sender.avatar : (msg.senderAvatar || null);
      var fallbackContact = sender || { name: displayName, avatar: displayAvatar };
      avatarHTML = '<div class="avatar-tap" data-contact-id="' + escapeHtml(contactId) + '"' +
        ' data-sender-name="' + escapeHtml(displayName) + '">' +
        C.avatarHTML(fallbackContact, 32, "msg-avatar avatar-gen") + '</div>';
      if (ctx.type === "group") {
        senderNameHTML = '<div class="msg-sender">' + escapeHtml(displayName) + '</div>';
      }
    }

    var bubbleClass = isMe ? "is-me" : "is-them";
    if (msg.isEmpty) bubbleClass += " is-empty";
    if (msg.isChoice) bubbleClass += " is-choice-msg";

    var rowClass = isMe ? "msg-row is-me" : "msg-row";

    // 抉择消息使用特殊渲染（ABCD 逐行对齐）
    var bubbleText;
    if (msg.isChoice) {
      bubbleText = renderChoiceText(msg.text);
    } else {
      bubbleText = wrapText(msg.text, 12);
    }

    // 自动回复标记
    var autoTag = "";
    if (msg.isAutoReply) {
      autoTag = '<span class="auto-reply-tag">自动回复</span>';
    }

    // 已读对勾（仅我的消息且已读时才显示）
    var readMark = "";
    if (isMe && msg.read) {
      readMark = '<span class="msg-read is-read">' + I.svg("check", 13) + '</span>';
    }

    return '<div class="' + rowClass + '">' +
      (isMe ? "" : avatarHTML) +
      '<div class="msg-content">' +
        senderNameHTML +
        '<div class="msg-bubble ' + bubbleClass + '">' + autoTag + bubbleText + '</div>' +
        '<div class="msg-time">' + readMark +
        '<span class="time-text" data-time="' + fmtTime(msg.time) + '" data-date="' + fmtDateSep(msg.time) + '">' + fmtTime(msg.time) + '</span>' +
        '</div>' +
      '</div>' +
      (isMe ? avatarHTML : "") +
      '</div>';
  }

  /* ---------------- 滚到底部 ---------------- */
  function scrollToBottom() {
    requestAnimationFrame(function () {
      if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    });
  }

  /* ========================================================================
     绑定事件
     ======================================================================== */
  function bindChatEvents() {
    // 返回 → 回到聊天会话列表
    pageEl.querySelector('[data-act="back"]').addEventListener("click", function () {
      openConvList();
    });

    // with me 栏目展开/收起
    var withMeToggle = pageEl.querySelector("#with-me-toggle");
    var withMePanel = pageEl.querySelector("#with-me-panel");
    var withMeChevron = pageEl.querySelector("#with-me-chevron");
    if (withMeToggle && withMePanel) {
      withMeToggle.addEventListener("click", function () {
        var isOpen = withMePanel.classList.toggle("is-open");
        if (withMeChevron) {
          withMeChevron.classList.toggle("is-down", isOpen);
        }
      });
    }

    // 抉择功能
    var choiceBtn = pageEl.querySelector('[data-wm="choice"]');
    if (choiceBtn) {
      choiceBtn.addEventListener("click", openChoiceDialog);
      choiceBtn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openChoiceDialog(); }
      });
    }

    // 点击时间 → 切换日期/时间显示
    msgContainer.addEventListener("click", function (e) {
      var timeEl = e.target.closest(".time-text");
      if (!timeEl) return;
      var isShowingTime = timeEl.getAttribute("data-show") !== "date";
      if (isShowingTime) {
        timeEl.textContent = timeEl.getAttribute("data-date");
        timeEl.setAttribute("data-show", "date");
      } else {
        timeEl.textContent = timeEl.getAttribute("data-time");
        timeEl.setAttribute("data-show", "time");
      }
    });

    // 点击对方头像 → 跳转到联系人主页
    msgContainer.addEventListener("click", function (e) {
      var tapEl = e.target.closest(".avatar-tap");
      if (!tapEl) return;
      var contactId = tapEl.getAttribute("data-contact-id");
      var senderName = tapEl.getAttribute("data-sender-name");
      if (!contactId) return;
      if (window.MineContacts && MineContacts.openProfile) {
        MineContacts.openProfile(contactId, senderName);
      }
    });

    // 输入框自适应高度 + 启用发送按钮
    inputEl.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
      sendBtn.disabled = !this.value.trim();
    });

    // Enter 发送（Shift+Enter 换行）
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });

    // 发送按钮
    sendBtn.addEventListener("click", doSend);
  }

  /* ---------------- 发送锁：移除（用输入框清空防重复即可） ---------------- */

  /* ---------------- 发送消息 ---------------- */
  function doSend() {
    var text = (inputEl.value || "").trim();
    if (!text) return;

    // 存储我的消息（未读状态）
    var msgs = conversations[ctx.convKey] || [];
    msgs.push({ id: uid(), from: "me", text: text, time: Date.now(), read: false });
    conversations[ctx.convKey] = msgs;
    save();

    // 清空输入并禁用按钮（防止重复发送）
    inputEl.value = "";
    inputEl.style.height = "auto";
    sendBtn.disabled = true;

    // 追加渲染
    appendMessage(msgs[msgs.length - 1]);

    // 触发对方回复
    scheduleReply();
  }

  /* ---------------- 追加单条消息 ---------------- */
  function appendMessage(msg) {
    var dateStr = fmtDateSep(msg.time);
    var lastSep = msgContainer.querySelector(".chat-date-sep:last-of-type");
    // 简单处理：若需要日期分隔
    var msgs = conversations[ctx.convKey] || [];
    var needDate = msgs.length <= 1;
    if (!needDate && msgs.length >= 2) {
      var prev = msgs[msgs.length - 2];
      if (fmtDateSep(prev.time) !== dateStr) needDate = true;
    }
    if (needDate) {
      var sep = document.createElement("div");
      sep.className = "chat-date-sep";
      sep.textContent = dateStr;
      msgContainer.appendChild(sep);
    }

    var row = document.createElement("div");
    row.innerHTML = msgRowHTML(msg);
    msgContainer.appendChild(row.firstChild);
    scrollToBottom();
  }

  /* ---------------- 将我的消息标记为已读并局部刷新 ---------------- */
  function markMyMessagesRead() {
    var msgs = conversations[ctx.convKey];
    if (!msgs) return;
    var changed = false;
    msgs.forEach(function (m) {
      if (m.from === "me" && !m.read) { m.read = true; changed = true; }
    });
    if (changed) {
      save();
      // 局部更新已读标记，避免全量重绘导致与 appendMessage 冲突
      updateReadMarksUI();
    }
  }

  /* ---------------- 局部更新已读对勾 UI ---------------- */
  function updateReadMarksUI() {
    if (!msgContainer) return;
    // 找到所有"我"的消息行中还没有对勾的 msg-time
    var meRows = msgContainer.querySelectorAll(".msg-row.is-me");
    meRows.forEach(function (row) {
      var timeEl = row.querySelector(".msg-time");
      if (!timeEl) return;
      // 已有对勾则跳过
      if (timeEl.querySelector(".msg-read")) return;
      // 插入对勾
      var check = document.createElement("span");
      check.className = "msg-read is-read";
      check.innerHTML = I.svg("check", 13);
      timeEl.insertBefore(check, timeEl.firstChild);
    });
  }

  /* ---------------- 对方回复（随机字卡） ---------------- */
  function scheduleReply() {
    // 确保通讯录数据已加载到内存
    if (C && C.loadData) C.loadData();

    if (ctx.type === "contact") {
      // 一对一
      var contact = C.findContact(ctx.id);
      // 1% 概率触发自动回复
      if (Math.random() < 0.01) {
        scheduleAutoReply(contact, null);
        return;
      }

      // 设定区间内的随机时间（0 ~ replyDelay 秒）
      var maxDelay = (contact && contact.replyDelay !== undefined) ? contact.replyDelay : 1.5;
      var actualDelay = Math.random() * maxDelay * 1000;

      if (actualDelay > 1500) {
        // 延迟较长：在回复前 1.2 秒显示"正在输入"
        setTimeout(function () { showTyping(null); }, actualDelay - 1200);
        setTimeout(function () {
          hideTyping();
          doContactReply(contact);
        }, actualDelay);
      } else {
        // 延迟很短：立即显示"正在输入"
        showTyping(null);
        setTimeout(function () {
          hideTyping();
          doContactReply(contact);
        }, Math.max(300, actualDelay));
      }
    } else {
      // 群聊：随机 1-2 位成员回复（合并个人字卡 + 群字卡）
      var group = C.findGroup(ctx.id);
      var responders = pickRandomMembers(group, Math.random() < 0.4 ? 2 : 1);
      if (responders.length === 0) return;

      var firstReply = true;
      responders.forEach(function (member) {
        // 1% 概率触发自动回复
        if (Math.random() < 0.01) {
          scheduleAutoReply(member, group);
          return;
        }

        // 设定区间内的随机时间
        var maxDelay = (member.replyDelay !== undefined) ? member.replyDelay : 1.5;
        var mDelay = Math.random() * maxDelay * 1000;

        (function (m, d) {
          function doReply() {
            hideTyping();
            var card = pickRandomCardForGroup(m, group);
            if (!card) return;
            var msgs = conversations[ctx.convKey];
            msgs.push({
              id: uid(),
              from: m.id,
              text: card,
              time: Date.now(),
              senderName: m.name || "未知",
              senderAvatar: m.avatar || null
            });
            save();
            // 未查看时增加未读计数（类微信机制）
            if (!isViewingConv(ctx.convKey)) incrementUnread(ctx.convKey);
            // 第一位成员回复时，将我的消息标记为已读
            if (firstReply) { markMyMessagesRead(); firstReply = false; }
            appendMessage(msgs[msgs.length - 1]);
          }
          if (d > 1500) {
            // 延迟较长：在回复前 1.2 秒显示"正在输入"
            setTimeout(function () { showTyping(m); }, d - 1200);
            setTimeout(doReply, d);
          } else {
            // 延迟很短：立即显示"正在输入"
            setTimeout(function () {
              showTyping(m);
              setTimeout(doReply, Math.max(300, d));
            }, 0);
          }
        })(member, mDelay);
      });
    }
  }

  /* ---------------- 自动回复（3% 触发时） ----------------
     3% 触发未读通知，100% 使用自动回复字卡（无自动卡时回退普通卡） */
  function scheduleAutoReply(contact, group) {
    var card = group ? pickRandomAutoCardForGroup(contact, group) : pickRandomAutoCard(contact);
    // 无自动回复字卡 → 回退到普通字卡（确保 100% 触发回复）
    if (!card) {
      card = group ? pickRandomCardForGroup(contact, group) : pickRandomCard(contact);
    }
    // 仍无任何字卡 → 保持沉默
    if (!card) return;

    var maxDelay = (contact && contact.replyDelay !== undefined) ? contact.replyDelay : 1.5;
    var actualDelay = Math.random() * maxDelay * 1000;
    var typingMember = group ? contact : null;

    if (actualDelay > 1500) {
      // 延迟较长：在回复前 1.2 秒显示"正在输入"
      setTimeout(function () { showTyping(typingMember); }, actualDelay - 1200);
      setTimeout(function () {
        hideTyping();
        doAutoReply(contact, card);
      }, actualDelay);
    } else {
      // 延迟很短：立即显示"正在输入"
      setTimeout(function () {
        showTyping(typingMember);
        setTimeout(function () {
          hideTyping();
          doAutoReply(contact, card);
        }, Math.max(300, actualDelay));
      }, 0);
    }
  }

  function doAutoReply(contact, card) {
    var msgs = conversations[ctx.convKey];
    var senderName = (contact && contact.name) ? contact.name : "未知";
    var senderAvatar = (contact && contact.avatar) ? contact.avatar : null;
    msgs.push({
      id: uid(),
      from: contact.id,
      text: card,
      time: Date.now(),
      isAutoReply: true,
      senderName: senderName,
      senderAvatar: senderAvatar
    });
    save();
    // 未查看时增加未读计数
    if (!isViewingConv(ctx.convKey)) incrementUnread(ctx.convKey);
    // 自动回复也标记已读
    markMyMessagesRead();
    appendMessage(msgs[msgs.length - 1]);
  }

  /* ---------------- 联系人回复执行 ---------------- */
  function doContactReply(contact) {
    var card = pickRandomCard(contact);
    var msgs = conversations[ctx.convKey];
    var senderName = (contact && contact.name) ? contact.name : "未知";
    var senderAvatar = (contact && contact.avatar) ? contact.avatar : null;
    if (card) {
      msgs.push({ id: uid(), from: ctx.id, text: card, time: Date.now(), senderName: senderName, senderAvatar: senderAvatar });
    } else {
      // 无字卡 → 沉默占位
      msgs.push({ id: uid(), from: ctx.id, text: "……", time: Date.now(), isEmpty: true, senderName: senderName, senderAvatar: senderAvatar });
    }
    save();
    // 未查看时增加未读计数（类微信机制）
    if (!isViewingConv(ctx.convKey)) incrementUnread(ctx.convKey);
    // 对方回复后，将我的消息标记为已读
    markMyMessagesRead();
    appendMessage(msgs[msgs.length - 1]);
  }

  /* ---------------- 输入指示 ---------------- */
  function showTyping(member) {
    hideTyping();
    var typing = document.createElement("div");
    typing.className = "msg-row";
    typing.id = "typing-indicator-row";

    // 若 member 为 null（一对一聊天），不显示头像
    // 若 member 存在但 findContact 可能失败，使用 member 自身信息
    var avatar = "";
    var name = "";
    if (member) {
      avatar = C.avatarHTML(member, 32, "msg-avatar avatar-gen");
      name = (ctx.type === "group") ?
        '<div class="msg-sender">' + escapeHtml(member.name || "未知") + '</div>' : "";
    }

    typing.innerHTML = avatar +
      '<div class="msg-content">' + name +
      '<div class="msg-bubble is-them"><div class="typing-indicator">' +
      '<span></span><span></span><span></span></div></div></div>';

    msgContainer.appendChild(typing);
    scrollToBottom();
  }
  function hideTyping() {
    var t = document.getElementById("typing-indicator-row");
    if (t) t.remove();
  }

  /* ========================================================================
     会话列表（聊天应用主页）
     ======================================================================== */
  function openConvList() {
    load();
    // 确保通讯录数据已加载到内存（可能页面刷新后未加载）
    if (C && C.loadData) C.loadData();
    if (!pageEl) pageEl = document.getElementById("page-chat");
    if (!pageEl) return;

    var navHtml =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="home">' + I.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">聊天</span>' +
        '<span class="nav-right"></span>' +
      '</div>';

    // 收集所有有消息的会话
    var convs = [];
    Object.keys(conversations).forEach(function (key) {
      var msgs = conversations[key];
      if (!msgs || msgs.length === 0) return;
      var lastMsg = msgs[msgs.length - 1];
      var title, avatarHTML, type, id;

      if (key.indexOf("contact:") === 0) {
        var c = C.findContact(key.substring(8));
        if (!c) return;
        title = c.name;
        avatarHTML = C.avatarHTML(c, 48, "conv-avatar");
        type = "contact"; id = c.id;
      } else if (key.indexOf("group:") === 0) {
        var g = C.findGroup(key.substring(6));
        if (!g) return;
        title = g.name;
        avatarHTML = C.groupAvatarHTML(g, 48);
        type = "group"; id = g.id;
      } else return;

      convs.push({
        key: key, title: title, avatarHTML: avatarHTML,
        type: type, id: id,
        lastText: lastMsg.from === "me" ? "我: " + lastMsg.text : lastMsg.text,
        lastTime: lastMsg.time,
        unread: getUnread(key)
      });
    });

    // 按最后消息时间排序
    convs.sort(function (a, b) { return b.lastTime - a.lastTime; });

    var bodyHtml = '<div class="scroll"><div class="conv-list">';
    if (convs.length === 0) {
      bodyHtml += '<div class="contacts-empty">' +
        '<div class="ce-icon">' + I.svg("chat", 26) + '</div>' +
        '<div class="ce-title">还没有对话</div>' +
        '<div class="ce-desc">从通讯录中选择联系人开始聊天</div>' +
        '</div>';
    } else {
      convs.forEach(function (conv) {
        // 未读角标
        var badgeHTML = '';
        if (conv.unread > 0) {
          var badgeNum = conv.unread > 99 ? '99+' : String(conv.unread);
          badgeHTML = '<span class="conv-badge">' + escapeHtml(badgeNum) + '</span>';
        }
        bodyHtml += '<div class="conv-row" data-conv-type="' + conv.type + '" data-conv-id="' + conv.id + '">' +
          '<div class="conv-avatar-wrap">' +
            conv.avatarHTML +
            badgeHTML +
          '</div>' +
          '<div class="conv-info">' +
            '<span class="conv-name">' + escapeHtml(conv.title) + '</span>' +
            '<span class="conv-last">' + escapeHtml(conv.lastText) + '</span>' +
          '</div>' +
          '<span class="conv-time">' + fmtTime(conv.lastTime) + '</span>' +
          '</div>';
      });
    }
    bodyHtml += '</div></div>';

    pageEl.innerHTML = navHtml + bodyHtml;

    // 绑定
    pageEl.querySelector('[data-act="home"]').addEventListener("click", function () {
      if (window.MineApp && MineApp.goHome) MineApp.goHome();
    });
    pageEl.querySelectorAll("[data-conv-type]").forEach(function (row) {
      row.addEventListener("click", function () {
        var type = row.getAttribute("data-conv-type");
        var id = row.getAttribute("data-conv-id");
        if (type === "contact") openContact(id);
        else openGroup(id);
      });
    });

    if (window.MineApp && MineApp.switchPage) MineApp.switchPage("chat");
  }

  /* ========================================================================
     抉择功能
     ------------------------------------------------------------------------
     弹窗：上 1/4 问题输入 + 下 3/4 四个选项 + 保存提交按钮
     提交后对方在 5 分钟内随机选择一个选项并回复
     ======================================================================== */
  var CHOICE_STORE_KEY = "mine.chat.choices.v1";
  var pendingChoices = {};  // { convKey: { question, options, submitTime } }

  function loadPendingChoices() {
    try {
      var raw = localStorage.getItem(CHOICE_STORE_KEY);
      if (raw) pendingChoices = JSON.parse(raw) || {};
    } catch (e) {}
    if (!pendingChoices) pendingChoices = {};
  }
  function savePendingChoices() {
    try { localStorage.setItem(CHOICE_STORE_KEY, JSON.stringify(pendingChoices)); } catch (e) {}
  }

  function openChoiceDialog() {
    // 移除已有弹窗
    var existing = document.querySelector(".choice-overlay");
    if (existing) existing.remove();

    loadPendingChoices();
    var saved = pendingChoices[ctx.convKey];

    var question = (saved && saved.question) ? saved.question : "";
    var options = (saved && saved.options && saved.options.length > 0)
      ? saved.options.slice()
      : ["", ""];  // 默认 2 个选项

    var overlay = document.createElement("div");
    overlay.className = "choice-overlay";

    var html = '<div class="choice-dialog">' +
      '<div class="choice-header">' +
        '<span class="choice-title">抉择</span>' +
        '<button class="choice-close" id="choice-close">' + I.svg("close", 18) + '</button>' +
      '</div>' +
      '<div class="choice-question-section">' +
        '<textarea class="choice-question-input" id="choice-question" ' +
          'placeholder="写下你想让对方抉择的问题…" maxlength="200" rows="2">' +
          escapeHtml(question) +
        '</textarea>' +
      '</div>' +
      '<div class="choice-options-section" id="choice-options-wrap">';

    for (var i = 0; i < options.length; i++) {
      html += buildOptionRow(i, options[i], options.length > 2);
    }

    html += '</div>' +
      '<div class="choice-footer">' +
        '<button class="choice-add-btn" id="choice-add-opt">' + I.svg("plus", 14) + '添加选项</button>' +
        '<button class="choice-submit-btn" id="choice-submit">保存并提交</button>' +
      '</div>' +
      '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 触发动画
    requestAnimationFrame(function () { overlay.classList.add("is-open"); });

    // 关闭按钮
    overlay.querySelector("#choice-close").addEventListener("click", closeChoiceDialog);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeChoiceDialog();
    });

    // 添加选项按钮
    overlay.querySelector("#choice-add-opt").addEventListener("click", function () {
      addOptionRow();
    });

    // 删除选项按钮（事件委托）
    overlay.querySelector("#choice-options-wrap").addEventListener("click", function (e) {
      var delBtn = e.target.closest(".choice-option-del");
      if (!delBtn) return;
      var row = delBtn.closest(".choice-option-row");
      if (!row) return;
      var wrap = overlay.querySelector("#choice-options-wrap");
      var rows = wrap.querySelectorAll(".choice-option-row");
      if (rows.length <= 2) return;  // 最少保留 2 个选项
      row.remove();
      refreshOptionLabels();
    });

    // 保存并提交
    overlay.querySelector("#choice-submit").addEventListener("click", submitChoice);
  }

  /** 构建单个选项行 HTML */
  function buildOptionRow(index, value, canDelete) {
    var letter = String.fromCharCode(65 + index);
    return '<div class="choice-option-row">' +
      '<span class="choice-option-label">' + letter + '</span>' +
      '<input type="text" class="choice-option-input" ' +
        'placeholder="选项 ' + letter + '" maxlength="100" value="' +
        escapeHtml(value || "") + '">' +
      (canDelete ? '<button class="choice-option-del" title="删除选项">' + I.svg("close", 12) + '</button>' : '') +
    '</div>';
  }

  /** 添加一行选项 */
  function addOptionRow() {
    var wrap = document.querySelector("#choice-options-wrap");
    if (!wrap) return;
    var rows = wrap.querySelectorAll(".choice-option-row");
    var newIndex = rows.length;
    if (newIndex >= 26) return;  // 最多 26 个选项（A-Z）
    wrap.insertAdjacentHTML("beforeend", buildOptionRow(newIndex, "", true));
    refreshOptionLabels();
    // 聚焦到新输入框
    var inputs = wrap.querySelectorAll(".choice-option-input");
    if (inputs[inputs.length - 1]) inputs[inputs.length - 1].focus();
  }

  /** 刷新所有选项行的字母标签和 placeholder */
  function refreshOptionLabels() {
    var wrap = document.querySelector("#choice-options-wrap");
    if (!wrap) return;
    var rows = wrap.querySelectorAll(".choice-option-row");
    var canDelete = rows.length > 2;
    rows.forEach(function (row, idx) {
      var letter = String.fromCharCode(65 + idx);
      var label = row.querySelector(".choice-option-label");
      if (label) label.textContent = letter;
      var input = row.querySelector(".choice-option-input");
      if (input) input.placeholder = "选项 " + letter;
      var delBtn = row.querySelector(".choice-option-del");
      if (canDelete && !delBtn) {
        row.insertAdjacentHTML("beforeend",
          '<button class="choice-option-del" title="删除选项">' + I.svg("close", 12) + '</button>');
      } else if (!canDelete && delBtn) {
        delBtn.remove();
      }
    });
  }

  function closeChoiceDialog() {
    var overlay = document.querySelector(".choice-overlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    setTimeout(function () { overlay.remove(); }, 300);
  }

  function submitChoice() {
    var questionEl = document.getElementById("choice-question");
    var question = (questionEl.value || "").trim();
    var options = [];
    var optionInputs = document.querySelectorAll("#choice-options-wrap .choice-option-input");
    optionInputs.forEach(function (el) {
      options.push((el.value || "").trim());
    });

    if (!question) {
      shakeElement(document.getElementById("choice-question"));
      return;
    }
    var filledOptions = options.filter(function (o) { return o.length > 0; });
    if (filledOptions.length < 2) {
      var firstInput = document.querySelector("#choice-options-wrap .choice-option-input");
      if (firstInput) shakeElement(firstInput);
      return;
    }

    // 保存到持久化
    loadPendingChoices();
    pendingChoices[ctx.convKey] = {
      question: question,
      options: options,
      submitTime: Date.now()
    };
    savePendingChoices();

    // 关闭弹窗
    closeChoiceDialog();

    // 在聊天中发送抉择消息
    var choiceMsg = "【抉择】" + question + "\n";
    for (var j = 0; j < options.length; j++) {
      if (options[j]) {
        choiceMsg += String.fromCharCode(65 + j) + ". " + options[j] + "\n";
      }
    }
    choiceMsg = choiceMsg.trimEnd();

    var msgs = conversations[ctx.convKey] || [];
    msgs.push({ id: uid(), from: "me", text: choiceMsg, time: Date.now(), read: false, isChoice: true });
    conversations[ctx.convKey] = msgs;
    save();
    appendMessage(msgs[msgs.length - 1]);

    // 对方在 5 分钟内随机选择并回复
    scheduleChoiceReply(filledOptions);
  }

  function scheduleChoiceReply(filledOptions) {
    // 捕获当前会话上下文（避免用户切换聊天后回复发错对话框）
    var curConvKey = ctx.convKey;
    var curType = ctx.type;
    var curId = ctx.id;

    // 随机延迟范围：10秒 ~ 5分钟
    var minDelay = 10000;
    var maxDelay = 5 * 60 * 1000;

    /** 发送单条抉择回复 */
    function sendChoiceReply(fromId, senderName, senderAvatar, delay) {
      setTimeout(function () {
        // 重新加载数据（确保数据是最新的）
        load();
        var msgs = conversations[curConvKey];
        if (!msgs) return;

        var pickedIdx = Math.floor(Math.random() * filledOptions.length);
        var picked = filledOptions[pickedIdx];
        var replyText = "我选择 " + String.fromCharCode(65 + pickedIdx) + "：" + picked;

        msgs.push({
          id: uid(),
          from: fromId,
          text: replyText,
          time: Date.now(),
          isChoiceReply: true,
          senderName: senderName,
          senderAvatar: senderAvatar
        });
        save();

        // 未查看时增加未读计数
        if (!isViewingConv(curConvKey)) incrementUnread(curConvKey);

        // 只有当前正在查看该会话时才更新 UI
        if (isViewingConv(curConvKey)) {
          markMyMessagesRead();
          appendMessage(msgs[msgs.length - 1]);
        }
      }, delay);
    }

    if (curType === "contact") {
      // 一对一：对方一人回复
      var contact = C.findContact(curId);
      var fromId = contact ? contact.id : curId;
      var name = contact ? (contact.name || "未知") : "未知";
      var avatar = contact ? (contact.avatar || null) : null;
      var delay = minDelay + Math.random() * (maxDelay - minDelay);
      sendChoiceReply(fromId, name, avatar, delay);
    } else if (curType === "group") {
      // 群聊：所有成员均做出选择并回复，各自随机延迟
      var group = C.findGroup(curId);
      if (group && group.members && group.members.length > 0) {
        group.members.forEach(function (m) {
          var memberId = typeof m === "string" ? m : m.id;
          var member = C.findContact(memberId);
          if (!member) return;
          var mDelay = minDelay + Math.random() * (maxDelay - minDelay);
          sendChoiceReply(member.id, member.name || "未知", member.avatar || null, mDelay);
        });
      }
    }
  }

  function shakeElement(el) {
    if (!el) return;
    el.classList.add("shake");
    setTimeout(function () { el.classList.remove("shake"); }, 400);
  }

  /* ========================================================================
     注册页面钩子
     ======================================================================== */
  window.MineApp = window.MineApp || {};
  var prevPage = window.MineApp.page;
  window.MineApp.page = function (id) {
    if (id === "chat") { openConvList(); return true; }
    return prevPage ? prevPage(id) : false;
  };

  /* ---------------- 搜索聊天记录 ---------------- */
  function searchHistory(convType, convId, opts) {
    var key = convType + ":" + convId;
    var msgs = conversations[key] || [];
    if (msgs.length === 0) return [];

    var keyword = (opts && opts.keyword) ? opts.keyword.trim().toLowerCase() : "";
    var dateStr = (opts && opts.date) ? opts.date.trim() : "";
    var results = [];

    msgs.forEach(function (msg, idx) {
      var match = true;
      // 关键词匹配
      if (keyword) {
        match = (msg.text || "").toLowerCase().indexOf(keyword) >= 0;
      }
      // 日期匹配
      if (match && dateStr) {
        var d = new Date(msg.time);
        var msgDate = d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
        match = (msgDate === dateStr);
      }
      if (match) {
        var senderName = "我";
        var senderAvatar = null;
        if (msg.from !== "me") {
          /* 一对一聊天：所有非"我"消息均来自同一联系人（convId），
             用 convId 查找而非 msg.from，与 msgRowHTML 中 ctx.id 的逻辑一致 */
          var lookupId = (convType === "contact") ? convId : msg.from;
          var contact = C.findContact(lookupId);
          senderName = (contact && contact.name) ? contact.name : (msg.senderName || "未知");
          senderAvatar = (contact && contact.avatar) ? contact.avatar : (msg.senderAvatar || null);
        }
        results.push({
          index: idx,
          text: msg.text,
          time: msg.time,
          from: msg.from,
          senderName: senderName,
          senderAvatar: senderAvatar,
          isAutoReply: !!msg.isAutoReply,
          isEmpty: !!msg.isEmpty
        });
      }
    });
    return results;
  }

  return {
    openContact: openContact,
    openGroup: openGroup,
    openConvList: openConvList,
    getConversations: function () { return JSON.parse(JSON.stringify(conversations)); },
    searchHistory: searchHistory,
    getTotalUnread: getTotalUnread,
    refreshConvListBadges: openConvList
  };
})();
