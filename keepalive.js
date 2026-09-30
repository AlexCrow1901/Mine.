 /* ========================================================================
   Mine · 后台保活模块
   ------------------------------------------------------------------------
   目标（针对 vivo 浏览器 / Edge 安卓版）：
   · 网页进入后台后尽量保持定时器运行（静音音频保活）
   · 后台收到消息 / 来电时弹出系统通知（Notification API）
   · 回到前台立即补查并补发后台期间到期的消息（时间戳校正）
   · 前台保持屏幕常亮（Wake Lock，可选）
   · 聊天记录存于 localStorage，切后台 / 重进 / 刷新均不丢失
   说明：受手机系统省电机制限制，任何网页都无法 100% 保证后台永不休眠；
         本模块用「音频保活 + 回前台补偿 + 系统通知」三层手段把体验做到最好。
   接入：index.html 引入；其他模块调用 MineKeepalive.notify(title, body)。
   ======================================================================== */
window.MineKeepalive = (function () {
  "use strict";

  var STATE_KEY = "mine.keepalive.v1";
  var PREF_KEY = "mine.settings.v1";
  var keepAudio = null;        // 保活用静音 <audio>
  var wakeLock = null;         // Wake Lock 句柄
  var audioStarted = false;    // 音频保活是否已尝试启动
  var lastHeartbeat = Date.now();
  var listenersBound = false;

  /* ---------------- 用户偏好（与"设置"页联动） ----------------
     notify:     消息通知（后台新消息/来电时是否弹系统通知）
     background: 后台运行（是否启用静音音频保活 + 屏幕常亮） */
  var prefs = { notify: true, background: true };
  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p.notify === "boolean") prefs.notify = p.notify;
        if (p && typeof p.background === "boolean") prefs.background = p.background;
      }
    } catch (e) {}
  }
  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {}
  }
  function getPrefs() { return { notify: prefs.notify, background: prefs.background }; }
  function setPref(key, val) {
    if (key === "notify" || key === "background") {
      prefs[key] = !!val;
      savePrefs();
      applyPrefs();
    }
  }

  /* ---------------- 静音 WAV dataURL 生成 ----------------
     生成 seconds 秒、8kHz、单声道、8-bit PCM 静音 WAV。
     浏览器对「正在播放音频」的页面会放宽后台挂起限制。 */
  function writeString(view, offset, str) {
    for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  function silentWavDataURL(seconds) {
    var sampleRate = 8000;
    var numSamples = Math.floor(sampleRate * seconds);
    var buffer = new ArrayBuffer(44 + numSamples);
    var view = new DataView(buffer);
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + numSamples, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);          // fmt chunk 大小
    view.setUint16(20, 1, true);           // PCM
    view.setUint16(22, 1, true);           // 单声道
    view.setUint32(24, sampleRate, true);  // 采样率
    view.setUint32(28, sampleRate, true);  // 字节率（8-bit 单声道）
    view.setUint16(32, 1, true);           // 块对齐
    view.setUint16(34, 8, true);           // 位深
    writeString(view, 36, "data");
    view.setUint32(40, numSamples, true);
    // PCM 采样全 0（静音），无需写入
    var bytes = new Uint8Array(buffer);
    var binary = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return "data:audio/wav;base64," + btoa(binary);
  }

  /* ---------------- 音频保活启动 ---------------- */
  function startAudioKeepalive() {
    if (!prefs.background) return;   // 设置页关闭了"后台运行"
    if (audioStarted) return;
    audioStarted = true;
    try {
      keepAudio = new Audio(silentWavDataURL(2));
      keepAudio.loop = true;
      keepAudio.preload = "auto";
      keepAudio.volume = 0.0;
      keepAudio.muted = true;
      // 播放结束 / 被中断时自动重播（双保险）
      keepAudio.addEventListener("pause", function () {
        if (keepAudio) { try { keepAudio.play(); } catch (e) {} }
      });
      var p = keepAudio.play();
      if (p && p.catch) p.catch(function () {
        // 自动播放被拒：重置标记，等待下次交互再试
        audioStarted = false;
        keepAudio = null;
      });
    } catch (e) {
      audioStarted = false;
      keepAudio = null;
    }
  }
  /* 停止音频保活（设置页关闭"后台运行"时调用） */
  function stopAudioKeepalive() {
    var a = keepAudio;
    keepAudio = null;          // 先置空，pause 事件监听里不会重播
    audioStarted = false;
    if (a) {
      try { a.pause(); a.src = ""; } catch (e) {}
    }
  }

  /* ---------------- 系统通知（Notification API） ---------------- */
  function notificationsSupported() {
    return typeof window.Notification !== "undefined";
  }
  function requestNotificationPermission() {
    if (!notificationsSupported()) return;
    try {
      if (Notification.permission === "default") {
        var r = Notification.requestPermission();
        if (r && r.then) r.then(function () {}, function () {});
      }
    } catch (e) {}
  }
  /** 弹出系统通知；页面在前台时通常无需调用 */
  function notify(title, body) {
    if (!prefs.notify) return;            // 设置页关闭了"消息通知"
    if (!notificationsSupported()) return;
    if (Notification.permission !== "granted") return;
    try {
      var n = new Notification(title || "Mine", {
        body: body || "你收到一条新消息",
        tag: "mine-notify",
        renotify: true,
        silent: false
      });
      n.onclick = function () {
        try { window.focus(); } catch (e) {}
        try { n.close(); } catch (e) {}
      };
      setTimeout(function () { try { n.close(); } catch (e) {} }, 10000);
    } catch (e) {}
  }

  /* ---------------- Wake Lock 屏幕常亮（前台辅助） ---------------- */
  function wakeLockSupported() {
    return navigator && typeof navigator.wakeLock === "object" &&
           typeof navigator.wakeLock.request === "function";
  }
  function requestWakeLock() {
    if (!prefs.background) return;   // 设置页关闭了"后台运行"
    if (!wakeLockSupported()) return;
    try {
      navigator.wakeLock.request("screen").then(function (lock) {
        wakeLock = lock;
        try {
          lock.addEventListener("release", function () { wakeLock = null; });
        } catch (e) {}
      }).catch(function () { wakeLock = null; });
    } catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }
  /* 设置变更后立即生效 */
  function applyPrefs() {
    if (prefs.background) {
      startAudioKeepalive();
      requestWakeLock();
    } else {
      stopAudioKeepalive();
      releaseWakeLock();
    }
  }

  /* ---------------- 状态持久化 ---------------- */
  function saveState() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        notif: notificationsSupported() ? Notification.permission : "unsupported",
        ts: Date.now()
      }));
    } catch (e) {}
  }

  /* ---------------- 生命周期事件 ---------------- */
  function onBecameVisible() {
    // 回到前台：确保保活音频 / Wake Lock 恢复
    startAudioKeepalive();
    requestWakeLock();
    saveState();
  }
  function bindLifecycle() {
    if (listenersBound) return;
    listenersBound = true;

    // 页面可见性变化
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") onBecameVisible();
    });

    // bfcache：从后台/历史恢复，页面原样保留、不重新加载
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) onBecameVisible();
    });
    window.addEventListener("resume", onBecameVisible);

    // 页面被冻结 / 进入后台（状态已在 localStorage，无需同步阻塞）
    window.addEventListener("freeze", function () { saveState(); });
    window.addEventListener("pagehide", function () { saveState(); });
  }

  /* ---------------- 首次用户交互后启动保活 ----------------
     浏览器自动播放策略要求音频播放须由用户手势触发。 */
  function bindFirstInteraction() {
    var started = false;
    function gesture() {
      if (started) return;
      started = true;
      startAudioKeepalive();
      requestNotificationPermission();
      requestWakeLock();
      saveState();
    }
    ["click", "touchstart", "touchend", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, gesture, { passive: true, capture: false });
    });
  }

  /* ---------------- 心跳：检测真实时间流逝 ----------------
     后台定时器被节流后，恢复时通过时间差发现"时间跳跃"，
     广播 mine:timeskip 事件，让聊天 / 电话模块补查到期任务。 */
  function startHeartbeat() {
    lastHeartbeat = Date.now();
    setInterval(function () {
      var now = Date.now();
      var gap = now - lastHeartbeat;
      lastHeartbeat = now;
      // 正常 2 秒一跳；超过 6 秒说明被后台节流过
      if (gap > 6000) {
        try {
          document.dispatchEvent(new CustomEvent("mine:timeskip", { detail: { gap: gap } }));
        } catch (e) {}
      }
    }, 2000);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    loadPrefs();
    bindLifecycle();
    bindFirstInteraction();
    startHeartbeat();
    // 若启动时已在前台且历史上已授权，直接尝试
    if (document.visibilityState === "visible") onBecameVisible();
  }

  init();

  return {
    init: init,
    notify: notify,
    requestPermission: requestNotificationPermission,
    startAudioKeepalive: startAudioKeepalive,
    requestWakeLock: requestWakeLock,
    getPrefs: getPrefs,
    setPref: setPref,
    applyPrefs: applyPrefs,
    isBackground: function () { return document.visibilityState !== "visible"; },
    notificationsSupported: notificationsSupported
  };
})();
