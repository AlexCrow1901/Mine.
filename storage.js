/* ========================================================================
   Mine · 统一存储层（IndexedDB + localStorage 混合存储）
   ------------------------------------------------------------------------
   功能：
   · 拦截 localStorage 的 getItem/setItem/removeItem，底层改用 IndexedDB
   · IndexedDB 容量远大于 localStorage（50MB+ vs 5MB），大幅提升存储上限
   · 内存缓存保证同步读取，IndexedDB 异步写入（防抖）
   · 自动迁移 localStorage 旧数据到 IndexedDB
   · localStorage 作为小数据的即时回退（IndexedDB 加载前可用）
   · 大数据（图片等）仅存 IndexedDB，不挤占 localStorage 配额
   对外 API：MineStore.getUsage() / onReady() / clearByKeys() / getAllKeys()
   ========================================================================
   安全设计：
   · 不使用 "use strict"——防止某些手机浏览器中 localStorage 属性赋值抛 TypeError
   · 所有 localStorage 覆写包裹在 try/catch 中——任一失败立即回滚全部
   · 全有或全无——不会出现部分覆写导致 getItem/setItem 不一致
   · 即使覆写完全失败，MineStore API 仍可独立工作，不影响页面
   ======================================================================== */

window.MineStore = (function () {
  /* 不使用 "use strict"：某些手机 WebView 中 localStorage 是不可扩展对象，
     严格模式下赋值会抛 TypeError 导致整个脚本崩溃，页面白屏 */

  var DB_NAME = "MineStorage";
  var DB_STORE = "kv";
  var DB_VERSION = 1;
  var db = null;
  var useDB = false;

  var cache = {};
  var idbKeySet = {};

  var ready = false;
  var readyCallbacks = [];

  var pendingWrites = {};
  var writeTimer = null;
  var WRITE_DEBOUNCE_MS = 300;

  var origGetItem = localStorage.getItem.bind(localStorage);
  var origSetItem = localStorage.setItem.bind(localStorage);
  var origRemoveItem = localStorage.removeItem.bind(localStorage);
  var origClear = localStorage.clear.bind(localStorage);
  var origKey = localStorage.key.bind(localStorage);

  function getOrigLength() {
    var count = 0;
    while (origKey(count) !== null) {
      count++;
      if (count > 100000) break;
    }
    return count;
  }

  function initDB() {
    try {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (e) {
        var database = e.target.result;
        if (!database.objectStoreNames.contains(DB_STORE)) {
          database.createObjectStore(DB_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = function (e) {
        db = e.target.result;
        useDB = true;
        loadAllFromDB();
      };
      request.onerror = function () {
        useDB = false;
        markReady();
      };
    } catch (e) {
      useDB = false;
      markReady();
    }
  }

  function loadAllFromDB() {
    if (!db) { markReady(); return; }
    try {
      var tx = db.transaction(DB_STORE, "readonly");
      var store = tx.objectStore(DB_STORE);
      var req = store.getAll();
      req.onsuccess = function () {
        var items = req.result || [];
        items.forEach(function (item) {
          if (item.key !== undefined) {
            cache[item.key] = item.value;
            idbKeySet[item.key] = true;
          }
        });
        migrateToDB();
        markReady();
      };
      req.onerror = function () { markReady(); };
    } catch (e) { markReady(); }
  }

  function migrateToDB() {
    if (!db) return;
    try {
      var tx = db.transaction(DB_STORE, "readwrite");
      var store = tx.objectStore(DB_STORE);
      var len = getOrigLength();
      for (var i = 0; i < len; i++) {
        var key = origKey(i);
        if (key && !idbKeySet[key]) {
          var value = origGetItem(key);
          if (value !== null) {
            store.put({ key: key, value: value });
            idbKeySet[key] = true;
          }
        }
      }
    } catch (e) {}
  }

  function markReady() {
    ready = true;
    var cbs = readyCallbacks;
    readyCallbacks = [];
    cbs.forEach(function (cb) { try { cb(); } catch (e) {} });
  }

  function queueWrite(key, value) {
    if (!useDB || !db) return;
    pendingWrites[key] = value;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(flushWrites, WRITE_DEBOUNCE_MS);
  }

  function flushWrites() {
    writeTimer = null;
    if (!db || !useDB) return;
    var writes = pendingWrites;
    pendingWrites = {};
    var keys = Object.keys(writes);
    if (keys.length === 0) return;
    try {
      var tx = db.transaction(DB_STORE, "readwrite");
      var store = tx.objectStore(DB_STORE);
      keys.forEach(function (key) {
        store.put({ key: key, value: writes[key] });
        idbKeySet[key] = true;
      });
    } catch (e) {
      try {
        var tx2 = db.transaction(DB_STORE, "readwrite");
        var store2 = tx2.objectStore(DB_STORE);
        keys.forEach(function (key) { store2.put({ key: key, value: writes[key] }); });
      } catch (e2) {}
    }
  }

  function removeFromDB(key) {
    if (!db || !useDB) return;
    delete idbKeySet[key];
    try {
      var tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(key);
    } catch (e) {}
  }

  function clearDB() {
    if (!db || !useDB) return;
    idbKeySet = {};
    try {
      var tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).clear();
    } catch (e) {}
  }

  /* ---- localStorage 覆写（全有或全无） ---- */
  function newGetItem(key) {
    if (cache[key] !== undefined) return cache[key];
    return origGetItem(key);
  }
  function newSetItem(key, value) {
    if (typeof value !== "string") value = String(value);
    cache[key] = value;
    queueWrite(key, value);
    if (value.length < 131072) { try { origSetItem(key, value); } catch (e) {} }
  }
  function newRemoveItem(key) {
    delete cache[key];
    removeFromDB(key);
    try { origRemoveItem(key); } catch (e) {}
  }
  function newClear() {
    cache = {};
    clearDB();
    try { origClear(); } catch (e) {}
  }
  function getAllKeysInternal() {
    var keySet = {};
    var len = getOrigLength();
    for (var i = 0; i < len; i++) { var k = origKey(i); if (k) keySet[k] = true; }
    Object.keys(idbKeySet).forEach(function (k) { keySet[k] = true; });
    Object.keys(cache).forEach(function (k) { keySet[k] = true; });
    return Object.keys(keySet);
  }
  function newKey(index) {
    var keys = getAllKeysInternal();
    if (index >= 0 && index < keys.length) return keys[index];
    return null;
  }
  function newLengthGetter() { return getAllKeysInternal().length; }

  var overrideOK = false;
  try {
    localStorage.getItem = newGetItem;
    localStorage.setItem = newSetItem;
    localStorage.removeItem = newRemoveItem;
    localStorage.clear = newClear;
    try { Object.defineProperty(localStorage, "length", { get: newLengthGetter, configurable: true }); } catch (e) {}
    localStorage.key = newKey;
    overrideOK = true;
  } catch (e) {
    try { localStorage.getItem = origGetItem; } catch (e2) {}
    try { localStorage.setItem = origSetItem; } catch (e2) {}
    try { localStorage.removeItem = origRemoveItem; } catch (e2) {}
    try { localStorage.clear = origClear; } catch (e2) {}
    try { localStorage.key = origKey; } catch (e2) {}
    overrideOK = false;
  }

  function getUsage() {
    var moduleKeys = {
      "聊天": ["mine.chat.v1","mine.chat.unread.v1","mine.chat.bg.v1","mine.chat.fontColor.v1","mine.chat.choices.v1","mine.chat.activeMsg.v1"],
      "信件": ["mine.mail.v1","mine.mail.pending.v1","mine.mail.active.v1","mine.mail.activecheck.v1"],
      "树洞": ["mine.treehole.v2","mine.treehole.verify.v1","mine.treehole.pending.v2","mine.treehole.templates.v1","mine.treehole.seenCount.v1"],
      "朋友圈": ["mine.moments.v1","mine.moments.cover","mine.moments.contactInteractions"],
      "联系人": ["mine.contacts.v1","mine.contacts.lastShuffle"],
      "电台": ["mine.radio.v1","mine.radio.mode.v1"],
      "吃货": ["mine.foodie.v1"],
      "个人": ["mine.me.v1","mine.bg.v1"]
    };
    var totalSize = 0, moduleSizes = {}, allKeys = getAllKeysInternal();
    Object.keys(moduleKeys).forEach(function (mod) {
      var modSize = 0;
      moduleKeys[mod].forEach(function (k) { var v = cache[k]; if (v === undefined) v = origGetItem(k); if (v) modSize += v.length; });
      moduleSizes[mod] = modSize; totalSize += modSize;
    });
    allKeys.forEach(function (k) {
      if (k.indexOf("mine.") === 0) {
        var found = false;
        Object.keys(moduleKeys).forEach(function (mod) { if (moduleKeys[mod].indexOf(k) >= 0) found = true; });
        if (!found) { var v = cache[k]; if (v === undefined) v = origGetItem(k); if (v) totalSize += v.length; }
      }
    });
    return { totalSize: totalSize, moduleSizes: moduleSizes, totalKB: (totalSize/1024).toFixed(1), maxKB: 51200, keyCount: allKeys.length };
  }

  function clearByKeys(keys) { keys.forEach(function (k) { delete cache[k]; removeFromDB(k); try { origRemoveItem(k); } catch (e) {} }); }
  function getKeysWithPrefix(prefix) { return getAllKeysInternal().filter(function (k) { return k.indexOf(prefix) === 0; }); }
  function clearAllMine(keepKeys) {
    var toRemove = [];
    getAllKeysInternal().forEach(function (k) { if (k.indexOf("mine.") === 0 && keepKeys.indexOf(k) < 0) toRemove.push(k); });
    clearByKeys(toRemove); return toRemove.length;
  }
  function onReady(cb) { if (ready) { try { cb(); } catch (e) {} } else { readyCallbacks.push(cb); } }
  function isReady() { return ready; }
  function flush() { if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; } flushWrites(); }

  try {
    var len = getOrigLength();
    for (var i = 0; i < len; i++) { var k = origKey(i); if (k) { var v = origGetItem(k); if (v !== null) cache[k] = v; } }
  } catch (e) {}
  initDB();

  return {
    getUsage: getUsage, clearByKeys: clearByKeys, getKeysWithPrefix: getKeysWithPrefix,
    clearAllMine: clearAllMine, onReady: onReady, isReady: isReady, flush: flush,
    isOverridden: function () { return overrideOK; },
    get: function (key) { return cache[key] !== undefined ? cache[key] : origGetItem(key); },
    set: function (key, value) { if (typeof value !== "string") value = String(value); cache[key] = value; queueWrite(key, value); if (value.length < 131072) { try { origSetItem(key, value); } catch (e) {} } },
    remove: function (key) { delete cache[key]; removeFromDB(key); try { origRemoveItem(key); } catch (e) {} },
    getAllKeys: getAllKeysInternal
  };
})();
