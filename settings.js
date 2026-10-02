/* ========================================================================
   Mine · 设置
   ------------------------------------------------------------------------
   · 后台保活开关（可分别控制）：
     - 消息通知：后台收到新消息 / 来电时是否弹出系统通知
     - 后台运行：是否启用后台保活（音频保活 + 屏幕常亮）
     - 通知逐条弹：开启后每条消息都弹（默认关闭 = 去重合并，防轰炸）
     - 保活不抢其他 App 声音：开启后保活走 WebAudio 通道，
       不占用媒体通道、不压低正在播放的音乐（默认开启）
   · 测试通知：当场体检权限/通道并真发一条系统通知
   · 应用图标：上传图片自定义 PWA 桌面图标（动态重建 manifest，
     重新"添加到主屏幕"后生效）；"恢复默认"回到内置白底黑字 Mine 图标
   · 开关状态存储于 localStorage "mine.settings.v1"；图标存 "mine.icon.v1"
   · 由 keepalive.js 读取并立即生效（MineKeepalive.setPref / applyPrefs）
   · 接入：app.js 注册 "settings" 页钩子；index.html 引入本文件
   ======================================================================== */
window.MineSettings = (function () {
  "use strict";
  /* MineIcons 在本文件之后才加载（见 index.html 脚本顺序），
     必须延迟到调用时再解析，否则 I.svg 抛异常导致设置页打不开。 */
  function iconSvg(name, size) {
    var M = window.MineIcons;
    return M && M.svg ? M.svg(name, size) : "";
  }
  var SETTINGS_KEY = "mine.settings.v1";
  var ICON_KEY = "mine.icon.v1";
  var prefs = { notify: true, background: true, nodedup: false, noduck: true };

  /* ============ 应用图标自定义（PWA 桌面图标） ============ */
  function getCustomIcon() {
    try { return localStorage.getItem(ICON_KEY) || null; } catch (e) { return null; }
  }
  /* 动态重建 manifest：自定义图标（dataURL）插入 icons 首位；
     apple-touch-icon（iOS）/ favicon 同步切换 */
  function rebuildManifest(customIcon) {
    var icons = [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ];
    if (customIcon) icons.unshift({ src: customIcon, sizes: "512x512", type: "image/png", purpose: "any" });
    var manifest = {
      name: "Mine · 雾客",
      short_name: "Mine",
      description: "雾客 Lunar Wanderer — 聊天、通讯录、陪伴、朋友圈一体化本地生活应用，支持离线使用与系统通知。",
      lang: "zh-CN",
      start_url: "./index.html",
      scope: "./",
      display: "standalone",
      orientation: "portrait",
      background_color: "#F8F4EF",
      theme_color: "#F8F4EF",
      icons: icons
    };
    try {
      var blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
      var url = URL.createObjectURL(blob);
      var link = document.querySelector('link[rel="manifest"]');
      if (link) link.href = url;
      var ati = document.querySelector('link[rel="apple-touch-icon"]');
      if (ati) ati.href = customIcon || "icons/icon-192.png";
      var fav = document.querySelector('link[rel="icon"]');
      if (fav) fav.href = customIcon || "icons/icon-192.png";
    } catch (e) {}
  }
  /* 页面加载即应用自定义图标（Blob URL 每次加载需重建） */
  (function initIcon() {
    var c = getCustomIcon();
    if (c) rebuildManifest(c);
  })();
  /* 上传图片 → 压缩为 512px dataURL → 持久化 + 重建 manifest */
  function applyCustomIcon(file) {
    if (!file || !/^image\//.test(file.type)) return;
    if (window.MineUtils && MineUtils.compressImage) {
      MineUtils.compressImage(file, 512, 0.9, function (dataURL) {
        if (!dataURL) return;
        try { localStorage.setItem(ICON_KEY, dataURL); } catch (e) {}
        rebuildManifest(dataURL);
        renderPage();
      });
    } else {
      var reader = new FileReader();
      reader.onload = function () {
        var dataURL = reader.result;
        try { localStorage.setItem(ICON_KEY, dataURL); } catch (e) {}
        rebuildManifest(dataURL);
        renderPage();
      };
      reader.readAsDataURL(file);
    }
  }
  function resetCustomIcon() {
    try { localStorage.removeItem(ICON_KEY); } catch (e) {}
    rebuildManifest(null);
    renderPage();
  }
  /* ---------------- 持久化 ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p.notify === "boolean") prefs.notify = p.notify;
        if (p && typeof p.background === "boolean") prefs.background = p.background;
        if (p && typeof p.nodedup === "boolean") prefs.nodedup = p.nodedup;
        if (p && typeof p.noduck === "boolean") prefs.noduck = p.noduck;
      }
    } catch (e) {}
    // 让保活模块按当前设置生效
    if (window.MineKeepalive) MineKeepalive.applyPrefs();
  }
  function save() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch (e) {}
  }
  function getPrefs() {
    return { notify: prefs.notify, background: prefs.background, nodedup: prefs.nodedup, noduck: prefs.noduck };
  }
  function setPref(key, val) {
    if (!(key === "notify" || key === "background" || key === "nodedup" || key === "noduck")) return;
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
      .replace( />/g, "&gt;").replace(/"/g, "&quot;");
  }
  /* ---------------- 渲染设置页 ---------------- */
  function renderPage() {
    load();
    var navBar =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + iconSvg("back", 20) + '返回</button>' +
        '<span class="nav-title">设置</span>' +
        '<span class="nav-right"></span>' +
      '</div>';
    var html = '<div class="scroll me-scroll">';
    html += '<div class="group-head">后台保活</div>';
    // 消息通知开关
    html += switchRow("set-notify", "chat", "消息通知",
      "后台收到新消息 / 来电时弹出系统通知", prefs.notify);
    // 后台运行开关
    html += switchRow("set-background", "power", "后台运行",
      "后台保持活跃，回到页面不丢记录", prefs.background);
    // 通知逐条弹开关
    html += switchRow("set-nodedup", "bell", "通知逐条弹",
      "开启后每条消息都弹；关闭则去重合并，避免通知轰炸", prefs.nodedup);
    // 保活不抢其他 App 声音开关
    html += switchRow("set-noduck", "music", "保活不抢其他 App 声音",
      "开启后保活走 WebAudio 通道，不占用媒体通道、不压低音乐（默认开）", prefs.noduck);
    // 测试通知按钮
    html += '<div class="func-row">' +
      '<div class="func-icon">' + iconSvg("check", 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">测试通知</span>' +
        '<span class="func-sub">体检权限与通道，并真发一条系统通知</span>' +
      '</div>' +
      '<button class="chat-bg-btn" id="set-test" style="flex:none;">测试</button>' +
      '</div>';
    html += '<div id="set-test-result"></div>';
    // 应用图标自定义
    html += '<div class="group-head">应用图标</div>';
    html += iconCard();
    html += '<div class="card-hint">修改后需重新"添加到主屏幕 / 安装应用"才会更新桌面图标；建议上传正方形图片，系统会自动适配圆角与遮罩。</div>';
    html += '<div class="card-hint">关闭"消息通知"后将不再弹出系统通知；关闭"后台运行"可节省电量，但后台活跃度会下降。受手机系统省电机制限制，网页后台保活尽力而为。</div>';
    html += '<div class="card-hint">聊天记录与朋友圈数据存储于本地，刷新、关闭、更新网站均不会丢失。</div>';
    html += '<div class="card-hint">若收不到通知：① 浏览器地址栏图标 → 权限 → 通知 → 允许；② 手机系统"设置 → 通知"允许该浏览器；③ 勿开启勿扰模式；④ Chrome 可把本站加入"始终保持活动"。</div>';
    html += '</div>'; // .scroll
    var detail = document.getElementById("page-detail");
    if (!detail) return;
    detail.innerHTML = navBar + html;
    bindEvents(detail);
  }
  /* 开关行构建 */
  function switchRow(id, icon, title, sub, checked) {
    return '<div class="func-row">' +
      '<div class="func-icon">' + iconSvg(icon, 20) + '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">' + title + '</span>' +
        '<span class="func-sub">' + sub + '</span>' +
      '</div>' +
      '<label class="proactive-switch">' +
        '<input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="proactive-switch-track"></span>' +
      '</label>' +
      '</div>';
  }
  /* 应用图标卡片 */
  function iconCard() {
    var custom = getCustomIcon();
    var src = custom || "icons/icon-192.png";
    return '<div class="func-row">' +
      '<div class="func-icon" style="width:46px;height:46px;border-radius:12px;overflow:hidden;flex:none;">' +
        '<img id="set-icon-preview" src="' + src + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">' +
      '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">桌面图标</span>' +
        '<span class="func-sub">' + (custom ? "已使用自定义图标" : "当前为内置图标") + '</span>' +
      '</div>' +
      '<button class="chat-bg-btn" id="set-icon-upload" style="flex:none;">' +
        (custom ? "更换" : "选择图片") + '</button>' +
      (custom
        ? '<button class="chat-bg-btn" id="set-icon-reset" style="flex:none;margin-left:6px;">恢复默认</button>'
        : '') +
      '</div>' +
      '<input type="file" accept="image/*" id="set-icon-file" class="file-hidden">';
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
    var nodedupEl = pageEl.querySelector("#set-nodedup");
    if (nodedupEl) {
      nodedupEl.addEventListener("change", function () {
        setPref("nodedup", nodedupEl.checked);
      });
    }
    var noduckEl = pageEl.querySelector("#set-noduck");
    if (noduckEl) {
      noduckEl.addEventListener("change", function () {
        setPref("noduck", noduckEl.checked);
      });
    }
    /* 应用图标：上传 / 恢复默认 */
    var iconUpload = pageEl.querySelector("#set-icon-upload");
    var iconFile = pageEl.querySelector("#set-icon-file");
    var iconReset = pageEl.querySelector("#set-icon-reset");
    if (iconUpload && iconFile) {
      iconUpload.addEventListener("click", function () { iconFile.click(); });
      iconFile.addEventListener("change", function () {
        if (this.files && this.files[0]) applyCustomIcon(this.files[0]);
        this.value = "";
      });
    }
    if (iconReset) {
      iconReset.addEventListener("click", resetCustomIcon);
    }
    var testBtn = pageEl.querySelector("#set-test");
    var resultEl = pageEl.querySelector("#set-test-result");
    if (testBtn && resultEl) {
      testBtn.addEventListener("click", function () {
        if (!window.MineKeepalive) { resultEl.innerHTML = '<div class="card-hint">保活模块未加载</div>'; return; }
        /* 同步返回当前状态；权限为 default 时会异步请求，结果通过回调刷新 */
        var st = MineKeepalive.testNotify(function (st2) {
          renderTestResult(st2);
        });
        renderTestResult(st);
      });
    }
    function renderTestResult(st) {
      if (!resultEl) return;
      var lines = [];
      lines.push("Service Worker 通道：" + (st.sw ? "可用" : "不可用"));
      var permText = String(st.permission || "unknown");
      if (permText === "granted") permText = "已授予";
      else if (permText === "denied") permText = "已拒绝";
      else if (permText === "default") permText = "未授予（默认）";
      else if (permText === "unsupported") permText = "不支持";
      lines.push("通知权限：" + permText);
      if (st.secure !== undefined) {
        lines.push("安全连接：" + (st.secure ? "是" : "否（通知需要 HTTPS）"));
      }
      if (st.ios !== undefined) {
        lines.push("iOS 环境：" + (st.ios ? (st.standalone ? "PWA 模式" : "普通网页（通知需添加到主屏幕）") : "否"));
      }
      lines.push("保活通道：" + (st.audioMode === "wa" ? "WebAudio（不抢声音）" : "媒体元素"));
      lines.push("保活播放中：" + (st.audioPlaying ? "是" : "否"));
      lines.push("屏幕常亮：" + (st.wakeLock ? "是" : "否"));
      if (st.requesting) lines.push("正在请求通知权限…请留意浏览器弹窗");
      if (st.hint) lines.push(st.hint);
      if (st.sent) lines.push("已发送一条测试通知，请查看通知栏");
      resultEl.innerHTML = '<div class="card-hint" style="margin-top:8px;">' +
        lines.map(escapeHtml).join("<br>") + '</div>';
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
