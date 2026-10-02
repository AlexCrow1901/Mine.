/* ========================================================================
   Mine · 背景图管理器
   ------------------------------------------------------------------------
   重点功能：自由更换背景。
   · 预设：雾境 / 铅灰 / 冷青 / 暮霭（CSS 渐变预设；默认"雾境"= 无背景图，
     保持浅色简约观感，跨浏览器表现一致）
   · 上传：本地图片即时预览
   · 调节：雾色叠加 / 背景模糊 / 噪点强度
   · 持久化：localStorage（自定义图尽量以 dataURL 存储，超额则降级为会话级）
   ======================================================================== */

window.MineBackground = (function () {
  "use strict";

  var ASSET = "assets/";
  var STORE_KEY = "mine.bg.v1";

  // 预设列表（仅渐变与无图；图片预设已移除，避免依赖仓库内 jpg 资源）
  var PRESETS = [
    { id: "none",   name: "雾境",   type: "none" },
    { id: "lead",   name: "铅灰",   type: "gradient",
      value: "linear-gradient(160deg,#3a4045 0%,#2b3034 50%,#1d2124 100%)",
      thumb: "linear-gradient(160deg,#3a4045,#1d2124)" },
    { id: "cyan",   name: "冷青",   type: "gradient",
      value: "linear-gradient(165deg,#2f3a3e 0%,#283a40 45%,#1c272b 100%)",
      thumb: "linear-gradient(165deg,#2f3a3e,#1c272b)" },
    { id: "dusk",   name: "暮霭",   type: "gradient",
      value: "linear-gradient(170deg,#3a3531 0%,#332f30 45%,#232021 100%)",
      thumb: "linear-gradient(170deg,#3a3531,#232021)" }
  ];

  var state = {
    preset: "none",             // 默认"雾境"：无背景图，跨浏览器统一浅色简约观感
    customUrl: null,            // 自定义图（dataURL 或 objectURL）
    customType: "image",
    fontStyle: "default",       // 字体样式：default | rounded | songti | kai | mono
    fontColor: "black"          // 主界面字体颜色：white | black | cream | azure | sage
  };

  var el = {};              // 背景层 DOM
  var sheetEl = null;       // 管理面板
  var overlayEl = null;

  /* ---------- 持久化 ---------- */
  function save() {
    try {
      var data = {
        preset: state.preset,
        customUrl: state.customUrl,
        fontStyle: state.fontStyle,
        fontColor: state.fontColor
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {
      // 存储失败（多为 dataURL 过大），静默降级为会话级
    }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      /* 预设合法性校验：历史版本可能存了已移除的图片预设（london/forest），回退为"雾境" */
      state.preset = (data.preset && presetById(data.preset)) ? data.preset : "none";
      state.customUrl = data.customUrl || null;
      state.fontStyle = (data.fontStyle && FONT_STYLES[data.fontStyle]) ? data.fontStyle : "default";
      state.fontColor = (data.fontColor && FONT_COLORS[data.fontColor]) ? data.fontColor : "black";
    } catch (e) {}
  }

  /* ---------- 应用到背景层 ---------- */
  function apply() {
    var bg = el.image;

    // 背景图 / 渐变
    var p = presetById(state.preset);
    var url = (state.preset === "custom" && state.customUrl) ? state.customUrl
            : (p && p.type === "image") ? p.value
            : (p && p.type === "gradient") ? p.value : null;

    if (url) {
      if (p && p.type === "gradient") {
        bg.style.backgroundImage = p.value;
        bg.classList.remove("is-img");
      } else {
        bg.style.backgroundImage = "url('" + url + "')";
        bg.classList.add("is-img");
      }
      bg.classList.add("is-active");
      bg.style.filter = "none";
      bg.style.transform = "scale(1)";
    } else {
      bg.classList.remove("is-active");
      bg.style.backgroundImage = "none";
      bg.style.filter = "none";
    }
    save();
    syncManagerUI();
    applyFontColor();
    applyFontStyle();
  }

  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return null;
  }

  /* ---------- 公共操作 ---------- */
  function setPreset(id) {
    state.preset = id;
    apply();
  }

  /* ---------- 字体样式（通过覆盖 --font-base 全局生效） ---------- */
  var FONT_STYLES = {
    default: { name: "默认", char: "默", css: "" },
    rounded: { name: "圆体", char: "圆",
      css: "'Yuanti SC','YouYuan','PingFang SC','Microsoft YaHei',system-ui,sans-serif" },
    songti:  { name: "宋体", char: "宋",
      css: "'Songti SC','SimSun','宋体',serif" },
    kai:     { name: "楷体", char: "楷",
      css: "'Kaiti SC','KaiTi','楷体',serif" },
    mono:    { name: "等宽", char: "码",
      css: "'SF Mono','Consolas','Menlo',monospace" }
  };
  function applyFontStyle() {
    var root = document.documentElement;
    var css = FONT_STYLES[state.fontStyle] ? FONT_STYLES[state.fontStyle].css : "";
    if (css) root.style.setProperty("--font-base", css);
    else root.style.removeProperty("--font-base");
  }
  function setFontStyle(style) {
    if (!FONT_STYLES[style]) return;
    state.fontStyle = style;
    applyFontStyle();
    save();
    syncManagerUI();
  }

  /* ---------- 主界面字体颜色 ----------
     通过覆盖 :root 的 CSS 变量实现全局字体颜色切换。
     其他界面（陪伴、朋友圈等）自动继承。 */
  var FONT_COLORS = {
    white: { name: "白色",
      "--t-primary":   "#dde3e6",
      "--t-secondary": "#aab1b6",
      "--t-tertiary":  "#71787d",
      "--t-faint":     "#565c61" },
    black: { name: "黑色",
      "--t-primary":   "#1a1a1a",
      "--t-secondary": "#3a3a3a",
      "--t-tertiary":  "#6a6a6a",
      "--t-faint":     "#9a9a9a" },
    cream: { name: "米白",
      "--t-primary":   "#efe9dc",
      "--t-secondary": "#c9bfa8",
      "--t-tertiary":  "#9c917c",
      "--t-faint":     "#7a7160" },
    azure: { name: "浅蓝",
      "--t-primary":   "#d6e4ee",
      "--t-secondary": "#a9c2d4",
      "--t-tertiary":  "#7d97ab",
      "--t-faint":     "#647c8e" },
    sage:  { name: "浅绿",
      "--t-primary":   "#dde8d8",
      "--t-secondary": "#b3c9ab",
      "--t-tertiary":  "#8ba383",
      "--t-faint":     "#718a6a" }
  };
  function applyFontColor() {
    var vars = FONT_COLORS[state.fontColor] || FONT_COLORS.black;
    var root = document.documentElement;
    Object.keys(vars).forEach(function (k) {
      if (k === "name") return;
      root.style.setProperty(k, vars[k]);
    });
  }
  function setFontColor(color) {
    if (!FONT_COLORS[color]) return;
    state.fontColor = color;
    applyFontColor();
    save();
    syncManagerUI();
  }

  function upload(file) {
    if (!file || !/^image\//.test(file.type)) return;
    // 使用压缩工具，避免 localStorage 容量溢出
    window.MineUtils.compressImage(file, 1080, 0.82, function (dataURL) {
      if (!dataURL) return;
      state.customUrl = dataURL;
      state.preset = "custom";
      apply();
    });
  }
  function clearCustom() {
    state.customUrl = null;
    state.preset = "none";
    apply();
  }

  /* ---------- 管理面板（底部 Sheet） ---------- */
  function buildSheet() {
    if (sheetEl) return;

    overlayEl = document.createElement("div");
    overlayEl.className = "sheet-overlay";
    overlayEl.addEventListener("click", closeManager);

    sheetEl = document.createElement("div");
    sheetEl.className = "sheet";
    sheetEl.innerHTML =
      '<div class="sheet-handle"></div>' +
      '<div class="sheet-head"><h2>背景</h2>' +
      '<button class="nav-btn" data-act="close">' + window.MineIcons.svg("close", 20) + '</button></div>' +
      '<div class="sheet-body" id="bg-sheet-body"></div>';

    document.body.appendChild(overlayEl);
    document.body.appendChild(sheetEl);

    sheetEl.querySelector('[data-act="close"]').addEventListener("click", closeManager);
    renderManager();
  }

  function renderManager() {
    var body = document.getElementById("bg-sheet-body");
    if (!body) return;

    // 预设网格
    var presetsHtml = '<div class="section-label">预设</div><div class="preset-grid">';
    PRESETS.forEach(function (p) {
      var thumb = p.type === "image"
        ? "background-image:url('" + p.thumb + "');background-size:cover;background-position:center;"
        : "background:" + p.thumb + ";";
      presetsHtml +=
        '<button class="preset-item' + (state.preset === p.id ? " is-active" : "") +
        '" data-preset="' + p.id + '" style="' + thumb + '">' +
        '<span class="preset-label">' + p.name + '</span></button>';
    });
    // 自定义图卡位
    if (state.customUrl) {
      presetsHtml +=
        '<button class="preset-item is-active" data-preset="custom" ' +
        'style="background-image:url(\'' + state.customUrl + '\');background-size:cover;background-position:center;">' +
        '<span class="preset-label">自定义</span></button>';
    }
    presetsHtml += '</div>';

    // 上传区
    var uploadHtml =
      '<div class="section-label">自定义图片</div>' +
      '<div class="upload-zone" id="bg-upload-zone">' +
        window.MineIcons.svg("upload", 24) +
        '<span>点击选择本地图片</span>' +
      '</div>' +
      '<input type="file" accept="image/*" id="bg-file" class="file-hidden">' +
      (state.customUrl
        ? '<button class="btn btn-block" data-act="clear" style="margin-top:12px;">' +
          window.MineIcons.svg("trash", 18) + ' 清除自定义</button>'
        : '');

    // 字体样式
    var fontStyleHtml =
      '<div class="section-label">字体样式</div>' +
      '<div class="font-color-row">' +
        Object.keys(FONT_STYLES).map(function (key) {
          var fs = FONT_STYLES[key];
          return '<button class="font-color-btn' + (state.fontStyle === key ? " is-active" : "") +
            '" data-font-style="' + key + '">' +
            '<span class="fc-swatch font-style-swatch" style="font-family:' + (fs.css || "sans-serif") + ';">' + fs.char + '</span>' +
            '<span>' + fs.name + '</span></button>';
        }).join("") +
      '</div>';

    // 字体颜色
    var fontColorHtml =
      '<div class="section-label">字体颜色</div>' +
      '<div class="font-color-row">' +
        Object.keys(FONT_COLORS).map(function (key) {
          var fc = FONT_COLORS[key];
          if (key === "name") return "";
          return '<button class="font-color-btn' + (state.fontColor === key ? " is-active" : "") +
            '" data-font-color="' + key + '">' +
            '<span class="fc-swatch fc-' + key + '"></span><span>' + fc.name + '</span></button>';
        }).join("") +
      '</div>';

    body.innerHTML = presetsHtml + uploadHtml + fontStyleHtml + fontColorHtml;

    // 绑定事件
    body.querySelectorAll("[data-preset]").forEach(function (btn) {
      btn.addEventListener("click", function () { setPreset(btn.getAttribute("data-preset")); });
    });
    // 上传区点击 → 触发文件选择
    var uploadZone = body.querySelector("#bg-upload-zone");
    var fileInput = document.getElementById("bg-file");
    if (uploadZone && fileInput) {
      uploadZone.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", function () {
        if (this.files && this.files[0]) upload(this.files[0]);
        this.value = ""; // 允许重复选择同一文件
      });
    }
    var clearBtn = body.querySelector('[data-act="clear"]');
    if (clearBtn) clearBtn.addEventListener("click", clearCustom);

    // 字体样式按钮
    body.querySelectorAll("[data-font-style]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setFontStyle(btn.getAttribute("data-font-style"));
      });
    });

    // 字体颜色按钮
    body.querySelectorAll("[data-font-color]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setFontColor(btn.getAttribute("data-font-color"));
      });
    });
  }

  function syncManagerUI() {
    if (!sheetEl || !sheetEl.classList.contains("is-open")) return;
    // 只更新预设选中状态，不重建整个面板（避免破坏 file input）
    var body = document.getElementById("bg-sheet-body");
    if (!body) return;

    // 更新预设项选中态
    body.querySelectorAll("[data-preset]").forEach(function (btn) {
      var id = btn.getAttribute("data-preset");
      btn.classList.toggle("is-active", id === state.preset);
    });

    // 更新字体样式选中态
    body.querySelectorAll("[data-font-style]").forEach(function (btn) {
      var fs = btn.getAttribute("data-font-style");
      btn.classList.toggle("is-active", fs === state.fontStyle);
    });

    // 更新字体颜色选中态
    body.querySelectorAll("[data-font-color]").forEach(function (btn) {
      var fc = btn.getAttribute("data-font-color");
      btn.classList.toggle("is-active", fc === state.fontColor);
    });

    // 若自定义图刚上传，需要重建一次以显示自定义卡位和清除按钮
    var hasCustomSlot = !!body.querySelector('[data-preset="custom"]');
    if (state.customUrl && !hasCustomSlot) {
      renderManager();
    }
    if (!state.customUrl && hasCustomSlot) {
      renderManager();
    }
  }

  function openManager() {
    buildSheet();
    requestAnimationFrame(function () {
      overlayEl.classList.add("is-open");
      sheetEl.classList.add("is-open");
    });
  }
  function closeManager() {
    if (!sheetEl) return;
    overlayEl.classList.remove("is-open");
    sheetEl.classList.remove("is-open");
  }

  /* ---------- 初始化 ---------- */
  function init() {
    el.image = document.querySelector(".bg-image");
    load();
    apply();
    applyFontColor();
    applyFontStyle();
  }

  return {
    init: init,
    openManager: openManager,
    closeManager: closeManager,
    setPreset: setPreset,
    upload: upload,
    setFontStyle: setFontStyle,
    setFontColor: setFontColor,
    applyFontColor: applyFontColor,
    applyFontStyle: applyFontStyle,
    getState: function () { return Object.assign({}, state); }
  };
})();
