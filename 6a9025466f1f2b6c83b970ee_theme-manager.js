/* ========================================================================
   Mine · 主题管理器 + 小组件系统
   ------------------------------------------------------------------------
   功能：
   · 主题切换（支持后期扩展更多主题）
   · 主题选择面板
   · 小组件弹窗（添加小组件）
   · 编辑模式（拖拽排列、删除组件）
   · 时钟组件实时更新
   · Hero 卡片读取用户资料
   ------------------------------------------------------------------------
   对外 API：MineTheme.switch(name) / getTheme() / registerTheme()
   ======================================================================== */

window.MineTheme = (function () {
  "use strict";

  /* ====== 主题注册表（后期扩展在此追加） ======
     每个主题需要：
     · key:  唯一标识
     · name: 显示名称
     · desc: 描述
     · bodyClass: 激活时添加到 body 的 class（默认主题留空）
     · swatchClass: 色板预览的 CSS class
  */
  var THEMES = [
    {
      key: "fog",
      name: "伦敦雾都",
      desc: "炭黑冷调 · 维多利亚阴郁美学",
      bodyClass: "",
      swatchClass: "fog"
    },
    {
      key: "neumorphism",
      name: "奶油软拟态",
      desc: "暖奶油米白 · 柔和双重软阴影",
      bodyClass: "theme-neumorphism",
      swatchClass: "neumorphism"
    }
    /* ---- 后续新增主题示例 ----
    {
      key: "ocean",
      name: "深海蓝",
      desc: "深海渐变 · 冷调波纹",
      bodyClass: "theme-ocean",
      swatchClass: "ocean"
    }
    */
  ];

  var STORAGE_KEY = "mine.theme.v1";
  var currentTheme = "fog";
  var dom = {};

  /* ====== 工具函数 ====== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return (root || document).querySelectorAll(sel); }

  /* ====== 获取当前主题 ====== */
  function getTheme() { return currentTheme; }

  /* ====== 注册新主题（运行时动态添加） ====== */
  function registerTheme(theme) {
    if (!theme || !theme.key) return;
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].key === theme.key) { THEMES[i] = theme; return; }
    }
    THEMES.push(theme);
  }

  /* ====== 切换主题 ====== */
  function switchTheme(key) {
    var theme = null;
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].key === key) { theme = THEMES[i]; break; }
    }
    if (!theme) return;

    /* 移除所有主题 class */
    for (var j = 0; j < THEMES.length; j++) {
      if (THEMES[j].bodyClass) {
        document.body.classList.remove(THEMES[j].bodyClass);
      }
    }
    /* 添加新主题 class */
    if (theme.bodyClass) {
      document.body.classList.add(theme.bodyClass);
    }
    currentTheme = key;

    /* 持久化 */
    try { localStorage.setItem(STORAGE_KEY, key); } catch (e) {}

    /* 更新面板选中状态 */
    updateThemePanelSelection();

    /* 如果是新拟态主题，渲染首页组件 */
    if (key === "neumorphism") {
      renderNeuHome();
    }

    /* 触发主题切换回调 */
    if (typeof onThemeChange === "function") onThemeChange(key);
  }

  var onThemeChange = null;

  /* ====== 加载保存的主题 ====== */
  function loadTheme() {
    var saved = "fog";
    try { saved = localStorage.getItem(STORAGE_KEY) || "fog"; } catch (e) {}
    switchTheme(saved);
  }

  /* ====== 渲染新拟态首页组件 ====== */
  function renderNeuHome() {
    if (!dom.heroContainer) return;

    /* 读取用户资料 */
    var profile = { name: "雾客", avatar: null };
    try {
      var raw = localStorage.getItem("mine.me.v1");
      if (raw) {
        var me = JSON.parse(raw);
        if (me && me.name) profile.name = me.name;
        if (me && me.avatar) profile.avatar = me.avatar;
      }
    } catch (e) {}

    /* 渲染 Hero 卡片 */
    var avatarHTML = profile.avatar
      ? '<img src="' + escapeAttr(profile.avatar) + '" alt="">'
      : '<span style="font-family:var(--font-script);font-size:20px;color:var(--t-tertiary);">' +
        escapeHtml(firstChar(profile.name)) + '</span>';

    dom.heroContainer.innerHTML =
      '<div class="neu-delete-badge">×</div>' +
      '<div class="neu-hero-avatar">' + avatarHTML + '</div>' +
      '<div class="neu-hero-info">' +
        '<div class="neu-hero-name">' + escapeHtml(profile.name) + '</div>' +
        '<div class="neu-hero-subtitle">Lunar Wanderer</div>' +
        '<div class="neu-hero-quote">She walks with moonlight in her heart, and stars in her dreams.</div>' +
      '</div>';

    /* 渲染时钟 */
    updateNeuClock();
  }

  /* ====== 时钟更新 ====== */
  function updateNeuClock() {
    if (!dom.clockTime) return;
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    dom.clockTime.textContent = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;

    if (dom.clockDate) {
      var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                     "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      dom.clockDate.textContent =
        days[now.getDay()] + " · " + now.getDate() + " " + months[now.getMonth()];
    }
  }

  /* ====== 主题选择面板 ====== */
  function buildThemePanel() {
    if (dom.themePanel) return;

    var overlay = document.createElement("div");
    overlay.className = "neu-overlay theme-overlay";

    var panel = document.createElement("div");
    panel.className = "theme-panel";

    var swatchesHTML = THEMES.map(function (t) {
      return '<div class="theme-option' + (t.key === currentTheme ? " is-active" : "") +
             '" data-theme="' + t.key + '">' +
        '<div class="theme-swatch ' + t.swatchClass + '"></div>' +
        '<div class="theme-option-info">' +
          '<div class="theme-option-name">' + t.name + '</div>' +
          '<div class="theme-option-desc">' + t.desc + '</div>' +
        '</div>' +
      '</div>';
    }).join("");

    panel.innerHTML =
      '<div class="theme-panel-handle"></div>' +
      '<div class="theme-panel-head">' +
        '<h2>切换主题</h2>' +
        '<button class="theme-panel-close">×</button>' +
      '</div>' +
      '<div class="theme-panel-body">' + swatchesHTML + '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    dom.themeOverlay = overlay;
    dom.themePanel = panel;

    /* 绑定主题选项点击 */
    $all(".theme-option", panel).forEach(function (opt) {
      opt.addEventListener("click", function () {
        switchTheme(opt.getAttribute("data-theme"));
        closeThemePanel();
      });
    });

    /* 关闭按钮 */
    $(".theme-panel-close", panel).addEventListener("click", closeThemePanel);
    overlay.addEventListener("click", closeThemePanel);
  }

  function openThemePanel() {
    buildThemePanel();
    updateThemePanelSelection();
    dom.themeOverlay.classList.add("is-open");
    dom.themePanel.classList.add("is-open");
  }

  function closeThemePanel() {
    if (!dom.themePanel) return;
    dom.themeOverlay.classList.remove("is-open");
    dom.themePanel.classList.remove("is-open");
  }

  function updateThemePanelSelection() {
    if (!dom.themePanel) return;
    $all(".theme-option", dom.themePanel).forEach(function (opt) {
      opt.classList.toggle("is-active",
        opt.getAttribute("data-theme") === currentTheme);
    });
  }

  /* ====== 主题切换按钮 ====== */
  function buildSwitchButton() {
    if (dom.switchBtn) return;
    var btn = document.createElement("button");
    btn.className = "theme-switch-btn";
    btn.setAttribute("aria-label", "切换主题");
    btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>';
    btn.addEventListener("click", openThemePanel);
    document.body.appendChild(btn);
    dom.switchBtn = btn;
  }

  /* ====== 小组件弹窗 ====== */
  var WIDGETS = [
    { id: "moon-water", name: "月光水面", size: "4×1", icon: "moon" },
    { id: "night-lamp", name: "晚安小灯", size: "2×2", icon: "lamp" },
    { id: "date", name: "日期", size: "2×1", icon: "calendar" },
    { id: "memory", name: "回忆", size: "4×1", icon: "memory" },
    { id: "moon-phase", name: "月相", size: "4×2", icon: "moon" },
    { id: "rose", name: "玫瑰", size: "2×1", icon: "rose" }
  ];

  function buildWidgetPanel() {
    if (dom.widgetPanel) return;

    var overlay = document.createElement("div");
    overlay.className = "neu-overlay";

    var panel = document.createElement("div");
    panel.className = "neu-widget-panel";

    var itemsHTML = WIDGETS.map(function (w) {
      return '<div class="neu-widget-item">' +
        '<div class="neu-widget-preview">' + widgetIconHTML(w.icon) + '</div>' +
        '<div class="neu-widget-info">' +
          '<div class="neu-widget-name">' + w.name + '</div>' +
          '<div class="neu-widget-size">占' + w.size + '格</div>' +
        '</div>' +
        '<button class="neu-widget-add-btn" data-widget="' + w.id + '">添加</button>' +
      '</div>';
    }).join("");

    panel.innerHTML =
      '<div class="neu-panel-handle"></div>' +
      '<div class="neu-panel-head">' +
        '<span class="neu-panel-title">添加小组件</span>' +
        '<button class="neu-panel-close">×</button>' +
      '</div>' +
      '<div class="neu-panel-body">' + itemsHTML + '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    dom.widgetOverlay = overlay;
    dom.widgetPanel = panel;

    /* 关闭 */
    $(".neu-panel-close", panel).addEventListener("click", closeWidgetPanel);
    overlay.addEventListener("click", closeWidgetPanel);

    /* 添加按钮 */
    $all(".neu-widget-add-btn", panel).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var wid = btn.getAttribute("data-widget");
        addWidget(wid);
      });
    });
  }

  function openWidgetPanel() {
    buildWidgetPanel();
    dom.widgetOverlay.classList.add("is-open");
    dom.widgetPanel.classList.add("is-open");
  }

  function closeWidgetPanel() {
    if (!dom.widgetPanel) return;
    dom.widgetOverlay.classList.remove("is-open");
    dom.widgetPanel.classList.remove("is-open");
  }

  function addWidget(widgetId) {
    /* 简单反馈：关闭弹窗 */
    closeWidgetPanel();
    exitEditMode();
  }

  /* ====== 编辑模式 ====== */
  function enterEditMode() {
    document.body.classList.add("neu-edit-mode");
  }

  function exitEditMode() {
    document.body.classList.remove("neu-edit-mode");
  }

  function toggleEditMode() {
    document.body.classList.toggle("neu-edit-mode");
  }

  /* ====== 拖拽排序（触摸 + 鼠标） ====== */
  function initDragSort() {
    var containers = [".app-grid", ".neu-hero-row"];
    containers.forEach(function (sel) {
      var container = $(sel);
      if (!container) return;
      initContainerDrag(container);
    });
  }

  function initContainerDrag(container) {
    var dragEl = null;
    var isDragging = false;
    var startX = 0, startY = 0;

    container.addEventListener("touchstart", handleStart, { passive: true });
    container.addEventListener("touchmove", handleMove, { passive: false });
    container.addEventListener("touchend", handleEnd);
    container.addEventListener("mousedown", handleStart);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);

    function isEditMode() {
      return document.body.classList.contains("neu-edit-mode");
    }

    function handleStart(e) {
      if (!isEditMode()) return;
      var touch = e.touches ? e.touches[0] : e;
      var target = e.target;
      /* 找到可拖拽的卡片元素 */
      while (target && target !== container) {
        if (target.classList.contains("app-cell") ||
            target.classList.contains("neu-hero") ||
            target.classList.contains("neu-clock") ||
            target.classList.contains("neu-title-card")) {
          dragEl = target;
          break;
        }
        target = target.parentElement;
      }
      if (!dragEl) return;
      startX = touch.clientX;
      startY = touch.clientY;
      isDragging = false;
    }

    function handleMove(e) {
      if (!dragEl || !isEditMode()) return;
      var touch = e.touches ? e.touches[0] : e;
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        isDragging = true;
        dragEl.classList.add("neu-dragging");
        if (e.preventDefault) e.preventDefault();
      }
      if (isDragging && e.preventDefault) e.preventDefault();

      /* 检测拖拽目标位置 */
      if (isDragging) {
        var afterElement = getDragAfterElement(container, touch.clientY);
        if (afterElement == null) {
          container.appendChild(dragEl);
        } else if (afterElement !== dragEl) {
          container.insertBefore(dragEl, afterElement);
        }
      }
    }

    function handleEnd() {
      if (dragEl) {
        dragEl.classList.remove("neu-dragging");
        dragEl = null;
      }
      isDragging = false;
    }

    function getDragAfterElement(container, y) {
      var elements = $all(".app-cell, .neu-hero, .neu-clock, .neu-title-card", container);
      var closest = null;
      var closestOffset = -Infinity;
      elements.forEach(function (child) {
        if (child === dragEl) return;
        var box = child.getBoundingClientRect();
        var offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closestOffset) {
          closestOffset = offset;
          closest = child;
        }
      });
      return closest;
    }
  }

  /* ====== 辅助函数 ====== */
  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function firstChar(s) {
    s = String(s || "");
    return s.charAt(0) || "?";
  }

  function widgetIconHTML(name) {
    /* 简单的 SVG 占位图标 */
    var icons = {
      moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
      lamp: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5V15H8v-1.5A6 6 0 0 1 12 3z"/></svg>',
      calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
      memory: '<svg viewBox="0 0 24 24"><path d="M12 21c-5 0-9-4-9-9M21 12c0-5-4-9-9-9M12 3v9l6 3"/></svg>',
      rose: '<svg viewBox="0 0 24 24"><path d="M12 5c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5zM12 15v6M9 21h6"/></svg>'
    };
    return icons[name] || icons.moon;
  }

  /* ====== 注入新拟态首页 HTML ====== */
  function injectNeuHomeHTML() {
    var homePage = $('[data-page="home"]');
    if (!homePage || $("#neu-home-content")) return;

    var gridWrap = $(".app-grid-wrap", homePage);
    if (!gridWrap) return;

    /* 在 app-grid 前面插入新拟态首页组件 */
    var neuContent = document.createElement("div");
    neuContent.id = "neu-home-content";
    neuContent.style.cssText = "display:none;";
    neuContent.innerHTML =
      /* 编辑模式控制栏 */
      '<div class="neu-edit-bar">' +
        '<button class="neu-add-widget-btn">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;">' +
          '<path d="M12 5v14M5 12h14"/></svg>' +
          '添加小组件' +
        '</button>' +
        '<button class="neu-done-btn">完成</button>' +
      '</div>' +
      /* Hero 卡片 */
      '<div class="neu-hero" data-widget="hero">' +
        '<div class="neu-delete-badge">×</div>' +
        '<div class="neu-hero-avatar"></div>' +
        '<div class="neu-hero-info">' +
          '<div class="neu-hero-name"></div>' +
          '<div class="neu-hero-subtitle">Lunar Wanderer</div>' +
          '<div class="neu-hero-quote">She walks with moonlight in her heart, and stars in her dreams.</div>' +
        '</div>' +
      '</div>' +
      /* 时钟 + 标题行 */
      '<div class="neu-row">' +
        '<div class="neu-card neu-clock" data-widget="clock">' +
          '<div class="neu-delete-badge">×</div>' +
          '<div class="neu-clock-time">--:--</div>' +
          '<div class="neu-clock-date">---</div>' +
        '</div>' +
        '<div class="neu-card neu-title-card" data-widget="title">' +
          '<div class="neu-delete-badge">×</div>' +
          '<div class="neu-brand">MEMOIRE</div>' +
          '<div class="neu-title-main">A little moonlight</div>' +
          '<div class="neu-title-sub">Keep the pages that quietly changed you</div>' +
        '</div>' +
      '</div>' +
      /* 欢迎语 */
      '<div class="neu-welcome">WELCOME HOME</div>';

    gridWrap.insertBefore(neuContent, gridWrap.firstChild);

    /* 缓存 DOM 引用 */
    dom.heroContainer = $(".neu-hero", neuContent);
    dom.clockTime = $(".neu-clock-time", neuContent);
    dom.clockDate = $(".neu-clock-date", neuContent);

    /* 编辑模式按钮 */
    var addBtn = $(".neu-add-widget-btn", neuContent);
    var doneBtn = $(".neu-done-btn", neuContent);
    if (addBtn) addBtn.addEventListener("click", openWidgetPanel);
    if (doneBtn) doneBtn.addEventListener("click", exitEditMode);

    /* 删除按钮 */
    $all(".neu-delete-badge", neuContent).forEach(function (badge) {
      badge.addEventListener("click", function (e) {
        e.stopPropagation();
        var card = badge.parentElement;
        if (card) card.style.display = "none";
      });
    });

    /* 长按进入编辑模式 */
    var longPressTimer = null;
    neuContent.addEventListener("touchstart", function () {
      longPressTimer = setTimeout(function () {
        enterEditMode();
        longPressTimer = null;
      }, 650);
    }, { passive: true });
    neuContent.addEventListener("touchend", function () {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });
    neuContent.addEventListener("touchmove", function () {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }, { passive: true });
  }

  /* ====== 显示/隐藏新拟态首页组件 ====== */
  function showNeuHome(show) {
    var content = $("#neu-home-content");
    if (content) content.style.display = show ? "block" : "none";
    if (show) renderNeuHome();
  }

  /* ====== 初始化 ====== */
  function init() {
    /* 注入新拟态首页 HTML */
    injectNeuHomeHTML();

    /* 构建主题切换按钮 */
    buildSwitchButton();

    /* 加载保存的主题 */
    loadTheme();

    /* 初始化拖拽排序 */
    setTimeout(initDragSort, 500);

    /* 时钟定时更新 */
    updateNeuClock();
    setInterval(updateNeuClock, 10000);

    /* 当主题切换时，控制新拟态首页显示 */
    onThemeChange = function (key) {
      showNeuHome(key === "neumorphism");
      if (key === "neumorphism") {
        setTimeout(initDragSort, 300);
      }
    };

    /* 初始显示 */
    showNeuHome(currentTheme === "neumorphism");
  }

  /* ====== 公共 API ====== */
  return {
    init: init,
    switchTheme: switchTheme,
    getTheme: getTheme,
    registerTheme: registerTheme,
    enterEditMode: enterEditMode,
    exitEditMode: exitEditMode,
    toggleEditMode: toggleEditMode,
    openThemePanel: openThemePanel,
    closeThemePanel: closeThemePanel
  };
})();
