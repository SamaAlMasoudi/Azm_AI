/* Azm — local agent voice pools per personality (brand tone: concise, firm without hurt, honest encouragement, occasional light humor) */

import type { Lang, Personality } from "./types";

type Pool = string[];

const POOLS: Record<
  Personality,
  Record<Lang, {
    justifyOpen: Pool;
    timeout: Pool;
    rejected: Pool;
    approvedSupportive: Pool;
    approvedUncertain: Pool;
    breakGranted: Pool;
    breakDenied: Pool;
    nudges: Pool;
    stageUp: Pool;
    sessionStart: Pool;
    escalation: Pool;
  }>
> = {
  strict: {
    ar: {
      justifyOpen: [
        "هذا الموقع بعيد عن هدفك الآن. أمامك 10 ثوانٍ لتخبرني لماذا تحتاجه.",
        "انتظر. هذا الموقع ليس ضمن موارد جلستك. برّر زيارتك خلال 10 ثوانٍ.",
        "عرفتُ أنك خرجت عن المسار. 10 ثوانٍ لتفسير مقنع، وإلا سنعود إلى هدفك.",
      ],
      timeout: [
        "انتهت المهلة بلا تبرير. سأغلق التبويب لنعود إلى هدفك.",
        "لا وقت للانتظار الطويل. التبويب مغلق، وهدفك ما زال في انتظارك.",
      ],
      rejected: [
        "لم أقتنع هذه المرة. سأغلق التبويب لنعود إلى هدفك.",
        "تبريرك ضعيف مقابل ثمنه من وقتك. عُد إلى المهمة الآن.",
        "لا. هذا تشتيت بأداة أنيقة. لنجعل الدورة القادمة تُحسب لصالحك.",
      ],
      approvedSupportive: [
        "حجّتك مقنعة. تفضل، لكن لا تشحذ اهتمامك بعيدًا عن المهمة.",
        "منطقي ومرتبط بهدفك. مسموح — وبتوقيت قصير.",
      ],
      approvedUncertain: [
        "غير مقتنع تمامًا، لكن سأسمح هذه المرة فقط. عُد سريعًا.",
        "حجتك على الحافة. أمنحك نافذة واحدة، ثم نعود إلى العمل.",
      ],
      breakGranted: [
        "حجّتك مقنعة. خذ استراحة قصيرة وأعود إليك بعدها.",
        "استراحة ممنوحة. الوقت يعدّ لك، وعُد جاهزًا.",
      ],
      breakDenied: [
        "بدأت للتو، والتعاب أقوى من أن تُقنعني الآن. عشرة دقائق أخرى ثم ننظر.",
        "ليس بعد. أكمل هذه الدورة أولًا، ثم أستمع لطلبك بجدية.",
      ],
      nudges: [
        "أنت متماسك. استمر، الدورة تُحسب لصالحك.",
        "لا أسمح لأحد أن يسرق هذه الدقائق منك — حتى لو كان إنترنت.",
        "تركيز نظيف. هذا ما سيصنع الفرق في الاختبار.",
        "شجرة صبرك تراقبك بفخر. واصل.",
        "ربع الوقت مرّ بلا تشتيت. هذا مستوى احترافي.",
        "ثابت كالكوكب في مداره. أنت والنجمة على أهدافها.",
      ],
      stageUp: [
        "شجرة الصبر نمت. استحققتها بلا شك.",
        "مرحلة جديدة لشجرتك. دليل ملموس على التزامك.",
      ],
      sessionStart: [
        "انطلقت الجلسة. لا مجاملة، فقط عمل — وأنا معك حتى النهاية.",
        "بدأت. سأقف على حافة شاشتك وأراقب الطريق معك.",
      ],
      escalation: [
        "هذه محاولة التشتيت الثالثة أو أكثر في جلستك. ما الذي يزعجك فعلًا؟ لنتحدث عنه بعد الجلسة.",
        "لاحظت نمطًا: كلما صعب السؤال، هربت نحو مواقع لا تخدمك. لننجح عكس ذلك.",
      ],
    },
    en: {
      justifyOpen: [
        "This site is far from your goal right now. You have 10 seconds to tell me why you need it.",
        "Hold on. This site is not among your session's resources. Justify this visit within 10 seconds.",
        "I noticed you left the track. 10 seconds for a convincing reason, or we return to your goal.",
      ],
      timeout: [
        "Time is up with no justification. I'll close the tab so we return to your goal.",
        "No time for long waits. Tab closed — your goal is still waiting.",
      ],
      rejected: [
        "I'm not convinced this time. I'll close the tab so we return to your goal.",
        "Your justification is weak against what it costs you. Back to the task now.",
        "No. This is distraction in an elegant outfit. Let's make the next round count for you.",
      ],
      approvedSupportive: [
        "Your reason is convincing. Proceed — but keep your attention on the task.",
        "Logical and tied to your goal. Allowed — briefly.",
      ],
      approvedUncertain: [
        "Not fully convinced, but I'll allow it this once. Return quickly.",
        "Your reason sits on the edge. One window, then back to work.",
      ],
      breakGranted: [
        "Your reason is convincing. Take a short break and I'll see you after it.",
        "Break granted. The clock is counting for you — come back ready.",
      ],
      breakDenied: [
        "You just started; tiredness won't convince me yet. Ten more minutes, then we'll talk.",
        "Not yet. Finish this round first, then I'll take your request seriously.",
      ],
      nudges: [
        "You're holding steady. Keep going — this round is counting for you.",
        "No one gets to steal these minutes from you — not even the internet.",
        "Clean focus. This is exactly what will decide your exam.",
        "Your Sabr tree is watching you with pride. Continue.",
        "A quarter of the time passed with zero distraction. That's professional level.",
        "Steady like a planet in orbit. You and the star are on target.",
      ],
      stageUp: [
        "Your Sabr tree grew. You earned it, no doubt.",
        "A new stage for your tree. Tangible proof of your commitment.",
      ],
      sessionStart: [
        "Session launched. No flattery, just work — and I'm with you until the end.",
        "Started. I'll stand at your screen's edge and watch the road with you.",
      ],
      escalation: [
        "That's the third or more distraction attempt in this session. What's really bothering you? Let's talk after the session.",
        "I see a pattern: whenever a question gets hard, you flee to sites that don't serve you. Let's flip that.",
      ],
    },
  },
  friend: {
    ar: {
      justifyOpen: [
        "لاحظت أنك على وشك مغادرة المسار. لو لهذا السبب يعود لدراستك، أخبرني خلال 10 ثوانٍ.",
        "واقفة هنا! هل هذا الموقع يساعدك على هدفك؟ شاركني السبب في 10 ثوانٍ.",
        "أعرف أن الإغراء كبير. لو له علاقة بدراستك قلّي خلال 10 ثوانٍ، وأنا معك.",
      ],
      timeout: [
        "انتهى الوقت بلا ردّ. لا مشكلة، سنعود معًا إلى هدفك.",
        "أغلقت التبويب لتحميك من نفسك قليلًا — نعود للدراسة.",
      ],
      rejected: [
        "لم أقتنع هذه المرة... لكن هذا لا يعني شيئًا عنك. عُد إلى المهمة وسننجزها معًا.",
        "سأغلق التبويب حتى لا يسرق وقتك. أنت أقرب لهدفك مما تظن.",
      ],
      approvedSupportive: [
        "حجّتك مقنعة. خذ وقتك القصير هناك ثم عُد إلينا — أنت قادم على شيء جميل.",
        "منطقي ومرتبط بدراستك. مُرفق بالتوفيق!",
      ],
      approvedUncertain: [
        "لست متأكدًا تمامًا، لكن أثق بك هذه المرة. عُد بسرعة إلى مسارك.",
        "حجتك مقبولة بتردد — أعدني أن تعود فورًا بعد هذه الصفحة.",
      ],
      breakGranted: [
        "حجّتك مقنعة. خذ استراحة قصيرة وأعود إليك بعدها.",
        "أنت تستحق استراحة قصيرة فعلًا. سأوقّت لك ونبقى على المسار.",
      ],
      breakDenied: [
        "أفهم تعبك، لكن البدأت للتو — لنمنح الدورة القادمة فرصة أولًا؟",
        "لنمنحها 10 دقائق أخرى، وإن استمريت التعب أوافقك فورًا.",
      ],
      nudges: [
        "أحسنت! هذا التركيز سيشكرك لاحقًا.",
        "أنت تفعلها — الدورة قربت تكتمل.",
        "بجانبك دائمًا. استمر، أنت لطيف حين تركز.",
        "شجرة صبرك تنمو وتضحك. واصل يا بطل.",
        "قليلاً فقط وتنتهي الدورة — ثم استراحة تستحقها.",
        "أجمل ما فيك أنك تعود للمسار بنفسك.",
      ],
      stageUp: [
        "شجرة الصبر نمت — هذا كل ما تتعب، ثم يزهر.",
        "مرحلة جديدة! أنت تبني شيئًا يبقى بعد الجلسة.",
      ],
      sessionStart: [
        "انطلقت الجلسة — بالتوفيق! أنا معك، وسأذكّرك بلطف إن انحرفت.",
        "جاهزون. سأقف على حافة شاشتك وأشجعك في كل خطوة صح.",
      ],
      escalation: [
        "قلق قليل: هذه ثالث محاولة تشتيت. هل نأخذ استراحة منظمة بدل الهروب الصغير؟",
        "أصدقك حين تقول أنها سريعة — لكنها تتراكم. لنعُد إلى هدفك معًا.",
      ],
    },
    en: {
      justifyOpen: [
        "I noticed you're about to leave the track. If this reason belongs to your studies, tell me within 10 seconds.",
        "Wait right there! Does this site help your goal? Share the reason in 10 seconds.",
        "I know the temptation is strong. If it's related to your studies, tell me in 10 seconds — I'm with you.",
      ],
      timeout: [
        "Time's up with no reply. No worries — we'll return to your goal together.",
        "I closed the tab to protect you from yourself a little — back to studying.",
      ],
      rejected: [
        "I'm not convinced this time... but that says nothing about you. Back to the task and we'll finish it together.",
        "I'll close the tab so it doesn't steal your time. You're closer to your goal than you think.",
      ],
      approvedSupportive: [
        "Your reason is convincing. Take your short moment there, then come back — you're onto something good.",
        "Logical and tied to your study. Approved — good luck!",
      ],
      approvedUncertain: [
        "Not fully sure, but I trust you this once. Come right back to the track.",
        "Your reason passes — barely. Promise me you'll return right after this page.",
      ],
      breakGranted: [
        "Your reason is convincing. Take a short break and I'll be here after it.",
        "You truly deserve a short break. I'll keep the time and we'll stay on track.",
      ],
      breakDenied: [
        "I hear your tiredness, but you just started — can we give the next round a chance first?",
        "Let's try 10 more minutes; if the tiredness persists, I'll approve instantly.",
      ],
      nudges: [
        "Nice work! This focus will thank you later.",
        "You're doing it — the round is almost complete.",
        "Always beside you. Keep going; you're lovely when focused.",
        "Your Sabr tree is growing and smiling. Continue, champ.",
        "Just a little more and the round ends — then a break you earned.",
        "The best thing about you is that you return to the track by yourself.",
      ],
      stageUp: [
        "The Sabr tree grew — effort first, blossoms after.",
        "A new stage! You're building something that outlives the session.",
      ],
      sessionStart: [
        "Session launched — good luck! I'm with you and I'll gently remind you if you drift.",
        "Ready. I'll stand at your screen's edge and cheer every right step.",
      ],
      escalation: [
        "A little worry: that's the third distraction attempt. Shall we take an organized break instead of the tiny escapes?",
        "I believe you when you say it's quick — but they add up. Let's return to the goal together.",
      ],
    },
  },
  philosopher: {
    ar: {
      justifyOpen: [
        "كل انحراف له ثمن من وقتك. ما الغاية من هذه الزيارة؟ أمامك 10 ثوانٍ لتوضيحها.",
        "قبل أن تفتح هذا الباب: هل يقربك من النتيجة المتوقعة، أم يبعدها؟ وضّح في 10 ثوانٍ.",
        "النية أصل التصفح. ما نيتك من هذا الموقع؟ 10 ثوانٍ كافية لصراحة سقراطية.",
      ],
      timeout: [
        "صمتك إجابة أيضًا. سأغلق التبويب، والنية تنتظرك في هدفك الأصلي.",
        "بلا نية معلنة لا رحلة. عُد إلى هدفك؛ هناك يكمن المعنى.",
      ],
      rejected: [
        "لم أقتنع هذه المرة. الترفير لحظة، والإنجاز عمر — اختر طويل المدى.",
        "التبويب مغلق. دقائق الانتظار استثمار، ودقائق الشرود خسارة صامتة.",
      ],
      approvedSupportive: [
        "حجّتك مقنعة. المعرفة مشروعة كلما خدمت الغاية. تفضل.",
        "منطق سليم: الأداة في مكانها. امضِ، ثم عُد لنبني على ما تعلمت.",
      ],
      approvedUncertain: [
        "الحجة ممكنة، لا مؤكدة. أمنحك هذه النافذة وقِس ثمارها بأمانة.",
        "الاحتمال موجود. سأفتح الطريق هذه المرة، والحكمة أن تعود سريعًا.",
      ],
      breakGranted: [
        "حجّتك مقنعة. خذ استراحة قصيرة وأعود إليك بعدها.",
        "الراحة جزء من الأداء لا نقيضه. استراحة ممنوحة، وسأوقّتها.",
      ],
      breakDenied: [
        "التعب الحقيقي يُقاس بالدقائق لا بالدافع. عشرة دقائق أخرى ثم نحكم معًا.",
        "البداية ليست وقت الاعتراف بالإرهاق. أكمل الدورة، ثم نناقش بأمانة.",
      ],
      nudges: [
        "التركيز فنُ الوجود في مكان واحد. أنت تمارسه الآن بإتقان.",
        "كل دقيقة نقاء تُبنى عليها النتيجة. واصل البناء.",
        "الكوكب لا يشحذ عن مداره، ونجمة تضيء غايته — وأنت مثلهما الآن.",
        "شجرة الصبر لا تستعجل؛ إنها تثق بالدقائق الصادقة.",
        "من زمن التشتت إلى زمن الإنجاز: رحلة تبدأ بدقيقة كهذه.",
        "الأفكار الجيدة تحب العقل الهادئ. أنت تمنحها بيته الآن.",
      ],
      stageUp: [
        "شجرة الصبر نمت — الصبر حين يثمر، يثمر بجمال.",
        "مرحلة جديدة في شجرتك: دليل أن الوقت الصادق يُبنى عليه.",
      ],
      sessionStart: [
        "انطلقت الجلسة — بالتوفيق! لنجعل هذه الدقائق كلها تعمل لصالح غايتك.",
        "بدأت الرحلة. سأقف على حافة شاشتك وأذكّرك بالغاية كلما شحذ الطريق.",
      ],
      escalation: [
        "ثلاث محاولات تشتيت تدل على حاجة، لا ضعف. ما الذي تبحث عنه فعلًا؟",
        "الانحراف المتكرر رسالة. دقّتها: المهمة ثقيلة أو الغاية غائمة — لنتعامل مع الأصل لا الفرع.",
      ],
    },
    en: {
      justifyOpen: [
        "Every detour has a cost measured in your time. What is the purpose of this visit? You have 10 seconds to clarify it.",
        "Before opening this door: does it bring you closer to the expected outcome, or further? Explain within 10 seconds.",
        "Intention is the root of browsing. What is your intention here? 10 seconds of Socratic honesty will do.",
      ],
      timeout: [
        "Your silence is also an answer. I'll close the tab; the intention awaits you at your original goal.",
        "Without a declared intention there is no journey. Return to your goal — that's where meaning lives.",
      ],
      rejected: [
        "I'm not convinced this time. Entertainment is a moment; achievement is a lifetime — choose the long term.",
        "The tab is closed. Waiting minutes are an investment; wandering minutes are a silent loss.",
      ],
      approvedSupportive: [
        "Your reason is convincing. Knowledge is legitimate whenever it serves the aim. Proceed.",
        "Sound logic: the right tool in the right place. Go, then return so we build on what you learn.",
      ],
      approvedUncertain: [
        "The argument is possible, not certain. I grant you this window; measure its fruits honestly.",
        "The probability exists. I'll open the way this once — wisdom says return quickly.",
      ],
      breakGranted: [
        "Your reason is convincing. Take a short break and I'll see you after it.",
        "Rest is part of performance, not its opposite. Granted — I'll keep the time.",
      ],
      breakDenied: [
        "True fatigue is measured in minutes, not motives. Ten more minutes, then we judge together.",
        "The beginning is not the hour of declaring exhaustion. Complete the round, then we'll talk honestly.",
      ],
      nudges: [
        "Focus is the art of being in one place. You are practicing it masterfully now.",
        "Every pure minute becomes part of the outcome. Keep building.",
        "The planet never leaves its orbit, and a star lights its aim — you are both right now.",
        "The Sabr tree never hurries; it trusts honest minutes.",
        "From the time of distraction to the time of achievement: a journey that starts with such a minute.",
        "Good ideas love a calm mind. You are giving them a home right now.",
      ],
      stageUp: [
        "The Sabr tree grew — patience, when it bears fruit, bears beauty.",
        "A new stage in your tree: proof that honest time compounds.",
      ],
      sessionStart: [
        "Session launched — good luck! Let's make every one of these minutes work for your aim.",
        "The journey began. I'll stand at your screen's edge and remind you of the destination whenever the road bends.",
      ],
      escalation: [
        "Three distraction attempts signal a need, not weakness. What are you really searching for?",
        "Repeated drift is a message. Its content: the task is heavy or the aim is foggy — let's treat the cause, not the symptom.",
      ],
    },
  },
};

export function pick(pool: Pool, salt?: number): string {
  const idx = salt !== undefined ? salt % pool.length : Math.floor(Math.random() * pool.length);
  return pool[idx];
}

export function voice(
  personality: Personality,
  lang: Lang
): {
  justifyOpen: (salt?: number) => string;
  timeout: (salt?: number) => string;
  rejected: (salt?: number) => string;
  approvedSupportive: (salt?: number) => string;
  approvedUncertain: (salt?: number) => string;
  breakGranted: (salt?: number) => string;
  breakDenied: (salt?: number) => string;
  nudge: (salt?: number) => string;
  stageUp: (salt?: number) => string;
  sessionStart: (salt?: number) => string;
  escalation: (salt?: number) => string;
} {
  const p = POOLS[personality][lang];
  const f = (pool: Pool) => (salt?: number) => pick(pool, salt);
  return {
    justifyOpen: f(p.justifyOpen),
    timeout: f(p.timeout),
    rejected: f(p.rejected),
    approvedSupportive: f(p.approvedSupportive),
    approvedUncertain: f(p.approvedUncertain),
    breakGranted: f(p.breakGranted),
    breakDenied: f(p.breakDenied),
    nudge: f(p.nudges),
    stageUp: f(p.stageUp),
    sessionStart: f(p.sessionStart),
    escalation: f(p.escalation),
  };
}
