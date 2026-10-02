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

  /* ============ 应用图标自定义（PWA 桌面图标） ============
     为保证应用可安装为独立 App（Chrome 只认可静态 manifest.json 上的图标，
     动态 blob manifest 会导致无法安装），自定义桌面图标采用"导出替换"方案：
     上传 → 应用内预览 + 导出 PNG → 用导出的文件替换仓库 icons/ 下同名文件
     并重新部署 → 重新"添加到主屏幕"后桌面图标即更新。
     上传的自定义图标仅存本地用于预览，不修改 manifest。 */
  function getCustomIcon() {
    try { return localStorage.getItem(ICON_KEY) || null; } catch (e) { return null; }
  }
  /* dataURL → 按目标尺寸重绘为 PNG 并触发下载 */
  function downloadPng(dataUrl, filename, size) {
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement("canvas");
        c.width = size; c.height = size;
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        var a = document.createElement("a");
        a.href = c.toDataURL("image/png");
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {}
    };
    img.src = dataUrl;
  }
  function downloadCustomIcon(size) {
    var data = getCustomIcon();
    if (!data) return;
    downloadPng(data, size === 512 ? "icon-512.png" : "icon-192.png", size);
  }
  /* 上传图片 → 压缩为 512px dataURL → 仅本地存储与预览 */
  function applyCustomIcon(file) {
    if (!file || !/^image\//.test(file.type)) return;
    if (window.MineUtils && MineUtils.compressImage) {
      MineUtils.compressImage(file, 512, 0.9, function (dataURL) {
        if (!dataURL) return;
        try { localStorage.setItem(ICON_KEY, dataURL); } catch (e) {}
        renderPage();
      });
    } else {
      var reader = new FileReader();
      reader.onload = function () {
        try { localStorage.setItem(ICON_KEY, reader.result); } catch (e) {}
        renderPage();
      };
      reader.readAsDataURL(file);
    }
  }
  function resetCustomIcon() {
    try { localStorage.removeItem(ICON_KEY); } catch (e) {}
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
    html += '<div class="card-hint">自定义桌面图标：上传图片 → 导出 PNG → 替换仓库 icons/icon-512.png（与 icon-192.png）→ 重新部署 → 重新"添加到主屏幕"后生效。为保证可安装为独立应用，安装始终使用静态 manifest.json 中的图标。</div>';
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
    var html = '<div class="func-row">' +
      '<div class="func-icon" style="width:46px;height:46px;border-radius:12px;overflow:hidden;flex:none;">' +
        '<img id="set-icon-preview" src="' + src + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">' +
      '</div>' +
      '<div class="func-text">' +
        '<span class="func-title">桌面图标</span>' +
        '<span class="func-sub">' + (custom ? "已上传自定义图标（导出替换文件后生效）" : "当前为内置 Mine 图标") + '</span>' +
      '</div>' +
      '<button class="chat-bg-btn" id="set-icon-upload" style="flex:none;">' +
        (custom ? "更换" : "选择图片") + '</button>' +
      '</div>' +
      '<input type="file" accept="image/*" id="set-icon-file" class="file-hidden">';
    if (custom) {
      html += '<div class="func-row" style="border-top:none;">' +
        '<div class="func-icon">' + iconSvg("download", 20) + '</div>' +
        '<div class="func-text">' +
          '<span class="func-title">导出图标文件</span>' +
          '<span class="func-sub">下载 PNG 后替换仓库 icons/ 目录同名文件并重新部署</span>' +
        '</div>' +
        '<button class="chat-bg-btn" id="set-icon-dl512" style="flex:none;">下载 512</button>' +
        '<button class="chat-bg-btn" id="set-icon-dl192" style="flex:none;margin-left:6px;">下载 192</button>' +
        '<button class="chat-bg-btn" id="set-icon-reset" style="flex:none;margin-left:6px;">恢复默认</button>' +
        '</div>';
    }
    return html;
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
    /* 应用图标：上传 / 导出 / 恢复默认 */
    var iconUpload = pageEl.querySelector("#set-icon-upload");
    var iconFile = pageEl.querySelector("#set-icon-file");
    var iconReset = pageEl.querySelector("#set-icon-reset");
    var iconDl512 = pageEl.querySelector("#set-icon-dl512");
    var iconDl192 = pageEl.querySelector("#set-icon-dl192");
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
    if (iconDl512) {
      iconDl512.addEventListener("click", function () { downloadCustomIcon(512); });
    }
    if (iconDl192) {
      iconDl192.addEventListener("click", function () { downloadCustomIcon(192); });
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
