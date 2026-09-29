/* ========================================================================
   Mine · 大容量存储增强（storage.js）
   ------------------------------------------------------------------------
   仓库原文件中此文件缺失，此处提供一份兼容实现：
   · 保持 localStorage 的同步 API（getItem / setItem / removeItem / clear）
   · 底层额外写入 IndexedDB，突破浏览器 5MB 配额限制（图片字卡 / 聊天背景等）
   · 原生 localStorage 作为"降级镜像"：写入尽力同步（超配额时静默），
     删除 storage.js 后原有数据仍保留在原生 localStorage 中
   · 首次加载同步用原生数据种子化缓存 → 兼容历史数据（升级不丢数据）
   · 异步从 IndexedDB 恢复后，以 IndexedDB 中更新版本的键覆盖缓存
   注意：必须在其它脚本之前加载（见 index.html）。
   ======================================================================== */

(function () {
  "use strict";

  if (window.__mineStorageInstalled) return;
  window.__mineStorageInstalled = true;

  var DB_NAME = "mine-storage";
  var DB_VER = 1;
  var STORE = "kv";

  function openDB(cb) {
    var req;
    try { req = indexedDB.open(DB_NAME, DB_VER); }
    catch (e) { cb(null); return; }
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = function () { cb(req.result); };
    req.onerror = function () { cb(null); };
  }

  function dbGetAll(db, cb) {
    try {
      var tx = db.transaction(STORE, "readonly");
      var req = tx.objectStore(STORE).getAll();
      req.onsuccess = function () { cb(req.result || []); };
      req.onerror = function () { cb([]); };
    } catch (e) { cb([]); }
  }

  function dbPutAll(db, entries, cb) {
    try {
      var tx = db.transaction(STORE, "readwrite");
      var store = tx.objectStore(STORE);
      entries.forEach(function (e) { store.put(e.value, e.key); });
      tx.oncomplete = function () { if (cb) cb(); };
      tx.onerror = function () { if (cb) cb(); };
    } catch (e) { if (cb) cb(); }
  }

  /* ---- 同步缓存：先用原生 localStorage 种子化（升级兼容） ---- */
  var cache = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k != null) cache[k] = localStorage.getItem(k);
    }
  } catch (e) {}

  /* ---- 异步持久化到 IndexedDB（防抖） ---- */
  var persistPending = false;
  function schedulePersist() {
    if (persistPending) return;
    persistPending = true;
    setTimeout(function () {
      persistPending = false;
      openDB(function (db) {
        if (!db) return;
        var entries = [];
        for (var key in cache) entries.push({ key: key, value: cache[key] });
        dbPutAll(db, entries);
      });
    }, 300);
  }

  /* ---- 原生 localStorage 镜像（尽力而为，配额不足静默） ---- */
  function mirrorNative(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* 超配额：交给 IndexedDB 兜底 */ }
  }

  var store = {
    get length() { return Object.keys(cache).length; },
    key: function (i) { return Object.keys(cache)[i] || null; },
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
    },
    setItem: function (key, value) {
      key = String(key);
      value = String(value);
      cache[key] = value;
      mirrorNative(key, value);
      schedulePersist();
    },
    removeItem: function (key) {
      key = String(key);
      delete cache[key];
      mirrorNative(key, null);
      schedulePersist();
    },
    clear: function () {
      cache = {};
      try { localStorage.clear(); } catch (e) {}
      schedulePersist();
    }
  };

  /* ---- 从 IndexedDB 恢复（较新的键覆盖缓存），完成后触发事件 ---- */
  openDB(function (db) {
    if (!db) return;
    dbGetAll(db, function (entries) {
      entries.forEach(function (e) {
        if (e && e.key != null) {
          if (cache[e.key] !== e.value) cache[e.key] = e.value;
          try { localStorage.setItem(e.key, e.value); } catch (err) {}
        }
      });
      var all = [];
      for (var key in cache) all.push({ key: key, value: cache[key] });
      dbPutAll(db, all);
      try { window.dispatchEvent(new Event("mine:storage-hydrated")); } catch (e) {}
    });
  });

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: function () { return store; }
  });
})();
