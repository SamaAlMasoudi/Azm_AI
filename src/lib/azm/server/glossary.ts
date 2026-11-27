/* Azm — cross-language academic glossary (EN <-> AR) used by the deterministic
 * intent classifier. Ported from azm-ai v0.2.2 (packages/shared/src/glossary.ts).
 * Topic clusters let e.g. a title containing "Chlorophyll" match an Arabic goal
 * about "التمثيل الضوئي" (photosynthesis). Intentionally small and modular. */

import { tokenize } from "./text";

export interface GlossaryCluster {
  topic: string;
  terms: string[];
}

export const GLOSSARY: GlossaryCluster[] = [
  {
    topic: "biology",
    terms: [
      "biology", "أحياء", "علم الأحياء", "حيوي",
      "photosynthesis", "التمثيل الضوئي", "البناء الضوئي", "تمثيل ضوئي",
      "chlorophyll", "الكلوروفيل", "كلوروفيل",
      "cell", "الخلية", "خلية", "خلايا", "cells",
      "dna", "rna", "genetics", "الوراثة", "جينات",
      "enzyme", "الإنزيم", "انزيم", "إنزيمات",
      "mitosis", "meiosis", "انقسام", "الانقسام",
      "respiration", "التنفس", "تنفس خلوي",
      "ecosystem", "النظام البيئي", "بيئة",
    ],
  },
  {
    topic: "chemistry",
    terms: [
      "chemistry", "كيمياء", "الكيمياء",
      "atom", "الذرة", "ذرة", "ذرات",
      "molecule", "الجزيء", "جزيء",
      "reaction", "تفاعل", "التفاعلات",
      "acid", "base", "حمض", "قاعدة", "الحموض",
      "periodic", "جدول دوري", "العناصر",
    ],
  },
  {
    topic: "physics",
    terms: [
      "physics", "فيزياء", "الفيزياء",
      "force", "قوة", "القوى",
      "motion", "حركة", "الحركة",
      "energy", "طاقة", "الطاقة",
      "electricity", "كهرباء", "الكهرباء", "كهربائي",
      "magnetism", "مغناطيس", "مغناطيسية",
      "momentum", "كمية الحركة",
      "gravity", "جاذبية", "الجاذبية",
    ],
  },
  {
    topic: "math",
    terms: [
      "math", "mathematics", "رياضيات", "الرياضيات", "حساب",
      "algebra", "جبر", "الجبر",
      "geometry", "هندسة", "الهندسة",
      "equation", "معادلة", "معادلات", "المعادلات",
      "function", "دالة", "الدوال",
      "derivative", "مشتقة", "اشتقاق", "تفاضل",
      "integral", "تكامل", "المتكاملات",
      "probability", "احتمال", "الاحتمالات",
      "triangle", "مثلث", "المثلثات", "مثلثات",
    ],
  },
  {
    topic: "arabic-language",
    terms: [
      "نحو", "النحو", "إعراب", "اعراب", "بلاغة", "البلاغة",
      "قواعد اللغة", "لغتي", "اللغة العربية", "عربي", "عربية",
      "grammar", "syntax", "صفة", "جملة", "الجملة",
      "إملاء", "املاء", "همزة", "همزات", "تنوين",
      "قصيدة", "شعر", "نثر", "أدب", "ادب",
    ],
  },
  {
    topic: "english-language",
    terms: [
      "english", "إنجليزي", "الإنجليزية", "انجليزي", "انجليزية",
      "vocabulary", "مفردات", "كلمات",
      "tense", "زمن", "أزمنة", "ازمنة",
      "essay", "مقال", "writing", "كتابة",
      "ielts", "toefl", "reading", "listening",
    ],
  },
  {
    topic: "history-geography",
    terms: [
      "history", "تاريخ", "التاريخ",
      "geography", "جغرافيا", "الجغرافيا",
      "حرب", "معركة", "دولة", "حضارة", "الحضارات",
      "خريطة", "خرائط", "مناخ", "سكان",
      "war", "revolution", "empire", "civilization",
    ],
  },
  {
    topic: "cs",
    terms: [
      "programming", "برمجة", "برمجيات", "حاسوب", "الحاسوب", "computer", "computing",
      "algorithm", "خوارزمية", "خوارزميات", "الخوارزميات",
      "python", "javascript", "java", "code", "كود",
      "database", "قاعدة بيانات", "قواعد البيانات",
      "network", "شبكات", "الشبكات", "networks",
      "html", "css", "react", "api", "binary",
    ],
  },
  {
    topic: "stats-econ",
    terms: [
      "statistics", "إحصاء", "احصاء", "الإحصاء", "إحصائية",
      "economics", "اقتصاد", "الاقتصاد", "اقتصادية",
      "mean", "median", "متوسط", "وسيط", "انحراف", "تباين",
      "supply", "demand", "عرض", "طلب",
    ],
  },
  {
    topic: "philosophy",
    terms: [
      "philosophy", "فلسفة", "الفلسفة", "فلسفي",
      "منطق", "المنطق", "logic",
      "أخلاق", "اخلاق", "ethics", "metaphysics",
    ],
  },
  {
    topic: "exam-prep",
    terms: [
      "exam", "امتحان", "الامتحان", "اختبار", "الاختبار", "اختبارات",
      "quiz", "مراجعة", "مراجعه", "revision", "فرض", "نهائي",
      "سؤال", "أسئلة", "اسئلة", "تمارين", "تدريبات", "حل",
      "practice", "worksheet", "ملزمة", "ملخص", "الملخص",
    ],
  },
];

export const TERM_INDEX: Map<string, number> = (() => {
  const m = new Map<string, number>();
  GLOSSARY.forEach((c, i) => {
    for (const t of c.terms) {
      for (const tok of tokenize(t)) m.set(tok, i);
    }
  });
  return m;
})();

/** Expand goal tokens with their cluster translations (EN<->AR). */
export function expandTokensWithGlossary(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const idx = TERM_INDEX.get(t);
    if (idx !== undefined) {
      for (const term of GLOSSARY[idx]!.terms) out.push(...tokenize(term));
    }
  }
  return out;
}

/** True if any title token shares a glossary cluster with any goal token. */
export function sharesGlossaryCluster(goalTokens: string[], titleTokens: string[]): boolean {
  const goalClusters = new Set<number>();
  for (const t of goalTokens) {
    const idx = TERM_INDEX.get(t);
    if (idx !== undefined) goalClusters.add(idx);
  }
  if (goalClusters.size === 0) return false;
  for (const t of titleTokens) {
    const idx = TERM_INDEX.get(t);
    if (idx !== undefined && goalClusters.has(idx)) return true;
  }
  return false;
}
