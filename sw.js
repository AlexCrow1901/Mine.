/* ========================================================================
   Mine · Service Worker (v2)
   ------------------------------------------------------------------------
   作用（参考 mochi 方案）：
   1. 后台通知通道：页面 JS 被系统冻结 / 手机锁屏时，仍可用
      registration.showNotification() 弹出系统通知；
      通知被点击时唤醒页面并转发"打开哪个会话"。
   2. 完整离线缓存：安装时预缓存全部核心资源（HTML/CSS/JS/图标/manifest），
      网络优先，失败回退缓存 —— 首次打开后离线/弱网可完整使用。
   说明：通知是否弹出仍受浏览器通知权限 + 手机系统通知设置控制。
   版本：v2（缓存名含版本，升级时浏览器自动更新）
   ======================================================================== */
var CACHE_NAME = "mine-cache-v2";

/* 核心资源全量预缓存（版本号与 index.html 中的 ?vN 保持一致；
   版本升级时同步更新本列表，确保离线时拉到的都是最新文件） */
var CORE_ASSETS = [
  "./",
  "./index.html",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "theme.css?v6",
  "base.css?v7",
  "home.css?v6",
  "components.css?v7",
  "contacts.css?v9",
  "chat.css?v30",
  "companion.css?v2",
  "profile.css?v1",
  "mail.css?v4",
  "treehole.css?v4",
  "radio.css?v2",
  "foodie.css?v3",
  "moments.css?v2",
  "contact-moments.css?v2",
  "phone.css?v1",
  "notify.css?v1",
  "theme-neumorphism.css?v2",
  "storage.js?v3",
  "utils.js?v8",
  "notify.js?v1",
  "keepalive.js?v3",
  "settings.js?v6",
  "icons.js?v16",
  "background.js?v9",
  "contacts.js?v20",
  "chat.js?v41",
  "phone.js?v1",
  "companion.js?v7",
  "profile.js?v6",
  "mail.js?v10",
  "treehole.js?v6",
  "radio.js?v2",
  "foodie.js?v3",
  "moments.js?v3",
  "contact-moments.js?v1",
  "theme-manager.js?v2",
  "files.js?v1",
  "app.js?v10",
  "sw.js"
];

/* ---------------- 安装：跳过等待 + 预缓存全部核心资源 ---------------- */
self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) {
      return c.addAll(CORE_ASSETS).catch(function () {});
    })
  );
});

/* ---------------- 激活：清理旧缓存 ---------------- */
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ---------------- 消息：外部触发刷新缓存 ---------------- */
self.addEventListener("message", function (e) {
  var data = e.data || {};
  if (data.type === "PRECACHE_NOW") {
    e.waitUntil(
      caches.open(CACHE_NAME).then(function (c) {
        return c.addAll(CORE_ASSETS).catch(function () {});
      })
    );
  }
});

/* ---------------- 请求：网络优先，超时/失败回退缓存 ----------------
   version.json / notice.json 不拦截，保证版本检测真实 */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = e.request.url;
  if (url.indexOf("version.json") >= 0 || url.indexOf("notice.json") >= 0) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      // 同源 GET 成功 → 写缓存（stale-while-revalidate 风格）
      if (res && res.ok && url.indexOf(self.location.origin) === 0) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) {
          try { c.put(e.request, copy); } catch (err) {}
        });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        if (hit) return hit;
        /* query 版本不同导致未命中时，去掉 query 再试一次 */
        var noQuery = e.request.url.split("?")[0];
        return caches.match(noQuery).then(function (hit2) {
          if (hit2) return hit2;
          return caches.match("./");
        });
      });
    })
  );
});

/* ---------------- 通知点击：唤醒页面并跳转到对应会话 ----------------
   页面在后台时点击通知 → 找到已打开的窗口 focus 并 postMessage；
   页面已被系统杀掉 → openWindow 重新打开。 */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var data = e.notification.data || {};
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if ("focus" in client) {
          client.focus();
          try {
            client.postMessage({
              type: "mine:notify-click",
              convKey: data.convKey || null,
              kind: data.kind || "msg"
            });
          } catch (err) {}
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
      return null;
    })
  );
});
