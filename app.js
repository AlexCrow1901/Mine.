/* ========================================================================
   Mine · 应用主逻辑
   ------------------------------------------------------------------------
   · 应用注册表（图标 / 标签 / 行为）—— 后续扩展直接在此追加
   · 主屏图标网格 + Dock 渲染
   · 状态栏时钟 / 信号 / 电池
   · 页面切换（Home ↔ 详情占位页）
   · 预留扩展：APP.page() 钩子，供后续聊天 / API / MCP 接入
   ======================================================================== */

(function () {
  "use strict";

  /* ---------------- 应用注册表 ----------------
     page: 跳转到同名占位页；action:'background' 打开背景管理。
     后续新增功能：在此添加条目，并实现对应 page 钩子即可。 */
  var APPS = [
    { id: "chat",       icon: "chat",       label: "聊天" },
    { id: "contacts",   icon: "contacts",   label: "通讯录" },
    { id: "companion",  icon: "discover",   label: "陪伴" },
    { id: "moments",    icon: "moments",    label: "朋友圈" },
    { id: "files",      icon: "files",      label: "文件" },
    { id: "background", icon: "background", label: "背景", accent: true, action: "background" },
    { id: "settings",   icon: "settings",   label: "设置" },
    { id: "weather",    icon: "weather",    label: "天气" }
  ];

  var DOCK = [
    { id: "phone",   icon: "phone",   label: "电话" },
    { id: "chat",    icon: "chat",    label: "聊天" },
    { id: "browser", icon: "browser", label: "浏览" },
    { id: "me",      icon: "me",      label: "我" }
  ];

  /* ---------------- 占位页文案（后续替换为真实功能） ----------------
     contacts 已由 contacts.js 通过 MineApp.page 钩子接管，下方仅作兜底。
     chat 已由 chat.js 通过 MineApp.page 钩子接管，下方仅作兜底。 */
  var PLACEHOLDER = {
    chat:     { title: "聊天",   icon: "chat",     desc: "聊天模块加载中…" },
    contacts: { title: "通讯录", icon: "contacts", desc: "联系人系统加载中…" },
    discover: { title: "陪伴",   icon: "discover", desc: "陪伴页正在酝酿之中。" },
    companion: { title: "陪伴",  icon: "discover", desc: "陪伴页正在酝酿之中。" },
    moments:  { title: "朋友圈", icon: "moments",  desc: "动态广场待开放。" },
    files:    { title: "文件",   icon: "files",    desc: "文件管理尚未启用。" },
    settings: { title: "设置",   icon: "settings", desc: "设置项将在后续版本完善。" },
    weather:  { title: "天气",   icon: "weather",  desc: "雾都今日：浓雾，湿冷。\n能见度低，注意脚下石板路。" },
    phone:    { title: "电话",   icon: "phone",    desc: "通话功能未接入。" },
    browser:  { title: "浏览",   icon: "browser",  desc: "浏览器尚未启用。" },
    me:       { title: "我",     icon: "me",       desc: "个人中心建设中。" }
  };

  /* ---------------- 公共扩展命名空间 ----------------
     后续模块可挂载：APP.page = function(id){ ... }  返回 true 表示已处理 */
  var APP = window.MineApp = window.MineApp || {};

  /* ---------------- DOM 引用 ---------------- */
  var dom = {};

  /* ---------------- 渲染主屏图标 ---------------- */
  function cellHTML(app) {
    var accent = app.accent ? " accent" : "";
    var badge = window.MineNotify ? MineNotify.badgeHTML(app.id) : "";
    return '<div class="app-cell" role="button" tabindex="0" data-app="' + app.id + '">' +
      '<div class="app-icon' + accent + '">' + window.MineIcons.svg(app.icon, 28) + '</div>' + badge +
      '<span class="app-label">' + app.label + '</span>' +
      '</div>';
  }
  function dockCellHTML(app) {
    var badge = window.MineNotify ? MineNotify.badgeHTML(app.id) : "";
    return '<div class="app-cell" role="button" tabindex="0" data-app="' + app.id + '">' +
      '<div class="app-icon">' + window.MineIcons.svg(app.icon, 25) + '</div>' + badge +
      '</div>';
  }

  function renderHome() {
    dom.grid.innerHTML = APPS.map(cellHTML).join("");
    dom.dock.innerHTML = DOCK.map(dockCellHTML).join("");

    // 绑定点击
    document.querySelectorAll(".app-cell").forEach(function (cell) {
      cell.addEventListener("click", function () { onAppTap(cell.getAttribute("data-app")); });
      cell.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAppTap(cell.getAttribute("data-app")); }
      });
    });
  }

  /* ---------------- 应用点击 ---------------- */
  function onAppTap(appId) {
    var app = findApp(appId);
    if (!app) return;
    if (app.action === "background") {
      window.MineBackground.openManager();
      return;
    }
    // 标记已查看该应用的通知
    if (window.MineNotify) MineNotify.markSeen(appId);
    // 预留钩子：若已注册真实页面逻辑则调用
    if (typeof APP.page === "function" && APP.page(appId) === true) return;
    openPlaceholder(appId);
  }

  function findApp(id) {
    var all = APPS.concat(DOCK);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* ---------------- 详情占位页 ---------------- */
  function openPlaceholder(appId) {
    var info = PLACEHOLDER[appId] || { title: appId, icon: "eye", desc: "敬请期待。" };
    var navBar =
      '<div class="nav-bar">' +
        '<button class="nav-btn" data-act="back">' + window.MineIcons.svg("back", 20) + '返回</button>' +
        '<span class="nav-title">' + info.title + '</span>' +
        '<span class="nav-right"></span>' +
      '</div>';
    var desc = info.desc.replace(/\n/g, "<br>");
    var body =
      '<div class="scroll"><div class="empty-state">' +
        '<div class="empty-icon">' + window.MineIcons.svg(info.icon, 30) + '</div>' +
        '<div class="empty-title">' + info.title + '</div>' +
        '<div class="empty-desc">' + desc + '</div>' +
      '</div></div>';

    dom.detail.innerHTML = navBar + body;
    dom.detail.querySelector('[data-act="back"]').addEventListener("click", goHome);
    switchPage("detail");
  }

  function goHome() { switchPage("home"); }

  /* ---------------- 页面切换 ---------------- */
  function switchPage(name) {
    document.querySelectorAll(".page").forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-page") === name);
    });
  }

  /* ---------------- 状态栏时钟 ---------------- */
  function updateClock() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    dom.time.textContent = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function updateGreeting() {
    var now = new Date();
    var week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
    var hello;
    var h = now.getHours();
    if (h < 6) hello = "深夜安";
    else if (h < 11) hello = "早安";
    else if (h < 14) hello = "午安";
    else if (h < 18) hello = "午后好";
    else if (h < 22) hello = "晚安";
    else hello = "夜深了";
    if (dom.hello) {
      // 读取"我"的昵称，回退到"雾客"
      var myName = "雾客";
      try {
        var raw = localStorage.getItem("mine.me.v1");
        if (raw) {
          var me = JSON.parse(raw);
          if (me && me.name) myName = me.name;
        }
      } catch (e) {}
      dom.hello.textContent = hello + "，" + myName;
    }
    if (dom.date) dom.date.textContent =
      (now.getMonth() + 1) + "月" + now.getDate() + "日 · " + week;
  }

  /* ---------------- 长按主屏呼出背景管理 ---------------- */
  function bindLongPress() {
    var timer = null;
    var grid = dom.gridWrap;
    function start(e) {
      timer = setTimeout(function () {
        window.MineBackground.openManager();
        timer = null;
      }, 650);
    }
    function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
    grid.addEventListener("touchstart", start, { passive: true });
    grid.addEventListener("touchend", cancel);
    grid.addEventListener("touchmove", cancel, { passive: true });
    grid.addEventListener("mousedown", start);
    grid.addEventListener("mouseup", cancel);
    grid.addEventListener("mouseleave", cancel);
    grid.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    dom.grid = document.getElementById("app-grid");
    dom.dock = document.getElementById("dock-inner");
    dom.gridWrap = document.querySelector(".app-grid-wrap");
    dom.detail = document.getElementById("page-detail");
    dom.time = document.getElementById("status-time");
    dom.hello = document.querySelector(".greeting .hello");
    dom.date = document.querySelector(".greeting .date");

    renderHome();
    updateClock();
    updateGreeting();
    bindLongPress();

    setInterval(updateClock, 20000);
    setInterval(updateGreeting, 60000);

    // 背景管理器初始化
    if (window.MineBackground) window.MineBackground.init();
    // 个人中心初始化
    if (window.MineProfile) window.MineProfile.init();
    // 次元信箱初始化
    if (window.MineMail) window.MineMail.init();
    // 深夜树洞初始化（启动定期检查器，处理待回复问卷）
    if (window.MineTreeHole) window.MineTreeHole.init();

    // ===== 注册 MineNotify provider =====
    if (window.MineNotify) {
      // chat provider 已在 chat.js 中注册

      // moments provider：基于时间戳统计新互动数
      if (window.MineMoments) {
        MineNotify.register("moments", function () {
          return MineMoments.getUnreadCount();
        });
      }

      // companion 聚合 provider：次元信箱 + 深夜树洞的未读总数
      // 不注册 onSeen 回调：用户打开陪伴页时不清除未读，
      // 角标保留到用户点进具体子应用（time-mailbox / night-whispers）才清除
      if (window.MineMail || window.MineTreeHole) {
        MineNotify.register("companion",
          function () {
            var count = 0;
            if (window.MineMail) count += MineMail.getUnreadCount();
            if (window.MineTreeHole) count += MineTreeHole.getUnreadCount();
            return count;
          }
        );
      }

      // 陪伴页子卡片单独 provider（卡片角标）
      if (window.MineMail) {
        MineNotify.register("time-mailbox",
          function () { return MineMail.getUnreadCount(); },
          function () { MineMail.clearUnread(); }
        );
      }
      if (window.MineTreeHole) {
        MineNotify.register("night-whispers",
          function () { return MineTreeHole.getUnreadCount(); },
          function () { MineTreeHole.clearUnread(); }
        );
      }

      // 初始刷新角标
      MineNotify.refreshBadges();
    }
  }

  /* ---------------- 公共方法 ---------------- */
  APP.goHome = goHome;
  APP.switchPage = switchPage;
  APP.openPlaceholder = openPlaceholder;
  APP.refreshGreeting = updateGreeting;

  // 个人中心页面钩子（链式：保存前一个 page handler）
  var prevPage = APP.page;
  APP.page = function (id) {
    if (id === "me" && window.MineProfile) {
      MineProfile.renderPage();
      switchPage("detail");
      return true;
    }
    return prevPage ? prevPage(id) : false;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
