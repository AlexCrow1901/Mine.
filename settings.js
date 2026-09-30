/* ========================================================================
   Mine · 设置
   ------------------------------------------------------------------------
   · 后台保活开关（可分别控制）：
     - 消息通知：后台收到新消息 / 来电时是否弹出系统通知
     - 后台运行：是否启用后台保活（静音音频保活 + 屏幕常亮）
   · 开关状态存储于 localStorage "mine.settings.v1"
   · 由 keepalive.js 读取并立即生效（MineKeepalive.setPref / applyPrefs）
   · 接入：app.js 注册 "settings" 页钩子；index.html 引入本文件
   ======================================================================== */

window.MineSettings = (function () {
  "use strict";

  var I = window.MineIcons;
  var SETTINGS_KEY = "mine.settings.v1";

  var prefs = { notify: true, background: true };

  /* ---------------- 持久化 ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p.notify === "boolean") prefs.notify = p.notify;
        if (p && typeof p.background === "boolean") prefs.background = p.background;
      }
    } catch (e) {}
    // 让保活模块按当前设置生效
    if (window.MineKeepalive) MineKeepalive.applyPrefs();
  }
  function save() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch (e) {}
  }
  function getPrefs() {
    return { notify: prefs.notify, background: prefs.background };
  }
  function setPref(key, val) {
    if (key !== "notify" && key !== "background") return;
    prefs[key] = !!val;
    save();
    // 同步给保活模块并立即生效
    if (window.MineKeepalive) {
      MineKeepalive.setPref(key, prefs[key]);
      MineKeepalive.applyPrefs();
    }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------------- 渲染设置页 ---------------- */
  function renderPage() {
    load();

    var navBar =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + I.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">设置</span>' +
        '<span class="nav-right"></span>' +
      '</div>';

    var html = '<div class="scroll me-scroll">';

    html += '<div class="group-head">后台保活</div>';

    // 消息通知开关
    html += '<div class="func-row">' +
      '<div class="func-icon">' + I.svg("chat", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">消息通知</span>' +
        '<span class="func-sub">后台收到新消息 / 来电时弹出系统通知</span>' +
      '</div>' +
      '<label class="proactive-switch">' +
        '<input type="checkbox" id="set-notify"' + (prefs.notify ? ' checked' : '') + '>' +
        '<span class="proactive-switch-track"></span>' +
      '</label>' +
      '</div>';

    // 后台运行开关
    html += '<div class="func-row">' +
      '<div class="func-icon">' + I.svg("power", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">后台运行</span>' +
        '<span class="func-sub">后台保持活跃，回到页面不丢记录</span>' +
      '</div>' +
      '<label class="proactive-switch">' +
        '<input type="checkbox" id="set-background"' + (prefs.background ? ' checked' : '') + '>' +
        '<span class="proactive-switch-track"></span>' +
      '</label>' +
      '</div>';

    html += '<div class="card-hint">关闭"消息通知"后将不再弹出系统通知；关闭"后台运行"可节省电量，但后台活跃度会下降。受手机系统省电机制限制，网页后台保活尽力而为。</div>';
    html += '<div class="card-hint">聊天记录与朋友圈数据存储于本地，刷新、关闭、更新网站均不会丢失。</div>';

    html += '</div>'; // .scroll

    var detail = document.getElementById("page-detail");
    if (!detail) return;
    detail.innerHTML = navBar + html;

    bindEvents(detail);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents(pageEl) {
    var backBtn = pageEl.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener("click", function () {
      window.MineApp.goHome();
    });

    var notifyEl = pageEl.querySelector("#set-notify");
    if (notifyEl) {
      notifyEl.addEventListener("change", function () {
        setPref("notify", notifyEl.checked);
        // 重新开启通知时，顺手请求一次系统权限
        if (notifyEl.checked && window.MineKeepalive) {
          MineKeepalive.requestPermission();
        }
      });
    }

    var bgEl = pageEl.querySelector("#set-background");
    if (bgEl) {
      bgEl.addEventListener("change", function () {
        setPref("background", bgEl.checked);
      });
    }
  }

  /* ---------------- 暴露接口 ---------------- */
  return {
    load: load,
    renderPage: renderPage,
    getPrefs: getPrefs,
    setPref: setPref
  };
})();
