/* =========================================================
   絮语 Whisper · 逻辑层
   纯原生 JavaScript，数据保存在 localStorage
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 配置 ---------- */
  var STORAGE_KEY = "whisper.posts.v1";
  var THEME_KEY = "whisper.theme.v2";
  var LEGACY_THEME_KEY = "whisper.theme.v1";
  var MAX_LEN = 280;
  var ME = "我自己";

  var THEME_MODES = ["system", "light", "dark"];
  var THEME_LABELS = { system: "跟随系统", light: "浅色", dark: "深色" };

  // 本地壁纸：顺序即整点轮换顺序
  var SCENES = [
    { file: "assets/bg-01.jpg", name: "晨雾", tone: "light" },
    { file: "assets/bg-02.jpg", name: "午后", tone: "light" },
    { file: "assets/bg-03.jpg", name: "秋光", tone: "light" },
    { file: "assets/bg-04.jpg", name: "灯下", tone: "dark" },
    { file: "assets/bg-05.jpg", name: "归海", tone: "light" },
    { file: "assets/bg-06.jpg", name: "陶野", tone: "light" },
    { file: "assets/bg-07.jpg", name: "薄暮", tone: "light" },
    { file: "assets/bg-08.jpg", name: "夜窗", tone: "dark" },
  ];

  var HOUR = 3600000;

  var AVATAR_GRADIENTS = [
    ["#E3A87C", "#C2683F"],
    ["#9FB49B", "#5F7A5C"],
    ["#A3AECD", "#5E6C93"],
    ["#D8A6AD", "#A75F6D"],
    ["#CDB68B", "#9A7F4E"],
    ["#B9A6C9", "#75628C"],
  ];

  /* ---------- 元素引用 ---------- */
  var els = {
    feed: document.getElementById("feed"),
    feedCount: document.getElementById("feed-count"),
    empty: document.getElementById("empty-state"),
    emptyCta: document.getElementById("empty-cta"),
    input: document.getElementById("composer-input"),
    publish: document.getElementById("publish-btn"),
    count: document.getElementById("char-count"),
    meter: document.getElementById("meter"),
    tip: document.getElementById("composer-tip"),
    today: document.getElementById("today-label"),
    themeToggle: document.getElementById("theme-toggle"),
    themeMeta: document.getElementById("theme-color-meta"),
    sceneStack: document.querySelector(".scene-stack"),
    sceneLayers: document.querySelectorAll(".scene-layer"),
    sceneNext: document.getElementById("scene-next"),
    sceneName: document.getElementById("scene-name"),
    sceneChip: document.getElementById("scene-chip"),
    toast: document.getElementById("toast"),
    tpl: document.getElementById("post-card-tpl"),
  };

  /* ---------- 状态 ---------- */
  var state = {
    posts: [],
    storageOK: true,
    submitting: false,
    themeMode: "system",
  };

  var sceneState = {
    index: -1,
    active: 0,
    manualIndex: -1,
    manualSlot: -1,
    timer: null,
    requestId: 0,
    preloaded: {},
  };

  var themeMedia = null;
  var toastTimer = null;

  /* ---------- 工具 ---------- */
  function uid() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  }

  function avatarGradient(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i += 1) {
      sum += name.charCodeAt(i);
    }
    return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
  }

  function initialOf(name) {
    return name.trim().slice(0, 1) || "絮";
  }

  function formatRelative(ts) {
    var diff = Date.now() - ts;
    if (!isFinite(ts) || diff < 0) return "刚刚";
    if (diff < 60 * 1000) return "刚刚";
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + " 分钟前";
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + " 小时前";
    if (diff < 7 * 24 * 60 * 60 * 1000) return Math.floor(diff / 86400000) + " 天前";

    var d = new Date(ts);
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
    }, 2200);
  }

  /* ---------- 数据校验 ---------- */
  function sanitizePost(raw) {
    if (!raw || typeof raw !== "object") return null;

    var content = typeof raw.content === "string" ? raw.content.trim() : "";
    if (!content) return null;

    var author = typeof raw.author === "string" && raw.author.trim() ? raw.author.trim() : ME;
    var likes = typeof raw.likes === "number" && isFinite(raw.likes) && raw.likes > 0 ? Math.floor(raw.likes) : 0;

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : uid(),
      author: author,
      createdAt: typeof raw.createdAt === "number" && isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
      content: content.slice(0, MAX_LEN),
      likes: likes,
      likedByMe: raw.likedByMe === true,
    };
  }

  /* ---------- 种子数据（原创示例） ---------- */
  function seedPosts() {
    var now = Date.now();

    return [
      {
        id: "seed-linwan",
        author: "林晚",
        createdAt: now - 6 * 60 * 1000,
        content:
          "傍晚收衣服的时候，风里有一点桂花味。秋天好像终于把脚伸进了这座城市，轻轻的，怕吵到谁。",
        likes: 12,
        likedByMe: false,
      },
      {
        id: "seed-aju",
        author: "阿橘",
        createdAt: now - 3 * 60 * 60 * 1000,
        content:
          "今天把阳台那几盆多肉重新换了土，弄了一手泥。明明只是浇水换盆这种小事，成就感却莫名其妙地高。",
        likes: 8,
        likedByMe: false,
      },
      {
        id: "seed-shen",
        author: "沈青野",
        createdAt: now - 27 * 60 * 60 * 1000,
        content:
          "重读一本旧书，才发现当年划线的句子，现在读来完全是另一层意思。书没变，是我变了。",
        likes: 21,
        likedByMe: false,
      },
      {
        id: "seed-nanzhi",
        author: "南枝",
        createdAt: now - 3 * 24 * 60 * 60 * 1000,
        content:
          "凌晨写完最后一页，关灯之前听见楼下有人推着自行车走过，链条声很轻。城市安静下来的时候，才听得见它呼吸。",
        likes: 34,
        likedByMe: false,
      },
    ]
      .map(sanitizePost)
      .filter(Boolean);
  }

  /* ---------- 存储 ---------- */
  function loadPosts() {
    var raw = null;

    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      state.storageOK = false;
      return seedPosts();
    }

    if (!raw) return seedPosts();

    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return seedPosts();

      var cleaned = parsed.map(sanitizePost).filter(Boolean);
      return cleaned.length ? cleaned : seedPosts();
    } catch (err) {
      return seedPosts();
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.posts));
      return true;
    } catch (err) {
      if (state.storageOK) {
        state.storageOK = false;
        toast("本地存储不可用，内容仅在当前页面有效");
      }
      return false;
    }
  }

  /* ---------- 渲染 ---------- */
  function createPostCard(post, index) {
    var node = els.tpl.content.firstElementChild.cloneNode(true);
    var avatar = node.querySelector(".post__avatar");
    var author = node.querySelector(".post__author");
    var time = node.querySelector(".post__time");
    var body = node.querySelector(".post__body");
    var likeBtn = node.querySelector(".like-btn");
    var likeCount = node.querySelector(".like-btn__count");
    var gradient = avatarGradient(post.author);

    node.dataset.id = post.id;
    node.style.setProperty("--i", String(Math.min(index, 8)));

    avatar.textContent = initialOf(post.author);
    avatar.style.backgroundImage = "linear-gradient(140deg, " + gradient[0] + ", " + gradient[1] + ")";

    author.textContent = post.author;

    time.dateTime = new Date(post.createdAt).toISOString();
    time.dataset.ts = String(post.createdAt);
    time.textContent = formatRelative(post.createdAt);
    time.title = new Date(post.createdAt).toLocaleString("zh-CN");

    body.textContent = post.content;

    likeBtn.dataset.id = post.id;
    likeBtn.setAttribute("aria-pressed", post.likedByMe ? "true" : "false");
    likeBtn.setAttribute("aria-label", (post.likedByMe ? "取消点赞" : "点赞") + "，" + post.author);
    likeCount.textContent = String(post.likes);

    return node;
  }

  function renderFeed(options) {
    var opts = options || {};
    var sorted = state.posts.slice().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    var fragment = document.createDocumentFragment();
    sorted.forEach(function (post, index) {
      var card = createPostCard(post, index);
      if (opts.highlightId && post.id === opts.highlightId) {
        card.classList.add("is-new");
      }
      fragment.appendChild(card);
    });

    els.feed.textContent = "";
    els.feed.appendChild(fragment);

    // 长文展开：渲染完成后测量高度，超出 4 行才插入展开按钮
    Array.prototype.forEach.call(els.feed.querySelectorAll(".post"), function (card) {
      var body = card.querySelector(".post__body");
      if (!body) return;

      if (body.scrollHeight - body.clientHeight > 4) {
        var expand = document.createElement("button");
        expand.type = "button";
        expand.className = "expand-btn";
        expand.textContent = "展开全文";
        expand.setAttribute("aria-expanded", "false");
        body.insertAdjacentElement("afterend", expand);
      }
    });

    var total = state.posts.length;
    els.feedCount.textContent = total ? "共 " + total + " 条" : "暂无内容";
    els.empty.hidden = total > 0;
  }

  function refreshTimes() {
    Array.prototype.forEach.call(els.feed.querySelectorAll(".post__time"), function (node) {
      var ts = Number(node.dataset.ts);
      if (isFinite(ts)) node.textContent = formatRelative(ts);
    });
  }

  /* ---------- 发布 ---------- */
  function updateComposer() {
    var value = els.input.value;
    var remaining = MAX_LEN - value.length;

    els.count.textContent = String(remaining);
    els.meter.classList.toggle("is-warn", remaining <= 40 && remaining > 0);
    els.meter.classList.toggle("is-limit", remaining <= 0);

    els.publish.disabled = value.trim().length === 0 || state.submitting;
    els.tip.textContent =
      remaining <= 40 && remaining > 0
        ? "还能写下 " + remaining + " 字，慢慢来"
        : "按 Ctrl / ⌘ + Enter 也可以快速发布";
  }

  function autoGrow() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 240) + "px";
    els.input.style.overflowY = els.input.scrollHeight > 240 ? "auto" : "hidden";
  }

  function publishPost() {
    var value = els.input.value.trim();
    if (!value || state.submitting) return;

    var post = sanitizePost({
      author: ME,
      content: value,
      createdAt: Date.now(),
      likes: 0,
      likedByMe: false,
    });
    if (!post) return;

    state.submitting = true;
    state.posts.push(post);
    persist();

    els.input.value = "";
    autoGrow();
    updateComposer();
    renderFeed({ highlightId: post.id });
    toast("已发布，静候回响");

    window.setTimeout(function () {
      state.submitting = false;
      updateComposer();
    }, 320);

    window.setTimeout(function () {
      var head = document.querySelector(".feed-head");
      if (head) head.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  /* ---------- 点赞 ---------- */
  function toggleLike(postId, btn) {
    var post = null;
    for (var i = 0; i < state.posts.length; i += 1) {
      if (state.posts[i].id === postId) {
        post = state.posts[i];
        break;
      }
    }
    if (!post) return;

    post.likedByMe = !post.likedByMe;
    post.likes = Math.max(0, post.likes + (post.likedByMe ? 1 : -1));

    btn.setAttribute("aria-pressed", post.likedByMe ? "true" : "false");
    btn.setAttribute("aria-label", (post.likedByMe ? "取消点赞" : "点赞") + "，" + post.author);
    btn.querySelector(".like-btn__count").textContent = String(post.likes);

    btn.classList.remove("is-popping");
    if (post.likedByMe) {
      // 触发重排以便重复播放动画
      void btn.offsetWidth;
      btn.classList.add("is-popping");
    }

    persist();
  }

  /* ---------- 长文展开 ---------- */
  function handleExpand(btn) {
    var body = btn.previousElementSibling;
    if (!body || !body.classList.contains("post__body")) return;

    var expanded = body.classList.toggle("is-expanded");
    btn.textContent = expanded ? "收起" : "展开全文";
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  /* ---------- 主题：system / light / dark ---------- */
  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function resolveTheme(mode) {
    if (mode === "light" || mode === "dark") return mode;
    return systemPrefersDark() ? "dark" : "light";
  }

  function applyTheme(mode, options) {
    var opts = options || {};
    var nextMode = mode === "light" || mode === "dark" ? mode : "system";
    var resolved = resolveTheme(nextMode);

    state.themeMode = nextMode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeMode = nextMode;

    if (els.themeMeta) {
      els.themeMeta.setAttribute("content", resolved === "dark" ? "#14110F" : "#FAF6EF");
    }

    if (els.themeToggle) {
      var nextMode2 = THEME_MODES[(THEME_MODES.indexOf(nextMode) + 1) % THEME_MODES.length];
      els.themeToggle.setAttribute(
        "aria-label",
        "明暗主题：" + THEME_LABELS[nextMode] + "，点击切换为" + THEME_LABELS[nextMode2]
      );
      els.themeToggle.setAttribute("aria-pressed", resolved === "dark" ? "true" : "false");
      els.themeToggle.setAttribute("title", "明暗主题：" + THEME_LABELS[nextMode] + "（点击切换）");
    }

    if (opts.persist) {
      try {
        window.localStorage.setItem(THEME_KEY, nextMode);
      } catch (err) {
        /* 偏好写入失败不影响使用 */
      }
    }

    if (opts.announce) {
      toast(
        nextMode === "system"
          ? "已跟随系统 · " + (resolved === "dark" ? "深色" : "浅色")
          : "已切换为" + THEME_LABELS[nextMode] + "模式"
      );
    }
  }

  function cycleTheme() {
    var next = THEME_MODES[(THEME_MODES.indexOf(state.themeMode) + 1) % THEME_MODES.length];
    applyTheme(next, { persist: true, announce: true });
  }

  function initTheme() {
    var stored = null;

    try {
      stored = window.localStorage.getItem(THEME_KEY);
      // 旧版本的主题键不再使用，静默清理，避免遗留值干扰跟随系统
      if (window.localStorage.getItem(LEGACY_THEME_KEY) !== null) {
        window.localStorage.removeItem(LEGACY_THEME_KEY);
      }
    } catch (err) {
      stored = null;
    }

    if (stored !== "light" && stored !== "dark" && stored !== "system") stored = "system";
    applyTheme(stored, {});

    if (window.matchMedia) {
      themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (state.themeMode === "system") applyTheme("system", {});
      };
      if (themeMedia.addEventListener) {
        themeMedia.addEventListener("change", onChange);
      } else if (themeMedia.addListener) {
        themeMedia.addListener(onChange);
      }
    }
  }

  /* ---------- 背景场景：整点轮换 + 手动换一张 ---------- */
  function hourSlot(timestamp) {
    return Math.floor(timestamp / HOUR);
  }

  function scheduledSceneIndex(timestamp) {
    return hourSlot(timestamp) % SCENES.length;
  }

  function currentSceneIndex() {
    var now = Date.now();
    if (sceneState.manualIndex >= 0 && sceneState.manualSlot === hourSlot(now)) {
      return sceneState.manualIndex;
    }
    return scheduledSceneIndex(now);
  }

  function sceneAt(index) {
    return SCENES[((index % SCENES.length) + SCENES.length) % SCENES.length];
  }

  function preloadScene(index, callback) {
    var scene = sceneAt(index);
    if (sceneState.preloaded[scene.file]) {
      if (callback) callback(true);
      return;
    }

    var img = new Image();
    var settled = false;
    var timer = window.setTimeout(function () {
      finish(false);
    }, 4000);

    function finish(ok) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (ok) sceneState.preloaded[scene.file] = true;
      if (callback) callback(ok);
    }

    img.onload = function () {
      if (img.decode) {
        img.decode().then(
          function () {
            finish(true);
          },
          function () {
            finish(true);
          }
        );
      } else {
        finish(true);
      }
    };
    img.onerror = function () {
      finish(false);
    };
    img.src = scene.file;
  }

  function updateSceneLabel(index) {
    var scene = sceneAt(index);
    document.documentElement.dataset.sceneTone = scene.tone || "light";
    if (els.sceneName) els.sceneName.textContent = scene.name;
    if (els.sceneChip) els.sceneChip.setAttribute("title", "当前背景 · " + scene.name);
  }

  function applyScene(index, options) {
    var opts = options || {};
    var normalized = ((index % SCENES.length) + SCENES.length) % SCENES.length;

    if (!els.sceneLayers.length || !els.sceneStack) return;
    if (opts.force !== true && normalized === sceneState.index) {
      updateSceneLabel(normalized);
      return;
    }

    // 只接受最后一次切换请求，避免连续点击时旧图片覆盖新图片
    var requestId = (sceneState.requestId += 1);
    updateSceneLabel(normalized);

    preloadScene(normalized, function (ok) {
      if (requestId !== sceneState.requestId) return;

      var scene = sceneAt(normalized);
      var outgoing = els.sceneLayers[sceneState.active];
      var incoming = els.sceneLayers[1 - sceneState.active];

      if (ok) {
        incoming.style.backgroundImage = 'url("' + scene.file + '")';
        els.sceneStack.classList.remove("is-fallback");
      } else {
        incoming.style.backgroundImage = "";
        els.sceneStack.classList.add("is-fallback");
      }

      incoming.classList.add("is-active");
      outgoing.classList.remove("is-active");
      sceneState.active = 1 - sceneState.active;
      sceneState.index = normalized;

      if (opts.breathe) {
        els.sceneStack.classList.remove("is-shifting");
        void els.sceneStack.offsetWidth;
        els.sceneStack.classList.add("is-shifting");
        window.setTimeout(function () {
          els.sceneStack.classList.remove("is-shifting");
        }, 1300);
      }
    });
  }

  function scheduleSceneTick() {
    window.clearTimeout(sceneState.timer);
    var now = Date.now();
    var next = (hourSlot(now) + 1) * HOUR + 800;

    sceneState.timer = window.setTimeout(function () {
      sceneState.manualIndex = -1;
      sceneState.manualSlot = -1;
      applyScene(scheduledSceneIndex(Date.now()), { breathe: true });
      scheduleSceneTick();
    }, Math.max(1200, next - now));
  }

  function nextScene() {
    var now = Date.now();
    var target = (currentSceneIndex() + 1) % SCENES.length;

    sceneState.manualIndex = target;
    sceneState.manualSlot = hourSlot(now);

    applyScene(target, { force: true, breathe: true });
    toast("换了一张 · " + sceneAt(target).name);
  }

  function preloadUpcomingScene() {
    var nextIndex = (scheduledSceneIndex(Date.now()) + 1) % SCENES.length;
    preloadScene(nextIndex);
  }

  function initScene() {
    if (!els.sceneLayers.length || !els.sceneStack) return;

    applyScene(currentSceneIndex(), { force: true });
    scheduleSceneTick();

    if (window.requestIdleCallback) {
      window.requestIdleCallback(preloadUpcomingScene, { timeout: 4000 });
    } else {
      window.setTimeout(preloadUpcomingScene, 2600);
    }
  }

  /* ---------- 日期标题 ---------- */
  function renderToday() {
    var now = new Date();
    var week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    els.today.textContent =
      now.getMonth() + 1 + " 月 " + now.getDate() + " 日 · " + week[now.getDay()];
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    els.input.addEventListener("input", function () {
      updateComposer();
      autoGrow();
    });

    els.input.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        publishPost();
      }
    });

    els.publish.addEventListener("click", publishPost);

    els.feed.addEventListener("click", function (event) {
      var likeBtn = event.target.closest(".like-btn");
      if (likeBtn) {
        toggleLike(likeBtn.dataset.id, likeBtn);
        return;
      }

      var expandBtn = event.target.closest(".expand-btn");
      if (expandBtn) handleExpand(expandBtn);
    });

    els.emptyCta.addEventListener("click", function () {
      els.input.focus();
      els.input.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    els.themeToggle.addEventListener("click", cycleTheme);

    if (els.sceneNext) {
      els.sceneNext.addEventListener("click", nextScene);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;

      refreshTimes();

      // 休眠或跨小时后回到页面，补齐可能错过的壁纸
      var target = currentSceneIndex();
      if (target !== sceneState.index) applyScene(target, { breathe: true });

      if (state.themeMode === "system") applyTheme("system", {});
    });
  }

  /* ---------- 初始化 ---------- */
  function bootstrap() {
    initTheme();
    initScene();
    renderToday();

    state.posts = loadPosts().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    // 首次访问把种子数据落盘，让之后的点赞状态也能持久保存
    persist();

    renderFeed();
    updateComposer();
    autoGrow();
    bindEvents();

    window.setInterval(refreshTimes, 60 * 1000);

    if (!state.storageOK) {
      toast("当前浏览器无法使用本地存储，内容不会保存");
    }
  }

  bootstrap();
})();
