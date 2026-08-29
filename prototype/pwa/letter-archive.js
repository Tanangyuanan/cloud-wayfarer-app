((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CloudWayfarerLetterArchive = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function makeIssue({ id, iso, localText, locationId, locationName, city, cityEnglish, number, image, imageAlt, title, headline, deck, body, cultureBody = "", sources = [], ticketLabel = "TRAVEL TICKET" }) {
    return {
      id: `archive-letter-${id}`,
      kind: "editorial-letter",
      editorialType: "archive",
      locationId,
      locationName,
      routeOrder: number,
      status: "ready",
      context: { localTime: { iso, timezone: "Asia/Shanghai", localText } },
      meta: { generatedAt: iso, archive: true },
      ticket: {
        city,
        cityEnglish,
        issuedOn: iso.slice(0, 7),
        number: `NO.2026-${String(number).padStart(3, "0")}`,
        label: ticketLabel,
        sourceImage: { url: image, alt: imageAlt }
      },
      content: { headline, letterTitle: title, deck, letterBody: body, cultureBody },
      sources,
      delivery: {
        editorial: { cadence: "archive", label: "阿镜旧信" },
        voice: { status: "on-demand", provider: "MiniMax", persona: "阿镜" }
      }
    };
  }

  const issues = [
    makeIssue({
      id: "2026-06-18-guiyang-home",
      iso: "2026-06-18T12:40:00.000Z",
      localText: "2026/06/18周四 20:40:00",
      locationId: "guiyang",
      locationName: "贵阳",
      city: "贵阳",
      cityEnglish: "GUIYANG",
      number: 1,
      image: "/app/assets/guizhou-road.jpg",
      imageAlt: "贵阳雨后的山地道路",
      headline: "先在贵阳住下来",
      title: "行李放下来的第七天",
      deck: "在真正出发以前，阿镜先在贵阳练习怎样过普通的一天。",
      body: "晚上好。你读到这封信时，我已经在贵阳住下第七天了。\n\n房间还没有完全收拾好。雨伞倚在门边，充电线绕着桌脚，几张车票被我压在一本书下面。白天我想着赶快出发，晚上回来又觉得，如果没有一个地方让人晒干鞋、备份照片、把账记清，路就会只剩下不停往前。\n\n所以我先没走。这几天只是认路，买日用品，听窗外的雨什么时候大、什么时候又忽然轻下来。我开始明白，旅行不只是到达别处，也是先找到一个可以回来的地方。你现在读到的，就是我从这间小屋里寄出的第一封信。",
      sources: [{ kind: "阿镜的记录", title: "贵阳生活手帐 · 2026.06.18" }]
    }),
    makeIssue({
      id: "2026-06-26-jiaxiu",
      iso: "2026-06-26T10:20:00.000Z",
      localText: "2026/06/26周五 18:20:00",
      locationId: "guiyang",
      locationName: "贵阳·甲秀楼",
      city: "甲秀楼",
      cityEnglish: "GUIYANG",
      number: 2,
      image: "/prototype/assets/attractions/CTY-003.jpg",
      imageAlt: "甲秀楼与南明河",
      headline: "楼要和河一起看",
      title: "我把镜头往后退了一点",
      deck: "在甲秀楼，阿镜第一次意识到：有些地方不能只带走一个地标。",
      body: "傍晚好。今天我在南明河边站了很久，最后留下的照片，反而不是甲秀楼最完整的那一张。\n\n一开始，我和很多人一样，只想把楼放在画面正中。后来我沿河岸向后走，浮玉桥、涵碧亭、两岸的路和晚归的人慢慢进了镜头。这时候我才看见，它不只是一座供人拍照的古楼，也还在今天的城市路线里。\n\n那天以后，我给自己留了一个小规矩：到一个有名的地方，先别急着靠近，也往后退几步。看看它和水、道路、天际线以及正在过日子的人怎样待在一起。如果你以后也来，你会不会愿意和我一样，把第一张照片留给它与城市的关系？",
      cultureBody: "甲秀楼始建于明万历年间，现在所见经过多次重修。楼、浮玉桥、涵碧亭与南明河共同构成这处城市景观。",
      sources: [{ kind: "事实依据", title: "贵州省人大：甲秀楼的历史与建筑", url: "https://www.gzrd.gov.cn/gzwh/202002/t20200204_77670164.html?isMobile=false" }]
    }),
    makeIssue({
      id: "2026-07-04-qingyan",
      iso: "2026-07-04T07:10:00.000Z",
      localText: "2026/07/04周六 15:10:00",
      locationId: "qingyan",
      locationName: "青岩古镇",
      city: "青岩",
      cityEnglish: "QINGYAN",
      number: 3,
      image: "/prototype/assets/attractions/CTY-001.jpg",
      imageAlt: "青岩古镇的石城街巷",
      headline: "雨后的青岩让我少赶一站",
      title: "那天，我没有把计划全部走完",
      deck: "一段发亮又湿滑的石板路，改掉了阿镜第一版塞得太满的行程表。",
      body: "下午好。青岩的雨停得很快，石板路却没有立刻干。我本来还想赶去另一处，走到背街时，忽然不想再追时间了。\n\n主街的热闹很容易记，我却在城门和背街看得更慢。石墙顺着坡度长起来，被走了很多年的路面发着深色的光。我只要加快一点，鞋底就提醒我：这里不是一张平的古镇地图。\n\n我删掉了下午的第二站，找了个避雨的地方，把走过的路重新画了一遍。原来放弃一个勾，不会让旅行少掉什么。它反而让我第一次把一个地方留在了身体里。你会为了一段想慢慢走的路，放掉原定的下一站吗？",
      cultureBody: "青岩早期承担军事防御功能，后来逐渐发展出商贸和生活空间。当地石材广泛进入城墙、街巷和民居，雨后石板路会更湿滑。",
      sources: [{ kind: "事实依据", title: "贵州省文化资料：青岩古镇", url: "https://www.gzrd.gov.cn/gzwh/202001/t20200106_77670082.html?isMobile=true" }]
    }),
    makeIssue({
      id: "2026-07-13-longchang",
      iso: "2026-07-13T09:30:00.000Z",
      localText: "2026/07/13周一 17:30:00",
      locationId: "xiuwen",
      locationName: "修文·龙场",
      city: "龙场",
      cityEnglish: "XIUWEN",
      number: 4,
      image: "/prototype/assets/culture/HIS-009.jpg",
      imageAlt: "修文龙场阳明文化现场",
      headline: "龙场没有给我一句现成答案",
      title: "有些道理，不是站到洞口就会懂",
      deck: "阿镜带着一句熟悉的结论去龙场，却把更复杂的问题带了回来。",
      body: "傍晚好。来龙场以前，我以为自己已经知道这里的故事：一个人在困境里忽然想通了一件大事。可真的走进这个地方，那句简单的概括开始不够用了。\n\n被贬谪、异乡、讲学、交往，还有明代的政治背景与贵州地方社会，都在“龙场悟道”四个字的后面。我在纪念空间和资料文字之间来回走，发现自己最想知道的，不是那一刻究竟发生了什么，而是一个人怎样把认识慢慢变成行动。\n\n我没有在龙场得到一句可以立刻带走的答案。可这次没有答案，让我以后少了一点把复杂人生压成励志口号的冲动。你最近有没有一件事，也是在真正走近以后，才发现它比原来想的更难？",
      cultureBody: "王阳明被贬谪至贵州龙场后，在当地处境、讲学与交往中继续思考知与行的关系。理解龙场悟道，需要同时看个人经历、历史处境和后来的思想传播。",
      sources: [{ kind: "事实依据", title: "贵州省人大：阳明文化与龙场悟道", url: "https://www.gzrd.gov.cn/gzwh/202405/t20240511_84619757.html" }]
    }),
    makeIssue({
      id: "2026-07-22-zunyi",
      iso: "2026-07-22T11:10:00.000Z",
      localText: "2026/07/22周三 19:10:00",
      locationId: "zunyi",
      locationName: "遵义老城",
      city: "遵义",
      cityEnglish: "ZUNYI",
      number: 5,
      image: "/prototype/assets/culture/RED-004.jpg",
      imageAlt: "遵义老城历史街区",
      headline: "走出会址，再把时间接起来",
      title: "历史不在散会那一刻结束",
      deck: "从一间会议室走回老城街巷，阿镜开始学着把“转折”放回前后的路里。",
      body: "晚上好。今天从遵义会议会址出来以后，我没有马上打车离开，而是在老城里又走了一段。\n\n展陈里的时间线很密，桌椅、旧建筑、文物和后来的讲述又叠在同一个空间里。如果只记住“转折”两个字，它会像一盏突然被点亮的灯。可真实的变化不会在散会时自动完成，它还要通过会后的行军、作战与组织调整，一步一步进入现实。\n\n走出展厅，街巷恢复了今天的声音。我却因为刚才那条时间线，看得比平时慢了一点。我想以后再讲一个重要时刻时，都应该记得问：它之前，人们正在经历什么？它之后，又是怎样才真正改变了路？",
      cultureBody: "遵义会议召开于1935年1月。理解其历史意义，需要将会前处境、会议讨论和会后实践连在一起，并区分历史原物、复原陈设与当代展陈。",
      sources: [{ kind: "事实依据", title: "贵州省民族宗教事务委员会：遵义会议与长征足迹", url: "https://mzt.guizhou.gov.cn/xwzx/mzyw/202412/t20241230_86435861.html" }]
    }),
    makeIssue({
      id: "2026-07-31-hailongtun",
      iso: "2026-07-31T08:35:00.000Z",
      localText: "2026/07/31周五 16:35:00",
      locationId: "hailongtun",
      locationName: "海龙屯",
      city: "海龙屯",
      cityEnglish: "HAILONGTUN",
      number: 6,
      image: "/prototype/assets/hailongtun-now-web.jpg",
      imageAlt: "海龙屯山地关隘遗址",
      headline: "地图上看不见海龙屯的那段坡",
      title: "我把后面两天的路程都删短了",
      deck: "一座山地城堡的尺度，让阿镜第一次用体力而不是景点数量重新排路。",
      body: "下午好。今天这封信写得比平时短一点，因为我走完海龙屯的山路后，只想把腿放平。\n\n地图上的关隘是几个名字，走起来却是坡度、石阶、距离和一次次停下。当我真正向上走，才能理解为什么关隘、城墙、道路和宫殿区要一起看：山势从来不是背景，它本来就参与了防御与统治空间的建立。\n\n回去以后，我把后面两天的路程都删短了。以前我会觉得这是计划失败；今天却觉得，一张不肯让位给身体的路线表，才是真的不可靠。我以后再看山地遗址，会先问路有多陡、风雨会怎样改变它，而不只问有几个点可以拍。",
      cultureBody: "海龙屯与湖南老司城、湖北唐崖土司城共同构成世界文化遗产“土司遗址”。关隘、城墙、宫殿区和道路共同呈现播州土司如何把行政与防御系统嵌入山地。",
      sources: [
        { kind: "事实依据", title: "UNESCO：中国土司遗址", url: "https://whc.unesco.org/en/list/1474/" },
        { kind: "地方资料", title: "贵州省人大：海龙屯与播州土司文化", url: "https://www.gzrd.gov.cn/gzwh/202507/t20250704_88230687.html" }
      ]
    }),
    makeIssue({
      id: "2026-08-09-chishui-river",
      iso: "2026-08-09T10:15:00.000Z",
      localText: "2026/08/09周日 18:15:00",
      locationId: "maotai",
      locationName: "赤水河谷",
      city: "赤水河谷",
      cityEnglish: "CHISHUI RIVER",
      number: 7,
      image: "/prototype/assets/culture/ENV-005.jpg",
      imageAlt: "赤水河谷与沿河城镇",
      headline: "赤水河不肯只讲一种故事",
      title: "我把原来的标题划掉了",
      deck: "酒、古道、渡口、行军与今天的生活，在同一条河上互相挤开了单一答案。",
      body: "傍晚好。今天我坐在赤水河边，把笔记本最上面那个早就想好的标题划掉了。它太像一句完整结论，而这条河不肯只装进一种故事。\n\n古道与渡口记得盐运和商贸，粮食、曲药、季节和生产秩序把酿酒与河谷连在一起，四渡赤水又让不同渡口、支流、道路和时间节点进入历史。这些线索没有一条可以单独代表整条河。更何况今天的城镇、产业、生态保护和沿河生活仍然在继续。\n\n我后来只写下一句：先沿着河走，不要急着替它概括。也许我开始真正喜欢上某个地方的标志，不是我能用一句话说清它，而是我愿意让几种不同的时间同时待在心里。",
      cultureBody: "赤水河流域曾连接盐运、商贸、城镇与酿酒生产。长征期间的四渡赤水发生在不同渡口和战场条件下，需要放回连续的时间与空间中理解。",
      sources: [
        { kind: "流域资料", title: "贵州省人大：贵州酒文化与赤水河", url: "https://www.gzrd.gov.cn/gzwh/202504/t20250411_87504666.html" },
        { kind: "历史资料", title: "贵州红色资源与长征足迹", url: "https://mzt.guizhou.gov.cn/xwzx/mzyw/202412/t20241230_86435861.html" }
      ]
    }),
    makeIssue({
      id: "2026-08-18-chishui-danxia",
      iso: "2026-08-18T08:05:00.000Z",
      localText: "2026/08/18周二 16:05:00",
      locationId: "chishui",
      locationName: "赤水丹霞",
      city: "赤水",
      cityEnglish: "CHISHUI",
      number: 8,
      image: "/prototype/assets/attractions/WAT-003.jpg",
      imageAlt: "赤水丹霞红崖与森林飞瀑",
      headline: "雨天没有浪费赤水",
      title: "我在湿滑的路边收起了相机",
      deck: "雨让红崖变深，也让步道变滑。阿镜开始把天气当成旅行的条件，而不是一个特效。",
      body: "下午好。雨一直没有完全停，红色崖壁比晴天照片里更深，林子里的水声也更近。可我今天最清楚的记忆，是自己在一段湿滑的步道边把相机收了起来。\n\n我原本想追一个更完整的角度，鞋底却已经开始打滑。雨让颜色变得好看，也同时改变了水量、能见度和行走条件。如果我只记录第一件事，就会把真实的赤水写成一张永远不会滑倒的风景图。\n\n所以我没有再往前赶。我站在安全的地方看了一会儿雨，然后慢慢返回。那天没有拍到计划中的照片，却让我记住了一件更重要的事：天气不是旅行的滤镜，它会真的落在脚下，要求人做出选择。",
      cultureBody: "赤水是“中国丹霞”系列世界自然遗产的组成部分。红色砂岩、砾岩经地质过程形成崖壁、峡谷等地貌，湿润气候又让森林与飞瀑覆盖其间。雨天会同时改变景观与安全条件。",
      sources: [{ kind: "事实依据", title: "UNESCO：中国丹霞", url: "https://whc.unesco.org/en/list/1335/" }]
    }),
    makeIssue({
      id: "2026-08-24-guiyang-return",
      iso: "2026-08-24T13:15:00.000Z",
      localText: "2026/08/24周一 21:15:00",
      locationId: "guiyang",
      locationName: "贵阳",
      city: "贵阳",
      cityEnglish: "GUIYANG",
      number: 9,
      image: "/app/assets/guizhou-road.jpg",
      imageAlt: "回到贵阳的山地道路",
      headline: "回来以后，屋子才变成家",
      title: "雨伞还在门边，我却不一样了",
      deck: "从贵阳出发，又回到贵阳。第一段路没有以景点结束，而是以一次归来完成。",
      body: "晚上好。我回贵阳了。推开门时，雨伞还靠在原来的地方，桌下那卷没收好的充电线也没有动。\n\n房间跟我离开时几乎一样，我却第一次觉得它不只是一处租来的住处。我把潮湿的衣服晒起来，把海龙屯那天删短的路程表、赤水河边划掉的标题，还有一路上的车票按时间排好。原来“回来”不是终点，它是让走过的路慢慢变成记忆的那几个小时。\n\n我现在更会给坡度、雨、睡眠和没有答案的时间留位置。也更确定，我想写的不只是“去过哪里”，而是每一处地方怎样让我改了一点主意。你是在这之后来到我的世界的。前面的信都还在，你可以从任何一封开始认识我。",
      sources: [{ kind: "阿镜的记录", title: "贵州第一段行路·归来页 · 2026.08.24" }],
      ticketLabel: "RETURN TICKET"
    })
  ];

  function list() {
    return issues.map((issue) => structuredClone(issue));
  }

  return { list };
});
