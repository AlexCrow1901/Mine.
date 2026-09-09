/* ========================================================================
   Mine · 背景图管理器
   ------------------------------------------------------------------------
   重点功能：自由更换背景图。
   · 预设：纯雾境 / 雾伦敦 / 雾林 / 铅灰 / 冷青 / 暮霭（CSS 渐变预设）
   · 上传：本地图片即时预览
   · 调节：雾色叠加 / 背景模糊 / 噪点强度
   · 持久化：localStorage（自定义图尽量以 dataURL 存储，超额则降级为会话级）
   ======================================================================== */

window.MineBackground = (function () {
  "use strict";

  var ASSET = "assets/";
  var STORE_KEY = "mine.bg.v1";

  // 预设列表
  var PRESETS = [
    { id: "none",   name: "雾境",   type: "none" },
    { id: "london", name: "雾伦敦", type: "image", value: ASSET + "bg-london.jpg",
      thumb: ASSET + "bg-london.jpg" },
    { id: "forest", name: "雾林",   type: "image", value: ASSET + "bg-forest.jpg",
      thumb: ASSET + "bg-forest.jpg" },
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
    preset: "london",
    customUrl: null,        // 自定义图（dataURL 或 objectURL）
    customType: "image",
    fogTint: 0.34,
    blur: 0,                // 背景图自身模糊 px
    noise: 0.12
  };

  var el = {};              // 背景层 DOM
  var sheetEl = null;       // 管理面板
  var overlayEl = null;

  /* ---------- 持久化 ---------- */
  function save() {
    try {
      var data = {
        preset: state.preset,
        fogTint: state.fogTint,
        blur: state.blur,
        noise: state.noise,
        customUrl: state.customUrl
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
      state.preset = data.preset || state.preset;
      state.fogTint = (typeof data.fogTint === "number") ? data.fogTint : state.fogTint;
      state.blur = (typeof data.blur === "number") ? data.blur : state.blur;
      state.noise = (typeof data.noise === "number") ? data.noise : state.noise;
      state.customUrl = data.customUrl || null;
    } catch (e) {}
  }

  /* ---------- 应用到背景层 ---------- */
  function apply() {
    var bg = el.image, tint = el.fogTint, noise = el.noise;

    // 噪点
    if (noise) noise.style.opacity = state.noise;

    // 雾色叠加：仅在非"雾境"时显示
    var showTint = state.preset !== "none";
    tint.style.opacity = showTint ? "1" : "0";
    document.documentElement.style.setProperty("--fog-tint", state.fogTint);

    // 背景图 / 渐变
    var p = presetById(state.preset);
    var url = (state.preset === "custom" && state.customUrl) ? state.customUrl
            : (p && p.type === "image") ? p.value
            : (p && p.type === "gradient") ? p.value : null;

    if (url) {
      bg.style.backgroundImage = "url('" + url + "')";
      if (p && p.type === "gradient") {
        // 渐变预设直接作为背景图
        bg.style.backgroundImage = p.value;
        bg.classList.remove("is-img");
      } else {
        bg.classList.add("is-img");
      }
      bg.classList.add("is-active");
      // 模糊：放大避免边缘透出
      bg.style.filter = state.blur > 0
        ? "blur(" + state.blur + "px)"
        : "none";
      bg.style.transform = state.blur > 0 ? "scale(1.12)" : "scale(1)";
    } else {
      bg.classList.remove("is-active");
      bg.style.backgroundImage = "none";
      bg.style.filter = "none";
    }
    save();
    syncManagerUI();
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
  function setFogTint(v) { state.fogTint = v; apply(); }
  function setBlur(v) { state.blur = v; apply(); }
  function setNoise(v) { state.noise = v; apply(); }

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

    // 调节滑块
    var slidersHtml =
      '<div class="section-label">氛围调节</div>' +
      sliderRow("fogTint", "雾色叠加", state.fogTint, 0, 0.8, 0.01) +
      sliderRow("blur", "背景模糊", state.blur, 0, 20, 1) +
      sliderRow("noise", "雾霭噪点", state.noise, 0, 0.25, 0.01);

    body.innerHTML = presetsHtml + uploadHtml + slidersHtml;

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

    body.querySelectorAll("input.slider").forEach(function (input) {
      input.addEventListener("input", function () {
        var key = this.getAttribute("data-key");
        var v = parseFloat(this.value);
        if (key === "fogTint") setFogTint(v);
        else if (key === "blur") setBlur(v);
        else if (key === "noise") setNoise(v);
        var valEl = this.closest(".slider-block").querySelector(".slider-val");
        if (valEl) valEl.textContent = Math.round(v * (key === "blur" ? 1 : 100)) + (key === "blur" ? "px" : "%");
      });
    });
  }

  function sliderRow(key, name, val, min, max, step) {
    var display = key === "blur"
      ? Math.round(val) + "px"
      : Math.round(val * 100) + "%";
    return '<div class="slider-block">' +
      '<div class="slider-row"><span class="slider-name">' + name + '</span>' +
      '<span class="slider-val">' + display + '</span></div>' +
      '<input type="range" class="slider" data-key="' + key + '" min="' + min +
      '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
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
    el.fogTint = document.querySelector(".bg-fog-tint");
    el.noise = document.querySelector(".bg-noise");
    load();
    apply();
  }

  return {
    init: init,
    openManager: openManager,
    closeManager: closeManager,
    setPreset: setPreset,
    upload: upload,
    setFogTint: setFogTint,
    setBlur: setBlur,
    setNoise: setNoise,
    getState: function () { return Object.assign({}, state); }
  };
})();
