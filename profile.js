/* ========================================================================
   Mine · 个人中心
   ------------------------------------------------------------------------
   · 修改我的头像（从本地文件上传，压缩存储）
   · 修改我的昵称
   · 数据存储于 localStorage "mine.me.v1"，与聊天模块共用
   ======================================================================== */

window.MineProfile = (function () {
  "use strict";

  var I = window.MineIcons;
  var U = window.MineUtils;
  var ME_KEY = "mine.me.v1";

  var meProfile = { name: "雾客", avatar: null };

  function loadMe() {
    try {
      var raw = localStorage.getItem(ME_KEY);
      if (raw) { meProfile = JSON.parse(raw); return; }
    } catch (e) {}
    meProfile = { name: "雾客", avatar: null };
    saveMe();
  }

  function saveMe() {
    try { localStorage.setItem(ME_KEY, JSON.stringify(meProfile)); } catch (e) {}
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function firstChar(s) {
    s = String(s || "");
    return s.charAt(0) || "?";
  }

  /* ---------------- 渲染头像 HTML ---------------- */
  function avatarHTML(size, cls) {
    var s = size || 32;
    var c = (cls ? " " + cls : "");
    if (meProfile && meProfile.avatar) {
      return '<div class="avatar' + c + '" style="width:' + s + 'px;height:' + s + 'px;">' +
        '<img src="' + escapeHtml(meProfile.avatar) + '" alt=""></div>';
    }
    return '<div class="avatar avatar-gen' + c + '" style="width:' + s + 'px;height:' + s + 'px;">' +
      escapeHtml(firstChar(meProfile ? meProfile.name : "雾")) + '</div>';
  }

  /* ---------------- 渲染个人中心页面 ---------------- */
  function renderPage() {
    var navBar =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + I.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">个人中心</span>' +
        '<span class="nav-right"></span>' +
      '</div>';

    var html = '<div class="scroll me-scroll">';

    // 头部：头像 + 昵称
    var avatarInner = (meProfile.avatar
      ? '<img src="' + escapeHtml(meProfile.avatar) + '">'
      : '<span class="avatar-gen-text">' + escapeHtml(firstChar(meProfile.name)) + '</span>');

    html += '<div class="profile-hero">' +
      '<div class="avatar-picker">' +
        '<div class="avatar big-avatar profile-avatar" id="me-avatar" style="position:relative;cursor:pointer;">' +
          avatarInner +
          '<div class="cam-badge">' + I.svg("camera", 15) + '</div>' +
        '</div>' +
        '<input type="file" accept="image/*" id="me-avatar-file" class="file-hidden">' +
      '</div>' +
      '<span class="profile-name" id="me-name-display">' + escapeHtml(meProfile.name || "雾客") + '</span>' +
      '<span class="profile-status">点击头像更换 · 点击昵称修改</span>' +
      '</div>';

    html += '<div class="list-sep"></div>';

    // 昵称修改区
    html += '<div class="group-head">昵称</div>';
    html += '<div class="me-edit-row">' +
      '<input type="text" class="field-input me-name-input" id="me-name-input" ' +
      'value="' + escapeHtml(meProfile.name || "雾客") + '" ' +
      'placeholder="输入你的昵称" maxlength="20">' +
      '<button class="btn btn-primary btn-sm" id="me-name-save">保存</button>' +
      '</div>';
    html += '<div class="card-hint">昵称将显示在主界面问候语和聊天消息中</div>';

    html += '<div class="list-sep"></div>';

    // 头像操作区
    html += '<div class="group-head">头像</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="change-avatar">' +
      '<div class="func-icon">' + I.svg("camera", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">更换头像</span>' +
        '<span class="func-sub">从相册选择图片</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
      '</div>';

    if (meProfile.avatar) {
      html += '<div class="func-row" role="button" tabindex="0" data-act="remove-avatar">' +
        '<div class="func-icon">' + I.svg("trash", 20) + '</div>' +
        '<div class="func-text">' +
          '<span class="func-title">移除头像</span>' +
          '<span class="func-sub">恢复默认文字头像</span>' +
        '</div>' +
        '<span class="chevron">' + I.svg("back", 18) + '</span>' +
      '</div>';
    }

    html += '<div class="list-sep"></div>';

    // 信息展示区
    html += '<div class="group-head">关于</div>';
    html += '<div class="func-row">' +
      '<div class="func-icon">' + I.svg("me", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">当前昵称</span>' +
        '<span class="func-sub" id="me-about-name">' + escapeHtml(meProfile.name || "雾客") + '</span>' +
      '</div>' +
      '</div>';
    html += '<div class="func-row">' +
      '<div class="func-icon">' + I.svg("chat", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">头像状态</span>' +
        '<span class="func-sub">' + (meProfile.avatar ? "已设置自定义头像" : "使用默认文字头像") + '</span>' +
      '</div>' +
      '</div>';

    html += '<div class="list-sep"></div>';

    // 数据管理区
    html += '<div class="group-head">数据管理</div>';
    html += '<div class="func-row" style="flex-direction:column;align-items:stretch;">' +
      '<div class="func-text" style="width:100%;">' +
        '<span class="func-title">存储用量</span>' +
        '<span class="func-sub" id="me-storage-info">计算中…</span>' +
      '</div>' +
      '<div class="storage-bar-wrap" style="margin-top:8px;width:100%;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">' +
        '<div id="me-storage-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#4a9eff,#6ec1ff);transition:width 0.5s;"></div>' +
      '</div>' +
    '</div>';

    // 导出记录按钮
    html += '<div class="group-head">导出记录</div>';
    html += '<div class="card-hint">导出为文本文件保存到手机，清除前请先导出备份</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="export-chat">' +
      '<div class="func-icon">' + I.svg("chat", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">导出聊天记录</span>' +
        '<span class="func-sub">所有会话消息</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="export-mail">' +
      '<div class="func-icon">' + I.svg("mail", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">导出信件记录</span>' +
        '<span class="func-sub">次元信箱信件</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="export-treehole">' +
      '<div class="func-icon">' + I.svg("treehole", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">导出树洞记录</span>' +
        '<span class="func-sub">帖子与回复</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="export-moments">' +
      '<div class="func-icon">' + I.svg("moments", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">导出朋友圈记录</span>' +
        '<span class="func-sub">动态与互动</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div style="padding:var(--sp-4) var(--sp-5);">' +
      '<button class="btn btn-block btn-primary" data-act="export-all">导出全部记录</button></div>';
    html += '<div class="card-hint">全部导出会生成一个包含所有记录的文本文件</div>';

    html += '<div class="list-sep"></div>';

    // 分类清理按钮
    html += '<div class="func-row" role="button" tabindex="0" data-act="clear-chat">' +
      '<div class="func-icon">' + I.svg("trash", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">清除聊天记录</span>' +
        '<span class="func-sub">消息 · 背景图 · 未读计数</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="clear-mail">' +
      '<div class="func-icon">' + I.svg("trash", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">清除信件记录</span>' +
        '<span class="func-sub">次元信箱 · 待发信件</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="clear-treehole">' +
      '<div class="func-icon">' + I.svg("trash", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">清除树洞记录</span>' +
        '<span class="func-sub">树洞帖子 · 回复 · 模板</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="clear-moments">' +
      '<div class="func-icon">' + I.svg("trash", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">清除朋友圈记录</span>' +
        '<span class="func-sub">动态 · 封面 · 互动</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="clear-radio">' +
      '<div class="func-icon">' + I.svg("trash", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">清除电台记录</span>' +
        '<span class="func-sub">歌曲 · 播放模式</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="clear-foodie">' +
      '<div class="func-icon">' + I.svg("trash", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">清除吃货记录</span>' +
        '<span class="func-sub">美食字卡</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
    '</div>';

    html += '<div class="list-sep"></div>';

    // 全部清除
    html += '<div style="padding:var(--sp-6) var(--sp-5);">' +
      '<button class="btn btn-block btn-danger" data-act="clear-all">' +
      I.svg("trash", 18) + ' 清除全部数据</button></div>';
    html += '<div class="card-hint">清除全部数据将删除所有聊天、信件、树洞、朋友圈等记录，但保留联系人和字卡</div>';

    html += '</div>'; // .scroll

    // 渲染到 detail 页
    var detail = document.getElementById("page-detail");
    detail.innerHTML = navBar + html;

    bindEvents(detail);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents(pageEl) {
    // 返回
    var backBtn = pageEl.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener("click", function () {
      window.MineApp.goHome();
    });

    // 头像点击 → 选择文件
    var avatarEl = pageEl.querySelector("#me-avatar");
    var fileEl = pageEl.querySelector("#me-avatar-file");
    var changeAvatarBtn = pageEl.querySelector('[data-act="change-avatar"]');
    if (avatarEl && fileEl) {
      var openPicker = function () { fileEl.click(); };
      avatarEl.addEventListener("click", openPicker);
      if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener("click", openPicker);
        changeAvatarBtn.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); }
        });
      }
    }

    // 文件选择 → 压缩 → 保存
    if (fileEl) {
      fileEl.addEventListener("change", function () {
        if (this.files && this.files[0]) {
          var f = this.files[0];
          if (U && U.compressImage) {
            U.compressImage(f, 200, 0.85, function (dataURL) {
              if (!dataURL) return;
              meProfile.avatar = dataURL;
              saveMe();
              renderPage(); // 重新渲染
            });
          }
          this.value = "";
        }
      });
    }

    // 移除头像
    var removeBtn = pageEl.querySelector('[data-act="remove-avatar"]');
    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        meProfile.avatar = null;
        saveMe();
        renderPage();
      });
      removeBtn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          meProfile.avatar = null;
          saveMe();
          renderPage();
        }
      });
    }

    // 昵称保存
    var nameInput = pageEl.querySelector("#me-name-input");
    var nameSave = pageEl.querySelector("#me-name-save");
    if (nameInput && nameSave) {
      var doSave = function () {
        var val = (nameInput.value || "").trim();
        if (!val) {
          nameInput.style.borderColor = "rgba(180,90,90,0.5)";
          nameInput.focus();
          setTimeout(function () { nameInput.style.borderColor = ""; }, 1500);
          return;
        }
        meProfile.name = val;
        saveMe();
        // 更新主界面问候语
        if (window.MineApp && window.MineApp.refreshGreeting) {
          window.MineApp.refreshGreeting();
        }
        renderPage();
      };
      nameSave.addEventListener("click", doSave);
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") doSave();
      });
    }

    // 存储用量显示
    updateStorageInfo(pageEl);

    // 导出记录事件绑定
    var exportActions = {
      "export-chat": { fn: exportChat, label: "聊天记录" },
      "export-mail": { fn: exportMail, label: "信件记录" },
      "export-treehole": { fn: exportTreehole, label: "树洞记录" },
      "export-moments": { fn: exportMoments, label: "朋友圈记录" },
      "export-all": { fn: exportAll, label: "全部记录" }
    };
    Object.keys(exportActions).forEach(function (act) {
      var el = pageEl.querySelector('[data-act="' + act + '"]');
      if (el) {
        var handler = function () { exportActions[act].fn(); };
        el.addEventListener("click", handler);
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); }
        });
      }
    });

    // 数据清理事件绑定
    var clearActions = {
      "clear-chat": {
        msg: "确定清除所有聊天记录？聊天消息、背景图和未读计数将被删除。",
        keys: ["mine.chat.v1", "mine.chat.unread.v1", "mine.chat.bg.v1", "mine.chat.fontColor.v1", "mine.chat.choices.v1"]
      },
      "clear-mail": {
        msg: "确定清除所有信件记录？次元信箱的信件和待发信件将被删除。",
        keys: ["mine.mail.v1", "mine.mail.pending.v1", "mine.mail.active.v1", "mine.mail.activecheck.v1"]
      },
      "clear-treehole": {
        msg: "确定清除所有树洞记录？帖子、回复和模板将被删除。",
        keys: ["mine.treehole.v2", "mine.treehole.verify.v1", "mine.treehole.pending.v2", "mine.treehole.templates.v1", "mine.treehole.seenCount.v1"]
      },
      "clear-moments": {
        msg: "确定清除所有朋友圈记录？动态、封面和互动将被删除。",
        keys: ["mine.moments.v1", "mine.moments.cover", "mine.moments.contactInteractions"]
      },
      "clear-radio": {
        msg: "确定清除所有电台记录？歌曲和播放模式将被删除。",
        keys: ["mine.radio.v1", "mine.radio.mode.v1"]
      },
      "clear-foodie": {
        msg: "确定清除所有吃货记录？美食字卡将被删除。",
        keys: ["mine.foodie.v1"]
      }
    };

    Object.keys(clearActions).forEach(function (act) {
      var btn = pageEl.querySelector('[data-act="' + act + '"]');
      if (btn) {
        var handler = function () {
          var cfg = clearActions[act];
          if (!confirm(cfg.msg)) return;
          cfg.keys.forEach(function (k) {
            try { localStorage.removeItem(k); } catch (e) {}
          });
          alert("已清除");
          updateStorageInfo(pageEl);
        };
        btn.addEventListener("click", handler);
        btn.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); }
        });
      }
    });

    // 全部清除（保留联系人和字卡）
    var clearAllBtn = pageEl.querySelector('[data-act="clear-all"]');
    if (clearAllBtn) {
      var clearAllHandler = function () {
        if (!confirm("确定清除全部数据？\n\n将删除：聊天记录、信件、树洞、朋友圈、电台、吃货等所有记录。\n\n保留：联系人、字卡、个人资料。")) return;
        var keepKeys = ["mine.contacts.v1", "mine.me.v1", "mine.contacts.lastShuffle", "mine.bg.v1"];
        var toRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf("mine.") === 0 && keepKeys.indexOf(k) < 0) {
            toRemove.push(k);
          }
        }
        toRemove.forEach(function (k) {
          try { localStorage.removeItem(k); } catch (e) {}
        });
        alert("已清除全部记录数据");
        updateStorageInfo(pageEl);
      };
      clearAllBtn.addEventListener("click", clearAllHandler);
    }
  }

  /* ---------------- 存储用量计算 ---------------- */
  function updateStorageInfo(pageEl) {
    var infoEl = pageEl.querySelector("#me-storage-info");
    var barEl = pageEl.querySelector("#me-storage-bar");
    if (!infoEl) return;

    // 统计各模块大小
    var moduleKeys = {
      "聊天": ["mine.chat.v1", "mine.chat.unread.v1", "mine.chat.bg.v1", "mine.chat.fontColor.v1", "mine.chat.choices.v1"],
      "信件": ["mine.mail.v1", "mine.mail.pending.v1", "mine.mail.active.v1", "mine.mail.activecheck.v1"],
      "树洞": ["mine.treehole.v2", "mine.treehole.verify.v1", "mine.treehole.pending.v2", "mine.treehole.templates.v1", "mine.treehole.seenCount.v1"],
      "朋友圈": ["mine.moments.v1", "mine.moments.cover", "mine.moments.contactInteractions"],
      "联系人": ["mine.contacts.v1", "mine.contacts.lastShuffle"],
      "电台": ["mine.radio.v1", "mine.radio.mode.v1"],
      "吃货": ["mine.foodie.v1"],
      "个人": ["mine.me.v1", "mine.bg.v1"]
    };

    var totalSize = 0;
    var moduleSizes = {};
    Object.keys(moduleKeys).forEach(function (mod) {
      var modSize = 0;
      moduleKeys[mod].forEach(function (k) {
        var v = localStorage.getItem(k);
        if (v) modSize += v.length;
      });
      moduleSizes[mod] = modSize;
      totalSize += modSize;
    });

    // 也统计其他 mine.* 键
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("mine.") === 0) {
        var found = false;
        Object.keys(moduleKeys).forEach(function (mod) {
          if (moduleKeys[mod].indexOf(k) >= 0) found = true;
        });
        if (!found) {
          var v = localStorage.getItem(k);
          if (v) totalSize += v.length;
        }
      }
    }

    var totalKB = (totalSize / 1024).toFixed(1);
    var maxKB = 5120; // 估算 5MB 上限
    var percent = Math.min(100, Math.round(totalSize / (maxKB * 1024) * 100));

    // 找最大的模块
    var maxMod = "";
    var maxModSize = 0;
    Object.keys(moduleSizes).forEach(function (mod) {
      if (moduleSizes[mod] > maxModSize) {
        maxModSize = moduleSizes[mod];
        maxMod = mod;
      }
    });

    infoEl.textContent = "已用 " + totalKB + " KB / 5120 KB (" + percent + "%)" +
      (maxMod ? " · " + maxMod + " 占用最多" : "");
    if (barEl) barEl.style.width = percent + "%";
  }

  /* ==================== 数据导出功能 ==================== */

  /* 通用：下载文本文件（兼容手机） */
  function downloadText(filename, text) {
    try {
      var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.position = "fixed";
      a.style.left = "0";
      a.style.top = "0";
      a.style.width = "1px";
      a.style.height = "1px";
      a.style.opacity = "0";
      document.body.appendChild(a);
      // 兼容手机：先触发，再延迟较长时间清理
      var ev = document.createEvent("MouseEvents");
      ev.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
      a.dispatchEvent(ev);
      setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) {}
        try { URL.revokeObjectURL(url); } catch (e) {}
      }, 2000);
    } catch (e) {
      // 兜底：用 data URL 方式
      try {
        var dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
        var a2 = document.createElement("a");
        a2.href = dataUrl;
        a2.download = filename;
        a2.style.display = "none";
        document.body.appendChild(a2);
        a2.click();
        setTimeout(function () { try { document.body.removeChild(a2); } catch (e) {} }, 2000);
      } catch (e2) {
        alert("导出失败，请重试");
      }
    }
  }

  /* 通用：读取 localStorage JSON */
  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* 通用：格式化时间 */
  function fmtTime(ts) {
    if (!ts) return "未知时间";
    try {
      var d = new Date(ts);
      return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() +
        " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    } catch (e) { return "未知时间"; }
  }

  /* 获取联系人名映射 */
  function getContactNames() {
    var data = readJSON("mine.contacts.v1");
    var names = {};
    if (data && data.contacts) {
      data.contacts.forEach(function (c) {
        names[c.id] = c.name || "未知";
      });
    }
    if (data && data.groups) {
      data.groups.forEach(function (g) {
        names[g.id] = g.name || "未知群";
      });
    }
    return names;
  }

  /* 导出聊天记录 */
  function exportChat() {
    var convs = readJSON("mine.chat.v1");
    if (!convs || Object.keys(convs).length === 0) {
      alert("没有聊天记录可导出");
      return;
    }
    var names = getContactNames();
    var text = "========== 聊天记录 ==========\n";
    text += "导出时间：" + fmtTime(Date.now()) + "\n\n";

    Object.keys(convs).forEach(function (key) {
      var msgs = convs[key];
      if (!Array.isArray(msgs) || msgs.length === 0) return;
      var name = names[key.replace("contact:", "").replace("group:", "")] || key;
      text += "--- " + name + " ---\n";
      msgs.forEach(function (m) {
        var time = fmtTime(m.time);
        var sender = m.from === "me" ? "我" : (m.senderName || names[m.from] || "对方");
        var content = m.text || "";
        // 图片消息标记
        if (typeof content === "string" && content.indexOf("data:image/") === 0) {
          content = "[图片]";
        }
        text += "[" + time + "] " + sender + "：" + content + "\n";
      });
      text += "\n";
    });

    downloadText("聊天记录_" + Date.now() + ".txt", text);
  }

  /* 导出信件记录 */
  function exportMail() {
    var data = readJSON("mine.mail.v1");
    if (!data) {
      alert("没有信件记录可导出");
      return;
    }
    var text = "========== 次元信箱信件记录 ==========\n";
    text += "导出时间：" + fmtTime(Date.now()) + "\n\n";

    // 收件箱（收到的信）
    var inbox = data.inbox || [];
    if (inbox.length > 0) {
      text += "--- 收件箱（共 " + inbox.length + " 封）---\n\n";
      inbox.forEach(function (m, i) {
        text += "[" + (i + 1) + "] " + fmtTime(m.time) + "\n";
        if (m.from && m.from.name) text += "发件人：" + m.from.name + "\n";
        text += "主题：" + (m.subject || "(无主题)") + "\n";
        text += "正文：" + (m.body || "") + "\n";
        text += "状态：" + (m.read ? "已读" : "未读") + (m.starred ? " ★" : "") + "\n\n";
      });
    }

    // 发件箱（发出的信）
    var outbox = data.outbox || [];
    if (outbox.length > 0) {
      text += "--- 发件箱（共 " + outbox.length + " 封）---\n\n";
      outbox.forEach(function (m, i) {
        text += "[" + (i + 1) + "] " + fmtTime(m.time) + "\n";
        if (m.to && m.to.length > 0) {
          var toNames = m.to.map(function (t) { return t.name || "未知"; });
          text += "收件人：" + toNames.join("、") + "\n";
        }
        text += "主题：" + (m.subject || "(无主题)") + "\n";
        text += "正文：" + (m.body || "") + "\n";
        text += "状态：" + (m.status || "未知") + "\n\n";
      });
    }

    // 草稿箱
    var drafts = data.drafts || [];
    if (drafts.length > 0) {
      text += "--- 草稿箱（共 " + drafts.length + " 封）---\n\n";
      drafts.forEach(function (m, i) {
        text += "[" + (i + 1) + "] " + fmtTime(m.time) + "\n";
        if (m.to && m.to.length > 0) {
          var toNames2 = m.to.map(function (t) { return t.name || "未知"; });
          text += "收件人：" + toNames2.join("、") + "\n";
        }
        text += "主题：" + (m.subject || "(无主题)") + "\n";
        text += "正文：" + (m.body || "") + "\n\n";
      });
    }

    // 待送达/待回复的调度记录
    var pending = readJSON("mine.mail.pending.v1");
    if (pending && pending.length > 0) {
      text += "--- 待处理信件（共 " + pending.length + " 封）---\n\n";
      pending.forEach(function (p, i) {
        text += "[" + (i + 1) + "] ";
        if (p.recipient && p.recipient.name) text += "收件人：" + p.recipient.name + "\n";
        text += "预计送达：" + fmtTime(p.deliveryTime) + "\n";
        text += "预计回复：" + fmtTime(p.replyTime) + "\n";
        text += "状态：" + (p.delivered ? "已送达" : "待送达") + " / " + (p.replied ? "已回复" : "待回复") + "\n";
        if (p.originalSubject) text += "原主题：" + p.originalSubject + "\n";
        text += "\n";
      });
    }

    // 主动来信调度
    var active = readJSON("mine.mail.active.v1");
    if (active && active.length > 0) {
      text += "--- 待送达主动来信（共 " + active.length + " 封）---\n\n";
      active.forEach(function (p, i) {
        text += "[" + (i + 1) + "] ";
        if (p.contact && p.contact.name) text += "发件人：" + p.contact.name + "\n";
        text += "预计送达：" + fmtTime(p.deliveryTime) + "\n";
        text += "状态：" + (p.delivered ? "已送达" : "待送达") + "\n\n";
      });
    }

    if (inbox.length === 0 && outbox.length === 0 && drafts.length === 0 && (!pending || pending.length === 0) && (!active || active.length === 0)) {
      alert("没有信件记录可导出");
      return;
    }

    downloadText("信件记录_" + Date.now() + ".txt", text);
  }

  /* 导出树洞记录 */
  function exportTreehole() {
    var surveys = readJSON("mine.treehole.v2");
    if (!surveys || (Array.isArray(surveys) && surveys.length === 0)) {
      alert("没有树洞记录可导出");
      return;
    }
    var names = getContactNames();
    var text = "========== 树洞记录 ==========\n";
    text += "导出时间：" + fmtTime(Date.now()) + "\n\n";

    var surveyList = Array.isArray(surveys) ? surveys : (surveys.list || []);
    surveyList.forEach(function (s, i) {
      text += "--- 问卷 " + (i + 1) + " ---\n";
      text += "发送时间：" + fmtTime(s.sendTime) + "\n";
      text += "状态：" + (s.status === "received" ? "已收到回复" : "等待回复中") + "\n";

      // 验证问题
      if (s.verifyQuestion) {
        text += "验证问题：" + (s.verifyQuestion.question || "") + "\n";
        if (s.verifyQuestion.options && s.verifyQuestion.options.length > 0) {
          s.verifyQuestion.options.forEach(function (opt, oi) {
            var mark = (oi === s.verifyQuestion.correctIndex) ? " ✓正确" : "";
            text += "  " + String.fromCharCode(65 + oi) + ". " + opt + mark + "\n";
          });
        }
      }

      // 问卷题目
      if (s.questions && s.questions.length > 0) {
        text += "问卷题目（共 " + s.questions.length + " 题）：\n";
        s.questions.forEach(function (q, qi) {
          text += "  Q" + (qi + 1) + ". " + (q.question || "") + "\n";
          if (q.options && q.options.length > 0) {
            q.options.forEach(function (opt, oi) {
              text += "    " + String.fromCharCode(65 + oi) + ". " + opt + "\n";
            });
          }
        });
      }

      // 收件人
      if (s.recipients && s.recipients.length > 0) {
        var recipientNames = s.recipients.map(function (r) { return r.name || "未知"; });
        text += "收件人：" + recipientNames.join("、") + "\n";
      }

      // 回复
      if (s.responses && s.responses.length > 0) {
        text += "回复（共 " + s.responses.length + " 份）：\n";
        s.responses.forEach(function (r, ri) {
          text += "  回复" + (ri + 1) + " — " + (r.contactName || names[r.contactId] || "未知") + "\n";
          text += "    回复时间：" + fmtTime(r.responseTime) + "\n";
          text += "    验证：" + (r.verifyCorrect ? "通过" : "未通过") + "\n";
          if (r.answers && r.answers.length > 0) {
            r.answers.forEach(function (a) {
              var q = s.questions && s.questions[a.qIndex];
              var qText = q ? q.question : ("问题" + (a.qIndex + 1));
              var choiceText = q && q.options ? (q.options[a.choice] || "未选") : ("选项" + (a.choice + 1));
              text += "    " + qText + " → " + choiceText + "\n";
            });
          }
          text += "    状态：" + (r.valid ? "有效" : "无效") + "\n";
        });
      }

      text += "\n";
    });

    // 待回复的调度记录
    var pending = readJSON("mine.treehole.pending.v2");
    if (pending && pending.length > 0) {
      text += "--- 待回复问卷（共 " + pending.length + " 份）---\n\n";
      pending.forEach(function (p, i) {
        text += "[" + (i + 1) + "] ";
        if (p.recipient && p.recipient.name) text += "收件人：" + p.recipient.name + "\n";
        text += "预计回复：" + fmtTime(p.replyTime) + "\n";
        text += "尝试次数：" + (p.attempts || 0) + "\n";
        text += "状态：" + (p.resolved ? "已完成" : "待处理") + "\n\n";
      });
    }

    // 模板
    var templates = readJSON("mine.treehole.templates.v1");
    if (templates && templates.length > 0) {
      text += "--- 问卷模板（共 " + templates.length + " 个）---\n\n";
      templates.forEach(function (t, i) {
        text += "[" + (i + 1) + "] " + (t.name || "未命名模板") + "\n";
        if (t.questions && t.questions.length > 0) {
          t.questions.forEach(function (q, qi) {
            text += "  Q" + (qi + 1) + ". " + (q.question || "") + " (" + (q.options ? q.options.length : 0) + " 个选项)\n";
          });
        }
        text += "\n";
      });
    }

    downloadText("树洞记录_" + Date.now() + ".txt", text);
  }

  /* 导出朋友圈记录 */
  function exportMoments() {
    var data = readJSON("mine.moments.v1");
    if (!data || (Array.isArray(data) && data.length === 0)) {
      alert("没有朋友圈记录可导出");
      return;
    }
    var names = getContactNames();
    var text = "========== 朋友圈记录 ==========\n";
    text += "导出时间：" + fmtTime(Date.now()) + "\n\n";

    var posts = Array.isArray(data) ? data : [];
    posts.forEach(function (p, i) {
      text += "--- 动态 " + (i + 1) + " ---\n";
      text += "发布者：" + (p.authorName || names[p.authorId] || "未知") + "\n";
      text += "时间：" + fmtTime(p.timestamp) + "\n";
      if (p.text) text += "内容：" + p.text + "\n";
      if (p.images && p.images.length > 0) {
        text += "图片：" + p.images.length + " 张\n";
      }
      if (p.location) text += "位置：" + p.location + "\n";

      // 点赞（是数组 [{ id, name }]）
      if (p.likes && p.likes.length > 0) {
        var likeNames = p.likes.map(function (l) { return l.name || l.id || "未知"; });
        text += "点赞（" + p.likes.length + "）：" + likeNames.join("、") + "\n";
      }

      // 评论（数组 [{ id, name, text, timestamp }]）
      if (p.comments && p.comments.length > 0) {
        text += "评论（" + p.comments.length + "）：\n";
        p.comments.forEach(function (c) {
          text += "  [" + fmtTime(c.timestamp) + "] " + (c.name || c.id || "未知") + "：" + (c.text || "") + "\n";
        });
      }

      text += "\n";
    });

    // 封面图
    var cover = localStorage.getItem("mine.moments.cover");
    if (cover) text += "封面图：已设置\n\n";

    // 联系人朋友圈互动记录
    var interactions = readJSON("mine.moments.contactInteractions");
    if (interactions) {
      text += "--- 联系人朋友圈互动记录 ---\n\n";
      Object.keys(interactions).forEach(function (postId) {
        var acts = interactions[postId];
        if (!acts) return;
        // 从 postId 提取联系人ID
        var contactId = "";
        if (postId.indexOf("cm_") === 0) {
          var rest = postId.substring(3);
          var lastUnder = rest.lastIndexOf("_");
          contactId = lastUnder > 0 ? rest.substring(0, lastUnder) : rest;
        }
        text += (names[contactId] || contactId || postId) + "：\n";
        if (acts.likes && acts.likes.length > 0) {
          var likeNames2 = acts.likes.map(function (l) { return l.name || l.id || "未知"; });
          text += "  点赞（" + acts.likes.length + "）：" + likeNames2.join("、") + "\n";
        }
        if (acts.comments && acts.comments.length > 0) {
          text += "  评论（" + acts.comments.length + "）：\n";
          acts.comments.forEach(function (c) {
            text += "    " + (c.name || "未知") + "：" + (c.text || "") + "\n";
          });
        }
        if (acts.autoReplies && acts.autoReplies.replies && acts.autoReplies.replies.length > 0) {
          text += "  自动回复（" + acts.autoReplies.replies.length + "）：\n";
          acts.autoReplies.replies.forEach(function (r) {
            text += "    " + (r.name || "对方") + "：" + (r.text || "") + "\n";
          });
        }
        text += "\n";
      });
    }

    downloadText("朋友圈记录_" + Date.now() + ".txt", text);
  }

  /* 导出全部记录 */
  function exportAll() {
    var text = "========== Mine 全部数据备份 ==========\n";
    text += "导出时间：" + fmtTime(Date.now()) + "\n";
    text += "================================\n\n\n";

    // 聊天记录
    var convs = readJSON("mine.chat.v1");
    if (convs && Object.keys(convs).length > 0) {
      var names = getContactNames();
      text += "========== 聊天记录 ==========\n\n";
      Object.keys(convs).forEach(function (key) {
        var msgs = convs[key];
        if (!Array.isArray(msgs) || msgs.length === 0) return;
        var name = names[key.replace("contact:", "").replace("group:", "")] || key;
        text += "--- " + name + " ---\n";
        msgs.forEach(function (m) {
          var time = fmtTime(m.time);
          var sender = m.from === "me" ? "我" : (m.senderName || names[m.from] || "对方");
          var content = m.text || "";
          if (typeof content === "string" && content.indexOf("data:image/") === 0) content = "[图片]";
          text += "[" + time + "] " + sender + "：" + content + "\n";
        });
        text += "\n";
      });
    }

    // 信件记录
    var mail = readJSON("mine.mail.v1");
    if (mail) {
      text += "\n========== 次元信箱信件记录 ==========\n\n";
      var inbox = mail.inbox || [];
      var outbox = mail.outbox || [];
      var drafts = mail.drafts || [];
      if (inbox.length > 0) {
        text += "--- 收件箱（共 " + inbox.length + " 封）---\n\n";
        inbox.forEach(function (m, i) {
          text += "[" + (i + 1) + "] " + fmtTime(m.time) + "\n";
          if (m.from && m.from.name) text += "发件人：" + m.from.name + "\n";
          text += "主题：" + (m.subject || "(无主题)") + "\n";
          text += "正文：" + (m.body || "") + "\n\n";
        });
      }
      if (outbox.length > 0) {
        text += "--- 发件箱（共 " + outbox.length + " 封）---\n\n";
        outbox.forEach(function (m, i) {
          text += "[" + (i + 1) + "] " + fmtTime(m.time) + "\n";
          if (m.to && m.to.length > 0) {
            var toNames = m.to.map(function (t) { return t.name || "未知"; });
            text += "收件人：" + toNames.join("、") + "\n";
          }
          text += "主题：" + (m.subject || "(无主题)") + "\n";
          text += "正文：" + (m.body || "") + "\n";
          text += "状态：" + (m.status || "未知") + "\n\n";
        });
      }
      if (drafts.length > 0) {
        text += "--- 草稿箱（共 " + drafts.length + " 封）---\n\n";
        drafts.forEach(function (m, i) {
          text += "[" + (i + 1) + "] " + fmtTime(m.time) + "\n";
          text += "主题：" + (m.subject || "(无主题)") + "\n";
          text += "正文：" + (m.body || "") + "\n\n";
        });
      }
      // 待处理信件
      var mailPending = readJSON("mine.mail.pending.v1");
      if (mailPending && mailPending.length > 0) {
        text += "--- 待处理信件（共 " + mailPending.length + " 封）---\n\n";
        mailPending.forEach(function (p, i) {
          text += "[" + (i + 1) + "] ";
          if (p.recipient && p.recipient.name) text += "收件人：" + p.recipient.name + "\n";
          text += "预计送达：" + fmtTime(p.deliveryTime) + "\n";
          text += "预计回复：" + fmtTime(p.replyTime) + "\n";
          text += "状态：" + (p.delivered ? "已送达" : "待送达") + " / " + (p.replied ? "已回复" : "待回复") + "\n\n";
        });
      }
      // 主动来信
      var mailActive = readJSON("mine.mail.active.v1");
      if (mailActive && mailActive.length > 0) {
        text += "--- 待送达主动来信（共 " + mailActive.length + " 封）---\n\n";
        mailActive.forEach(function (p, i) {
          text += "[" + (i + 1) + "] ";
          if (p.contact && p.contact.name) text += "发件人：" + p.contact.name + "\n";
          text += "预计送达：" + fmtTime(p.deliveryTime) + "\n";
          text += "状态：" + (p.delivered ? "已送达" : "待送达") + "\n\n";
        });
      }
    }

    // 树洞记录
    var treehole = readJSON("mine.treehole.v2");
    if (treehole) {
      var names4 = getContactNames();
      text += "\n========== 树洞记录 ==========\n\n";
      var surveyList = Array.isArray(treehole) ? treehole : [];
      surveyList.forEach(function (s, i) {
        text += "--- 问卷 " + (i + 1) + " ---\n";
        text += "发送时间：" + fmtTime(s.sendTime) + "\n";
        text += "状态：" + (s.status === "received" ? "已收到回复" : "等待回复中") + "\n";
        if (s.verifyQuestion) {
          text += "验证问题：" + (s.verifyQuestion.question || "") + "\n";
        }
        if (s.questions && s.questions.length > 0) {
          text += "问卷题目：\n";
          s.questions.forEach(function (q, qi) {
            text += "  Q" + (qi + 1) + ". " + (q.question || "") + "\n";
          });
        }
        if (s.recipients && s.recipients.length > 0) {
          var rNames = s.recipients.map(function (r) { return r.name || "未知"; });
          text += "收件人：" + rNames.join("、") + "\n";
        }
        if (s.responses && s.responses.length > 0) {
          text += "回复（共 " + s.responses.length + " 份）：\n";
          s.responses.forEach(function (r, ri) {
            text += "  回复" + (ri + 1) + " — " + (r.contactName || names4[r.contactId] || "未知") + "\n";
            text += "    时间：" + fmtTime(r.responseTime) + "\n";
            text += "    验证：" + (r.verifyCorrect ? "通过" : "未通过") + "\n";
            if (r.answers && r.answers.length > 0) {
              r.answers.forEach(function (a) {
                var q = s.questions && s.questions[a.qIndex];
                var qText = q ? q.question : ("问题" + (a.qIndex + 1));
                var choiceText = q && q.options ? (q.options[a.choice] || "未选") : ("选项" + (a.choice + 1));
                text += "    " + qText + " → " + choiceText + "\n";
              });
            }
          });
        }
        text += "\n";
      });
      // 待回复
      var thPending = readJSON("mine.treehole.pending.v2");
      if (thPending && thPending.length > 0) {
        text += "--- 待回复问卷（共 " + thPending.length + " 份）---\n\n";
        thPending.forEach(function (p, i) {
          text += "[" + (i + 1) + "] ";
          if (p.recipient && p.recipient.name) text += "收件人：" + p.recipient.name + "\n";
          text += "预计回复：" + fmtTime(p.replyTime) + "\n";
          text += "状态：" + (p.resolved ? "已完成" : "待处理") + "\n\n";
        });
      }
      // 模板
      var thTemplates = readJSON("mine.treehole.templates.v1");
      if (thTemplates && thTemplates.length > 0) {
        text += "--- 问卷模板（共 " + thTemplates.length + " 个）---\n\n";
        thTemplates.forEach(function (t, i) {
          text += "[" + (i + 1) + "] " + (t.name || "未命名") + "\n";
          if (t.questions && t.questions.length > 0) {
            t.questions.forEach(function (q, qi) {
              text += "  Q" + (qi + 1) + ". " + (q.question || "") + "\n";
            });
          }
          text += "\n";
        });
      }
    }

    // 朋友圈记录
    var moments = readJSON("mine.moments.v1");
    if (moments && Array.isArray(moments) && moments.length > 0) {
      var names3 = getContactNames();
      text += "\n========== 朋友圈记录 ==========\n\n";
      moments.forEach(function (p, i) {
        text += "--- 动态 " + (i + 1) + " ---\n";
        text += "发布者：" + (p.authorName || names3[p.authorId] || "未知") + "\n";
        text += "时间：" + fmtTime(p.timestamp) + "\n";
        if (p.text) text += "内容：" + p.text + "\n";
        if (p.images && p.images.length > 0) text += "图片：" + p.images.length + " 张\n";
        if (p.likes && p.likes.length > 0) {
          var ln = p.likes.map(function (l) { return l.name || l.id || "未知"; });
          text += "点赞（" + p.likes.length + "）：" + ln.join("、") + "\n";
        }
        if (p.comments && p.comments.length > 0) {
          text += "评论（" + p.comments.length + "）：\n";
          p.comments.forEach(function (c) {
            text += "  [" + fmtTime(c.timestamp) + "] " + (c.name || "未知") + "：" + (c.text || "") + "\n";
          });
        }
        text += "\n";
      });
      // 互动记录
      var interactions = readJSON("mine.moments.contactInteractions");
      if (interactions) {
        text += "--- 联系人朋友圈互动记录 ---\n\n";
        Object.keys(interactions).forEach(function (postId) {
          var acts = interactions[postId];
          if (!acts) return;
          var cid = "";
          if (postId.indexOf("cm_") === 0) {
            var rest = postId.substring(3);
            var lu = rest.lastIndexOf("_");
            cid = lu > 0 ? rest.substring(0, lu) : rest;
          }
          text += (names3[cid] || cid || postId) + "：\n";
          if (acts.likes && acts.likes.length > 0) text += "  点赞 " + acts.likes.length + " 次\n";
          if (acts.comments && acts.comments.length > 0) text += "  评论 " + acts.comments.length + " 条\n";
          if (acts.autoReplies && acts.autoReplies.replies && acts.autoReplies.replies.length > 0) text += "  自动回复 " + acts.autoReplies.replies.length + " 条\n";
          text += "\n";
        });
      }
    }

    // 联系人字卡摘要
    var contacts = readJSON("mine.contacts.v1");
    if (contacts && contacts.contacts) {
      text += "\n========== 联系人字卡摘要 ==========\n\n";
      contacts.contacts.forEach(function (c) {
        text += c.name + "：";
        if (c.cards && c.cards.length > 0) {
          var summary = c.cards.map(function (card) {
            if (typeof card === "string" && card.indexOf("data:image/") === 0) return "[图片]";
            return card;
          });
          text += summary.join("、");
        } else {
          text += "无字卡";
        }
        text += "\n";
      });
    }

    // 个人资料
    var me = readJSON("mine.me.v1");
    if (me) {
      text += "\n========== 个人资料 ==========\n";
      text += "昵称：" + (me.name || "雾客") + "\n";
      text += "头像：" + (me.avatar ? "已设置" : "默认") + "\n";
    }

    text += "\n========== 导出结束 ==========\n";

    downloadText("Mine全部数据备份_" + Date.now() + ".txt", text);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    loadMe();
  }

  /* ---------------- 暴露接口 ---------------- */
  return {
    init: init,
    renderPage: renderPage,
    getProfile: function () { return meProfile; },
    getName: function () { return meProfile.name || "雾客"; },
    avatarHTML: avatarHTML,
    loadMe: loadMe,
    saveMe: saveMe
  };
})();
