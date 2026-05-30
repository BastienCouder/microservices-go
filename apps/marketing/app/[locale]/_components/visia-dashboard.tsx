import React from "react";
import {
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  ExternalLink,
  Globe2,
  LogOut,
  PieChart,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export type VisiaNavItem = {
  id: string;
  label: string;
  active?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
};

export type VisiaNavSection = {
  title: string;
  items: VisiaNavItem[];
};

export type MetricCard = {
  id: string;
  label: string;
  value: string;
  helper?: string;
  delta?: string;
  active?: boolean;
};

export type PromptItem = {
  id: string;
  provider: string;
  model: string;
  age: string;
  question: string;
  mentioned?: boolean;
  rank?: string;
  score?: number;
};

export type VisiaDashboardShellProps = {
  appName?: string;
  brandName?: string;
  brandDescription?: string;
  navSections?: VisiaNavSection[];
  metrics?: MetricCard[];
  prompts?: PromptItem[];
  leftPanel?: React.ReactNode;
  mainContent?: React.ReactNode;
  rightPanel?: React.ReactNode;
  className?: string;
};

const defaultNavSections: VisiaNavSection[] = [
  {
    title: "Monitoring",
    items: [
      { id: "overview", label: "Vue d’ensemble", active: true },
      { id: "prompts", label: "Prompts suivis" },
      { id: "answers", label: "Réponses IA" },
      { id: "pages", label: "Pages citées" },
      { id: "perception", label: "Perception" },
    ],
  },
  {
    title: "Optimisation",
    items: [
      { id: "content", label: "Optimisation contenu" },
      { id: "audit", label: "Audit du site" },
      { id: "problems", label: "Problèmes détectés" },
      { id: "traffic", label: "Trafic" },
    ],
  },
  {
    title: "Contexte de marque",
    items: [
      { id: "profile", label: "Profil de marque" },
      { id: "configured-ai", label: "IA configurées" },
    ],
  },
  {
    title: "Paramètres",
    items: [
      { id: "org", label: "Organisations" },
      { id: "account", label: "Compte" },
    ],
  },
];

const defaultMetrics: MetricCard[] = [
  { id: "mentions", label: "Taux de mention", value: "100%", delta: "+29% vs 7j", helper: "4/4 réponses mentionnent votre marque", active: true },
  { id: "visibility", label: "Score de visibilité", value: "70 /100", delta: "+16 vs 7j", helper: "Score combiné mention × position × sentiment" },
  { id: "rank", label: "Rang moyen", value: "1", delta: "+0.0", helper: "Sur toutes les réponses où votre marque est citée" },
];

const defaultPrompts: PromptItem[] = Array.from({ length: 4 }).map((_, index) => ({
  id: `prompt-${index}`,
  provider: "DeepSeek",
  model: "deepseek v4 flash (free)",
  age: "11d",
  question: "Quelle marque est la plus recommandée pour des sneakers lifestyle iconiques en 2026 ?",
  mentioned: true,
  rank: "Rang n°1",
  score: 70,
}));

export default function VisiaDashboardShell({
  appName = "VISIA.",
  brandName = "Nike",
  brandDescription = "garde un léger avantage sur la visibilité IA sur 14 jours",
  navSections = defaultNavSections,
  metrics = defaultMetrics,
  prompts = defaultPrompts,
  leftPanel,
  mainContent,
  rightPanel,
  className = "",
}: VisiaDashboardShellProps) {
  return (
    <div className={["min-h-screen bg-slate-100 text-slate-950", className].join(" ")}>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[230px_minmax(360px,1fr)_320px]">
        <Sidebar appName={appName} brandName={brandName} navSections={navSections} />

        <main className="min-w-0 space-y-4 p-4 lg:p-5">
          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            {leftPanel ?? <BrandControlPanel brandName={brandName} description={brandDescription} />}

            <section className="min-w-0 space-y-4">
              <MetricGrid metrics={metrics} />
              {mainContent ?? <DashboardMainContent />}
            </section>
          </div>
        </main>

        <aside className="hidden border-l border-slate-200 bg-white/70 p-4 xl:block">
          {rightPanel ?? <RightMonitoringPanel prompts={prompts} />}
        </aside>
      </div>
    </div>
  );
}

function Sidebar({
  appName,
  brandName,
  navSections,
}: {
  appName: string;
  brandName: string;
  navSections: VisiaNavSection[];
}) {
  return (
    <aside className="hidden min-h-screen bg-[#2f6fca] text-white lg:flex lg:flex-col">
      <div className="px-5 py-5 text-2xl font-bold tracking-tight">{appName}</div>

      <div className="mx-3 mb-6 flex items-center gap-3 rounded-lg bg-white/15 px-3 py-3 text-sm">
        <div className="flex size-8 items-center justify-center rounded-full bg-white/30 text-xs font-semibold">N</div>
        <span className="flex-1">{brandName}</span>
        <ChevronDown className="size-4 opacity-70" />
      </div>

      <nav className="flex-1 space-y-5 px-3">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wide text-blue-100/70">{section.title}</p>
            <div className="space-y-1 border-l border-blue-200/30 pl-2">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={[
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                    item.active ? "bg-white/18 text-white" : "text-blue-50/85 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 p-3 text-xs text-blue-50/80">
        <Progress value={15} className="h-1 bg-white/20" />
        <p>15 / 100 crédits utilisés</p>
        <Button variant="ghost" className="h-8 w-full justify-start bg-white/10 text-white hover:bg-white/15 hover:text-white">
          <Globe2 className="mr-2 size-4" /> Langue FR
        </Button>
        <Button variant="ghost" className="h-8 w-full justify-start bg-white/10 text-white hover:bg-white/15 hover:text-white">
          <LogOut className="mr-2 size-4" /> Déconnexion
        </Button>
      </div>
    </aside>
  );
}

function BrandControlPanel({ brandName, description }: { brandName: string; description: string }) {
  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-sm">
        <CardContent className="relative p-6">
          <div className="absolute inset-y-0 right-20 w-px bg-white/25" />
          <Button size="icon" variant="ghost" className="absolute right-5 top-5 size-8 rounded-full bg-white/20 text-white hover:bg-white/25 hover:text-white">
            <ExternalLink className="size-4" />
          </Button>

          <h1 className="text-4xl font-semibold leading-none">{brandName}</h1>
          <p className="mt-2 max-w-[260px] text-base leading-5 text-blue-50">{description}</p>

          <div className="mt-8">
            <p className="text-2xl font-bold">0%</p>
            <p className="text-xs text-blue-100">Réponses avec citation</p>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
            <Zap className="size-3.5" /> Sous pression <span className="font-normal text-amber-600">14 jours</span>
          </div>

          <div className="mt-7 h-2 rounded-full bg-white/25">
            <div className="h-2 w-[64%] rounded-full bg-white/80" />
          </div>
          <p className="mt-3 text-xs text-blue-100">Le rythme ralentit sur la fin de période et mérite un suivi.</p>
        </CardContent>
      </Card>

      <CardBlock title="Filtres" action="Réinitialiser les filtres">
        <div className="space-y-4">
          <Field label="Période">
            <button className="flex h-10 w-full items-center justify-between rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-700 shadow-sm">
              <span>14 jours</span>
              <ChevronDown className="size-4 text-slate-400" />
            </button>
          </Field>

          <Field label="Modèles">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-xs">
              <button className="rounded-md px-2 py-2 text-slate-500">Modèles regroupés</button>
              <button className="rounded-md bg-blue-600 px-2 py-2 text-white shadow-sm">Chaque modèle</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                ["DeepSeek", "DeepSeek v4 Flash (free)"],
                ["OpenAI", "gpt-oss-120b (free)"],
                ["Qwen", "Qwen3 Next 80B A3B Instruct"],
              ].map(([name, model]) => (
                <button key={name} className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300">
                  <Bot className="mb-3 size-5 text-blue-600" />
                  <p className="text-sm font-semibold text-slate-900">{name}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{model}</p>
                </button>
              ))}
            </div>
          </Field>
        </div>
      </CardBlock>

      <CardBlock title="Top concurrents (SOV)">
        <div className="space-y-2 text-sm">
          <Competitor name="New Balance" value="40.0%" />
          <Competitor name="Puma" value="0.0%" />
        </div>
      </CardBlock>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {metrics.map((metric) => (
        <Card key={metric.id} className={["border-0 shadow-sm", metric.active ? "bg-blue-600 text-white" : "bg-white"].join(" ")}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <p className={metric.active ? "text-sm text-blue-100" : "text-sm text-slate-500"}>{metric.label}</p>
              <Button size="icon" variant="ghost" className={[
                "size-8 rounded-full",
                metric.active ? "bg-white/20 text-white hover:bg-white/25 hover:text-white" : "text-slate-500 hover:bg-slate-100",
              ].join(" ")}>
                <ExternalLink className="size-4" />
              </Button>
            </div>
            <p className="mt-4 text-4xl font-bold tracking-tight">{metric.value}</p>
            {metric.delta && (
              <Badge className={[
                "mt-4 border-0 text-xs",
                metric.active ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-50",
              ].join(" ")}>{metric.delta}</Badge>
            )}
            {metric.helper && <p className={metric.active ? "mt-3 text-xs text-blue-100" : "mt-3 text-xs text-slate-500"}>{metric.helper}</p>}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function DashboardMainContent() {
  return (
    <div className="space-y-4">
      <CardBlock title="Analyse de visibilité" action="14D">
        <div className="h-48">
          <HorizontalBar label="DeepSeek V4 Flash" value={4} max={12} />
          <HorizontalBar label="Qwen3 Next 80B" value={0} max={12} />
          <HorizontalBar label="gpt-oss-120b" value={0} max={12} />
        </div>
      </CardBlock>

      <CardBlock title="Visibilité de la marque" action="14D">
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="flex h-56 items-end gap-5 px-8 pb-6">
            {[28.6, 28.6, 28.6, 14.3, 0, 0, 0].map((value, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-blue-600/80" style={{ height: `${Math.max(value * 5, 4)}px` }} />
                <span className="text-xs text-slate-500">{["NI", "NB", "AS", "AD", "PU", "UA", "LU"][index]}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Top marques</p>
            <p className="text-xs text-slate-500">par visibilité</p>
            <div className="mt-3 divide-y divide-slate-100">
              {[
                ["Nike", "28.6%", "4 mentions"],
                ["New Balance", "28.6%", "4 mentions"],
                ["ASICS", "28.6%", "4 mentions"],
                ["Adidas", "14.3%", "2 mentions"],
              ].map(([name, percent, mentions]) => (
                <div key={name} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-blue-500" />
                    <span className="flex size-8 items-center justify-center rounded-md border text-xs text-slate-500">{name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <p className="font-medium text-slate-900">{name}</p>
                      <p className="text-xs text-slate-500">{mentions}</p>
                    </div>
                  </div>
                  <span className="font-bold">{percent}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardBlock>

      <div className="grid gap-4 md:grid-cols-2">
        <CardBlock title="Ton des réponses IA">
          <div className="flex h-64 items-center justify-center">
            <div className="relative flex size-44 items-center justify-center rounded-full border-[18px] border-blue-600">
              <div className="flex size-28 items-center justify-center rounded-full bg-blue-400 text-sm font-bold text-white">75%</div>
              <span className="absolute right-4 top-10 rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">25%</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Legend label="Positif" value="25%" />
            <Legend label="Neutre" value="75%" />
            <Legend label="Négatif" value="0%" />
          </div>
        </CardBlock>

        <CardBlock title="Pages les plus citées">
          <EmptyState />
        </CardBlock>
      </div>

      <CardBlock title="Insights automatiques">
        <div className="divide-y divide-slate-100 text-sm">
          <Insight label="DeepSeek" value="100%" text="DeepSeek mentionne votre marque dans 4/4 réponses sur le scope actuel." />
          <Insight label="Concurrence" value="4" text="New Balance est le concurrent le plus cité dans le scope actuel." />
          <Insight label="Qualité" value="70/100" text="Le score moyen de visibilité sur les réponses filtrées est de 70/100." />
        </div>
      </CardBlock>
    </div>
  );
}

function RightMonitoringPanel({ prompts }: { prompts: PromptItem[] }) {
  return (
    <div className="space-y-4">
      <PanelTitle title="Erreurs monitoring" count="0" />
      <EmptyState compact />

      <PanelTitle title="Flux de prompts" count={String(prompts.length)} />
      <div className="space-y-3">
        {prompts.map((prompt) => (
          <Card key={prompt.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{prompt.provider}</p>
                      <p className="text-xs text-slate-500">{prompt.model}</p>
                    </div>
                    <span className="text-xs text-slate-400">{prompt.age}</span>
                  </div>

                  <p className="mt-4 text-sm leading-5 text-slate-800">“{prompt.question}”</p>

                  <div className="mt-4 flex items-center gap-3 text-xs font-semibold">
                    {prompt.mentioned && <span className="text-emerald-600">Mentionné</span>}
                    {prompt.rank && <span className="text-blue-600">{prompt.rank}</span>}
                    {typeof prompt.score === "number" && <Badge className="ml-auto bg-orange-50 text-orange-600 hover:bg-orange-50">{prompt.score}</Badge>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CardBlock({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <Card className="border-0 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase text-blue-600">
          <Sparkles className="size-4" /> {title}
        </CardTitle>
        {action && <button className="text-xs font-medium text-slate-500">{action}</button>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Competitor({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="size-4 rounded border border-slate-200" />
        <span>{name}</span>
      </div>
      <span className="text-slate-400">{value}</span>
    </div>
  );
}

function HorizontalBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="grid grid-cols-[120px_1fr_24px] items-center gap-3 py-3 text-xs text-slate-500">
      <span className="text-right leading-4">{label}</span>
      <div className="h-9 rounded bg-slate-50">
        <div className="h-9 rounded bg-blue-600" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="font-bold text-slate-700">{value}</span>
    </div>
  );
}

function Legend({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 text-center">
      <p className="font-medium text-slate-600">{label}</p>
      <p className="font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={["flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400", compact ? "h-24" : "h-48"].join(" ")}>
      Aucune donnée disponible
    </div>
  );
}

function Insight({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div>
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-slate-700">{text}</p>
      </div>
      <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50">{value}</Badge>
    </div>
  );
}

function PanelTitle({ title, count }: { title: string; count?: string }) {
  return (
    <div className="flex items-center justify-between text-sm font-bold uppercase text-blue-600">
      <span className="flex items-center gap-2"><Sparkles className="size-4" /> {title}</span>
      {count && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs">{count}</span>}
    </div>
  );
}

/*
Version fake data / UI only :

Tu n’as pas besoin d’importer les panels de l’autre app.
Ce fichier recrée l’UI avec des données mockées et des composants locaux.

Utilisation simple :

import VisiaDashboardShell from "./VisiaDashboardShell";

export default function MonitoringMockPage() {
  return <VisiaDashboardShell appName="VISIA." brandName="Nike" />;
}

Utilisation avec fake data personnalisées :

const fakeMetrics = [
  {
    id: "mentions",
    label: "Taux de mention",
    value: "100%",
    delta: "+29% vs 7j",
    helper: "4/4 réponses mentionnent votre marque",
    active: true,
  },
  {
    id: "visibility",
    label: "Score de visibilité",
    value: "70 /100",
    delta: "+16 vs 7j",
    helper: "Score combiné mention × position × sentiment",
  },
  {
    id: "rank",
    label: "Rang moyen",
    value: "1",
    delta: "+0.0",
    helper: "Sur toutes les réponses où votre marque est citée",
  },
];

const fakePrompts = [
  {
    id: "1",
    provider: "DeepSeek",
    model: "deepseek v4 flash (free)",
    age: "11d",
    question:
      "Quelle marque est la plus recommandée pour des sneakers lifestyle iconiques en 2026 ?",
    mentioned: true,
    rank: "Rang n°1",
    score: 70,
  },
];

export function MonitoringMockPage() {
  return (
    <VisiaDashboardShell
      appName="VISIA."
      brandName="Nike"
      brandDescription="garde un léger avantage sur la visibilité IA sur 14 jours"
      metrics={fakeMetrics}
      prompts={fakePrompts}
    />
  );
}

Quand tu voudras brancher la vraie app plus tard, tu remplaceras progressivement :
- les fakeMetrics par les données API
- les fakePrompts par le flux réel
- le contenu de DashboardMainContent par tes vrais charts
*/
