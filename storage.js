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
   ======================================================================== */

window.MineStore = (function () {
  "use strict";

  var DB_NAME = "MineStorage";
  var DB_STORE = "kv";
  var DB_VERSION = 1;
  var db = null;
  var useDB = false;

  /* 内存缓存：所有键值对都在内存中，保证同步读取 */
  var cache = {};
  /* 记录哪些键存在 IndexedDB 中（用于区分 localStorage 独有数据） */
  var idbKeySet = {};

  /* 就绪状态 */
  var ready = false;
  var readyCallbacks = [];

  /* 防抖写入队列 */
  var pendingWrites = {};
  var writeTimer = null;
  var WRITE_DEBOUNCE_MS = 300;

  /* ---- 保留原始 localStorage 方法引用 ---- */
  var origGetItem = localStorage.getItem.bind(localStorage);
  var origSetItem = localStorage.setItem.bind(localStorage);
  var origRemoveItem = localStorage.removeItem.bind(localStorage);
  var origClear = localStorage.clear.bind(localStorage);
  var origKey = localStorage.key.bind(localStorage);
  var origLength = localStorage.length;

  /* =====================================================================
     IndexedDB 初始化
     ===================================================================== */
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

  /* 从 IndexedDB 加载所有数据到缓存 */
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
            /* IndexedDB 数据优先（通常是更新版本） */
            cache[item.key] = item.value;
            idbKeySet[item.key] = true;
          }
        });

        /* 迁移：localStorage 中有但 IndexedDB 中没有的数据，写入 IndexedDB */
        migrateToDB();

        markReady();
      };
      req.onerror = function () {
        markReady();
      };
    } catch (e) {
      markReady();
    }
  }

  /* 将 localStorage 独有的数据迁移到 IndexedDB */
  function migrateToDB() {
    if (!db) return;
    try {
      var tx = db.transaction(DB_STORE, "readwrite");
      var store = tx.objectStore(DB_STORE);
      for (var i = 0; i < origLength; i++) {
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
    cbs.forEach(function (cb) {
      try { cb(); } catch (e) {}
    });
  }

  /* =====================================================================
     IndexedDB 读写（防抖写入）
     ===================================================================== */
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
      /* 如果写入失败，重试一次 */
      try {
        var tx2 = db.transaction(DB_STORE, "readwrite");
        var store2 = tx2.objectStore(DB_STORE);
        keys.forEach(function (key) {
          store2.put({ key: key, value: writes[key] });
        });
      } catch (e2) {}
    }
  }

  function removeFromDB(key) {
    if (!db || !useDB) return;
    delete idbKeySet[key];
    try {
      var tx = db.transaction(DB_STORE, "readwrite");
      var store = tx.objectStore(DB_STORE);
      store.delete(key);
    } catch (e) {}
  }

  function clearDB() {
    if (!db || !useDB) return;
    idbKeySet = {};
    try {
      var tx = db.transaction(DB_STORE, "readwrite");
      var store = tx.objectStore(DB_STORE);
      store.clear();
    } catch (e) {}
  }

  /* =====================================================================
     拦截 localStorage（核心逻辑）
     ===================================================================== */

  /* getItem：从内存缓存同步读取 */
  localStorage.getItem = function (key) {
    if (cache[key] !== undefined) {
      return cache[key];
    }
    /* 回退到原始 localStorage（IndexedDB 尚未加载时） */
    return origGetItem(key);
  };

  /* setItem：更新缓存 + 写 IndexedDB + 尝试 localStorage */
  localStorage.setItem = function (key, value) {
    /* 确保是字符串 */
    if (typeof value !== "string") value = String(value);

    /* 更新内存缓存 */
    cache[key] = value;

    /* 写入 IndexedDB（异步防抖，支持大容量） */
    queueWrite(key, value);

    /* 同时尝试写入 localStorage（小数据作为即时回退） */
    /* 大数据（>128KB）跳过 localStorage，避免配额错误 */
    if (value.length < 131072) {
      try {
        origSetItem(key, value);
      } catch (e) {
        /* localStorage 配额已满，不影响——IndexedDB 有数据 */
      }
    }
  };

  /* removeItem：从缓存 + IndexedDB + localStorage 三处删除 */
  localStorage.removeItem = function (key) {
    delete cache[key];
    removeFromDB(key);
    try { origRemoveItem(key); } catch (e) {}
  };

  /* clear：清空缓存 + IndexedDB + localStorage */
  localStorage.clear = function () {
    cache = {};
    clearDB();
    try { origClear(); } catch (e) {}
  };

  /* key() 和 length：合并 localStorage + IndexedDB 的键 */
  /* 获取所有键的合并列表 */
  function getAllKeysInternal() {
    var keySet = {};
    /* localStorage 原生键 */
    for (var i = 0; i < origLength; i++) {
      var k = origKey(i);
      if (k) keySet[k] = true;
    }
    /* IndexedDB 独有的键 */
    Object.keys(idbKeySet).forEach(function (k) {
      keySet[k] = true;
    });
    /* 缓存中的键 */
    Object.keys(cache).forEach(function (k) {
      keySet[k] = true;
    });
    return Object.keys(keySet);
  }

  /* 覆盖 length 属性 */
  try {
    Object.defineProperty(localStorage, "length", {
      get: function () {
        return getAllKeysInternal().length;
      },
      configurable: true
    });
  } catch (e) {
    /* 某些浏览器不支持覆盖 length，忽略 */
  }

  /* 覆盖 key() 方法 */
  localStorage.key = function (index) {
    var keys = getAllKeysInternal();
    if (index >= 0 && index < keys.length) {
      return keys[index];
    }
    return null;
  };

  /* =====================================================================
     对外 API
     ===================================================================== */

  /* 存储用量统计（包括 IndexedDB + localStorage） */
  function getUsage() {
    var moduleKeys = {
      "聊天": ["mine.chat.v1", "mine.chat.unread.v1", "mine.chat.bg.v1", "mine.chat.fontColor.v1", "mine.chat.choices.v1", "mine.chat.activeMsg.v1"],
      "信件": ["mine.mail.v1", "mine.mail.pending.v1", "mine.mail.active.v1", "mine.mail.activecheck.v1"],
      "树洞": ["mine.treehole.v2", "mine.treehole.verify.v1", "mine.treehole.pending.v2", "mine.treehole.templates.v1", "mine.treehole.seenCount.v1"],
      "朋友圈": ["mine.moments.v1", "mine.moments.cover", "mine.moments.contactInteractions"],
      "联系人": ["mine.contacts.v1", "mine.contacts.lastShuffle"],
      "电台": ["mine.radio.v1", "mine.radio.mode.v1"],
      "吃货": ["mine.foodie.v1"],
      "个人": ["mine.me.v1", "mine.bg.v1"]
    };

    var totalSize = 0;
    var moduleSizes = {};
    var allKeys = getAllKeysInternal();

    /* 统计各模块大小 */
    Object.keys(moduleKeys).forEach(function (mod) {
      var modSize = 0;
      moduleKeys[mod].forEach(function (k) {
        var v = cache[k];
        if (v === undefined) v = origGetItem(k);
        if (v) modSize += v.length;
      });
      moduleSizes[mod] = modSize;
      totalSize += modSize;
    });

    /* 统计其他 mine.* 键 */
    allKeys.forEach(function (k) {
      if (k.indexOf("mine.") === 0) {
        var found = false;
        Object.keys(moduleKeys).forEach(function (mod) {
          if (moduleKeys[mod].indexOf(k) >= 0) found = true;
        });
        if (!found) {
          var v = cache[k];
          if (v === undefined) v = origGetItem(k);
          if (v) totalSize += v.length;
        }
      }
    });

    return {
      totalSize: totalSize,
      moduleSizes: moduleSizes,
      totalKB: (totalSize / 1024).toFixed(1),
      /* IndexedDB 容量上限：浏览器通常 50MB+（部分浏览器可达数 GB） */
      maxKB: 51200,
      keyCount: allKeys.length
    };
  }

  /* 按键批量清除（同时清除 IndexedDB + localStorage + 缓存） */
  function clearByKeys(keys) {
    keys.forEach(function (k) {
      delete cache[k];
      removeFromDB(k);
      try { origRemoveItem(k); } catch (e) {}
    });
  }

  /* 获取所有匹配前缀的键 */
  function getKeysWithPrefix(prefix) {
    return getAllKeysInternal().filter(function (k) {
      return k.indexOf(prefix) === 0;
    });
  }

  /* 清除所有 mine.* 键（保留指定键） */
  function clearAllMine(keepKeys) {
    var allKeys = getAllKeysInternal();
    var toRemove = [];
    allKeys.forEach(function (k) {
      if (k.indexOf("mine.") === 0 && keepKeys.indexOf(k) < 0) {
        toRemove.push(k);
      }
    });
    clearByKeys(toRemove);
    return toRemove.length;
  }

  /* 就绪回调 */
  function onReady(cb) {
    if (ready) {
      try { cb(); } catch (e) {}
    } else {
      readyCallbacks.push(cb);
    }
  }

  function isReady() {
    return ready;
  }

  /* 强制刷新（立即写入 IndexedDB） */
  function flush() {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    flushWrites();
  }

  /* =====================================================================
     初始化
     ===================================================================== */

  /* 第一步：从 localStorage 同步加载到缓存（立即可用） */
  try {
    for (var i = 0; i < origLength; i++) {
      var k = origKey(i);
      if (k) {
        var v = origGetItem(k);
        if (v !== null) cache[k] = v;
      }
    }
  } catch (e) {}

  /* 第二步：异步打开 IndexedDB 并加载数据 */
  initDB();

  /* =====================================================================
     公开 API
     ===================================================================== */
  return {
    getUsage: getUsage,
    clearByKeys: clearByKeys,
    getKeysWithPrefix: getKeysWithPrefix,
    clearAllMine: clearAllMine,
    onReady: onReady,
    isReady: isReady,
    flush: flush,
    /* 直接读写（绕过 localStorage 拦截，用于特殊场景） */
    get: function (key) { return cache[key] !== undefined ? cache[key] : origGetItem(key); },
    set: function (key, value) {
      if (typeof value !== "string") value = String(value);
      cache[key] = value;
      queueWrite(key, value);
      if (value.length < 131072) {
        try { origSetItem(key, value); } catch (e) {}
      }
    },
    remove: function (key) {
      delete cache[key];
      removeFromDB(key);
      try { origRemoveItem(key); } catch (e) {}
    },
    getAllKeys: getAllKeysInternal
  };
})();
