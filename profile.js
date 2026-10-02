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

    // 头部：头像 + 昵称（仅展示，编辑入口在"个性化"）
    var avatarInner = (meProfile.avatar
      ? '<img src="' + escapeHtml(meProfile.avatar) + '">'
      : '<span class="avatar-gen-text">' + escapeHtml(firstChar(meProfile.name)) + '</span>');

    html += '<div class="profile-hero">' +
      '<div class="avatar big-avatar profile-avatar" id="me-avatar" style="position:relative;">' +
        avatarInner +
      '</div>' +
      '<span class="profile-name" id="me-name-display">' + escapeHtml(meProfile.name || "雾客") + '</span>' +
      '<span class="profile-status">在"个性化"中修改昵称与头像</span>' +
      '</div>';

    html += '<div class="list-sep"></div>';

    // 个性化：昵称 / 头像 / 背景
    html += '<div class="group-head">个性化</div>';

    // 昵称
    html += '<div class="me-edit-row">' +
      '<input type="text" class="field-input me-name-input" id="me-name-input" ' +
      'value="' + escapeHtml(meProfile.name || "雾客") + '" ' +
      'placeholder="输入你的昵称" maxlength="20">' +
      '<button class="btn btn-primary btn-sm" id="me-name-save">保存</button>' +
      '</div>';

    // 头像
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

    // 背景
    html += '<div class="func-row" role="button" tabindex="0" data-act="open-background">' +
      '<div class="func-icon">' + I.svg("background", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">背景</span>' +
        '<span class="func-sub">模式、背景、字体样式与字体颜色</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
      '</div>';

    html += '<input type="file" accept="image/*" id="me-avatar-file" class="file-hidden">';

    html += '<div class="list-sep"></div>';

    // 字卡
    html += '<div class="group-head">字卡</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="open-cards">' +
      '<div class="func-icon">' + I.svg("me", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">我的字卡</span>' +
        '<span class="func-sub">公用字卡所有联系人可用，单独字卡仅指定联系人使用</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
      '</div>';

    html += '<div class="list-sep"></div>';

    // 概率修改
    html += '<div class="group-head">概率</div>';
    html += '<div class="func-row" role="button" tabindex="0" data-act="open-probability">' +
      '<div class="func-icon">' + I.svg("sliders", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">概率修改</span>' +
        '<span class="func-sub">自定义图片 / emoji / 语音 / 附带 emoji / 沉默等概率</span>' +
      '</div>' +
      '<span class="chevron">' + I.svg("back", 18) + '</span>' +
      '</div>';

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

    // 背景入口 → 打开背景管理器
    var bgBtn = pageEl.querySelector('[data-act="open-background"]');
    if (bgBtn) {
      bgBtn.addEventListener("click", function () {
        if (window.MineBackground) window.MineBackground.openManager();
      });
    }

    // 字卡入口 → 打开字卡管理器
    var cardsBtn = pageEl.querySelector('[data-act="open-cards"]');
    if (cardsBtn) {
      cardsBtn.addEventListener("click", function () {
        if (window.MineCards) window.MineCards.openManager();
      });
    }

    // 概率修改入口 → 打开概率管理器
    var probBtn = pageEl.querySelector('[data-act="open-probability"]');
    if (probBtn) {
      probBtn.addEventListener("click", function () {
        if (window.MineProbs) window.MineProbs.openManager();
      });
    }

    // 更换头像 → 选择文件
    var fileEl = pageEl.querySelector("#me-avatar-file");
    var changeAvatarBtn = pageEl.querySelector('[data-act="change-avatar"]');
    if (changeAvatarBtn && fileEl) {
      var openPicker = function () { fileEl.click(); };
      changeAvatarBtn.addEventListener("click", openPicker);
      changeAvatarBtn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); }
      });
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
 
