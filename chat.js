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
  var BG_KEY = "mine.chat.bg.v1";   /* 每个会话的自定义背景图 */
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

    // 加载会话背景图
    loadBg();
    loadChatFontColor();
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(conversations));
      return true;
    } catch (e) {
      // 存储空间不足：尝试移除图片类消息后重试
      return _tryStripImageMessages();
    }
  }

  /* 存储空间不足时，移除最早的图片类消息以腾出空间 */
  function _tryStripImageMessages() {
    try {
      var allImages = [];
      Object.keys(conversations).forEach(function (key) {
        var msgs = conversations[key];
        if (!Array.isArray(msgs)) return;
        msgs.forEach(function (m, i) {
          if (typeof m.text === "string" && m.text.indexOf("data:image/") === 0) {
            allImages.push({ key: key, idx: i, size: m.text.length, msgId: m.id });
          }
        });
      });
      allImages.sort(function (a, b) { return a.size - b.size; });
      // 从最小的图片消息开始移除，每次移除后尝试保存
      for (var i = 0; i < allImages.length; i++) {
        var item = allImages[i];
        var msgs = conversations[item.key];
        if (!msgs) continue;
        // 找到对应的消息并移除
        for (var j = msgs.length - 1; j >= 0; j--) {
          if (msgs[j].id === item.msgId) {
            msgs.splice(j, 1);
            break;
          }
        }
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(conversations));
          return true; // 保存成功
        } catch (e) {}
      }
    } catch (e) {}
    return false;
  }
  function saveUnread() {
    try { localStorage.setItem(UNREAD_KEY, JSON.stringify(unreadCounts)); } catch (e) {}
  }

  /* ==================== 每个会话的自定义背景图 ====================
     chatBg: { "contact:c1": "data:image/...", "group:g1": "data:image/..." }
     使用 localStorage 存储（图片经压缩，单张约 100~200KB） */
  var chatBg = {};

  function loadBg() {
    try {
      var raw = localStorage.getItem(BG_KEY);
      if (raw) chatBg = JSON.parse(raw) || {};
    } catch (e) {}
    if (!chatBg) chatBg = {};
  }
  function saveBg() {
    try { localStorage.setItem(BG_KEY, JSON.stringify(chatBg)); } catch (e) {
      showToast("背景图片过大，无法保存");
    }
  }
  function getConvBg(convKey) {
    return chatBg[convKey] || null;
  }
  function setConvBg(convKey, dataUrl) {
    if (dataUrl) { chatBg[convKey] = dataUrl; }
    else { delete chatBg[convKey]; }
    saveBg();
  }
  /* 将背景图应用到聊天页 DOM */
  function applyConvBg() {
    if (!pageEl) return;
    var bg = getConvBg(ctx.convKey);
    var msgArea = pageEl.querySelector(".chat-messages");
    if (bg) {
      pageEl.style.setProperty("--chat-bg-image", "url(" + bg + ")");
      if (msgArea) msgArea.classList.add("has-custom-bg");
    } else {
      pageEl.style.removeProperty("--chat-bg-image");
      if (msgArea) msgArea.classList.remove("has-custom-bg");
    }
  }
  /* ==================== 每个会话的字体颜色（黑/白） ====================
     chatFontColor: { "contact:c1": "black", "group:g1": "white", ... }
     未设置的会话继承主界面字体颜色 */
  var CHAT_FONTCOLOR_KEY = "mine.chat.fontColor.v1";
  var chatFontColor = {};
  var CHAT_FC_COLORS = {
    white: {
      "--t-primary":  "#dde3e6",
      "--t-secondary": "#aab1b6",
      "--t-tertiary":  "#71787d",
      "--t-faint":     "#565c61"
    },
    black: {
      "--t-primary":  "#1a1a1a",
      "--t-secondary": "#3a3a3a",
      "--t-tertiary":  "#6a6a6a",
      "--t-faint":     "#9a9a9a"
    }
  };
  function loadChatFontColor() {
    try {
      var raw = localStorage.getItem(CHAT_FONTCOLOR_KEY);
      if (raw) chatFontColor = JSON.parse(raw) || {};
    } catch (e) {}
    if (!chatFontColor) chatFontColor = {};
  }
  function saveChatFontColor() {
    try { localStorage.setItem(CHAT_FONTCOLOR_KEY, JSON.stringify(chatFontColor)); } catch (e) {}
  }
  function getConvFontColor(convKey) {
    return chatFontColor[convKey] || null;
  }
  function setConvFontColor(convKey, color) {
    if (color) { chatFontColor[convKey] = color; }
    else { delete chatFontColor[convKey]; }
    saveChatFontColor();
  }
  function applyChatFontColor() {
    if (!pageEl) return;
    var fc = getConvFontColor(ctx.convKey);
    if (fc && CHAT_FC_COLORS[fc]) {
      var colors = CHAT_FC_COLORS[fc];
      for (var key in colors) {
        if (colors.hasOwnProperty(key)) {
          pageEl.style.setProperty(key, colors[key]);
        }
      }
    } else {
      /* 清除覆盖，继承主界面字体颜色 */
      pageEl.style.removeProperty("--t-primary");
      pageEl.style.removeProperty("--t-secondary");
      pageEl.style.removeProperty("--t-tertiary");
      pageEl.style.removeProperty("--t-faint");
    }
  }
  /* 打开背景与字体设置面板 */
  function openBgSettings() {
    var overlay = document.createElement("div");
    overlay.className = "chat-bg-overlay";

    var curBg = getConvBg(ctx.convKey);
    var curFc = getConvFontColor(ctx.convKey);

    var sheet = document.createElement("div");
    sheet.className = "chat-bg-sheet";
    sheet.innerHTML =
      '<div class="chat-bg-handle"></div>' +
      '<div class="chat-bg-head">' +
        '<span class="chat-bg-title">聊天设置</span>' +
        '<button class="chat-bg-close" data-act="close">' + I.svg("close", 20) + '</button>' +
      '</div>' +
      '<div class="chat-bg-body">' +
        '<div class="chat-bg-preview" id="bg-preview">' +
          (curBg ? '<img src="' + curBg + '" alt="背景预览">' : '<div class="bg-preview-empty">暂无自定义背景</div>') +
        '</div>' +
        '<div class="chat-bg-actions">' +
          '<button class="chat-bg-btn" data-act="upload">' +
            I.svg("image", 20) + '<span>从图库选择</span></button>' +
          (curBg ? '<button class="chat-bg-btn chat-bg-btn-danger" data-act="clear">' +
            I.svg("trash", 20) + '<span>清除背景</span></button>' : '') +
        '</div>' +
        '<input type="file" id="chat-bg-file" accept="image/*" style="display:none">' +
        '<div class="section-label" style="margin-top:20px;">字体颜色</div>' +
        '<div class="font-color-row">' +
          '<button class="font-color-btn' + (!curFc ? " is-active" : "") + '" data-fc="inherit">' +
            '<span class="fc-swatch fc-inherit">' + I.svg("link", 14) + '</span><span>跟随主界面</span></button>' +
          '<button class="font-color-btn' + (curFc === "white" ? " is-active" : "") + '" data-fc="white">' +
            '<span class="fc-swatch fc-white"></span><span>白色</span></button>' +
          '<button class="font-color-btn' + (curFc === "black" ? " is-active" : "") + '" data-fc="black">' +
            '<span class="fc-swatch fc-black"></span><span>黑色</span></button>' +
        '</div>' +
      '</div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("is-open"); });

    function closeSheet() {
      overlay.classList.remove("is-open");
      setTimeout(function () { overlay.remove(); }, 300);
    }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeSheet();
    });
    sheet.querySelector('[data-act="close"]').addEventListener("click", closeSheet);

    var fileInput = sheet.querySelector("#chat-bg-file");
    sheet.querySelector('[data-act="upload"]').addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        var file = this.files[0];
        if (!/^image\//.test(file.type)) { closeSheet(); return; }
        if (window.MineUtils && MineUtils.compressImage) {
          MineUtils.compressImage(file, 1080, 0.82, function (dataURL) {
            if (!dataURL) { closeSheet(); return; }
            setConvBg(ctx.convKey, dataURL);
            applyConvBg();
            closeSheet();
          });
        } else {
          var reader = new FileReader();
          reader.onload = function () {
            setConvBg(ctx.convKey, reader.result);
            applyConvBg();
            closeSheet();
          };
          reader.readAsDataURL(file);
        }
      }
    });

    var clearBtn = sheet.querySelector('[data-act="clear"]');
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        setConvBg(ctx.convKey, null);
        applyConvBg();
        closeSheet();
      });
    }

    /* 字体颜色按钮 */
    sheet.querySelectorAll("[data-fc]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var fc = btn.getAttribute("data-fc");
        if (fc === "inherit") {
          setConvFontColor(ctx.convKey, null);
        } else {
          setConvFontColor(ctx.convKey, fc);
        }
        applyChatFontColor();
        sheet.querySelectorAll("[data-fc]").forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
      });
    });
  }

  /* ---------------- 未读计数工具 ---------------- */
  var appLevelSeen = false;  // 用户是否已打开过聊天应用（控制主屏角标）

  function incrementUnread(convKey) {
    if (!unreadCounts[convKey]) unreadCounts[convKey] = 0;
    unreadCounts[convKey]++;
    appLevelSeen = false;  // 新消息到达 → 主屏角标重新显示
    saveUnread();
    if (window.MineNotify) MineNotify.refreshBadges();
  }
  function clearUnread(convKey) {
    if (unreadCounts[convKey]) {
      delete unreadCounts[convKey];
      saveUnread();
      if (window.MineNotify) MineNotify.refreshBadges();
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
  /* 获取通知数：用户已打开聊天应用后不显示主屏角标，但会话角标仍保留 */
  function getNotifyCount() {
    return appLevelSeen ? 0 : getTotalUnread();
  }

  /* 判断当前是否正在查看某个会话 */
  function isViewingConv(convKey) {
    var chatPage = document.getElementById("page-chat");
    if (!chatPage || !chatPage.classList.contains("is-active")) return false;
    return ctx.convKey === convKey;
  }

  /* 安全追加消息到当前会话（带自动重试 + 待渲染队列兜底，确保消息最终一定显示）
     解决：isViewingConv 偶发返回 false 导致消息存了但不显示 */
  function safeAppendMessages(convKey, msgList) {
    if (!msgList || msgList.length === 0) return;
    var attempts = 0;
    var maxAttempts = 8;
    var intervals = [0, 50, 100, 200, 400, 800, 1600, 3200]; // 重试间隔（指数退避，最长约 6.35 秒）

    function tryAppend() {
      if (attempts >= maxAttempts) {
        // 所有重试都失败 → 加入待渲染队列兜底（页面激活/进入会话时自动消费）
        if (!pendingRenderQueue[convKey]) pendingRenderQueue[convKey] = [];
        pendingRenderQueue[convKey] = pendingRenderQueue[convKey].concat(msgList);
        return;
      }
      var delay = intervals[attempts] || 500;
      attempts++;

      setTimeout(function () {
        // 双重校验：页面激活 + 会话匹配 + msgContainer 存在
        var chatPage = document.getElementById("page-chat");
        var pageActive = chatPage && chatPage.classList.contains("is-active");
        var convMatch = ctx.convKey === convKey;

        if (pageActive && convMatch && msgContainer) {
          for (var i = 0; i < msgList.length; i++) {
            appendMessage(msgList[i]);
          }
        } else {
          tryAppend();
        }
      }, delay);
    }

    tryAppend();
  }

  /* 消费待渲染消息队列（进入会话 / 页面激活时调用，确保消息不丢失） */
  function flushPendingRender(convKey) {
    var key = convKey || ctx.convKey;
    if (!key || !pendingRenderQueue[key] || pendingRenderQueue[key].length === 0) return;
    if (!msgContainer) return;

    var chatPage = document.getElementById("page-chat");
    var pageActive = chatPage && chatPage.classList.contains("is-active");
    var convMatch = ctx.convKey === key;
    if (!pageActive || !convMatch) return;

    var msgs = pendingRenderQueue[key];
    pendingRenderQueue[key] = [];
    for (var i = 0; i < msgs.length; i++) {
      appendMessage(msgs[i]);
    }
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
   * 若该消息已有 choiceAnswers，则被选中的选项会被标注：
   *   · 文字加粗
   *   · 背景色加深
   *   · 显示选择者标签
   * @param {object} msg - 抉择消息对象（含 text 和可选的 choiceAnswers）
   * @returns {string} HTML
   */
  function renderChoiceText(msg) {
    var text = (msg && msg.text) || "";
    var lines = text.split(/\n/);
    var html = "";
    var firstLine = true;
    var optionsHtml = "";
    var hasOptions = false;

    /* 构建选项字母 → 选择者名单 的映射 */
    var selectedMap = {};
    if (msg && msg.choiceAnswers && msg.choiceAnswers.length > 0) {
      msg.choiceAnswers.forEach(function (ans) {
        if (!selectedMap[ans.letter]) selectedMap[ans.letter] = [];
        selectedMap[ans.letter].push(ans.name || "未知");
      });
    }
    var hasAnswers = msg && msg.choiceAnswers && msg.choiceAnswers.length > 0;

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
          var letter = match[1];
          var isSelected = !!selectedMap[letter];
          var optClass = 'choice-msg-option' + (isSelected ? ' is-selected' : '');
          var badge = '';
          if (isSelected) {
            var names = selectedMap[letter].map(escapeHtml).join('、');
            badge = '<span class="choice-msg-picked">' + names + ' 选择</span>';
          }
          optionsHtml += '<div class="' + optClass + '">' +
            '<span class="choice-msg-letter">' + letter + '</span>' +
            '<span class="choice-msg-text">' + match[2] + '</span>' +
            badge +
            '</div>';
        } else if (safe.length > 0) {
          optionsHtml += '<div class="choice-msg-line">' + safe + '</div>';
        }
      }
    });
    // 用容器包裹选项，确保所有字母标签在同一列对齐
    if (hasOptions) {
      var wrapClass = 'choice-msg-options' + (hasAnswers ? ' has-answers' : '');
      html += '<div class="' + wrapClass + '">' + optionsHtml + '</div>';
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

  /* ---------------- 字卡选择工具 ---------------- */

  /** 判断字卡是否为图片字卡（base64 data URI） */
  function isImageCard(card) {
    return typeof card === "string" && card.indexOf("data:image/") === 0;
  }

  /** 判断字卡是否为 emoji 字卡（由 emoji 字符组成的短串） */
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

  /** 从卡池中筛选图片字卡 */
  function filterImageCards(cards) {
    if (!cards || cards.length === 0) return [];
    return cards.filter(isImageCard);
  }

  /** 从卡池中筛选 emoji 字卡 */
  function filterEmojiCards(cards) {
    if (!cards || cards.length === 0) return [];
    return cards.filter(isEmojiCard);
  }

  /** 从卡池中筛选文字字卡（排除图片和 emoji） */
  function filterTextCards(cards) {
    if (!cards || cards.length === 0) return [];
    return cards.filter(function (c) { return !isImageCard(c) && !isEmojiCard(c); });
  }

  /**
   * 通用字卡选择器：10% 概率发送图片字卡，10% 概率发送 emoji 字卡
   * · 若池中有图片字卡且命中 10% → 从图片字卡中随机抽取
   * · 若池中有 emoji 字卡且命中 10% → 从 emoji 字卡中随机抽取
   * · 否则从文字字卡中随机抽取
   * · 若无文字字卡则从全池随机抽取
   */
  function pickCardWithImageChance(pool) {
    if (!pool || pool.length === 0) return null;
    var imageCards = filterImageCards(pool);
    var emojiCards = filterEmojiCards(pool);
    var textCards = filterTextCards(pool);
    if (imageCards.length > 0 && Math.random() < 0.10) {
      return imageCards[Math.floor(Math.random() * imag
