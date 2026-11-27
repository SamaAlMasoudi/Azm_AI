/* Azm — mock site page components for the simulated browser.
 * Every component receives { lang, navigate, dest } and renders a self-contained,
 * recognizable-but-simplified light surface for one site. Navigation-looking
 * elements MUST call navigate() with a canonical URL (no protocol, no www).
 * Purely decorative controls (like/subscribe/play) stay inert on purpose.
 */

"use client";

import { useState } from "react";
import type { ComponentType, CSSProperties, FormEvent, ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Globe,
  GraduationCap,
  Heart,
  Info,
  Instagram,
  Languages,
  Leaf,
  LibraryBig,
  ListChecks,
  Maximize,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Music2,
  Play,
  PlayCircle,
  Plus,
  Repeat2,
  Search,
  Send,
  Share,
  Share2,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  VideoOff,
  Volume2,
  Youtube,
} from "lucide-react";
import { SITE_CATALOG, VIDEO_BY_ID } from "./sites-data";
import type { CatalogVideo } from "./sites-data";
import { getDict } from "./i18n";
import type { Lang, NavDestination } from "./types";

/* ============================== shared bits ============================== */

export interface SitePageProps {
  lang: Lang;
  navigate: (url: string) => void; // canonical url, e.g. "youtube.com/watch?v=v-photo1"
  dest: NavDestination;
}

const YT_VIDEOS: CatalogVideo[] =
  SITE_CATALOG.find((s) => s.id === "youtube")?.videos ?? [];
const EDU_VIDEOS = YT_VIDEOS.filter((v) => v.category === "education");
const UP_NEXT_IDS = ["v-calc1", "v-hist1", "v-code1", "v-goals5", "v-gaming", "v-vlog", "v-music"];

/* No blue in the simulated web — warm/neutral deterministic palette for tiles. */
const PALETTE: [string, string][] = [
  ["#F59E0B", "#FB7185"],
  ["#10B981", "#84CC16"],
  ["#A78BFA", "#FB7185"],
  ["#F43F5E", "#FBBF24"],
  ["#8B5CF6", "#34D399"],
  ["#FB7185", "#A78BFA"],
];

function palette(i: number): [string, string] {
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

function gradStyle([a, b]: [string, string]): CSSProperties {
  return { backgroundImage: `linear-gradient(135deg, ${a} 0%, ${b} 100%)` };
}

/** 14 -> "14:00", 60 -> "1:00:00" */
function fmtDur(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:00` : `${m}:00`;
}

function hashName(name: string): number {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return sum;
}

/** aspect-video gradient tile with optional centered icon + duration badge */
function Thumb({
  gradient,
  duration,
  icon,
  className,
}: {
  gradient: [string, string];
  duration?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-video overflow-hidden ${className ?? "w-full"}`}
      style={gradStyle(gradient)}
    >
      {icon ? <div className="absolute inset-0 flex items-center justify-center">{icon}</div> : null}
      {duration ? (
        <span className="azm-nums absolute bottom-1.5 end-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {duration}
        </span>
      ) : null}
    </div>
  );
}

/** gradient circle avatar with first letter */
function Avatar({ name, className }: { name: string; className?: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        className ?? "h-9 w-9 text-sm"
      }`}
      style={gradStyle(palette(hashName(name)))}
      aria-hidden
    >
      {letter}
    </span>
  );
}

/** standard light page root */
function Page({ lang, className, children }: { lang: Lang; className?: string; children: ReactNode }) {
  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`min-h-full ${className ?? "bg-white text-zinc-900"}`}
      style={{ fontFamily: "inherit" }}
    >
      {children}
    </div>
  );
}

/* ============================== youtube home ============================== */

function YouTubeHome({ lang, navigate }: SitePageProps) {
  const c =
    lang === "ar"
      ? {
          placeholder: "ابحث في يوتيوب",
          chips: ["الكل", "محاضرات", "موسيقى", "مباشر", "ألعاب", "ملخصات"],
        }
      : {
          placeholder: "Search YouTube",
          chips: ["All", "Lectures", "Music", "Live", "Gaming", "Recaps"],
        };
  return (
    <Page lang={lang}>
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-[#0f0f0f] px-3 py-2.5 text-white md:px-4">
        <span className="rounded-full p-2 text-zinc-300" aria-hidden>
          <Menu className="h-5 w-5" />
        </span>
        <button onClick={() => navigate("youtube.com")} className="flex items-center gap-1.5">
          <Youtube className="h-6 w-6 text-[#FF0000]" />
          <span className="text-lg font-semibold tracking-tight" dir="ltr">
            YouTube
          </span>
        </button>
        <div className="mx-auto hidden w-full max-w-xl sm:flex">
          <input
            readOnly
            aria-label={c.placeholder}
            placeholder={c.placeholder}
            className="w-full rounded-s-full border border-zinc-700 bg-[#121212] px-4 py-1.5 text-sm outline-none placeholder:text-zinc-500"
          />
          <span className="flex items-center rounded-e-full border border-s-0 border-zinc-700 bg-zinc-800 px-4">
            <Search className="h-4 w-4 text-zinc-400" />
          </span>
        </div>
        <Avatar name="A" className="ms-auto h-8 w-8 text-xs sm:ms-0" />
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {c.chips.map((chip, i) => (
          <span
            key={chip}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
              i === 0 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"
            }`}
          >
            {chip}
          </span>
        ))}
      </div>

      <main className="grid grid-cols-1 gap-x-4 gap-y-6 px-4 pb-6 sm:grid-cols-2 lg:grid-cols-3">
        {YT_VIDEOS.map((v) => (
          <button key={v.id} onClick={() => navigate(`youtube.com/watch?v=${v.id}`)} className="group text-start">
            <Thumb
              gradient={v.gradient}
              duration={fmtDur(v.durationMin)}
              icon={
                <Play className="h-9 w-9 fill-white/90 text-white/90 opacity-0 drop-shadow transition group-hover:opacity-100" />
              }
              className="w-full rounded-xl"
            />
            <div className="mt-2.5 flex gap-2.5">
              <Avatar name={v.channelName[lang]} className="h-8 w-8 text-xs" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900">{v.title[lang]}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{v.channelName[lang]}</p>
                <p className="truncate text-xs text-zinc-500">
                  {v.views[lang]} · {v.age[lang]}
                </p>
              </div>
            </div>
          </button>
        ))}
      </main>
    </Page>
  );
}

/* ============================== youtube watch ============================== */

function YouTubeWatchPage({ lang, navigate, dest }: SitePageProps) {
  const v = VIDEO_BY_ID.get(dest.videoId ?? "");
  const c =
    lang === "ar"
      ? {
          subs: "١٢٨ ألف مشترك",
          subscribe: "اشتراك",
          like: "٤٫٢ ألف",
          commentsTitle: "٢ تعليقًا",
          next: "التالي لك",
          missing: "هذا الفيديو غير متوفر في البيئة المُحاكاة",
          back: "العودة للرئيسية",
          t1: "قبل ٣ أيام",
          t2: "قبل أسبوع",
        }
      : {
          subs: "128K subscribers",
          subscribe: "Subscribe",
          like: "4.2K",
          commentsTitle: "2 comments",
          next: "Up next",
          missing: "This video isn't available in the simulated environment",
          back: "Back to home",
          t1: "3 days ago",
          t2: "1 week ago",
        };

  if (!v) {
    return (
      <Page lang={lang}>
        <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <VideoOff className="h-10 w-10 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-600">{c.missing}</p>
          <button
            onClick={() => navigate("youtube.com")}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            {c.back}
          </button>
        </div>
      </Page>
    );
  }

  const upNext = UP_NEXT_IDS.map((id) => VIDEO_BY_ID.get(id)).filter(
    (x): x is CatalogVideo => Boolean(x)
  );

  return (
    <Page lang={lang}>
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-[#0f0f0f] px-3 py-2.5 text-white md:px-4">
        <button onClick={() => navigate("youtube.com")} className="flex items-center gap-1.5">
          <Youtube className="h-6 w-6 text-[#FF0000]" />
          <span className="text-lg font-semibold tracking-tight" dir="ltr">
            YouTube
          </span>
        </button>
        <Avatar name="A" className="ms-auto h-8 w-8 text-xs" />
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 md:flex-row">
        <div className="min-w-0 flex-1">
          {/* player */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl" style={gradStyle(v.gradient)}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50">
                <Play className="h-8 w-8 fill-white text-white" />
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0">
              <div className="h-1 w-full bg-white/30">
                <div className="h-full w-[35%] bg-[#FF0000]" />
              </div>
              <div className="flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-3 pb-1.5 pt-2 text-white">
                <Play className="h-4 w-4 fill-white" />
                <Volume2 className="h-4 w-4" />
                <span className="azm-nums text-xs" dir="ltr">
                  5:47 / {fmtDur(v.durationMin)}
                </span>
                <Maximize className="ms-auto h-4 w-4" />
              </div>
            </div>
          </div>

          <h1 className="mt-3 text-lg font-bold leading-snug text-zinc-900">{v.title[lang]}</h1>

          {/* channel row */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Avatar name={v.channelName[lang]} className="h-10 w-10 text-sm" />
            <div className="min-w-0">
              <button
                onClick={() => navigate(`youtube.com/${v.channel}`)}
                className="block truncate text-sm font-semibold text-zinc-900 hover:underline"
              >
                {v.channelName[lang]}
              </button>
              <p className="text-xs text-zinc-500">{c.subs}</p>
            </div>
            <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              {c.subscribe}
            </button>
            <div className="ms-auto flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800">
                <ThumbsUp className="h-4 w-4" /> {c.like}
              </span>
              <span className="flex items-center rounded-full bg-zinc-100 px-3 py-2 text-zinc-800">
                <ThumbsDown className="h-4 w-4" />
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800">
                <Share className="h-4 w-4" />
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-zinc-100 p-3 text-sm">
            <p className="azm-nums font-medium text-zinc-900">
              {v.views[lang]} · {v.age[lang]} · #study #focus
            </p>
            <p className="mt-1 leading-relaxed text-zinc-700">{v.desc[lang]}</p>
          </div>

          {/* comments */}
          <section className="mt-5">
            <h2 className="text-sm font-bold text-zinc-900">{c.commentsTitle}</h2>
            <div className="mt-3 space-y-4">
              {v.comments.map((cm, i) => (
                <div key={i} className="flex gap-3">
                  <Avatar name={cm.author} className="h-8 w-8 text-xs" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900">
                      {cm.author}{" "}
                      <span className="font-normal text-zinc-500">{i === 0 ? c.t1 : c.t2}</span>
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-zinc-800">{cm.text[lang]}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* up next */}
        <aside className="hidden w-80 shrink-0 md:block">
          <h2 className="mb-2 text-sm font-bold text-zinc-900">{c.next}</h2>
          <div className="space-y-3">
            {upNext.map((x) => (
              <button
                key={x.id}
                onClick={() => navigate(`youtube.com/watch?v=${x.id}`)}
                className="flex w-full gap-2 text-start"
              >
                <Thumb
                  gradient={x.gradient}
                  duration={fmtDur(x.durationMin)}
                  className="w-40 shrink-0 rounded-lg"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900">{x.title[lang]}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{x.channelName[lang]}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {x.views[lang]} · {x.age[lang]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}

/* ============================== youtube channel ============================== */

function YouTubeChannelPage({ lang, navigate, dest }: SitePageProps) {
  const raw = dest.channel ?? "@edulamp";
  const handle = raw.startsWith("@") ? raw : `@${raw}`;
  const vids = YT_VIDEOS.filter((v) => v.channel.toLowerCase() === handle.toLowerCase());
  const name = vids[0]?.channelName[lang] ?? handle;
  const c =
    lang === "ar"
      ? { subs: "١٫٢٤ مليون مشترك · 42 فيديو", tabs: ["الرئيسية", "الفيديوهات", "حول"], empty: "لا توجد فيديوهات بعد" }
      : { subs: "1.24M subscribers · 42 videos", tabs: ["Home", "Videos", "About"], empty: "No videos yet" };

  return (
    <Page lang={lang}>
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-[#0f0f0f] px-3 py-2.5 text-white md:px-4">
        <button onClick={() => navigate("youtube.com")} className="flex items-center gap-1.5">
          <Youtube className="h-6 w-6 text-[#FF0000]" />
          <span className="text-lg font-semibold tracking-tight" dir="ltr">
            YouTube
          </span>
        </button>
        <Avatar name="A" className="ms-auto h-8 w-8 text-xs" />
      </header>

      <div className="mx-auto max-w-5xl p-4">
        <div className="h-24 rounded-xl md:h-36" style={{ backgroundImage: "linear-gradient(120deg, #52525b, #18181b)" }} />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Avatar name={name} className="-mt-9 h-16 w-16 border-4 border-white text-lg shadow-sm" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-zinc-900">{name}</h1>
            <p className="text-sm text-zinc-500" dir="ltr">
              {handle} · {c.subs}
            </p>
          </div>
          <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            {lang === "ar" ? "اشتراك" : "Subscribe"}
          </button>
        </div>

        <nav className="mt-4 flex gap-6 border-b border-zinc-200 text-sm">
          {c.tabs.map((tab, i) => (
            <span
              key={tab}
              className={`pb-2 font-medium ${
                i === 0 ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-500"
              }`}
            >
              {tab}
            </span>
          ))}
        </nav>

        {vids.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">{c.empty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
            {vids.map((v) => (
              <button key={v.id} onClick={() => navigate(`youtube.com/watch?v=${v.id}`)} className="group text-start">
                <Thumb
                  gradient={v.gradient}
                  duration={fmtDur(v.durationMin)}
                  icon={
                    <Play className="h-8 w-8 fill-white/90 text-white/90 opacity-0 transition group-hover:opacity-100" />
                  }
                  className="w-full rounded-xl"
                />
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-zinc-900">{v.title[lang]}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {v.views[lang]} · {v.age[lang]}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

/* ============================== youtube playlist ============================== */

function YouTubePlaylistPage({ lang, navigate, dest }: SitePageProps) {
  const listId = dest.playlistId ?? "PL-bio-unit3";
  const c =
    lang === "ar"
      ? { by: "قائمة تشغيل · مصباح التعليم", main: "فيديوهات القائمة" }
      : { by: "Playlist · EduLamp", main: "Playlist videos" };
  return (
    <Page lang={lang}>
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-[#0f0f0f] px-3 py-2.5 text-white md:px-4">
        <button onClick={() => navigate("youtube.com")} className="flex items-center gap-1.5">
          <Youtube className="h-6 w-6 text-[#FF0000]" />
          <span className="text-lg font-semibold tracking-tight" dir="ltr">
            YouTube
          </span>
        </button>
        <Avatar name="A" className="ms-auto h-8 w-8 text-xs" />
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:flex-row">
        <aside className="rounded-xl bg-zinc-100 p-4 md:w-72 md:shrink-0">
          <LibraryBig className="h-5 w-5 text-zinc-500" />
          <h2 className="mt-2 truncate text-sm font-bold text-zinc-900" dir="ltr">
            {listId}
          </h2>
          <p className="text-xs text-zinc-500">{c.by}</p>
          <ol className="mt-3 space-y-2">
            {EDU_VIDEOS.map((v, i) => (
              <li key={v.id}>
                <button onClick={() => navigate(`youtube.com/watch?v=${v.id}`)} className="flex w-full gap-2 text-start">
                  <span className="azm-nums w-4 pt-2 text-xs text-zinc-500" dir="ltr">
                    {i + 1}
                  </span>
                  <Thumb gradient={v.gradient} className="w-24 shrink-0 rounded-md" />
                  <span className="min-w-0 pt-0.5">
                    <span className="line-clamp-2 block text-xs font-medium leading-snug text-zinc-900">
                      {v.title[lang]}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                      {v.channelName[lang]} · {fmtDur(v.durationMin)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="min-w-0 flex-1">
          <h1 className="mb-3 text-base font-bold text-zinc-900">{c.main}</h1>
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {EDU_VIDEOS.map((v) => (
              <button key={v.id} onClick={() => navigate(`youtube.com/watch?v=${v.id}`)} className="group text-start">
                <Thumb
                  gradient={v.gradient}
                  duration={fmtDur(v.durationMin)}
                  icon={
                    <Play className="h-8 w-8 fill-white/90 text-white/90 opacity-0 transition group-hover:opacity-100" />
                  }
                  className="w-full rounded-xl"
                />
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-zinc-900">{v.title[lang]}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {v.channelName[lang]} · {v.views[lang]}
                </p>
              </button>
            ))}
          </div>
        </main>
      </div>
    </Page>
  );
}

/* ============================== google ============================== */

function GoogleHome({ lang, navigate }: SitePageProps) {
  const [q, setQ] = useState("");
  const dict = getDict(lang).browser;
  const c = lang === "ar" ? { search: "بحث Google", lucky: "أنا محظوظ" } : { search: "Google Search", lucky: "I'm Feeling Lucky" };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`google.com/search?q=${encodeURIComponent(q)}`);
  };
  return (
    <Page lang={lang}>
      <div className="flex min-h-full flex-col items-center px-4 pb-10 pt-20 md:pt-28">
        <p className="text-5xl font-medium tracking-wide text-zinc-700" dir="ltr">
          Google
        </p>
        <form
          onSubmit={submit}
          className="mt-9 flex w-full max-w-xl items-center gap-3 rounded-full border border-zinc-300 px-5 py-3 shadow-sm transition focus-within:shadow-md"
        >
          <Search className="h-5 w-5 shrink-0 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dict.searchPlaceholder}
            aria-label={dict.searchAction}
            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            dir="auto"
          />
          <Mic className="h-5 w-5 shrink-0 text-zinc-400" />
        </form>
        <div className="mt-7 flex gap-3">
          <span className="rounded-md bg-zinc-100 px-4 py-2 text-sm text-zinc-700">{c.search}</span>
          <span className="rounded-md bg-zinc-100 px-4 py-2 text-sm text-zinc-700">{c.lucky}</span>
        </div>
        <p className="mt-12 flex items-center gap-1.5 text-xs text-zinc-500">
          <Info className="h-3.5 w-3.5" />
          {dict.simulated}
        </p>
      </div>
    </Page>
  );
}

function GoogleResultsPage({ lang, navigate, dest }: SitePageProps) {
  const [q2, setQ2] = useState(dest.query ?? "");
  const dict = getDict(lang).browser;
  const q = dest.query?.trim() || (lang === "ar" ? "التمثيل الضوئي" : "photosynthesis");
  const photo = VIDEO_BY_ID.get("v-photo1");
  const c =
    lang === "ar"
      ? {
          stats: "نحو ١٬٢٤٠٬٠٠٠ نتيجة (٠٫٤٢ ثانية)",
          results: [
            {
              site: "wikipedia.org",
              url: "wikipedia.org/wiki/Photosynthesis",
              title: `${q} — التعريف والنظرة العامة`,
              snippet: `دليل موسوعي يشرح ${q} بالخطوات والأمثلة، مع ملخص سريع مناسب للمراجعة قبل الاختبار.`,
            },
            {
              site: "coursera.org",
              url: "coursera.org/learn/solar",
              title: "دورة تفاعلية: الفهم من الصفر حتى إتقان الفكرة",
              snippet: "محاضرات قصيرة، تمارين تدريبية، وشهادة إتمام — انضم مجانًا وابدأ بالأسبوع الأول.",
            },
            {
              site: "khanacademy.org",
              url: "khanacademy.org/bio/photosynthesis/lesson/1",
              title: "دروس وتمارين تفاعلية مع تتبع للتقدم",
              snippet: "شرح مبسّط بمقاطع قصيرة وأسئلة تحدٍّ لقياس فهمك خطوة بخطوة — مناسب للطلاب.",
            },
            {
              site: "youtube.com",
              url: "youtube.com/watch?v=v-photo1",
              title: photo?.title[lang] ?? `${q} — شرح شامل خطوة بخطوة`,
              snippet: photo?.desc[lang] ?? "شرح كامل مع ملخص نهائي وأسئلة تدريبية في نهاية الفيديو.",
            },
            {
              site: "yallakora.com",
              url: "yallakora.com",
              title: "يلا كورة — نتائج المباريات الأحدث وترتيب الدوريات",
              snippet: "متابعة لحظية لنتائج مباريات اليوم، أخبار الانتقالات، وجدول الترتيب الكامل.",
            },
            {
              site: "netflix.com",
              url: "netflix.com",
              title: "أشهر مسلسلات هذا الأسبوع على نتفليكس",
              snippet: "قائمة الأعمال الأكثر مشاهدة الآن — حلقات جديدة كل أسبوع وشائعة على مواقع التواصل.",
            },
          ],
        }
      : {
          stats: "About 1,240,000 results (0.42 seconds)",
          results: [
            {
              site: "wikipedia.org",
              url: "wikipedia.org/wiki/Photosynthesis",
              title: `${q} — definition and overview`,
              snippet: `An encyclopedic guide to ${q} with step-by-step explanations and examples — ideal for quick pre-exam revision.`,
            },
            {
              site: "coursera.org",
              url: "coursera.org/learn/solar",
              title: "Interactive course: master the fundamentals from zero",
              snippet: "Short lectures, practice exercises, and a certificate — join for free and start week one today.",
            },
            {
              site: "khanacademy.org",
              url: "khanacademy.org/bio/photosynthesis/lesson/1",
              title: "Lessons and practice with progress tracking",
              snippet: "Simple explanations in short videos plus challenge questions that measure your understanding step by step.",
            },
            {
              site: "youtube.com",
              url: "youtube.com/watch?v=v-photo1",
              title: photo?.title[lang] ?? `${q} — complete step-by-step explanation`,
              snippet: photo?.desc[lang] ?? "A full walkthrough with a final recap and practice questions at the end of the video.",
            },
            {
              site: "yallakora.com",
              url: "yallakora.com",
              title: "YallaKora — latest match results and league standings",
              snippet: "Live coverage of today's matches, transfer news, and full league tables updated every minute.",
            },
            {
              site: "netflix.com",
              url: "netflix.com",
              title: "Most popular series this week on Netflix",
              snippet: "The most-watched titles right now — new episodes weekly and all over social media.",
            },
          ],
        };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q2.trim()) navigate(`google.com/search?q=${encodeURIComponent(q2)}`);
  };
  return (
    <Page lang={lang}>
      <header className="border-b border-zinc-200 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <button onClick={() => navigate("google.com")} className="shrink-0 text-xl font-medium tracking-wide text-zinc-700" dir="ltr">
            Google
          </button>
          <form
            onSubmit={submit}
            className="flex flex-1 items-center gap-3 rounded-full border border-zinc-300 px-4 py-2 shadow-sm"
          >
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              value={q2}
              onChange={(e) => setQ2(e.target.value)}
              aria-label={dict.searchAction}
              className="w-full bg-transparent text-sm text-zinc-900 outline-none"
              dir="auto"
            />
            <Mic className="h-4 w-4 shrink-0 text-zinc-400" />
          </form>
          <Avatar name="S" className="h-8 w-8 text-xs" />
        </div>
      </header>

      <p className="azm-nums mx-auto mt-3 max-w-3xl px-4 text-xs text-zinc-500">{c.stats}</p>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-8 pt-4">
        {c.results.map((r) => (
          <div key={r.url}>
            <p className="text-xs text-zinc-500" dir="ltr">
              {r.site}
            </p>
            <button onClick={() => navigate(r.url)} className="mt-0.5 block text-start">
              <span className="text-lg font-medium text-zinc-800 hover:underline">{r.title}</span>
            </button>
            <p className="text-sm text-emerald-700" dir="ltr">
              {r.url}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">{r.snippet}</p>
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ============================== Azm assistant pages ==============================
 * Every AI destination inside the simulated browser (chatgpt.com, claude.ai, …)
 * renders the SAME assistant: Azm (عزم). The third-party hosts stay as plain
 * simulated addresses for scope/authorization, but the assistant's identity,
 * interface and branding are always عزم / Azm — never ChatGPT or Claude. */

interface ChatMsg {
  role: "user" | "ai";
  text: string;
  bullets?: string[];
  outro?: string;
}

interface ChatCannedReply {
  intro: string;
  bullets: [string, string, string];
  outro: string;
}

function ChatShell({
  lang,
  dest,
  theme,
}: {
  lang: Lang;
  dest: NavDestination;
  theme: {
    name: string;
    icon: ReactNode;
    aiIcon: ReactNode;
    surface: string;
    accentBtn: string;
    userBubble: string;
    headerIcon: string;
    replies: ChatCannedReply[];
    suggestions: string[];
    emptyTitle: string;
    emptySub: string;
    inputPh: string;
    sendLabel: string;
  };
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    if (dest.query && dest.query.trim()) {
      const r = theme.replies[0];
      return [
        { role: "user", text: dest.query },
        { role: "ai", text: r.intro, bullets: [...r.bullets], outro: r.outro },
      ];
    }
    return [];
  });
  const [input, setInput] = useState("");

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const aiCount = messages.filter((m) => m.role === "ai").length;
    const r = theme.replies[aiCount % theme.replies.length];
    setMessages((m) => [...m, { role: "user", text }]);
    window.setTimeout(() => {
      setMessages((m) => [...m, { role: "ai", text: r.intro, bullets: [...r.bullets], outro: r.outro }]);
    }, 700);
  };

  return (
    <Page lang={lang} className={`${theme.surface} flex h-full flex-col`}>
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
        <span className={theme.headerIcon}>{theme.icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold" dir="auto">
            {theme.name}
          </span>
          <span className="block text-[10px] font-bold tracking-[0.22em] text-zinc-400" dir="ltr">
            AZM AI
          </span>
        </span>
        <Avatar name="M" className="ms-auto h-7 w-7 text-[11px]" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 ${theme.headerIcon}`}>
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-lg font-bold text-zinc-900">{theme.emptyTitle}</h2>
              <p className="mt-1 text-sm text-zinc-600">{theme.emptySub}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {theme.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${theme.userBubble}`}>
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    {theme.aiIcon} {theme.name}
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-800">{m.text}</p>
                  {m.bullets ? (
                    <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-zinc-700">
                      {m.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {m.outro ? <p className="mt-2 text-sm leading-relaxed text-zinc-800">{m.outro}</p> : null}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 px-4 pb-3 pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={theme.inputPh}
            className="azm-scroll flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500"
            dir="auto"
          />
          <button type="submit" aria-label={theme.sendLabel} className={`rounded-full p-2.5 ${theme.accentBtn}`}>
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-zinc-400">
          {getDict(lang).browser.simulated}
        </p>
      </div>
    </Page>
  );
}

function AzmAssistantPage({ lang, dest }: SitePageProps) {
  const c =
    lang === "ar"
      ? {
          inputPh: "اسأل عزم أي شيء عن دراستك...",
          send: "إرسال",
          emptyTitle: "كيف أساعدك في دراستك اليوم؟",
          emptySub: "اطلب شرحًا مبسطًا، ملخصًا، أو أسئلة تدريبية — وسأبني الإجابة على هدفك.",
          suggestions: ["لخّص لي الدرس في نقاط", "اشرح دورة كالفن ببساطة", "جهّز 5 أسئلة تدريبية"],
          replies: [
            {
              intro: "لنقسّم سؤالك إلى خطوات واضحة تسهّل الفهم والاسترجاع لاحقًا.",
              bullets: [
                "ابدأ بتعريف مبسّط للمصطلح الأساسي مع مثال من حياتك اليومية.",
                "أعد صياغة الفكرة بأسلوبك في ثلاث جمل قبل الانتقال إلى التفاصيل.",
                "اختبر نفسك بثلاثة أسئلة قصيرة، وارجع فقط إلى ما أخطأت فيه.",
              ] as [string, string, string],
              outro: "أخبرني بمادتك وهدفك في هذه الجلسة، وسأجهّز لك أسئلة تدريبية مناسبة.",
            },
            {
              intro: "سؤال جيد — الإجابة تعتمد على هدفك، لكن هناك قاعدة عامة تنفعك دائمًا.",
              bullets: [
                "حدّد ناتجًا ملموسًا للجلسة: ما الشيء الذي ستتقنه قبل أن توقف الموقّت؟",
                "قسّم الوقت إلى جولات تركيز قصيرة مع فاصل بين كل جولة.",
                "أنهِ كل جولة بتلخيص سريع بجملة واحدة لترسّخ الفكرة.",
              ] as [string, string, string],
              outro: "إذا نسخت لي عنوان الدرس، أحوّله فورًا إلى خطة مراجعة صغيرة.",
            },
            {
              intro: "سأشرحها لك بمثال عملي أقرب إلى موادك الدراسية.",
              bullets: [
                "تخيّل المفهوم كخطوات على خط زمني: قبل، أثناء، وبعد العملية.",
                "اربط كل خطوة بكلمة مفتاحية واحدة تسهّل تذكّرها في الاختبار.",
                "راجع المثال بعد يوم واحد — التكرار المتباعد يثبّت المعلومة.",
              ] as [string, string, string],
              outro: "هل تريد أن أتحقق من فهمك بسؤالين سريعين الآن؟",
            },
          ],
        }
      : {
          inputPh: "Ask Azm anything about your studies...",
          send: "Send",
          emptyTitle: "How can I help you study today?",
          emptySub: "Ask for a simple explanation, a summary, or practice questions — I'll build the answer around your goal.",
          suggestions: ["Summarize my lesson in points", "Explain the Calvin cycle simply", "Make me 5 practice questions"],
          replies: [
            {
              intro: "Here's a clear way to think about it: break it into steps that make understanding and recall easier.",
              bullets: [
                "Start with a plain definition of the core term plus an everyday example.",
                "Restate the idea in your own words in three sentences before going deeper.",
                "Quiz yourself with three short questions, then revisit only what you missed.",
              ] as [string, string, string],
              outro: "Tell me your subject and today's goal, and I'll prepare matching practice questions.",
            },
            {
              intro: "Good question — the answer depends on your goal, but one general rule always helps.",
              bullets: [
                "Set a concrete outcome for the session: what will you master before the timer stops?",
                "Split the time into short focus rounds with a break between each round.",
                "End every round with a one-line summary to lock the idea in.",
              ] as [string, string, string],
              outro: "Paste the lesson title and I'll turn it into a mini revision plan right away.",
            },
            {
              intro: "Let me explain with a practical example close to your subjects.",
              bullets: [
                "Picture the concept as steps on a timeline: before, during, and after the process.",
                "Attach one keyword to each step so it's easier to recall in the exam.",
                "Review the example one day later — spaced repetition makes it stick.",
              ] as [string, string, string],
              outro: "Want me to check your understanding with two quick questions now?",
            },
          ],
        };
    return (
      <ChatShell
        lang={lang}
        dest={dest}
        theme={{
          name: lang === "ar" ? "عزم" : "Azm",
          icon: <Bot className="h-4 w-4" />,
          aiIcon: <Bot className="h-3.5 w-3.5" />,
          surface: "bg-[#f7f7f8] text-zinc-900",
          accentBtn: "bg-[#7C3AED] text-white hover:bg-[#8B5CF6]",
          userBubble: "bg-[#7C3AED] text-white",
          headerIcon: "text-zinc-800",
          replies: c.replies,
          suggestions: c.suggestions,
          emptyTitle: c.emptyTitle,
          emptySub: c.emptySub,
          inputPh: c.inputPh,
          sendLabel: c.send,
        }}
      />
    );
  }

function AzmAssistantReviewPage({ lang, dest }: SitePageProps) {
  const c =
    lang === "ar"
      ? {
          inputPh: "شاركني سؤالك أو فكرة الدرس...",
          send: "إرسال",
          emptyTitle: "بماذا نبدأ اليوم؟",
          emptySub: "سؤال عن درس، فكرة تحتاج تنظيمًا، أو ملخص لشريحة طويلة — اكتبها وسنفكر فيها معًا.",
          suggestions: ["راجع معي فكرة الدرس", "لخّص هذه الفكرة بجملة", "اقترح خطة مراجعة"],
          replies: [
            {
              intro: "سؤال مهم — دعنا نفكّكه بهدوء ونصل إلى جوهره.",
              bullets: [
                "ابدأ مما تعرفه بالفعل، ثم أضف طبقة جديدة واحدة في كل مرة.",
                "اكتب الفكرة بجملة واحدة كما لو كنت تشرحها لصديق.",
                "حدّد الجزء الذي ما زال غامضًا واعرضه عليّ لأشرحه بعينه.",
              ] as [string, string, string],
              outro: "قل لي أي جزء ما زال غير واضح، وسأبسّطه بمثال آخر.",
            },
            {
              intro: "هناك طريقة أبسط لرؤية هذا الموضوع مما تبدو عليه.",
              bullets: [
                "افصل بين «الفهم» و«الحفظ»: افهم أولًا ثم احفظ الملخص.",
                "ارسم فكرة الدرس بيدك بسرعة — يثبّت الفكرة أفضل من إعادة القراءة.",
                "اقرأ المصدر مرة واحدة بتركيز بدل ثلاث مرات بتشتت.",
              ] as [string, string, string],
              outro: "شاركني مقطعًا من الدرس وسأساعدك في تلخيصه بأسلوبك.",
            },
            {
              intro: "حدسك حول المذاكرة صحيح، لكن الترتيب هو ما يصنع الفرق.",
              bullets: [
                "ابدأ بالمهمة الأصعب عندما يكون تركيزك في أعلى مستوياته.",
                "اجعل لكل جلسة سؤالًا واحدًا تريد الإجابة عنه في نهايتها.",
                "اختم الجلسة بتقييم قصير: ما الذي تحسّن اليوم؟",
              ] as [string, string, string],
              outro: "أخبرني بجدولك اليوم، وأرتب لك الجلسات حسب الطاقة المطلوبة.",
            },
          ],
        }
      : {
          inputPh: "Share your question or lesson idea with Azm...",
          send: "Send",
          emptyTitle: "What should we start with today?",
          emptySub: "A question about a lesson, an idea that needs organizing, or a long passage to summarize — write it and we'll think it through together.",
          suggestions: ["Review a lesson idea with me", "Summarize this idea in one line", "Suggest a revision plan"],
          replies: [
            {
              intro: "An important question — let's unpack it calmly and get to its core.",
              bullets: [
                "Start from what you already know, then add one new layer at a time.",
                "Write the idea in one sentence as if explaining it to a friend.",
                "Pinpoint the part that still feels unclear and show it to me specifically.",
              ] as [string, string, string],
              outro: "Tell me which part still feels unclear and I'll simplify it with another example.",
            },
            {
              intro: "There's a simpler way to see this topic than it first appears.",
              bullets: [
                "Separate understanding from memorizing: understand first, then memorize the summary.",
                "Sketch the lesson quickly by hand — it locks the idea in better than re-reading.",
                "Read the source once with focus instead of three times while distracted.",
              ] as [string, string, string],
              outro: "Share a passage from the lesson and I'll help you summarize it in your own style.",
            },
            {
              intro: "Your instincts about studying are right — the ordering is what makes the difference.",
              bullets: [
                "Start with the hardest task while your focus is at its peak.",
                "Give each session one question you want answered by the end of it.",
                "Close the session with a short review: what improved today?",
              ] as [string, string, string],
              outro: "Tell me your schedule for today and I'll order your sessions by required energy.",
            },
          ],
        };
    return (
      <ChatShell
        lang={lang}
        dest={dest}
        theme={{
          name: lang === "ar" ? "عزم" : "Azm",
          icon: <Sparkles className="h-4 w-4" />,
          aiIcon: <Sparkles className="h-3.5 w-3.5" />,
          surface: "bg-[#faf9f5] text-zinc-900",
          accentBtn: "bg-[#7C3AED] text-white hover:bg-[#8B5CF6]",
          userBubble: "bg-[#7C3AED] text-white",
          headerIcon: "text-amber-600",
          replies: c.replies,
          suggestions: c.suggestions,
          emptyTitle: c.emptyTitle,
          emptySub: c.emptySub,
          inputPh: c.inputPh,
          sendLabel: c.send,
        }}
      />
    );
  }

/* ============================== coursera ============================== */

function CourseraPage({ lang, navigate }: SitePageProps) {
  const [open, setOpen] = useState(0);
  const ar = lang === "ar";
  const c = ar
    ? {
        nav: ["استكشف", "الشهادات", "للأعمال"],
        signin: "تسجيل الدخول",
        sub: "أطلق العنان لعجائب الفلك عبر دورة تفاعلية تصل إلى مدارات الكواكب",
        instructor: "د. مي الراشد",
        instructorRole: "عالمة فلك — جامعة النجوم",
        ratingN: "4.8",
        ratingCount: "(12,431 تقييم)",
        enroll: "التسجيل مجانًا",
        learnTitle: "ما ستتعلمه",
        learn: [
          "وصف حركة الكواكب ومداراتها بقوانين كبلر.",
          "تفسير أطوار القمر والكسوف والخسوف.",
          "مقارنة الكواكب الصخرية بالغازية العملاقة.",
          "تحليل أحدث الصور من مسبارات الفضاء.",
        ],
        syllabusTitle: "منهج الدورة",
        weeks: [
          {
            t: "الأسبوع 1 — جولة في المجموعة الشمسية",
            ls: [
              { n: "لمحة عامة عن الشمس والكواكب", d: "12 د" },
              { n: "كيف تُقاس المسافات في الفضاء؟", d: "9 د" },
              { n: "نشاط: ارسم خريطة المدارات", d: "15 د" },
            ],
          },
          {
            t: "الأسبوع 2 — قوانين كبلر والحركة المدارية",
            ls: [
              { n: "قوانين كبلر الثلاثة", d: "14 د" },
              { n: "من القطع الناقص إلى سرعة المدار", d: "11 د" },
            ],
          },
          {
            t: "الأسبوع 3 — القمر والأطوار والكسوف",
            ls: [
              { n: "لماذا يتغير وجه القمر؟", d: "10 د" },
              { n: "الكسوف والخسوف خطوة بخطوة", d: "13 د" },
            ],
          },
          {
            t: "الأسبوع 4 — الكواكب الخارجية والمسبارات",
            ls: [
              { n: "العوالم الغازية العملاقة", d: "16 د" },
              { n: "أحدث صور مسبار المشتري", d: "8 د" },
            ],
          },
        ],
        facts: [
          { icon: "clock", t: "١٢ ساعة إجمالًا" },
          { icon: "list", t: "4 وحدات · 18 محاضرة" },
          { icon: "lang", t: "متاحة بالعربية والإنجليزية" },
          { icon: "cert", t: "شهادة إتمام قابلة للمشاركة" },
        ],
      }
    : {
        nav: ["Explore", "Degrees", "For Business"],
        signin: "Sign in",
        sub: "Unlock the wonders of astronomy with an interactive course that reaches planetary orbits",
        instructor: "Dr. Maya Al-Rashid",
        instructorRole: "Astrophysicist — Stars University",
        ratingN: "4.8",
        ratingCount: "(12,431 ratings)",
        enroll: "Enroll for free",
        learnTitle: "What you'll learn",
        learn: [
          "Describe planetary motion and orbits with Kepler's laws.",
          "Explain moon phases, solar and lunar eclipses.",
          "Compare rocky planets with gas giants.",
          "Analyze the latest images from space probes.",
        ],
        syllabusTitle: "Syllabus",
        weeks: [
          {
            t: "Week 1 — A tour of the solar system",
            ls: [
              { n: "Overview of the sun and planets", d: "12 min" },
              { n: "How distances in space are measured", d: "9 min" },
              { n: "Activity: draw a map of the orbits", d: "15 min" },
            ],
          },
          {
            t: "Week 2 — Kepler's laws and orbital motion",
            ls: [
              { n: "Kepler's three laws", d: "14 min" },
              { n: "From ellipses to orbital speed", d: "11 min" },
            ],
          },
          {
            t: "Week 3 — The moon, phases, and eclipses",
            ls: [
              { n: "Why does the moon change face?", d: "10 min" },
              { n: "Solar and lunar eclipses step by step", d: "13 min" },
            ],
          },
          {
            t: "Week 4 — Outer planets and probes",
            ls: [
              { n: "The giant gas worlds", d: "16 min" },
              { n: "Latest images from the Jupiter probe", d: "8 min" },
            ],
          },
        ],
        facts: [
          { icon: "clock", t: "12 hours total" },
          { icon: "list", t: "4 modules · 18 lectures" },
          { icon: "lang", t: "Available in Arabic and English" },
          { icon: "cert", t: "Shareable certificate of completion" },
        ],
      };
  const factIcons: Record<string, ReactNode> = {
    clock: <Clock className="h-4 w-4" />,
    list: <ListChecks className="h-4 w-4" />,
    lang: <Languages className="h-4 w-4" />,
    cert: <BadgeCheck className="h-4 w-4" />,
  };

  return (
    <Page lang={lang}>
      <header className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
        <button onClick={() => navigate("coursera.org")} className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-rose-600" />
          <span className="text-xl font-bold tracking-tight text-zinc-900" dir="ltr">
            coursera
          </span>
        </button>
        <nav className="ms-6 hidden gap-5 text-sm text-zinc-600 md:flex">
          {c.nav.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </nav>
        <span className="ms-auto rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700">
          {c.signin}
        </span>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Thumb
            gradient={["#F59E0B", "#FB7185"]}
            icon={<PlayCircle className="h-14 w-14 text-white/90" />}
            className="w-full rounded-xl"
          />
          <h1 className="mt-4 text-2xl font-bold leading-snug text-zinc-900">
            {ar ? "فهم النظام الشمسي" : "Understanding the Solar System"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">{c.sub}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Avatar name={c.instructor} className="h-9 w-9 text-xs" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">{c.instructor}</p>
              <p className="text-xs text-zinc-500">{c.instructorRole}</p>
            </div>
            <div className="azm-nums flex items-center gap-1 text-sm" dir="ltr">
              <span className="font-bold text-amber-600">{c.ratingN}</span>
              {[0, 1, 2, 3].map((i) => (
                <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
              ))}
              <Star className="h-4 w-4 fill-amber-200 text-amber-200" />
              <span className="text-zinc-500">{c.ratingCount}</span>
            </div>
          </div>
          <button className="mt-4 rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white">
            {c.enroll}
          </button>

          <section className="mt-6 rounded-xl border border-zinc-200 p-4">
            <h2 className="text-base font-bold text-zinc-900">{c.learnTitle}</h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {c.learn.map((l) => (
                <li key={l} className="flex items-start gap-2 text-sm text-zinc-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {l}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-base font-bold text-zinc-900">{c.syllabusTitle}</h2>
            <div className="mt-3 space-y-2">
              {c.weeks.map((w, wi) => (
                <div key={wi} className="overflow-hidden rounded-xl border border-zinc-200">
                  <button
                    onClick={() => setOpen(open === wi ? -1 : wi)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  >
                    <span>{w.t}</span>
                    <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${open === wi ? "rotate-180" : ""}`} />
                  </button>
                  {open === wi ? (
                    <ul className="border-t border-zinc-200 bg-zinc-50/60 px-4 py-2">
                      {w.ls.map((l, li) => (
                        <li key={li}>
                          <button
                            onClick={
                              li === 0 ? () => navigate(`coursera.org/learn/solar/lecture/week${wi + 1}`) : undefined
                            }
                            className="flex w-full items-center gap-2 py-1.5 text-sm text-zinc-700"
                          >
                            <PlayCircle className="h-4 w-4 shrink-0 text-zinc-500" />
                            <span className="truncate">{l.n}</span>
                            <span className="azm-nums ms-auto shrink-0 text-xs text-zinc-500">{l.d}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="md:pt-1">
          <div className="rounded-xl bg-zinc-50 p-4">
            <h2 className="text-sm font-bold text-zinc-900">{c.enroll}</h2>
            <ul className="mt-3 space-y-2.5">
              {c.facts.map((f) => (
                <li key={f.t} className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="text-zinc-500">{factIcons[f.icon]}</span>
                  {f.t}
                </li>
              ))}
            </ul>
            <button className="mt-4 w-full rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
              {c.enroll}
            </button>
          </div>
        </aside>
      </div>
    </Page>
  );
}

/* ============================== khan academy ============================== */

function KhanAcademyPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const c = ar
    ? {
        search: "ابحث في أكاديمية خان",
        title: "الأحياء — الوحدة 3: الطاقة في الخلايا",
        progress: "٦٠٪ من الوحدة مكتملة",
        challengeTitle: "تحدي الوحدة",
        challengeDesc: "١٥ سؤالًا من كل الدروس — اختبر نفسك قبل الاختبار الحقيقي.",
        challengeBtn: "ابدأ التحدي",
        units: [
          {
            t: "التمثيل الضوئي | شرح معمّق",
            prog: "٦٠٪",
            base: "bio/photosynthesis",
            lessons: ["مقدمة عن التمثيل الضوئي", "التفاعلات الضوئية", "دورة كالفن", "العوامل المؤثرة في معدل التمثيل"],
          },
          {
            t: "التنفس الخلوي | خطوة بخطوة",
            prog: "٢٥٪",
            base: "bio/respiration",
            lessons: ["الجليكوليز", "حلقة كريبس", "سلسلة نقل الإلكترون"],
          },
        ],
      }
    : {
        search: "Search Khan Academy",
        title: "Biology — Unit 3: Energy in cells",
        progress: "60% of the unit complete",
        challengeTitle: "Unit challenge",
        challengeDesc: "15 questions from every lesson — test yourself before the real exam.",
        challengeBtn: "Start challenge",
        units: [
          {
            t: "Photosynthesis in depth",
            prog: "60%",
            base: "bio/photosynthesis",
            lessons: ["Intro to photosynthesis", "The light reactions", "The Calvin cycle", "Factors affecting the rate"],
          },
          {
            t: "Cellular respiration step by step",
            prog: "25%",
            base: "bio/respiration",
            lessons: ["Glycolysis", "The Krebs cycle", "Electron transport chain"],
          },
        ],
      };

  return (
    <Page lang={lang}>
      <header className="flex items-center gap-2 bg-zinc-900 px-4 py-3 text-white">
        <button onClick={() => navigate("khanacademy.org")} className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-emerald-400" />
          <span className="font-semibold" dir="ltr">
            Khan Academy
          </span>
        </button>
        <span className="ms-auto hidden items-center gap-2 rounded-full bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 sm:flex">
          <Search className="h-4 w-4" />
          {c.search}
        </span>
        <Avatar name="K" className="h-8 w-8 text-xs" />
      </header>

      <div className="mx-auto max-w-3xl space-y-5 p-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{c.title}</h1>
          <p className="azm-nums mt-1 text-sm text-zinc-500">{c.progress}</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full w-3/5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {c.units.map((u) => (
          <section key={u.t} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-900">{u.t}</h2>
              <span className="azm-nums text-xs font-medium text-emerald-700">{u.prog}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: u.prog.includes("٦٠") || u.prog.includes("60") ? "60%" : "25%" }}
              />
            </div>
            <ul className="mt-3 divide-y divide-zinc-100">
              {u.lessons.map((lsn, li) => (
                <li key={lsn}>
                  <button
                    onClick={() => navigate(`khanacademy.org/${u.base}/lesson/${li + 1}`)}
                    className="flex w-full items-center gap-2.5 py-2.5 text-start text-sm text-zinc-800 hover:text-emerald-800"
                  >
                    <PlayCircle className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="truncate">{lsn}</span>
                    <span className="azm-nums ms-auto shrink-0 text-xs text-zinc-400" dir="ltr">
                      {8 + li * 4} min
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <Trophy className="h-8 w-8 text-amber-500" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-zinc-900">{c.challengeTitle}</h2>
            <p className="text-sm text-zinc-600">{c.challengeDesc}</p>
          </div>
          <button
            onClick={() => navigate("khanacademy.org/bio/challenge")}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            {c.challengeBtn}
          </button>
        </section>
      </div>
    </Page>
  );
}

/* ============================== wikipedia ============================== */

function WikiLink({
  navigate,
  to,
  children,
}: {
  navigate: (url: string) => void;
  to: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={() => navigate(to)}
      className="text-emerald-700 underline decoration-emerald-700/40 hover:decoration-emerald-700"
    >
      {children}
    </button>
  );
}

function WikipediaPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const c = ar
    ? {
        site: "ويكيبيديا",
        tagline: "الموسوعة الحرة",
        searchPh: "ابحث في ويكيبيديا",
        title: "التمثيل الضوئي",
        lastEdited: "آخر تعديل قبل ٥ أيام",
        toc: "المحتويات",
        sections: ["التعريف", "الكلوروفيل", "التفاعلات الضوئية", "وصلات خارجية", "المراجع"],
        p1: "التمثيل الضوئي هو عملية حيوية تستخدمها النباتات وبعض الكائنات الأخرى لتحويل طاقة الضوء إلى طاقة كيميائية مخزّنة في الجلوكوز، مع إطلاق الأكسجين كناتج ثانوي. تجري العملية داخل البلاستيدات الخضراء، وهي أساس معظم سلاسل الغذاء على اليابسة وفي المحيطات.",
        p2a: "يعتمد التمثيل الضوئي على صبغة ",
        p2b: " التي تمتص الضوء الأحمر والأزرق وتعكس الأخضر، ولهذا تبدو معظم النباتات خضراء.",
        chlorophyll: "الكلوروفيل",
        p3a: "تجري التفاعلات الضوئية في أغشية الثايلاكويد حيث يُفتّت الماء ويُنتَج ATP وNADPH، ثم يعتمد عليهما ",
        p3b: " لتثبيت ثاني أكسيد الكربون وإنتاج السكر.",
        calvin: "دورة كالفن",
        external: "وصلات خارجية",
        extLink: "بي بي سي — تقرير: نباتات تمتص الكربون أسرع مما ظننا",
        refs: "المراجع",
        ref1: "تقرير BBC العلمي، 2024 — صفحة 12.",
        infoboxTitle: "التمثيل الضوئي",
        info: [
          ["النوع", "عملية حيوية"],
          ["الموقع", "البلاستيدات الخضراء"],
          ["المدخلات", "ثاني أكسيد الكربون + ماء + ضوء"],
          ["النواتج", "جلوكوز + أكسجين"],
        ],
        equation: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",
        equationLabel: "المعادلة المبسطة",
      }
    : {
        site: "Wikipedia",
        tagline: "The Free Encyclopedia",
        searchPh: "Search Wikipedia",
        title: "Photosynthesis",
        lastEdited: "Last edited 5 days ago",
        toc: "Contents",
        sections: ["Definition", "Chlorophyll", "Light reactions", "External links", "References"],
        p1: "Photosynthesis is a biological process used by plants and some other organisms to convert light energy into chemical energy stored in glucose, releasing oxygen as a by-product. It takes place inside chloroplasts and underpins most food chains on land and in the oceans.",
        p2a: "Photosynthesis depends on the pigment ",
        p2b: ", which absorbs red and blue light and reflects green — which is why most plants look green.",
        chlorophyll: "chlorophyll",
        p3a: "The light reactions occur in the thylakoid membranes, where water is split and ATP and NADPH are produced; ",
        p3b: " then uses them to fix carbon dioxide and build sugar.",
        calvin: "the Calvin cycle",
        external: "External links",
        extLink: "BBC — report: plants absorb carbon faster than we thought",
        refs: "References",
        ref1: "BBC science report, 2024 — p. 12.",
        infoboxTitle: "Photosynthesis",
        info: [
          ["Type", "Biological process"],
          ["Location", "Chloroplasts"],
          ["Inputs", "Carbon dioxide + water + light"],
          ["Outputs", "Glucose + oxygen"],
        ],
        equation: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",
        equationLabel: "Simplified equation",
      };

  return (
    <Page lang={lang} className="bg-white text-zinc-900">
      <header className="border-b border-zinc-300 px-4 py-2.5">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button
            onClick={() => navigate("wikipedia.org")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 font-serif text-lg text-zinc-700"
            aria-label={c.site}
          >
            W
          </button>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-900">{c.site}</p>
            <p className="text-[11px] text-zinc-500">{c.tagline}</p>
          </div>
          <span className="ms-auto hidden items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-400 sm:flex">
            <Search className="h-4 w-4" />
            {c.searchPh}
          </span>
        </div>
      </header>

      <main
        className="mx-auto max-w-4xl px-4 py-5 md:px-6"
        style={{ fontFamily: ar ? "inherit" : "Georgia, serif" }}
      >
        <h1 className="text-3xl text-zinc-900">{c.title}</h1>
        <p className="mt-1 border-b border-zinc-300 pb-2 text-xs text-zinc-500">{c.lastEdited}</p>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[1fr_18rem]">
          <article className="min-w-0 space-y-5 text-[15px] leading-7 text-zinc-800">
            <div className="rounded border border-zinc-300 bg-zinc-50 p-3 text-sm">
              <p className="font-bold text-zinc-900">{c.toc}</p>
              <ol className="mt-1 list-decimal space-y-0.5 ps-5 text-zinc-600">
                {c.sections.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>

            <p>{c.p1}</p>

            <section>
              <h2 className="border-b border-zinc-300 pb-1 text-xl text-zinc-900">{c.sections[1]}</h2>
              <p className="mt-2">
                {c.p2a}
                <WikiLink navigate={navigate} to="wikipedia.org/wiki/Chlorophyll">
                  {c.chlorophyll}
                </WikiLink>
                {c.p2b}
              </p>
            </section>

            <section>
              <h2 className="border-b border-zinc-300 pb-1 text-xl text-zinc-900">{c.sections[2]}</h2>
              <p className="mt-2">
                {c.p3a}
                <WikiLink navigate={navigate} to="wikipedia.org/wiki/Calvin_cycle">
                  {c.calvin}
                </WikiLink>
                {c.p3b}
              </p>
            </section>

            <section>
              <h2 className="border-b border-zinc-300 pb-1 text-xl text-zinc-900">{c.external}</h2>
              <ul className="mt-2 list-disc space-y-1 ps-5">
                <li>
                  <WikiLink navigate={navigate} to="bbc.com">
                    {c.extLink}
                  </WikiLink>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="border-b border-zinc-300 pb-1 text-xl text-zinc-900">{c.refs}</h2>
              <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-zinc-600">
                <li>
                  <WikiLink navigate={navigate} to="bbc.com">
                    {c.ref1}
                  </WikiLink>
                </li>
              </ol>
            </section>
          </article>

          <aside>
            <div className="rounded border border-zinc-300 bg-zinc-50 p-3 text-sm">
              <p className="text-center font-bold text-zinc-900">{c.infoboxTitle}</p>
              <Thumb
                gradient={["#10B981", "#84CC16"]}
                icon={<Leaf className="h-8 w-8 text-white/90" />}
                className="mt-2 w-full rounded"
              />
              <dl className="mt-2">
                {c.info.map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-2 border-t border-zinc-200 py-1.5">
                    <dt className="shrink-0 font-semibold text-zinc-800">{k}</dt>
                    <dd className="text-end text-zinc-600">{val}</dd>
                  </div>
                ))}
                <div className="border-t border-zinc-200 py-1.5">
                  <dt className="font-semibold text-zinc-800">{c.equationLabel}</dt>
                  <dd className="azm-nums mt-1 text-center text-xs text-zinc-600" dir="ltr">
                    {c.equation}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </main>
    </Page>
  );
}

/* ============================== x (twitter) ============================== */

function XPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const c = ar
    ? {
        compose: "ماذا يحدث؟",
        post: "نشر",
        trendsTitle: "التوجهات لك",
        posts: [
          {
            n: "طارق",
            h: "@tariq_ftbl",
            t: "٢ س",
            text: "ما هذا الشوط الثاني؟ الترجي يقلب النتيجة في أربع دقائق فقط، والملعب يشعل نفسه من الفرح.",
          },
          {
            n: "ريم",
            h: "@reem_studies",
            t: "٤ س",
            text: "خطة المذاكرة المسائية: فتحت الكتاب، فتحت الهاتف لأرى الوقت فقط، وها أنا أضحك على الميمز منذ نصف ساعة.",
          },
          {
            n: "خالد",
            h: "@khalid_dev",
            t: "٧ س",
            text: "إطار العمل الجديد صدر اليوم: تحديثات الحالة أسرع بـ 40٪ وتبسيط كبير في واجهة المطوّر.",
          },
          {
            n: "لينا",
            h: "@lina_arts",
            t: "١١ س",
            text: "أعلن الفنان عن جولته العالمية الصيف المقبل، والمقاعد ستنفد خلال ساعات على الأرجح.",
          },
          {
            n: "منيرة",
            h: "@munira_focus",
            t: "١٤ س",
            text: "تذكير لطيف: 90 دقيقة تركيز عميق أثمر من 5 ساعات مشتتة. أغلقي الإشعارات وابدأي الآن.",
          },
        ],
        trends: [
          { cat: "رياضة · التوجهات", name: "الترجي يقلب النتيجة", count: "12.4 ألف منشور" },
          { cat: "تعليم · التوجهات", name: "#خطة_المذاكرة_الفاشلة", count: "8,901 منشور" },
          { cat: "تقنية · التوجهات", name: "إطار العمل الجديد", count: "5,120 منشور" },
          { cat: "فن · التوجهات", name: "الجولة العالمية", count: "21.7 ألف منشور" },
          { cat: "دراسة · التوجهات", name: "#تركيز_عميق", count: "3,405 منشور" },
        ],
      }
    : {
        compose: "What's happening?",
        post: "Post",
        trendsTitle: "Trends for you",
        posts: [
          {
            n: "Tariq",
            h: "@tariq_ftbl",
            t: "2h",
            text: "What a second half! Espérance turn it around in four minutes — the stadium is on fire.",
          },
          {
            n: "Reem",
            h: "@reem_studies",
            t: "4h",
            text: "Tonight's study plan: opened the book, opened the phone to check the time, and now I've been laughing at memes for half an hour.",
          },
          {
            n: "Khalid",
            h: "@khalid_dev",
            t: "7h",
            text: "New framework released today: state updates 40% faster and a much simpler developer interface.",
          },
          {
            n: "Lina",
            h: "@lina_arts",
            t: "11h",
            text: "He just announced next summer's world tour — tickets will be gone within hours.",
          },
          {
            n: "Munira",
            h: "@munira_focus",
            t: "14h",
            text: "Gentle reminder: 90 minutes of deep focus beat 5 distracted hours. Kill notifications, start now.",
          },
        ],
        trends: [
          { cat: "Sports · Trending", name: "Esperance comeback", count: "12.4K posts" },
          { cat: "Education · Trending", name: "#FailedStudyPlan", count: "8,901 posts" },
          { cat: "Tech · Trending", name: "New framework release", count: "5,120 posts" },
          { cat: "Entertainment · Trending", name: "World tour announced", count: "21.7K posts" },
          { cat: "Study · Trending", name: "#DeepFocus", count: "3,405 posts" },
        ],
      };
  const stats = ["34", "12", "120"];

  return (
    <Page lang={lang} className="bg-black text-zinc-100">
      <header className="sticky top-0 z-10 flex items-center border-b border-zinc-800 bg-black/85 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate("x.com")} className="text-xl font-bold text-white" dir="ltr">
          X
        </button>
        <Avatar name="M" className="ms-auto h-8 w-8 text-xs" />
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 md:grid-cols-[1fr_320px]">
        <main className="border-zinc-800 md:border-x">
          {/* compose */}
          <div className="flex gap-3 border-b border-zinc-800 p-4">
            <Avatar name={c.posts[0].n} className="h-10 w-10 text-sm" />
            <div className="min-w-0 flex-1">
              <input
                readOnly
                placeholder={c.compose}
                className="w-full bg-transparent text-lg outline-none placeholder:text-zinc-500"
              />
              <div className="mt-3 flex justify-end">
                <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black">{c.post}</span>
              </div>
            </div>
          </div>

          {/* feed */}
          <div className="divide-y divide-zinc-800">
            {c.posts.map((p, i) => (
              <article
                key={i}
                onClick={() => navigate(`x.com/post/${i + 1}`)}
                className="flex cursor-pointer gap-3 px-4 py-3 hover:bg-zinc-950"
              >
                <Avatar name={p.n} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-bold text-white">{p.n}</span>
                    <span className="truncate text-zinc-500" dir="ltr">
                      {p.h}
                    </span>
                    <span className="text-zinc-500">· {p.t}</span>
                    <MoreHorizontal className="ms-auto h-4 w-4 shrink-0 text-zinc-500" />
                  </div>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-zinc-100">{p.text}</p>
                  <div className="mt-2.5 flex max-w-xs items-center justify-between text-zinc-500">
                    <span className="flex items-center gap-1.5 text-xs">
                      <MessageCircle className="h-4 w-4" /> {stats[0]}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <Repeat2 className="h-4 w-4" /> {stats[1]}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <Heart className="h-4 w-4" /> {stats[2]}
                    </span>
                    <span className="flex items-center text-xs">
                      <Share className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>

        <aside className="hidden p-4 md:block">
          <div className="rounded-2xl border border-zinc-800 p-3">
            <h2 className="px-2 pb-1 font-bold text-white">{c.trendsTitle}</h2>
            {c.trends.map((t) => (
              <button
                key={t.name}
                onClick={() => navigate(`x.com/search?q=${encodeURIComponent(t.name)}`)}
                className="block w-full rounded-xl px-2 py-2.5 text-start hover:bg-zinc-900"
              >
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <TrendingUp className="h-3.5 w-3.5" /> {t.cat}
                </span>
                <span className="mt-0.5 block text-sm font-bold text-white">{t.name}</span>
                <span className="block text-xs text-zinc-500">{t.count}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}

/* ============================== instagram ============================== */

function InstagramPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const dict = getDict(lang).browser;
  const c = ar
    ? { stories: ["أنت", "سارة", "عمر", "ليلى", "يوسف", "مريم", "نور"], hint: "الشبكة مُحاكاة — كل مربع انتقال داخل عزم" }
    : { stories: ["You", "Sara", "Omar", "Layla", "Yousef", "Maryam", "Nour"], hint: "Simulated feed — every tile is a navigation inside Azm" };

  return (
    <Page lang={lang}>
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5">
        <button onClick={() => navigate("instagram.com")} className="flex items-center gap-1.5">
          <Instagram className="h-6 w-6 text-zinc-900" />
          <span className="text-lg font-semibold italic text-zinc-900" dir="ltr">
            Instagram
          </span>
        </button>
        <span className="ms-auto flex items-center gap-4 text-zinc-700">
          <Heart className="h-6 w-6" />
          <Send className="h-6 w-6" />
        </span>
      </header>

      <div className="flex gap-4 overflow-x-auto border-b border-zinc-200 px-4 py-3">
        {c.stories.map((s) => (
          <span key={s} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-rose-700 p-[2.5px]">
              <Avatar name={s} className="h-14 w-14 text-sm ring-2 ring-white" />
            </span>
            <span className="w-full truncate text-center text-[10px] text-zinc-600">{s}</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            onClick={() => navigate(`instagram.com/p/${i + 1}`)}
            className="group relative aspect-square overflow-hidden"
            style={gradStyle(palette(i + 2))}
          >
            <Instagram className="absolute inset-0 m-auto h-7 w-7 text-white opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <p className="p-4 text-center text-xs text-zinc-400">{dict.simulated}</p>
    </Page>
  );
}

/* ============================== tiktok ============================== */

function TikTokPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const c = ar
    ? {
        vids: [
          {
            u: "@dance.zone",
            cap: "التحدي الجديد وصل — جرّب الحركة مع أصحابك وشاركها قبل أن تبرد",
            s: "صوت أصلي — dance.zone",
            stats: ["45.2K", "1.2K", "890"],
          },
          {
            u: "@studytok",
            cap: "POV: قلت للمذاكرة خمس دقائق... وصارت ساعة تمرير قبل الاختبار بقليل",
            s: "صوت أصلي — studytok",
            stats: ["128K", "3.4K", "2.1K"],
          },
          {
            u: "@comedy.house",
            cap: "اسكتش: عندما تسأل أمك «وين رايح؟» وأنت تحمل حقيبة المذاكرة",
            s: "صوت أصلي — comedy.house",
            stats: ["892K", "12K", "9.8K"],
          },
          {
            u: "@foodie.bite",
            cap: "معكرونة بثلاثة مكونات في 10 دقائق — وصفة نهاية الفصل الدراسي",
            s: "صوت أصلي — foodie.bite",
            stats: ["67.3K", "2.2K", "1.5K"],
          },
          {
            u: "@cat.log",
            cap: "القطة حكمت عليك اليوم: استمر بالمذاكرة ولا تفكر في الهاتف",
            s: "صوت أصلي — cat.log",
            stats: ["210K", "5.7K", "3.3K"],
          },
        ],
      }
    : {
        vids: [
          {
            u: "@dance.zone",
            cap: "The new challenge is here — try the move with your friends before it cools down",
            s: "original sound — dance.zone",
            stats: ["45.2K", "1.2K", "890"],
          },
          {
            u: "@studytok",
            cap: "POV: you said 5 minutes of studying… then an hour of scrolling right before the exam",
            s: "original sound — studytok",
            stats: ["128K", "3.4K", "2.1K"],
          },
          {
            u: "@comedy.house",
            cap: "Skit: when mom asks “where are you going?” and you're holding your study bag",
            s: "original sound — comedy.house",
            stats: ["892K", "12K", "9.8K"],
          },
          {
            u: "@foodie.bite",
            cap: "3-ingredient pasta in 10 minutes — the end-of-semester recipe",
            s: "original sound — foodie.bite",
            stats: ["67.3K", "2.2K", "1.5K"],
          },
          {
            u: "@cat.log",
            cap: "The cat has ruled on you today: keep studying and don't think about your phone",
            s: "original sound — cat.log",
            stats: ["210K", "5.7K", "3.3K"],
          },
        ],
      };

  return (
    <Page lang={lang} className="bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate("tiktok.com")} className="flex items-center gap-2">
          <Music2 className="h-6 w-6 text-rose-500" />
          <span className="text-lg font-bold text-white" dir="ltr">
            TikTok
          </span>
        </button>
        <span className="ms-auto text-zinc-400">
          <Search className="h-5 w-5" />
        </span>
      </header>

      <div className="mx-auto max-w-md space-y-4 p-4">
        {c.vids.map((v, i) => (
          <div key={v.u} className="relative w-full overflow-hidden rounded-xl" style={gradStyle(palette(i * 2 + 1))}>
            <div className="aspect-[9/13] max-h-[420px] w-full" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/35 p-4">
                <Play className="h-7 w-7 fill-white text-white" />
              </span>
            </span>
            <div className="absolute bottom-24 end-2 flex flex-col items-center gap-3 text-white">
              <span className="flex flex-col items-center gap-0.5 text-[11px]">
                <Heart className="h-6 w-6 fill-rose-500 text-rose-500" />
                <span dir="ltr">{v.stats[0]}</span>
              </span>
              <span className="flex flex-col items-center gap-0.5 text-[11px]">
                <MessageCircle className="h-6 w-6" />
                <span dir="ltr">{v.stats[1]}</span>
              </span>
              <span className="flex flex-col items-center gap-0.5 text-[11px]">
                <Share2 className="h-6 w-6" />
                <span dir="ltr">{v.stats[2]}</span>
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-sm font-bold text-white" dir="ltr">
                {v.u}
              </p>
              <p className="mt-0.5 text-sm leading-snug text-zinc-100">{v.cap}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-200">
                <Music2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate" dir="ltr">
                  {v.s}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ============================== reddit ============================== */

function RedditPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const c = ar
    ? {
        search: "ابحث في ريديت",
        posts: [
          {
            sub: "r/soccer",
            user: "u/footyfan_99",
            time: "قبل ساعة",
            title: "خيط المباراة: الهلال × الأهلي — النهائي",
            body: "نتيجة ممتازة والأجواء في الملعب من فئة أخرى. شاركنا تقييمك لأداء الفريقين في الشوطين.",
            score: "4.2K",
            comments: "891",
          },
          {
            sub: "r/GetStudying",
            user: "u/deep_focus",
            time: "قبل 3 ساعات",
            title: "كيف تركّز أربع ساعات متواصلة؟ كل طريقة أجربها تنهار بعد 20 دقيقة",
            body: "جرّبت بومودورو ومنع الإشعارات وترتيب المكتب... أحتاج أسلوبًا يثبت فعلاً لا نصائح عامة.",
            score: "1.8K",
            comments: "214",
          },
          {
            sub: "r/movies",
            user: "u/nightcinema",
            time: "قبل 5 ساعات",
            title: "نقاش رسمي: «الطريق الأخير» — الحوار مفتوح (تنبيه حرق)",
            body: "النصف الثاني أقوى مما توقعت، والموسيقى التصويرية حملت المشهد الأخير وحده.",
            score: "976",
            comments: "132",
          },
          {
            sub: "r/food",
            user: "u/kitchen_on_budget",
            time: "قبل 8 ساعات",
            title: "معكرونة بثلاثة مكونات اكتشفتها بين الجولات الدراسية",
            body: "مكرونة + جبنة + فلفل أسود، جاهزة قبل أن ينتهي مؤقت التركيز. وصفة الطالب الفقير المعتمدة.",
            score: "3.1K",
            comments: "458",
          },
          {
            sub: "r/examweek",
            user: "u/meme_dean",
            time: "قبل 12 ساعة",
            title: "أنا أمام ورقة الاختبار مقابل أنا أمام الكتاب",
            body: "ذاكرت كل شيء، وجاء الاختبار عن الفصل الذي خططت لأقرأه «لاحقًا».",
            score: "12.7K",
            comments: "930",
          },
        ],
      }
    : {
        search: "Search Reddit",
        posts: [
          {
            sub: "r/soccer",
            user: "u/footyfan_99",
            time: "1h ago",
            title: "[Match Thread] Al Hilal vs Al Ahly — The Final",
            body: "Great result and an electric atmosphere in the stadium. Rate both teams' performance across the two halves.",
            score: "4.2K",
            comments: "891",
          },
          {
            sub: "r/GetStudying",
            user: "u/deep_focus",
            time: "3h ago",
            title: "How do you focus 4 hours straight? Every method I try collapses after 20 minutes",
            body: "Tried Pomodoro, killed notifications, cleaned my desk... I need something that actually sticks, not generic advice.",
            score: "1.8K",
            comments: "214",
          },
          {
            sub: "r/movies",
            user: "u/nightcinema",
            time: "5h ago",
            title: "[Official Discussion] The Last Road — spoilers allowed",
            body: "The second half hit harder than expected, and the score carried the final scene on its own.",
            score: "976",
            comments: "132",
          },
          {
            sub: "r/food",
            user: "u/kitchen_on_budget",
            time: "8h ago",
            title: "[Homemade] The 3-ingredient pasta I discovered between study sessions",
            body: "Pasta + cheese + black pepper, ready before the focus timer rings. The officially approved broke-student recipe.",
            score: "3.1K",
            comments: "458",
          },
          {
            sub: "r/examweek",
            user: "u/meme_dean",
            time: "12h ago",
            title: "Me opening the exam paper vs me opening the textbook",
            body: "Studied everything, and the exam asked about the exact chapter I planned to read \"later\".",
            score: "12.7K",
            comments: "930",
          },
        ],
      };

  return (
    <Page lang={lang} className="bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5">
        <button onClick={() => navigate("reddit.com")} className="flex items-center gap-1.5">
          <MessageSquare className="h-7 w-7 text-rose-500" />
          <span className="text-xl font-bold lowercase tracking-tight text-zinc-900" dir="ltr">
            reddit
          </span>
        </button>
        <span className="ms-auto hidden items-center gap-2 rounded-full bg-zinc-100 px-4 py-1.5 text-sm text-zinc-400 sm:flex sm:w-64">
          <Search className="h-4 w-4" />
          {c.search}
        </span>
        <Avatar name="U" className="h-8 w-8 text-xs" />
      </header>

      <div className="mx-auto max-w-2xl space-y-3 p-4">
        {c.posts.map((p, i) => (
          <article key={i} className="flex rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex w-8 shrink-0 flex-col items-center gap-0.5 pt-1 text-zinc-400">
              <ArrowUp className="h-5 w-5 hover:text-rose-500" />
              <span className="azm-nums text-xs font-semibold text-zinc-800" dir="ltr">
                {p.score}
              </span>
              <ArrowDown className="h-5 w-5 hover:text-zinc-800" />
            </div>
            <div className="min-w-0 flex-1 ps-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => navigate(`reddit.com/${p.sub}`)}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 hover:bg-zinc-200"
                  dir="ltr"
                >
                  {p.sub}
                </button>
                <span className="text-zinc-500" dir="ltr">
                  {p.user}
                </span>
                <span className="text-zinc-400">· {p.time}</span>
              </div>
              <button onClick={() => navigate(`reddit.com/${p.sub}/comments/${i + 1}`)} className="mt-1 block text-start">
                <h2 className="text-[15px] font-medium leading-snug text-zinc-900 hover:underline">{p.title}</h2>
              </button>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{p.body}</p>
              <div className="mt-2 flex items-center gap-5 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  <span dir="ltr">{p.comments}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Share2 className="h-4 w-4" />
                  {ar ? "مشاركة" : "Share"}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

/* ============================== netflix ============================== */

function NetflixPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const c = ar
    ? {
        nav: ["الرئيسية", "مسلسلات", "أفلام"],
        badge: "مسلسل الأسبوع",
        heroTitle: "الطريق الأخير",
        heroDesc: "في مدينة لا تنام، يضطر سائق ليلي إلى اختيار طريق واحد قبل الفجر — والعودة غير مضمونة.",
        play: "تشغيل",
        rows: [
          {
            t: "الأكثر رواجًا الآن",
            items: ["سر الليلة", "المدينة الغائبة", "محطمة القلوب", "الجسر الأخير", "ظلال الصمت", "ما بعد العاصفة"],
          },
          {
            t: "لأنك شاهدت وثائقيات تاريخية",
            items: ["الأندلس: حضارة وأسطورة", "لعبة المخبأ", "الصفقة", "خط النار", "المطاردة", "الغرفة 9"],
          },
        ],
      }
    : {
        nav: ["Home", "Series", "Movies"],
        badge: "Series of the week",
        heroTitle: "The Last Road",
        heroDesc: "In a city that never sleeps, a night driver must choose one road before dawn — and there's no guarantee of coming back.",
        play: "Play",
        rows: [
          {
            t: "Trending now",
            items: ["Midnight Secret", "The Lost City", "Heartbreaker", "The Last Bridge", "Silent Shadows", "After the Storm"],
          },
          {
            t: "Because you watched history documentaries",
            items: ["Al-Andalus: Civilization and Legend", "Hide and Seek", "The Deal", "Line of Fire", "The Chase", "Room 9"],
          },
        ],
      };
  const nfPalette: [string, string][] = [
    ["#450A0A", "#B91C1C"],
    ["#1C1917", "#7F1D1D"],
    ["#7F1D1D", "#F43F5E"],
    ["#171717", "#991B1B"],
    ["#450A0A", "#EF4444"],
    ["#18181B", "#DC2626"],
  ];

  return (
    <Page lang={lang} className="bg-black text-zinc-100">
      <header className="sticky top-0 z-10 flex items-center gap-5 bg-black/90 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate("netflix.com")}>
          <span className="text-lg font-black tracking-widest text-red-600" dir="ltr">
            NETFLIX
          </span>
        </button>
        <nav className="hidden gap-4 text-sm text-zinc-300 md:flex">
          {c.nav.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </nav>
        <span className="ms-auto flex items-center gap-4 text-zinc-300">
          <Search className="h-5 w-5" />
          <Bell className="h-5 w-5" />
          <Avatar name="N" className="h-7 w-7 text-[11px]" />
        </span>
      </header>

      <section
        className="rounded-b-lg p-6 text-white md:p-8"
        style={{ backgroundImage: "linear-gradient(160deg, #7f1d1d 0%, #b91c1c 45%, #000000 100%)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-red-200">{c.badge}</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">{c.heroTitle}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-100/90">{c.heroDesc}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="flex items-center gap-2 rounded bg-white px-4 py-1.5 text-sm font-semibold text-black">
            <Play className="h-4 w-4 fill-black" />
            {c.play}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-black/30">
            <Plus className="h-4 w-4" />
          </span>
        </div>
      </section>

      <div className="space-y-6 p-4 md:p-6">
        {c.rows.map((row, ri) => (
          <section key={row.t}>
            <h2 className="mb-2 text-base font-semibold text-white">{row.t}</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {row.items.map((t, ti) => {
                const n = ri * 10 + ti + 1;
                return (
                  <button
                    key={t}
                    onClick={() => navigate(`netflix.com/watch/t${n}`)}
                    className="relative w-40 shrink-0 overflow-hidden rounded md:w-48"
                    style={gradStyle(nfPalette[(ti + ri) % nfPalette.length])}
                  >
                    <span className="block aspect-video w-full" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-start text-xs font-medium text-white">
                      {t}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}

/* ============================== yallakora ============================== */

function YallaKoraPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const c = ar
    ? {
        nav: ["المباريات", "الأخبار", "ترتيب الدوريات"],
        matchesTitle: "مباريات اليوم",
        standingsTitle: "ترتيب الدوري",
        newsTitle: "أهم الأخبار",
        tableHead: ["#", "الفريق", "لعب", "نقاط"],
        table: [
          ["الأهلي", "12", "30"],
          ["الترجي", "12", "28"],
          ["الهلال", "12", "26"],
        ],
        matches: [
          {
            league: "دوري أبطال العرب",
            a: "الأهلي",
            b: "الترجي",
            score: "2 - 1",
            live: true,
            status: "مباشر",
            meta: "الشوط الثاني · الدقيقة 67",
          },
          {
            league: "دوري روشن السعودي",
            a: "الهلال",
            b: "النصر",
            score: "0 - 0",
            live: true,
            status: "مباشر",
            meta: "الشوط الأول · الدقيقة 34",
          },
          {
            league: "الدوري الإسباني",
            a: "برشلونة",
            b: "ريال مدريد",
            score: "3 - 2",
            live: false,
            status: "انتهت",
            meta: "أمس · 22:00",
          },
          {
            league: "الدوري الإنجليزي",
            a: "ليفربول",
            b: "مانشستر سيتي",
            score: "1 - 1",
            live: false,
            status: "انتهت",
            meta: "السبت الماضي · 18:30",
          },
        ],
        news: [
          { tag: "انتقالات", t: "رسمي: نجم الدوري يوقّع لمصلحة نادٍ أوروبي في صفقة قياسية", time: "قبل ساعة" },
          { tag: "تحليل", t: "تقرير: كيف انقلبت مباراة القمة في ثلاث دقائق فقط", time: "قبل 3 ساعات" },
          { tag: "قمة", t: "موعد مباراة الأحد وأهم التوقعات والتشكيلات المتوقعة", time: "أمس" },
        ],
      }
    : {
        nav: ["Matches", "News", "Standings"],
        matchesTitle: "Today's matches",
        standingsTitle: "League standings",
        newsTitle: "Top news",
        tableHead: ["#", "Team", "Pld", "Pts"],
        table: [
          ["Al Ahly", "12", "30"],
          ["Esperance", "12", "28"],
          ["Al Hilal", "12", "26"],
        ],
        matches: [
          {
            league: "Arab Champions League",
            a: "Al Ahly",
            b: "Esperance",
            score: "2 - 1",
            live: true,
            status: "LIVE",
            meta: "Second half · 67'",
          },
          {
            league: "Saudi Pro League",
            a: "Al Hilal",
            b: "Al Nassr",
            score: "0 - 0",
            live: true,
            status: "LIVE",
            meta: "First half · 34'",
          },
          {
            league: "La Liga",
            a: "Barcelona",
            b: "Real Madrid",
            score: "3 - 2",
            live: false,
            status: "ENDED",
            meta: "Yesterday · 22:00",
          },
          {
            league: "Premier League",
            a: "Liverpool",
            b: "Manchester City",
            score: "1 - 1",
            live: false,
            status: "ENDED",
            meta: "Last Saturday · 18:30",
          },
        ],
        news: [
          { tag: "Transfers", t: "Official: league star signs for a European club in a record deal", time: "1 hour ago" },
          { tag: "Analysis", t: "Report: how the derby turned around in just three minutes", time: "3 hours ago" },
          { tag: "Derby", t: "Sunday clash date plus expected line-ups and predictions", time: "Yesterday" },
        ],
      };

  return (
    <Page lang={lang}>
      <header className="flex items-center gap-2 bg-zinc-900 px-4 py-3 text-white">
        <button onClick={() => navigate("yallakora.com")} className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-400" />
          <span className="text-lg font-bold">يلا كورة</span>
          <span className="text-sm text-zinc-400" dir="ltr">
            YallaKora
          </span>
        </button>
        <nav className="ms-auto hidden gap-5 text-sm text-zinc-300 md:flex">
          {c.nav.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-zinc-900">
            <Calendar className="h-4 w-4 text-zinc-500" />
            {c.matchesTitle}
          </h2>
          <div className="space-y-3">
            {c.matches.map((m, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{m.league}</span>
                  <span
                    className={
                      m.live
                        ? "rounded-full bg-red-600 px-2 py-0.5 font-semibold text-white animate-pulse"
                        : "rounded-full bg-zinc-200 px-2 py-0.5 font-medium text-zinc-700"
                    }
                  >
                    {m.status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <span className="truncate text-sm font-semibold text-zinc-900">{m.a}</span>
                  <span className="azm-nums text-lg font-bold text-zinc-900" dir="ltr">
                    {m.score}
                  </span>
                  <span className="truncate text-end text-sm font-semibold text-zinc-900">{m.b}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span dir="ltr">{m.meta}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-zinc-900">{c.standingsTitle}</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-xs text-zinc-500">
                  {c.tableHead.map((h) => (
                    <th key={h} className="px-3 py-2 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.table.map((row, ri) => (
                  <tr key={row[0]} className="border-t border-zinc-100">
                    <td className="azm-nums px-3 py-2 text-zinc-500" dir="ltr">
                      {ri + 1}
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-900">{row[0]}</td>
                    <td className="azm-nums px-3 py-2 text-zinc-600" dir="ltr">
                      {row[1]}
                    </td>
                    <td className="azm-nums px-3 py-2 font-bold text-zinc-900" dir="ltr">
                      {row[2]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-zinc-900">{c.newsTitle}</h2>
          <div className="space-y-2">
            {c.news.map((n, i) => (
              <button
                key={i}
                onClick={() => navigate(`yallakora.com/news/${i + 1}`)}
                className="block w-full rounded-xl border border-zinc-200 bg-white p-3 text-start hover:border-zinc-300"
              >
                <span className="text-[11px] font-bold text-rose-600">{n.tag}</span>
                <p className="mt-1 text-sm font-medium leading-snug text-zinc-900">{n.t}</p>
                <p className="mt-1 text-xs text-zinc-500">{n.time}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}

/* ============================== bbc ============================== */

function BbcPage({ lang, navigate }: SitePageProps) {
  const ar = lang === "ar";
  const c = ar
    ? {
        badge: "عربي",
        nav: ["رئيسية", "أخبار", "رياضة", "ثقافة"],
        title: "الأخبار الرئيسية",
        date: "الثلاثاء، 14 مايو — تحديث مستمر طوال اليوم",
        heads: [
          {
            cat: "تعليم",
            t: "إعلان موعد ظهور نتائج الامتحانات النهائية لهذا العام",
            s: "أكدت وزارة التعليم أن النتائج ستنشر أواخر الشهر المقبل، مع إتاحتها إلكترونيًا لجميع الطلاب عبر البوابة الرسمية.",
            time: "قبل ساعتين",
          },
          {
            cat: "طقس",
            t: "تحذير من موجة حر تتجاوز 45 درجة مئوية مطلع الأسبوع القادم",
            s: "دعت الأرصاد إلى تجنب التعرض المباشر للشمس وقت الظهيرة وترشيد استهلاك الكهرباء خلال ساعات الذروة.",
            time: "قبل 4 ساعات",
          },
          {
            cat: "رياضة",
            t: "انتقال نجم الدوري إلى نادٍ أوروبي في صفقة قياسية",
            s: "المصادر تقول إن الصفقة تتجاوز 60 مليون يورو، والاعب سيخضع للفحص الطبي خلال أيام.",
            time: "قبل 6 ساعات",
          },
          {
            cat: "تقنية",
            t: "نموذج ذكاء اصطناعي جديد يعدّ بتلخيص المحاضرات بدقة أعلى",
            s: "يقول المطورون إن النموذج يفهم السياق الأكاديمي ويولّد ملخصات مرتبطة بمصادر المحاضرة نفسها.",
            time: "قبل 8 ساعات",
          },
          {
            cat: "ثقافة",
            t: "مهرجان السينما يفتح أبوابه بأكثر من 60 فيلمًا من 20 دولة",
            s: "يشمل البرنامج مسابقة للأفلام القصيرة التي من إخراج طلاب، وجلسات حوار مع مخرجين عرب.",
            time: "أمس",
          },
        ],
      }
    : {
        badge: "Arabic",
        nav: ["Home", "News", "Sport", "Culture"],
        title: "Top stories",
        date: "Tuesday, 14 May — updates all day",
        heads: [
          {
            cat: "Education",
            t: "Results date for this year's final exams announced",
            s: "The ministry confirmed results will be published late next month, available online for all students through the official portal.",
            time: "2 hours ago",
          },
          {
            cat: "Weather",
            t: "Heatwave warning as temperatures pass 45°C early next week",
            s: "Forecasters urged people to avoid direct midday sun and to ration electricity during peak hours.",
            time: "4 hours ago",
          },
          {
            cat: "Sport",
            t: "League star joins European club in a record deal",
            s: "Sources say the transfer exceeds €60m; the player will undergo a medical within days.",
            time: "6 hours ago",
          },
          {
            cat: "Technology",
            t: "New AI model promises more accurate lecture summaries",
            s: "Developers say the model understands academic context and generates summaries tied to the lecture's own sources.",
            time: "8 hours ago",
          },
          {
            cat: "Culture",
            t: "Film festival opens with more than 60 films from 20 countries",
            s: "The program includes a student-directed shorts competition and conversations with Arab filmmakers.",
            time: "Yesterday",
          },
        ],
      };

  return (
    <Page lang={lang}>
      <header className="flex items-center gap-3 bg-black px-4 py-3 text-white">
        <button onClick={() => navigate("bbc.com")} className="flex items-center gap-2">
          <span className="border-b-2 border-red-600 pb-0.5 text-lg font-bold" dir="ltr">
            BBC
          </span>
          <span className="rounded-sm bg-red-600 px-1.5 py-0.5 text-xs font-bold">{c.badge}</span>
        </button>
        <nav className="ms-auto hidden gap-5 text-sm text-zinc-300 md:flex">
          {c.nav.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-2xl p-4">
        <h1 className="text-lg font-bold text-zinc-900">{c.title}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{c.date}</p>
        <div className="mt-3 space-y-3">
          {c.heads.map((h, i) => (
            <button
              key={i}
              onClick={() => navigate(`bbc.com/news/${i + 1}`)}
              className="block w-full rounded-xl border border-zinc-200 bg-white p-4 text-start shadow-sm hover:shadow"
            >
              <span className="inline-block rounded bg-rose-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                {h.cat}
              </span>
              <h2 className="mt-2 text-[15px] font-semibold leading-snug text-zinc-900 hover:underline">{h.t}</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">{h.s}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                <Clock className="h-3.5 w-3.5" />
                {h.time}
              </p>
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
}

/* ============================== unknown ============================== */

function UnknownPage({ lang, dest }: SitePageProps) {
  const dict = getDict(lang).browser;
  return (
    <Page lang={lang}>
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <Globe className="mx-auto h-10 w-10 text-zinc-400" />
        <h1 className="mt-4 text-lg font-bold text-zinc-900">{dict.unknownTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{dict.unknownBody}</p>
        <p className="mt-4 break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-500" dir="ltr">
          {dest.url}
        </p>
      </div>
    </Page>
  );
}

/* ============================== registry ============================== */

export const SITE_REGISTRY: Record<string, ComponentType<SitePageProps>> = {
  youtube: YouTubeHome,
  youtube_watch: YouTubeWatchPage,
  youtube_channel: YouTubeChannelPage,
  youtube_playlist: YouTubePlaylistPage,
  google: GoogleHome,
  google_results: GoogleResultsPage,
  chatgpt: AzmAssistantPage,
  claude: AzmAssistantReviewPage,
  coursera: CourseraPage,
  khanacademy: KhanAcademyPage,
  wikipedia: WikipediaPage,
  x: XPage,
  instagram: InstagramPage,
  tiktok: TikTokPage,
  reddit: RedditPage,
  netflix: NetflixPage,
  yallakora: YallaKoraPage,
  bbc: BbcPage,
  unknown: UnknownPage,
};
