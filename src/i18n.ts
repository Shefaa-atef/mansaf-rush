export type Lang = 'en' | 'ar';

/** Keeps a figure like "+13" reading left to right inside Arabic text, where a bare plus sign drifts to the wrong side of the number. */
export const isolateLtr = (text: string) => `\u2066${text}\u2069`;

export const TRANSLATIONS = {
  en: {
    names: ['You', 'Zaid', 'Omar', 'Sami'],
    traits: ['Your Seat', 'Quick Bites', 'Steady Eater', 'Big Appetite'],

    meta: {
      title: 'Mansaf Rush — A seat at the platter',
    },

    // Keyboard key labels drawn on the on-screen key caps.
    keys: {
      space: 'SPACE',
    },

    // Text read out by screen readers only.
    a11y: {
      openMenu: 'Open Menu',
      closeGuide: 'Close guide',
    },

    lobby: {
      ariaLabel: 'Mansaf Rush',
      edition: 'DINNER IS ON!',
      soundOn: 'Sound: on',
      soundOff: 'Sound: off',
      tagline: 'One platter. Four appetites. Can you beat the boys?',
      start: 'LET’S EAT!',
      preparing: 'PREPARING…',
      loadingLabel: 'Preparing the platter…',
      loadingTips: [
        'Hold SPACE to scoop rice, then alternate ← and → to roll it round.',
        'Catch a piece of lamb or an almond in your scoop for bonus points.',
        'A round lokma is worth far more than a squashed one — stop rolling while it is green.',
      ],
      loadingTipsMobile: [
        'Use the wheel to reach the rice, hold Scoop to fill your palm, then tap left and right to roll it round.',
        'Catch a piece of lamb or an almond in your scoop for bonus points.',
        'A round lokma is worth far more than a squashed one — stop rolling while it is green.',
      ],
      keyboardNote: 'KEYBOARD REQUIRED',
      rivalsHeading: 'THE BOYS ARE READY',
      guideHeading: 'MAKE EVERY BITE COUNT',
      guideSubtitle: 'Three moves. One perfect lokma.',
      footerTagline: 'ONE PLATTER. FOUR APPETITES.',
      brand: 'MANSAF RUSH',
    },

    header: {
      remaining: 'Mansaf Left',
      menu: 'Menu',
      logoAlt: 'Mansaf Rush Logo',
      langBtn: 'العربية',
    },

    intro: {
      eyebrow: 'WELCOME TO THE MAJLIS',
      title: 'How to Play',
      stepPill: (current: number, total: number) => `STEP ${current} OF ${total}`,
      steps: [
        {
          title: 'Scoop',
          desc: 'Move over the rice with the arrow keys and hold SPACE to scoop. Let go of SPACE when you have enough. Catch lamb or an almond for bonus points.',
          label: 'Scoop rice from the platter using the arrow keys and SPACE',
        },
        {
          title: 'Roll',
          desc: 'Alternate the left and right arrows — ← then → then ← — to roll the rice into a circle, no need to hold SPACE. A bigger scoop takes more rolls. Stop while it is green, or it gets squashed.',
          label: 'Roll the rice into a ball with the left and right arrows',
        },
        {
          title: 'Eat',
          desc: 'Once your lokma is ready, press the up arrow to eat and score. Go back for another bite!',
          label: 'Lift the lokma to your mouth with the up arrow',
        },
      ],
      back: '◀ Back',
      next: 'Next Step ➔',
      letsEat: 'Let’s Eat! ↗',
    },

    pauseMenu: {
      eyebrow: 'PAUSED',
      title: 'Game Menu',
      resume: '▶ Resume Game',
      howToPlay: '📖 How to Play',
      soundOn: '🔊 Sound: On',
      soundMuted: '🔇 Sound: Muted',
      restart: '🔄 Restart Game',
      switchLang: '🌐 Language: العربية',
    },

    guide: {
      eyebrow: 'GAMEPLAY GUIDE',
      title: 'How to Play',
      card1Title: '1. Move Hand',
      card1Desc: 'Use Arrow Keys (← → ↑ ↓) to move over rice on the platter.',
      card2Title: '2. Scoop',
      card2Desc: 'Hold SPACE over rice and steer with the arrows. Let go when you have enough. Lamb and almonds are worth bonus points.',
      card3Title: '3. Roll into a Circle',
      card3Desc: 'Alternate ← & → to roll — no need to hold SPACE. A bigger scoop takes more rolls. Stop while the gauge is GREEN, or it gets squashed!',
      card4Title: '4. Eat & Score',
      card4Desc: 'Press Up Arrow (↑) to bring the round Lokma to your mouth and eat!',
      gotIt: 'Got it!',
    },

    results: {
      victory: 'VICTORY',
      roundComplete: 'ROUND COMPLETE',
      youWin: 'You Win!',
      youLost: 'You Lost!',
      winSubline: 'You cleaned the platter better than anyone at the majlis!',
      loseSubline: (winnerName: string, rank: number) =>
        `${winnerName} finished first — you placed #${rank}.`,
      pts: 'PTS',
      playAgain: 'Play Again ↻',
      tryAgain: 'Try Again ↻',
      backToLobby: '🏠 Main Menu',
    },

    scoreboard: {
      youBadge: 'YOU',
      pts: 'pts',
    },

    hud: {
      eating: 'Eating Lokma...',
      lokmaReadyBadge: '🎯 LOKMA READY!',
      eatAction: 'Eat',
      rollProgress: (rolls: number, target: number) => `Roll into a circle (${rolls}/${target})`,
      enoughBadge: '🎯 ENOUGH RICE! LET GO OF SPACE',
      dry: 'No rice under your hand. Slide to the rice!',
      hold: 'Hold',
      toScoop: 'to Scoop',
      move: 'Move',
      scoop: 'Scoop',
    },

    // The gauge belongs to the roll: yellow is still loose, green is a round circle, red is squashed.
    meter: {
      zoneLoose: 'LOOSE',
      zoneRound: 'ROUND',
      zoneSquashed: 'SQUASHED',
      rollProgress: (rolls: number, target: number) =>
        `Roll into a circle: ${rolls}/${target} (← / →)`,
      perfectRound: 'Round! Stop rolling and press ↑',
      squashed: 'Squashed! Press ↑',
    },

    lokmaLabels: {
      tooLoose: 'Oops! Lokma too loose!',
      delicious: 'Eating delicious Lokma!',
      roundReady: '🎯 ROUND LOKMA READY! Press ↑ to Eat!',
      squashed: '💥 SQUASHED! Press ↑ to Eat',
      enough: '🎯 ENOUGH RICE! LET GO OF SPACE!',
      scooping: 'SCOOPING... HOLD SPACE FOR MORE RICE',
      defaultGuide: 'Use ARROWS to move · Hold SPACE to scoop rice',
      shapingHold: (rolls: number, target: number) => `ALTERNATE ← / → TO ROLL (${rolls}/${target})`,
    },

    feedback: {
      perfect: '✨ Perfect Lokma!',
      squashed: '💥 Squashed!',
      lamb: (pts: number) => ` · 🥩 Lamb ${isolateLtr(`+${pts}`)}`,
      almond: (pts: number) => ` · 🥜 Almond ${isolateLtr(`+${pts}`)}`,
      roundLokma: 'Round lokma! Press ↑ to eat. Too much rolling squashes it.',
      overRolled: 'Too much rolling: it is getting squashed!',
      almostSquashed: 'Careful! One more roll squashes it.',
      rollHint: (rolls: number, target: number) => `Alternate ← / → to roll (${rolls}/${target})`,
      finishRolling: 'Finish rolling by alternating ← / →, then press Up to eat.',
      smallScoop: 'Not enough rice! Keep holding SPACE to scoop more.',
      scooped: (rolls: number) => `Scooped! Alternate ← / → ${rolls} times to roll it into a circle.`,
      alternateHint: 'Switch sides! ← then → then ← again to roll it.',
    },

    // Table-talk bubbles above the bots' heads. Lines are dealt from a shuffled
    // deck (see phraseDealer.ts), so keep every line unique and keep both
    // languages the same length.
    opponent: {
      missed: [
        'MISSED!',
        '😵 It slipped away!',
        '😩 What a shame!',
        '🤦 Oops, I spilled it!',
        '😅 Nothing, zilch!',
        '🙄 Where did it go?!',
        '😤 There goes the lokma!',
      ],
      eat: [
        '🍚 Dahbirha! Roll it!',
        '🐑 Romanian or baladi lamb?',
        '🌰 Almond or pine nut?',
        '🥣 Sharrib, sharrib! Soak it!',
        '😋 So tasty!',
        '🥣 Real karaki jameed!',
        '🤲 Bismillah',
        '✨ Alhamdulillah',
        '💛 Bless mom’s hands!',
        '🔥 Wow, this jameed!',
        '😅 Easy, man, easy!',
        '🐑 The lamb just melts!',
        '🤤 Crazy good, I swear!',
        '😤 That piece is mine!',
        '😂 Leave some for the guests!',
        '🍚 Eat in joy and health!',
        '👌 Yummy, boss!',
        '😍 It doesn’t get better!',
        '🥄 More jameed for me!',
        '😎 I’m the mansaf master!',
        '🥜 More almonds, boss!',
        '🍚 Roll it and say Bismillah!',
        '🔥 Hot, hot, hot!',
        '🐐 Lamb or goat?',
        '🥛 Is that laban or jameed?',
        '😋 Can’t get enough!',
        '🙏 Bless you all, hosts!',
      ],
    },
  },

  ar: {
    names: ['أنت', 'زيد', 'عمر', 'سامي'],
    traits: ['مكانك', 'لقمة سريعة', 'ياكل على مهله', 'شهية مفتوحة'],

    meta: {
      title: 'منسف رش — مكانك عالسدر',
    },

    // Keyboard key labels drawn on the on-screen key caps.
    keys: {
      space: 'المسافة',
    },

    // Text read out by screen readers only.
    a11y: {
      openMenu: 'فتح القائمة',
      closeGuide: 'إغلاق',
    },

    lobby: {
      ariaLabel: 'منسف رش',
      edition: 'العزومة بلّشت!',
      soundOn: 'الصوت: شغّال',
      soundOff: 'الصوت: مكتوم',
      tagline: 'سدر واحد، أربع شهيات. بتقدر تسبق الشباب؟',
      start: 'يلا ناكل!',
      preparing: 'عم نجهّز...',
      loadingLabel: 'عم نجهّز السدر...',
      loadingTips: [
        'دوس المسافة تجمّع رز، وبعدين بدّل ← و → عشان تدحبرها لقمة.',
        'إذا لقيت قطعة لحمة أو لوزة بالرز، اجمعها وياها عشان نقاط زيادة.',
        'اللقمة الدايرة بتسوى نقاط أكتر بكثير من المعجونة — وقّف وهي خضرا.',
      ],
      loadingTipsMobile: [
        'حرّك العجلة نحو الرز وادعس جمّع لتملي كفّك، وبعدين اضغط يمين ويسار عشان تدحبرها لقمة.',
        'إذا لقيت قطعة لحمة أو لوزة بالرز، اجمعها وياها عشان نقاط زيادة.',
        'اللقمة الدايرة بتسوى نقاط أكتر بكثير من المعجونة — وقّف وهي خضرا.',
      ],
      keyboardNote: 'العب بلوحة المفاتيح',
      rivalsHeading: 'الشباب جاهزين',
      guideHeading: 'أصول اللقمة',
      guideSubtitle: 'ثلاث حركات… وبتصير معلّم منسف.',
      footerTagline: 'سدر واحد. أربع شهيات.',
      brand: 'منسف رش',
    },

    header: {
      remaining: 'باقي من المنسف',
      menu: 'القائمة',
      logoAlt: 'شعار منسف رش',
      langBtn: 'English',
    },

    intro: {
      eyebrow: 'أهلاً بك في المجلس',
      title: 'كيف بنلعب؟',
      stepPill: (current: number, total: number) => `الخطوة ${current} من ${total}`,
      steps: [
        {
          title: 'جمّع',
          desc: 'حرّك إيدك بالأسهم فوق الرز، ودوس عالمسافة وضلّك دايس لتجمّع كفّ رز. لمّا يصير الرز كفاية فلّت المسافة. وإذا لقيت قطعة لحمة أو لوزة شيلها معك وبتاخد نقاط زيادة.',
          label: 'جمّع الرز من السدر بالأسهم والمسافة',
        },
        {
          title: 'دحبر',
          desc: 'بدّل بين السهم اليمين واليسار — يمين وبعدين يسار وهيك بالتبادل — لتدحبر اللقمة دايرة، بلا ما تحتاج تدوس المسافة. كل ما كان الرز أكتر بدها دحبرة أكتر. وقّف وهي بالأخضر، وإذا زوّدتها بتنعجن.',
          label: 'دحبر لقمة الرز بالسهمين اليمين واليسار',
        },
        {
          title: 'القم',
          desc: 'لمّا تجهز اللقمة دوس السهم لفوق عشان تاكل وتجمع نقاط. وارجع للقمة اللي بعدها!',
          label: 'ارفع اللقمة لتمّك بالسهم لفوق',
        },
      ],
      back: 'السابق ➔',
      next: 'الخطوة التالية ◀',
      letsEat: 'صحتين وعافية! يلا ناكل ◀',
    },

    pauseMenu: {
      eyebrow: 'اللعبة واقفة',
      title: 'قائمة اللعبة',
      resume: '◀ كمّل اللعب',
      howToPlay: '📖 كيف بنلعب؟',
      soundOn: '🔊 الصوت: شغّال',
      soundMuted: '🔇 الصوت: مكتوم',
      restart: '🔄 ابدأ من جديد',
      switchLang: '🌐 اللغة: English',
    },

    guide: {
      eyebrow: 'كيف بنلعب',
      title: 'كيف بنلعب؟',
      card1Title: '١. حرّك إيدك',
      card1Desc: 'حرّك إيدك فوق الرز بالسدر بالأسهم (← → ↑ ↓).',
      card2Title: '٢. جمّع',
      card2Desc: 'دوس المسافة فوق الرز وحرّك بالأسهم وجمّع كفّ. لمّا يصير كفاية فلّت المسافة. اللحمة واللوز إلهم نقاط زيادة.',
      card3Title: '٣. دحبر',
      card3Desc: 'بدّل ← و → عشان تدحبر، بلا ما تحتاج تدوس المسافة. الرز الأكتر بدو دحبرة أكتر. وقّف وهي بالأخضر، وإذا زوّدتها بتنعجن!',
      card4Title: '٤. كُل واجمع نقاط',
      card4Desc: 'دوس السهم لفوق (↑) عشان ترفع اللقمة لتمّك وتاكلها!',
      gotIt: 'تمام!',
    },

    results: {
      victory: 'ألف مبروك!',
      roundComplete: 'خلصت الجولة',
      youWin: 'فزت يا معلّم!',
      youLost: 'خسرت هالمرة!',
      winSubline: 'مسحت السدر وسبقت كل اللي بالمجلس!',
      loseSubline: (winnerName: string, rank: number) =>
        `${winnerName} سبقك وخلّص المنسف — إنت بالمركز #${rank}.`,
      pts: 'نقطة',
      playAgain: 'العب كمان مرة ↻',
      tryAgain: 'جرّب كمان مرة ↻',
      backToLobby: '🏠 ارجع عالبداية',
    },

    scoreboard: {
      youBadge: 'أنت',
      pts: 'نقطة',
    },

    hud: {
      eating: 'عم تاكل اللقمة...',
      lokmaReadyBadge: '🎯 اللقمة جاهزة!',
      eatAction: 'كُل',
      rollProgress: (rolls: number, target: number) => `دحبر اللقمة (${rolls}/${target})`,
      enoughBadge: '🎯 تمام، الرز كفاية! فلّت المسافة',
      dry: 'ما في رز تحت إيدك! حرّكها عالرز',
      hold: 'دوس',
      toScoop: 'وجمّع',
      move: 'حرّك',
      scoop: 'جمّع',
    },

    // The gauge belongs to the roll: yellow is still loose, green is a round circle, red is squashed.
    meter: {
      zoneLoose: 'سايبة',
      zoneRound: 'دايرة',
      zoneSquashed: 'معجونة',
      rollProgress: (rolls: number, target: number) =>
        `دحبر اللقمة دايرة: ${rolls}/${target} (← / →)`,
      perfectRound: 'دايرة تمام! بلاش تدحبر أكتر، دوس ↑',
      squashed: 'انعجنت! دوس ↑',
    },

    lokmaLabels: {
      tooLoose: 'يا ساتر! اللقمة فرطت!',
      delicious: 'عم تاكل لقمة منسف بتجنّن!',
      roundReady: '🎯 اللقمة صارت دايرة! دوس ↑ وكُل!',
      squashed: '💥 انعجنت! دوس ↑ وكُل',
      enough: '🎯 الرز كفاية! فلّت المسافة!',
      scooping: 'عم تجمّع... ضلّك دايس عالمسافة لزيادة الرز',
      defaultGuide: 'حرّك بالأسهم · دوس المسافة عشان تجمّع رز',
      shapingHold: (rolls: number, target: number) => `بدّل ← / → عشان تدحبر (${rolls}/${target})`,
    },

    feedback: {
      perfect: '✨ عالأصول يا معلّم!',
      squashed: '💥 عجنتها يا زلمة!',
      lamb: (pts: number) => ` · 🥩 لحمة ${isolateLtr(`+${pts}`)}`,
      almond: (pts: number) => ` · 🥜 لوز ${isolateLtr(`+${pts}`)}`,
      roundLokma: 'صارت دايرة! دوس ↑ وكُل، وإذا زوّدتها بتنعجن.',
      overRolled: 'زوّدتها! عم تنعجن!',
      almostSquashed: 'انتبه! لو دحبرت مرة كمان بتنعجن.',
      rollHint: (rolls: number, target: number) => `بدّل ← / → عشان تدحبر (${rolls}/${target})`,
      finishRolling: 'كمّل بدّل ← / →، وبعدين دوس ↑ عشان تاكل.',
      smallScoop: 'الرز قليل! ضلّك دايس عالمسافة عشان تجمّع أكتر.',
      scooped: (rolls: number) => `جمّعت الرز! بدّل ← / → ${rolls} ${rolls <= 10 ? 'مرات' : 'مرة'} عشان تدحبره دايرة.`,
      alternateHint: 'بدّل! دوس ← وبعدين → وهيك بالتبادل عشان تدحبرها.',
    },

    opponent: {
      missed: [
        '😬 ما مسكتها!',
        '😵 فلتت منّي!',
        '😩 يا خسارة!',
        '🤦 كبّيتها!',
        '😅 ولا إشي!',
        '🙄 وين راحت؟!',
        '😤 ضاعت اللقمة!',
      ],
      eat: [
        '🍚 دحبرها!',
        '🐑 لحمة روماني ولا بلدي؟',
        '🌰 هاد لوز ولا صنوبر؟',
        '🥣 شرّب شرّب!',
        '😋 الأكل زاكي',
        '🥣 جميد كركي أصلي',
        '🤲 بسم الله',
        '✨ الحمدلله',
        '💛 يسلمو ايدين الوالدة',
        '🔥 يا سلام عالجميد!',
        '😅 على مهلك يا زلمة!',
        '🐑 اللحمة بتدوب!',
        '🤤 بيجنّن والله!',
        '😤 هاي القطعة إلي!',
        '😂 خلّي إشي للضيوف!',
        '🍚 بالهنا والشفا',
        '👌 طعمة يا معلّم!',
        '😍 ولا أطيب من هيك!',
        '🥄 زيدوني جميد!',
        '😎 أنا معلّم المنسف!',
        '🥜 كتّر اللوز يا معلّم!',
        '🍚 دحبر وسمّي!',
        '🔥 حامي حامي!',
        '🐐 خروف ولا جدي؟',
        '🥛 هاد لبن ولا جميد؟',
        '😋 ما بشبع منه!',
        '🙏 الله يعطيكم العافية',
      ],
    },
  },
};

// Compile-time guard: Arabic must define every key English does, so a string
// added to one language and forgotten in the other fails the build instead of
// silently showing up untranslated.
const sameShape: Record<Lang, typeof TRANSLATIONS.en> = TRANSLATIONS;
void sameShape;
