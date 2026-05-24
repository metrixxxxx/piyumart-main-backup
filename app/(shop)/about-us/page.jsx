"use client";
import { useEffect, useState } from "react";


const TEAM_VALUES = [
  {
    icon: "🛡️",
    title: "Safe & Trusted",
    description:
      "Every transaction is between verified LSPU students only. No outsiders, no scammers — just fellow Iskos and Iskas you can trust.",
  },
  {
    icon: "🤝",
    title: "Student-First",
    description:
      "Built by students, for students. We understand the campus struggle — tight budgets, second-hand needs, and the hustle of student life.",
  },
  {
    icon: "🌱",
    title: "Community Driven",
    description:
      "We believe in the power of a united campus. Every peso spent here stays within the LSPU community and supports fellow students.",
  },
  {
    icon: "💡",
    title: "Innovation",
    description:
      "We are aspiring developers who refuse to settle. We constantly improve the platform to make buying and selling easier for everyone.",
  },
];

export default function AboutPage() {
  const [userCount, setUserCount] = useState(null);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/users/count");
        const data = await res.json();
        setUserCount(data.total);
      } catch (err) {
        console.error("Failed to fetch user count:", err);
      }
    }
    fetchCount();
  }, []);

  const STATS = [
    { value: userCount ? `${userCount}+` : "...", label: "Student Users" },
    { value: "8", label: "Categories" },
    { value: "1", label: "Campus" },
    { value: "∞", label: "Possibilities" },
  ];

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#070b14] transition-colors duration-300">

      {/* ── HERO ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-1 pb-6">
        <div
          className="relative rounded-2xl overflow-hidden flex items-center justify-center text-center"
          style={{
            background: "linear-gradient(135deg, #1a2a6c 0%, #16235a 50%, #c9a028 100%)",
            minHeight: "320px",
            padding: "80px 48px",
          }}
        >
          {/* decorative circles — more visible */}
          <div className="absolute top-8 left-10 w-36 h-36 rounded-full bg-white/10" />
          <div className="absolute bottom-6 right-10 w-44 h-44 rounded-full bg-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-[#c9a028]/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 bg-white/15 text-white text-[11px] font-semibold px-4 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4aa40] animate-pulse" />
              LSPU SPCC Campus · Est. 2024
            </span>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight mb-5">
              Built by Students,{" "}
              <span style={{ color: "#d4aa40" }}>for Students.</span>
            </h1>

            <p className="text-white/70 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              We are aspiring web developers from LSPU SPCC who dared to build something meaningful
              — a safe, student-powered marketplace right on campus.
            </p>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
<section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {STATS.map((s) => (
      <div
        key={s.label}
        className="rounded-2xl text-center py-6 px-3 bg-white dark:bg-[#0e1520] border border-[#e5e9f2] dark:border-[#1e2a3a]"
      >
        <p className="text-2xl sm:text-3xl font-extrabold text-[#1a2a6c] dark:text-[#d4aa40]">
          {s.value}
        </p>
        <p className="text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/50 mt-1 font-medium">
          {s.label}
        </p>
      </div>
    ))}
  </div>
</section>

      {/* ── OUR STORY ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div
          className="rounded-2xl p-6 sm:p-10 bg-white dark:bg-[#0e1520]"
          style={{ border: "1px solid #e5e9f2" }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-bold text-[#1a2a6c] dark:text-[#d4aa40] uppercase tracking-widest mb-3 block">
                Our Story
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0e1a3d] dark:text-[#e8edf8] leading-tight mb-4">
                From a classroom idea to a campus reality.
              </h2>
              <div className="space-y-3 text-sm text-[#0e1a3d]/60 dark:text-[#e8edf8]/55 leading-relaxed">
                <p>
                  We are a group of aspiring web developers studying at Laguna State Polytechnic
                  University — San Pablo City Campus. Like every student, we faced the same
                  daily challenges: where to sell old textbooks, how to find affordable gadgets,
                  and who to trust when buying from strangers online.
                </p>
                <p>
                  That frustration became our motivation. We decided to build something that
                  solves a real problem for real students — a dedicated marketplace where only
                  LSPU students can buy and sell, making every transaction safer and more
                  convenient.
                </p>
                <p>
                  LSPU Marketplace is more than just a project. It is our commitment to the
                  campus community — proof that student developers can build tools that matter.
                </p>
              </div>
            </div>

            {/* Visual accent */}
            <div
              className="relative rounded-xl overflow-hidden flex items-center justify-center min-h-[200px] sm:min-h-[260px]"
              style={{
                background: "linear-gradient(135deg, #1a2a6c 0%, #16235a 60%, #c9a028 100%)",
              }}
            >
              <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/10" />
              <div className="absolute bottom-6 left-4 w-10 h-10 rounded-full bg-white/10" />
              <div className="text-center relative z-10 px-6">
                <p className="text-5xl mb-3">🎓</p>
                <p className="text-white font-bold text-lg leading-tight">LSPU SPCC</p>
                <p className="text-[#d4aa40] text-xs font-semibold mt-1">San Pablo City Campus</p>
                <p className="text-white/50 text-[11px] mt-2">Laguna State Polytechnic University</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <span className="text-xs font-bold text-[#1a2a6c] dark:text-[#d4aa40] uppercase tracking-widest">
            What We Stand For
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0e1a3d] dark:text-[#e8edf8] mt-1">
            Our Core Values
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEAM_VALUES.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-[#0e1520] hover:-translate-y-1 transition-transform duration-200"
              style={{ border: "1px solid #e5e9f2" }}
            >
              <div className="text-3xl mb-3">{v.icon}</div>
              <h3 className="font-bold text-[#0e1a3d] dark:text-[#e8edf8] text-sm mb-1">
                {v.title}
              </h3>
              <p className="text-xs text-[#0e1a3d]/55 dark:text-[#e8edf8]/50 leading-relaxed">
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-12">
        <div
          className="rounded-2xl p-6 sm:p-10 text-center"
          style={{
            background: "linear-gradient(135deg, #1a2a6c 0%, #16235a 60%, #0e1a3d 100%)",
          }}
        >
          <span className="text-[#d4aa40] text-xs font-bold uppercase tracking-widest mb-3 block">
            Our Mission
          </span>
          <p className="text-white text-lg sm:text-2xl font-bold leading-snug max-w-2xl mx-auto">
            &#34;To create a safe, trusted, and student-exclusive marketplace that empowers every
            LSPU student to buy, sell, and thrive together.&#34;
          </p>
          <p className="text-white/50 text-xs mt-4">
            — The LSPU Marketplace Dev Team, SPCC Campus
          </p>
        </div>
      </section>
      

      
    </main>
  );
}
