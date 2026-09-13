export type Lang = 'en' | 'ar';

export const TRANSLATIONS = {
  en: {
    names: ['You', 'Zaid', 'Omar', 'Sami'],
    traits: ['Your Seat', 'Quick Bites', 'Steady Eater', 'Big Appetite'],

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
          title: '01 · Move Your Hand',
          desc: 'Use Arrow Keys (← → ↑ ↓) to position your hand over rice on the platter.',
          label: '1. Position Hand',
        },
        {
          title: '02 · Scoop & Fill Gauge',
          desc: 'Press and hold SPACE over rice to fill the gauge until it turns GREEN.',
          label: '2. Scoop Until Green',
        },
        {
          title: '03 · Roll Into a Circle',
          desc: 'Press Left & Right Arrows (← →) with SPACE to roll and shape the rice into a neat round circle!',
          label: '3. Roll into Circle (← →)',
        },
        {
          title: '04 · Eat & Score',
          desc: 'Press Up Arrow (↑) to bring the round Lokma to your mouth and eat!',
          label: '4. Eat with Up Arrow (↑)',
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
      card2Title: '2. Scoop & Fill',
      card2Desc: 'Hold SPACE over rice to fill the gauge until it turns GREEN.',
      card3Title: '3. Roll into Circle',
      card3Desc: 'Press ← & → with SPACE to squeeze and roll into a round circle!',
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
      winnerBadge: '👑 WINNER',
      pts: 'PTS',
      playAgain: 'Play Again ↻',
      tryAgain: 'Try Again ↻',
    },

    scoreboard: {
      youBadge: 'YOU',
      pts: 'pts',
    },

    hud: {
      eating: 'Eating Lokma...',
      lokmaReadyBadge: '🎯 LOKMA READY!',
      eatAction: 'Eat',
      rollProgress: (rolls: number, target: number) => `Roll into Circle (${rolls}/${target})`,
      greenZoneBadge: '🎯 GREEN ZONE! HOLD SPACE + ← / → TO ROLL',
      hold: 'Hold',
      untilGreen: 'Until Green',
      move: 'Move',
      scoop: 'Scoop',
    },

    meter: {
      holdToRoll: 'HOLD SPACE + ← / → TO ROLL',
      tooMuchRoll: 'Too Much! SPACE + ← / → to Roll',
      gatheringRice: 'Gathering Rice...',
      rollProgress: (rolls: number, target: number) =>
        `Roll into Circle: ${rolls}/${target} (SPACE + ← / →)`,
      perfectRound: 'Perfect Round Lokma! Press ↑',
      squashed: 'Squashed Lokma! Press ↑',
      underfilled: 'Underfilled Lokma! Press ↑',
    },

    lokmaLabels: {
      tooLoose: 'Oops! Lokma too loose!',
      delicious: 'Eating delicious Lokma!',
      roundReady: '🎯 ROUND LOKMA READY! Press ↑ to Eat!',
      perfectHold: '🎯 PERFECT! KEEP SPACE HELD + ← / → TO ROLL!',
      tooMuchHold: '⚠️ TOO MUCH! SPACE + ← / → TO ROLL!',
      gatheringHold: 'GATHERING RICE... HOLD SPACE UNTIL GREEN!',
      defaultGuide: 'Use ARROWS to move · Hold SPACE to gather rice',
    },

    feedback: {
      perfect: '✨ Perfect Lokma!',
      squashed: '💥 Squashed!',
      sahtein: 'Sahtein!',
      lambBonus: ' · Lamb Bonus',
    },
  },

  ar: {
    names: ['أنت', 'زيد', 'عمر', 'سامي'],
    traits: ['مكانك', 'لقم سريعة', 'أكيل هادئ', 'شهية كبار'],

    header: {
      remaining: 'المنسَف المتبقي',
      menu: 'القائمة',
      logoAlt: 'شعار منسف رش',
      langBtn: 'English',
    },

    intro: {
      eyebrow: 'أهلاً بك في المجلس',
      title: 'طريقة اللعب',
      stepPill: (current: number, total: number) => `الخطوة ${current} من ${total}`,
      steps: [
        {
          title: '٠١ · حرك يدك',
          desc: 'استخدم أسهم الاتجاهات (← → ↑ ↓) لتحريك يدك فوق الأرز في السدر.',
          label: '١. حدد مكان اليد',
        },
        {
          title: '٠٢ · اغرف وامعط اللقمة',
          desc: 'اضغط باستمرار على زر المسافة (SPACE) فوق الأرز لملء المؤشر حتى يصبح أخضر.',
          label: '٢. اغرف حتى اللون الأخضر',
        },
        {
          title: '٠٣ · كبّب اللقمة (دوّرة)',
          desc: 'اضغط السهمين الأيمن والأيسر (← →) مع المسافة لتكبيب اللقمة وتدويرها بشكل مثالي!',
          label: '٣. كبّب اللقمة (← →)',
        },
        {
          title: '٠٤ · اكُل وحصّل نقاط',
          desc: 'اضغط السهم الأعلى (↑) لرفع اللقمة المكببة إلى فمك وأكلها!',
          label: '٤. اكُل بالسهم الأعلى (↑)',
        },
      ],
      back: 'السابق ➔',
      next: 'الخطوة التالية ◀',
      letsEat: 'صحتين وعافية! يلا ناكل ◀',
    },

    pauseMenu: {
      eyebrow: 'اللعبة متوقفة',
      title: 'قائمة اللعبة',
      resume: '◀ استئناف اللعب',
      howToPlay: '📖 طريقة اللعب',
      soundOn: '🔊 الصوت: مفعل',
      soundMuted: '🔇 الصوت: مكتوم',
      restart: '🔄 إعادة اللعب',
      switchLang: '🌐 اللغة: English',
    },

    guide: {
      eyebrow: 'دليل اللعب',
      title: 'طريقة اللعب',
      card1Title: '١. تحريك اليد',
      card1Desc: 'استخدم الأسهم (← → ↑ ↓) للتحرك فوق الأرز في السدر.',
      card2Title: '٢. الغرف والملء',
      card2Desc: 'اضغط المسافة فوق الأرز حتى يصبح المؤشر أخضر.',
      card3Title: '٣. التكبيب والتدوير',
      card3Desc: 'اضغط ← و → مع المسافة لتكبيب اللقمة بشكل دائر!',
      card4Title: '٤. الأكل والنقاط',
      card4Desc: 'اضغط السهم الأعلى (↑) لرفع اللقمة إلى فمك وأكلها!',
      gotIt: 'فهمت!',
    },

    results: {
      victory: 'فوز مستحق!',
      roundComplete: 'انتهاء الجولة',
      youWin: 'فزت بالمنسف!',
      youLost: 'خسرت الجولة!',
      winSubline: 'مسحت السدر أسرع وأشطر من الجميع في المجلس!',
      loseSubline: (winnerName: string, rank: number) =>
        `${winnerName} أنهى المنسف أولاً — مركزك #${rank}.`,
      winnerBadge: '👑 الفائز',
      pts: 'نقطة',
      playAgain: 'العب مجدداً ↻',
      tryAgain: 'حاول مجدداً ↻',
    },

    scoreboard: {
      youBadge: 'أنت',
      pts: 'نقطة',
    },

    hud: {
      eating: 'جارٍ أكل اللقمة...',
      lokmaReadyBadge: '🎯 اللقمة جاهزة!',
      eatAction: 'اكُل',
      rollProgress: (rolls: number, target: number) => `كبّب اللقمة (${rolls}/${target})`,
      greenZoneBadge: '🎯 المنطقة الخضراء! اضغط المسافة + ← / → لتكبيب اللقمة',
      hold: 'اضغط',
      untilGreen: 'حتى الأخضر',
      move: 'تحريك',
      scoop: 'غرف',
    },

    meter: {
      holdToRoll: 'اضغط المسافة + ← / → للتكبيب',
      tooMuchRoll: 'كثيرة جداً! المسافة + ← / → للتكبيب',
      gatheringRice: 'تجميع الأرز...',
      rollProgress: (rolls: number, target: number) =>
        `كبّب اللقمة: ${rolls}/${target} (المسافة + ← / →)`,
      perfectRound: 'لقمة دائرية مثالية! اضغط ↑',
      squashed: 'لقمة مهروسة! اضغط ↑',
      underfilled: 'لقمة صغيرة! اضغط ↑',
    },

    lokmaLabels: {
      tooLoose: 'عفواً! اللقمة فرطت!',
      delicious: 'أكل لقمة منسف لذيذة!',
      roundReady: '🎯 اللقمة المكببة جاهزة! اضغط ↑ للأكل!',
      perfectHold: '🎯 مثالي! واصل الضغط على المسافة + ← / → للتكبيب!',
      tooMuchHold: '⚠️ كمية كبيرة! المسافة + ← / → للتكبيب!',
      gatheringHold: 'تجميع الأرز... اضغط المسافة حتى الأخضر!',
      defaultGuide: 'استخدم الأسهم للتحرك · اضغط المسافة لتجميع الأرز',
    },

    feedback: {
      perfect: '✨ لقمة مثالية!',
      squashed: '💥 لقمة مهروسة!',
      sahtein: 'صحتين وعافية!',
      lambBonus: ' · بونوس اللحمة',
    },
  },
};
