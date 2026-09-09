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
