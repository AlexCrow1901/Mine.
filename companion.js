/* ========================================================================
   Mine · 陪伴页模块
   ------------------------------------------------------------------------
   功能：
   · 内容应用入口（bento 网格布局）
   · 每日寄语展示
   · 预留扩展：通过 register() 注册具体内容功能
   接入：通过 MineApp.page("companion") 钩子接管占位页。
   ======================================================================== */

window.MineCompanion = (function () {
  "use strict";

  var I = window.MineIcons;
  var pageEl = null;

  /* ========================================================================
     内容应用注册表
     ------------------------------------------------------------------------
     后续扩展：在此添加新条目即可。
     每项格式：
       id:     唯一标识
       icon:   图标名（对应 icons.js 中的 key）
       title:  卡片标题
       desc:   卡片描述
       wide:   是否跨两列（大卡片）
       accent: 是否使用强调色
       soon:   是否显示"待开放"标签
       onOpen: 点击时的回调函数（可选，后续实现具体功能时填充）
     ======================================================================== */
  var CONTENT_APPS = [
    // —— 每日陪伴 ——
    { id: "daily-companion", icon: "sunrise", title: "每日陪伴", desc: "晨间问候 · 今日心境", wide: true, accent: true, soon: true },
    { id: "mood-radio",      icon: "music",    title: "心情电台", desc: "依心绪而生的旋律", soon: true },
    { id: "breathing",       icon: "wind",     title: "呼吸练习", desc: "四拍呼吸 · 安定心神", soon: true },

    // —— 时光记录 ——
    { id: "time-mailbox",    icon: "feather",  title: "次元信箱", desc: "跨越次元的来信", soon: false },
    { id: "memory-album",   icon: "book",     title: "记忆相册", desc: "收藏温暖瞬间", soon: true },
    { id: "night-whispers",  icon: "moon",     title: "深夜树洞", desc: "倾诉此刻的心声", wide: true, soon: false },

    // —— 温暖陪伴 ——
    { id: "food-hunt",      icon: "utensils",  title: "觅食", desc: "塔罗牌抽签今日食", soon: false },
    { id: "quiet-flame",     icon: "flame",    title: "静默炉火", desc: "凝视跳动的火光", soon: true },
    { id: "companion-heart", icon: "heart",   title: "陪伴之心", desc: "此刻有人惦念着你", wide: true, accent: true, soon: true }
  ];

  /* ========================================================================
     每日寄语库 · 经典诗集
     ------------------------------------------------------------------------
     涵盖唐诗、宋词、近代诗、外国诗（博尔赫斯、加缪、林徽因、聂鲁达等）
     每条格式：{ text: 诗句, author: 作者 }
     ======================================================================== */
  var QUOTES = [
    // —— 唐诗 ——
    

    // —— 宋词 ——
    
    // —— 近代诗 ——
     
    { text: "我是天空里的一片云，偶尔投影在你的波心。", author: "徐志摩《偶然》" },
    { text: "你记得也好，最好你忘掉，在这交会时互放的光亮。", author: "徐志摩《偶然》" },
    { text: "我说你是人间的四月天，笑响点亮了四面风。", author: "林徽因《你是人间的四月天》" },
    { text: "你是一树一树的花开，是燕在梁间呢喃，你是爱，是暖，是希望，你是人间的四月天。", author: "林徽因《你是人间的四月天》" },
    { text: "雪化后那篇鹅黄，你像；新鲜初放芽的绿，你是。", author: "林徽因《你是人间的四月天》" },
    { text: "黑夜给了我黑色的眼睛，我却用它寻找光明。", author: "顾城《一代人》" },
    { text: "草在结它的种子，风在摇它的叶子。我们站着，不说话，就十分美好。", author: "顾城《门前》" },
    { text: "我希望，每一个时刻，都像彩色蜡笔那样美丽。", author: "顾城《我是一个任性的孩子》" },
    { text: "从明天起，做一个幸福的人，喂马，劈柴，周游世界。", author: "海子《面朝大海，春暖花开》" },
    { text: "我只愿面朝大海，春暖花开。", author: "海子《面朝大海，春暖花开》" },
    { text: "远方除了遥远一无所有。", author: "海子《远方》" },
    { text: "风后面是风，天空上面是天空，道路前面还是道路。", author: "海子《四姐妹》" },
    { text: "活在这珍贵的人间，太阳强烈，水波温柔。", author: "海子《活在这珍贵的人间》" },
    { text: "我达达的马蹄是美丽的错误，我不是归人，是个过客。", author: "郑愁予《错误》" },
    { text: "如何让你遇见我，在我最美丽的时刻。", author: "席慕蓉《一棵开花的树》" },
    { text: "佛于是把我化作一棵树，长在你必经的路旁，阳光下慎重地开满了花。", author: "席慕蓉《一棵开花的树》" },
    { text: "涉江而过，芙蓉千朵，诗也简单，心也简单。", author: "席慕蓉《无题》" },
    { text: "乡愁是一枚小小的邮票，我在这头，母亲在那头。", author: "余光中《乡愁》" },
    { text: "酒入豪肠，七分酿成了月光，余下的三分啸成剑气，绣口一吐就半个盛唐。", author: "余光中《寻李白》" },
    { text: "给我一瓢长江水啊长江水，酒一样的长江水。", author: "余光中《乡愁四韵》" },
    { text: "若逢新雪初霁，满月当空，下面平铺着皓影，上面流转着亮银。", author: "余光中《绝色》" },
    { text: "你在桥上看风景，看风景人在楼上看你。", author: "卞之琳《断章》" },
    { text: "明月装饰了你的窗子，你装饰了别人的梦。", author: "卞之琳《断章》" },
  
    { text: "天空在海里，鱼在云里，你在我心里。", author: "戴望舒《雨巷》" },
    { text: "撑着油纸伞，独自彷徨在悠长、悠长又寂寥的雨巷。", author: "戴望舒《雨巷》" },
    { text: "她是有，丁香一样的颜色，丁香一样的芬芳，丁香一样的忧愁。", author: "戴望舒《雨巷》" },
    
    { text: "我如果爱你，绝不像攀援的凌霄花，借你的高枝炫耀自己。", author: "舒婷《致橡树》" },
    { text: "我必须是你近旁的一株木棉，作为树的形象和你站在一起。", author: "舒婷《致橡树》" },
    { text: "我们分担寒潮、风雷、霹雳；我们共享雾霭、流岚、虹霓。", author: "舒婷《致橡树》" },
   

    // —— 外国诗 ——
    { text: "我用什么才能留住你？我给你瘦落的街道、绝望的落日、荒郊的月亮。我给你一个久久地望着孤月的人的悲哀。", author: "博尔赫斯《英文诗两首》" },
   
  
    { text: "在入选不朽的事件之中，爱情是唯一需要肉身的事。", author: "博尔赫斯《爱情的预见》" },
    { text: "真正严肃的哲学问题只有一个：那就是自杀。判断生活是否值得经历，这本身就是在回答哲学的根本问题。", author: "加缪《西西弗的神话》" },
    { text: "在隆冬，我终于知道，我身上有一个不可战胜的夏天。", author: "加缪《重返提帕萨》" },
     
  
    { text: "我爱你，如同某些黑暗的事物需要被秘密地爱着。", author: "聂鲁达《二十首情诗》" },
    { text: "今夜我可以写出最哀伤的诗篇。", author: "聂鲁达《二十首情诗·第二十首》" },
    { text: "我喜欢你是寂静的，仿佛你消失了一样。", author: "聂鲁达《我喜欢你是寂静的》" },
    { text: "你就像我的灵魂，一只梦的蝴蝶，你如同忧郁这个词。", author: "聂鲁达《我喜欢你是寂静的》" },
    { text: "让我在你的沉默中安静无声。", author: "聂鲁达《我喜欢你是寂静的》" },
    { text: "你的沉默明亮如灯，简单如指环。", author: "聂鲁达《我喜欢你是寂静的》" },
    { text: "我们错过了这个晚霞。今天黄昏没人看见它经过。", author: "聂鲁达《晚霞》" },
    { text: "爱那么短，遗忘那么长。", author: "聂鲁达《二十首情诗》" },
    { text: "我是荒野与天空的对话。", author: "聂鲁达《马丘比丘之巅》" },
    { text: "我记得你去年秋天的模样，灰色的贝雷帽，平静的心。", author: "聂鲁达《二十首情诗·第一首》" },
    { text: "假如生活欺骗了你，不要悲伤，不要心急。忧郁的日子里须要镇静。", author: "普希金《假如生活欺骗了你》" },
    { text: "而那过去了的，就会成为亲切的怀恋。", author: "普希金《假如生活欺骗了你》" },
    { text: "我曾经爱过你，爱情也许在我的心灵里还没有完全消亡。", author: "普希金《我曾经爱过你》" },
    { text: "但愿上帝保佑你，另一个人也会像我一样地爱你。", author: "普希金《我曾经爱过你》" },
    { text: "冬天来了，春天还会远吗？", author: "雪莱《西风颂》" },
    { text: "如果你冬天来了，春天还会远吗？", author: "雪莱《西风颂》" },
    { text: "把我的话语，像是灰烬和火星，从还未熄灭的炉火向人间播散。", author: "雪莱《西风颂》" },
    { text: "让预言的号角奏鸣！哦，风啊，如果冬天来了，春天还会远吗？", author: "雪莱《西风颂》" },
    { text: "我怎样爱你？让我来数一数。", author: "勃朗宁夫人《葡萄牙人十四行诗》" },
    { text: "我爱你直到我灵魂所及的深度、广度和高度。", author: "勃朗宁夫人《葡萄牙人十四行诗》" },
    { text: "我爱你以我童年的信仰，我爱你在日落时的圣洁。", author: "勃朗宁夫人《葡萄牙人十四行诗》" },
 
 
 
    { text: "我要在你身上做春天在樱桃树上做的事。", author: "聂鲁达《二十首情诗》" },
    { text: "夜晚的鸟群啄食第一阵群星，像爱着你的我的灵魂，闪烁着。", author: "聂鲁达《二十首情诗》" },
    { text: "我活着，我悲伤，我爱，我活着。", author: "加缪《日记》" },
    { text: "在世界的尽头，我看见了一片荒原，那就是自由的领地。", author: "加缪《反抗者》" },
    { text: "我永远是我自己的囚徒。", author: "博尔赫斯" },
    { text: "所有的距离都已消失，所有的话语都已说完。", author: "博尔赫斯《边界》" },
    { text: "玫瑰即玫瑰，花开无因由。", author: "博尔赫斯《玫瑰与弥尔顿》" },
    { text: "不是河流，而是水在流淌；不是我在生活，而是生活在流淌。", author: "博尔赫斯" },
    { text: "世界是一个舞台，所有的男男女女不过是一些演员。", author: "莎士比亚《皆大欢喜》" },
    { text: "生存还是毁灭，这是一个问题。", author: "莎士比亚《哈姆雷特》" },
    { text: "玫瑰不叫玫瑰，依然芳香如故。", author: "莎士比亚《罗密欧与朱丽叶》" },
    { text: "黑夜无论怎样悠长，白昼总会到来。", author: "莎士比亚《麦克白》" },
    { text: "我能否将你比作夏日？你比夏日更加温婉可爱。", author: "莎士比亚《十四行诗·第十八首》" },
    { text: "只要人类还在呼吸，眼睛还在看，这首诗就将长存，并赐予你生命。", author: "莎士比亚《十四行诗·第十八首》" },
    { text: "爱不是爱，当别人变迁时它也变迁。", author: "莎士比亚《十四行诗·第一一六首》" },
    { text: "我们最甜美的歌声，讲述的是最悲伤的思绪。", author: "雪莱《致云雀》" },
    { text: "我见过你哭。一滴明亮的泪涌上你蓝色的眼珠。", author: "拜伦《我见过你哭》" },
    { text: "她步履轻盈，走在美的光彩中。", author: "拜伦《她走在美的光彩中》" },
    { text: "一切都将逝去，唯有爱永存。", author: "但丁《神曲》" },
    { text: "在我的生命中，没有什么比你的存在更真实。", author: "但丁《神曲》" },
    { text: "走自己的路，让别人去说吧。", author: "但丁《神曲》" },
    { text: "当你老了，头发花白，睡意沉沉，倦坐在炉边，取下这本书来，慢慢读着。", author: "叶芝《当你老了》" },
    { text: "只有一个人爱你那朝圣者的灵魂，爱你衰老了的脸上痛苦的皱纹。", author: "叶芝《当你老了》" },
    { text: "一切都四散了，再也保不住中心。", author: "叶芝《第二次降临》" },
    { text: "而我，曾是一切，如今只是灰烬。", author: "里尔克" },
    { text: "每一道光都是一次温柔的暴力。", author: "加缪《西西弗的神话》" },
    { text: "幸福不是一切，人还有责任。", author: "加缪《鼠疫》" },
    { text: "在苦难的中途，我学会了幸福。", author: "加缪《重返提帕萨》" },
    { text: "无论我走到哪里，你都在那里。", author: "聂鲁达《二十首情诗》" },
    { text: "你的手是白色的，是飞翔的雪。", author: "聂鲁达《二十首情诗》" },
    { text: "沉默的夜晚，星星像牛奶一样流淌。", author: "聂鲁达" },
    { text: "我不再爱她，这是确定的，但也许我爱她。", author: "聂鲁达《二十首情诗·第二十首》" },
    { text: "我的声音试图借着风寻到你。", author: "聂鲁达" },
    { text: "月亮转过它梦白色的纸页。", author: "博尔赫斯《月亮》" },
    { text: "我给你一个从未有过信仰的人的忠诚。", author: "博尔赫斯《英文诗两首》" },
    { text: "我给你我设法保全的我自己的核心，不依附语言，不依附梦幻，自由自在。", author: "博尔赫斯《英文诗两首》" },
    { text: "不存在的事物只有一样，那就是遗忘。", author: "博尔赫斯《致一枚硬币》" },

    // —— 其他经典 ——
    { text: "人生若只如初见，何事秋风悲画扇。", author: "纳兰性德《木兰花》" },
    { text: "一生一代一双人，争教两处销魂。", author: "纳兰性德《画堂春》" },
    { text: "当时只道是寻常。", author: "纳兰性德《浣溪沙》" },
    { text: "山一程，水一程，身向榆关那畔行，夜深千帐灯。", author: "纳兰性德《长相思》" },
    { text: "风一更，雪一更，聒碎乡心梦不成，故园无此声。", author: "纳兰性德《长相思》" },
    { text: "我是人间惆怅客，知君何事泪纵横。", author: "纳兰性德《浣溪沙》" },
    { text: "世间所有的相遇，都是久别重逢。", author: "白落梅" },
    { text: "从前的日色变得慢，车、马、邮件都慢，一生只够爱一个人。", author: "木心《从前慢》" },
    { text: "从前的锁也好看，钥匙精美有样子，你锁了，人家就懂了。", author: "木心《从前慢》" },
    { text: "岁月不饶人，我亦未曾饶过岁月。", author: "木心" },
    { text: "凡事到了回忆的时候，真实得像假的一样。", author: "木心" },
    { text: "我是一个在黑暗中大雪纷飞的人哪。", author: "木心" },
    { text: "你站在桥上看风景，看风景人在楼上看你。明月装饰了你的窗子，你装饰了别人的梦。", author: "卞之琳《断章》" },
    { text: "面朝大海，春暖花开。", author: "海子" },
    { text: "要有最朴素的生活和最遥远的梦想，即使天寒地冻，路远马亡。", author: "海子" },
    { text: "远方除了遥远一无所有，更远的地方，更加孤独。", author: "海子《远方》" },
    { text: "天空一无所有，为何给我安慰。", author: "海子《黑夜的献诗》" },
    { text: "风后面是风，天空上面是天空，道路前面还是道路。", author: "海子《四姐妹》" },
    { text: "活在这珍贵的人间，人类和植物一样幸福，爱情和雨水一样幸福。", author: "海子《活在这珍贵的人间》" },
    { text: "黑夜从大地上升起，遮住了天空。", author: "海子《黑夜的献诗》" },
    { text: "秋天的屋顶又苦又香，秋天使人崩溃。", author: "海子《秋》" },
    { text: "春天，十个海子全部复活。", author: "海子《春天，十个海子》" },
    { text: "我有一所房子，面朝大海，春暖花开。", author: "海子《面朝大海，春暖花开》" },
    { text: "愿你有情人终成眷属，愿你在尘世获得幸福。", author: "海子《面朝大海，春暖花开》" }
  ];

  /* ---------------- 工具 ---------------- */
  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function getDailyQuote() {
    /* 每隔 12 小时随机抽取一句，同一 12 小时窗口内结果一致 */
    var now = new Date();
    var halfDayIndex = Math.floor(now.getTime() / 43200000); // 43200000ms = 12小时
    // 用时间窗口作为种子做伪随机，确保同一窗口内结果一致
    var seed = halfDayIndex;
    var rand = function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    // 多次迭代使种子更分散
    for (var i = 0; i < 10; i++) { rand(); }
    var idx = Math.floor(rand() * QUOTES.length);
    return QUOTES[idx];
  }

  /** 每隔 12 小时从联系人列表中随机抽取一位，返回其昵称 */
  function getDailyPersonName() {
    var C = window.MineContacts;
    if (!C || !C.loadData) return "";
    C.loadData();
    var contacts = (C.getState && C.getState().contacts) || [];
    if (contacts.length === 0) return "";
    var now = new Date();
    var halfDayIndex = Math.floor(now.getTime() / 43200000); // 43200000ms = 12小时
    // 用不同偏移量的种子，确保和诗句不总是抽到同一索引
    var seed = halfDayIndex + 7777;
    var rand = function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (var i = 0; i < 10; i++) { rand(); }
    var idx = Math.floor(rand() * contacts.length);
    return contacts[idx].name || "";
  }

  function getGreeting() {
    var h = new Date().getHours();
    if (h < 6)  return "深夜好，愿雾散心宁";
    if (h < 11) return "早安，新的一天开始了";
    if (h < 14) return "午安，歇歇脚吧";
    if (h < 18) return "午后好，阳光正柔";
    if (h < 22) return "晚安，一天辛苦了";
    return "夜深了，注意保暖";
  }

  /* ========================================================================
     渲染：内容卡片 HTML
     ======================================================================== */
  function cardHTML(app) {
    var wide = app.wide ? " is-wide" : "";
    var accent = app.accent ? " is-accent" : "";
    var soon = app.soon ? '<span class="comp-soon">待开放</span>' : "";
    var badge = window.MineNotify ? MineNotify.badgeHTML(app.id) : "";

    return '<div class="comp-card' + wide + accent + '" role="button" tabindex="0" data-app="' + app.id + '">' +
      soon +
      '<div class="comp-card-glow"></div>' +
      '<div class="comp-card-icon">' + I.svg(app.icon, 22) + '</div>' + badge +
      '<div class="comp-card-body">' +
        '<div class="comp-card-title">' + escapeHtml(app.title) + '</div>' +
        '<div class="comp-card-desc">' + escapeHtml(app.desc) + '</div>' +
      '</div>' +
      '</div>';
  }

  /* ========================================================================
     渲染：陪伴页主体
     ======================================================================== */
  function viewCompanion() {
    var html = '';

    // 导航栏
    html += '<div class="nav-bar">' +
      '<button class="nav-btn" data-act="back">' + I.svg("back", 20) + '返回</button>' +
      '<span class="nav-title">陪伴</span>' +
      '<span class="nav-right"></span>' +
      '</div>';

    html += '<div class="scroll">';

    // 顶部问候
    html += '<div class="comp-hero">';
    html += '<div class="comp-hero-title">陪伴</div>';
    html += '<div class="comp-hero-sub">' + getGreeting() + '</div>';
    html += '</div>';

    // 每日寄语
    var quote = getDailyQuote();
    var personName = getDailyPersonName();
    var label = personName ? personName + "的今日寄语" : "今日寄语";
    html += '<div class="comp-quote">';
    html += '<div class="comp-quote-label">' + escapeHtml(label) + '</div>';
    html += '<div class="comp-quote-text">' + escapeHtml(quote.text) + '</div>';
    html += '<div class="comp-quote-author">—— ' + escapeHtml(quote.author) + '</div>';
    html += '</div>';

    // 内容应用网格
    html += '<div class="comp-grid">';

    // 分区：每日陪伴
    html += '<div class="comp-section-label">每日陪伴</div>';
    CONTENT_APPS.filter(function (a) {
      return ["daily-companion", "mood-radio", "breathing"].indexOf(a.id) >= 0;
    }).forEach(function (a) { html += cardHTML(a); });

    // 分区：时光记录
    html += '<div class="comp-section-label">时光记录</div>';
    CONTENT_APPS.filter(function (a) {
      return ["time-mailbox", "memory-album", "night-whispers"].indexOf(a.id) >= 0;
    }).forEach(function (a) { html += cardHTML(a); });

    // 分区：温暖陪伴
    html += '<div class="comp-section-label">温暖陪伴</div>';
    CONTENT_APPS.filter(function (a) {
      return ["food-hunt", "quiet-flame", "companion-heart"].indexOf(a.id) >= 0;
    }).forEach(function (a) { html += cardHTML(a); });

    html += '</div>'; // .comp-grid
    html += '</div>'; // .scroll

    return html;
  }

  /* ========================================================================
     绑定交互
     ======================================================================== */
  function bindCompanion() {
    if (!pageEl) return;

    // 返回按钮
    var backBtn = pageEl.querySelector('[data-act="back"]');
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (window.MineApp && MineApp.goHome) MineApp.goHome();
      });
    }

    // 内容卡片点击
    pageEl.querySelectorAll(".comp-card").forEach(function (card) {
      card.addEventListener("click", function () {
        onCardTap(card.getAttribute("data-app"));
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardTap(card.getAttribute("data-app"));
        }
      });
    });
  }

  /* ---------------- 卡片点击处理 ----------------
     后续在此分发到具体功能模块。
     目前所有内容均为"待开放"状态，显示轻量提示。 */
  function onCardTap(appId) {
    var app = findApp(appId);
    if (!app) return;

    // 标记已查看该卡片的通知
    if (window.MineNotify) MineNotify.markSeen(appId);

    // 预留：若已注册具体功能，则调用
    if (typeof app.onOpen === "function") {
      app.onOpen();
      return;
    }

    // 默认：轻量提示（后续替换为具体功能页面）
    showSoonToast(app.title);
  }

  function findApp(id) {
    for (var i = 0; i < CONTENT_APPS.length; i++) {
      if (CONTENT_APPS[i].id === id) return CONTENT_APPS[i];
    }
    return null;
  }

  /* ---------------- 轻量提示 ---------------- */
  var toastTimer = null;
  function showSoonToast(title) {
    if (toastTimer) { clearTimeout(toastTimer); }

    // 移除已有 toast
    var existing = document.querySelector(".comp-toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.className = "comp-toast";
    toast.innerHTML = '<span class="comp-toast-icon">' + I.svg("moon", 18) + '</span>' +
      '<span class="comp-toast-text">' + escapeHtml(title) + ' · 即将开放</span>';
    document.body.appendChild(toast);

    // 触发动画
    requestAnimationFrame(function () {
      toast.classList.add("is-show");
    });

    toastTimer = setTimeout(function () {
      toast.classList.remove("is-show");
      setTimeout(function () { toast.remove(); }, 300);
    }, 1800);
  }

  /* ========================================================================
     对外接口
     ======================================================================== */
  function open() {
    if (!pageEl) pageEl = document.getElementById("page-companion");
    if (!pageEl) return;
    pageEl.innerHTML = viewCompanion();
    bindCompanion();
    if (window.MineApp && MineApp.switchPage) MineApp.switchPage("companion");
  }

  /* ---------------- 扩展接口 ----------------
     供后续模块注册具体功能：
       MineCompanion.register("mood-radio", function () { ... });
     注册后，点击对应卡片将调用该回调而非显示"待开放"提示。 */
  function register(appId, callback) {
    var app = findApp(appId);
    if (app) {
      app.onOpen = callback;
      app.soon = false;
    }
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    pageEl = document.getElementById("page-companion");
    // 注册次元信箱
    register("time-mailbox", function () {
      if (window.MineMail) window.MineMail.open();
    });
    // 注册深夜树洞
    register("night-whispers", function () {
      if (window.MineTreeHole) window.MineTreeHole.open();
    });
    // 注册心情电台
    register("mood-radio", function () {
      if (window.MineRadio) window.MineRadio.open();
    });
    // 注册觅食
    register("food-hunt", function () {
      if (window.MineFoodie) window.MineFoodie.open();
    });
  }

  /* ---------------- 注册页面钩子（链式，不覆盖其他模块） ---------------- */
  window.MineApp = window.MineApp || {};
  var prevPage = window.MineApp.page;
  window.MineApp.page = function (id) {
    if (id === "companion") { open(); return true; }
    return prevPage ? prevPage(id) : false;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    open: open,
    register: register,
    getApps: function () { return CONTENT_APPS.slice(); }
  };
})();
