"use client"
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";

const pages = [
  { path: "/pricing", visits: "2.5K", width: "100%", model: "openai" },
  { path: "/blog/ai-search-guide", visits: "2K", width: "82%", model: "anthropic" },
  { path: "/features/analytics", visits: "1.7K", width: "68%", model: "snowflake" },
  { path: "/docs/getting-started", visits: "1.5K", width: "58%", model: "openai" },
  { path: "/integrations/vercel", visits: "1.3K", width: "45%", model: "gemini" },
  { path: "/about", visits: "940", width: "30%", model: "anthropic" },
];

export default function PromptwatchCard() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7d8cc] p-8">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#d7ecff_0%,#f8d7ca_55%,#f3c9bd_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(#1f2937_0.7px,transparent_0.7px)] [background-size:4px_4px]" />

      {/* Floating card */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-2xl backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <ArrowUpRight size={18} />
          </div>

          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900">
              promptwatch.com
            </div>
            <div className="text-xs text-slate-400">
              12,402 visits this week
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live
          </div>
        </div>

        {/* Rows */}
        <div>
          {pages.map((page, index) => (
            <motion.div
              key={page.path}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + index * 0.07, duration: 0.25 }}
              whileHover={{ backgroundColor: "rgba(248,250,252,0.9)" }}
              className="group flex items-center gap-3 border-b border-slate-100 px-4 py-2.5"
            >
              <div className="relative h-6 flex-1 overflow-hidden rounded-md">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: page.width }}
                  transition={{
                    delay: 0.25 + index * 0.08,
                    duration: 0.55,
                    ease: "easeOut",
                  }}
                  className="absolute inset-y-0 left-0 rounded-md bg-blue-200"
                />

                <span className="relative z-10 flex h-full items-center px-2 font-mono text-xs text-slate-700">
                  {page.path}
                </span>
              </div>

              <div className="w-10 text-right text-xs text-slate-500">
                {page.visits}
              </div>

              <ModelIcon model={page.model} />
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs text-slate-400">
            6 agents active · 4 models
          </div>

          <div className="flex -space-x-1">
            <MiniIcon label="◎" />
            <MiniIcon label="✹" />
            <MiniIcon label="❄" />
            <MiniIcon label="✦" />
          </div>
        </div>

        {/* Glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-blue-400/20 blur-2xl" />
      </motion.div>
    </div>
  );
}

function ModelIcon({ model }: { model: string }) {
  const icons = {
    openai: "◎",
    anthropic: "✹",
    snowflake: "❄",
    gemini: "✦",
  };

  return (
    <motion.div
      whileHover={{ rotate: 15, scale: 1.15 }}
      className="flex h-5 w-5 items-center justify-center text-xs text-slate-500"
    >
      {icons[model as keyof typeof icons]}
    </motion.div>
  );
}

function MiniIcon({ label }: { label: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs shadow-sm"
    >
      {label}
    </motion.div>
  );
}