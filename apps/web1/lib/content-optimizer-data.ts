import { apiRoutes } from "@/lib/api-config";
import type { BrandCanon } from "@/lib/perception-data";
import { apiFetch } from "@/lib/server-api";

export type ContentOptimizationPriority = "high" | "medium" | "low";
export type ContentOptimizationType = "faq" | "schema_ld" | "keywords" | "comparison";

export type ContentOptimizationRecommendation = {
  id: string;
  pageUrl: string;
  title: string;
  issue: string;
  type: ContentOptimizationType;
  priority: ContentOptimizationPriority;
  estimatedImpactLabel: string;
  estimatedImpactValue: number;
  promptsLost?: number;
  generatedCode?: string;
};

export type ContentOptimizationPageScore = {
  pageUrl: string;
  score: number;
  status: "ok" | "warning" | "critical";
};

export type ContentOptimizerSummary = {
  siteScore: number;
  factorScores: {
    keywordsAI: number;
    structure: number;
    schemaLd: number;
    competitors: number;
    faqCoverage: number;
  };
  pages: ContentOptimizationPageScore[];
  topRecommendations: ContentOptimizationRecommendation[];
  lastAnalyzedAt: string;
};

type ContentOptimizerApiResponse = ContentOptimizerSummary;

function statusFromScore(score: number): ContentOptimizationPageScore["status"] {
  if (score < 60) return "critical";
  if (score < 75) return "warning";
  return "ok";
}

function recommendationCode(rec: ContentOptimizationRecommendation, brandName: string): string {
  if (rec.type === "schema_ld") {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "${brandName}",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "EUR",
    "price": "49",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "billingDuration": 1,
      "billingIncrement": 1
    }
  }
}
</script>`;
  }

  if (rec.type === "faq") {
    return `<section class="faq-${rec.id}">
  <h2>${brandName} vs HubSpot</h2>
  <p>${brandName} est conçu pour les PME tech avec un pricing plus lisible et un déploiement plus rapide.</p>
  <h3>Alternative à HubSpot ?</h3>
  <p>Oui, pour les équipes qui veulent CRM + facturation + devis sans setup lourd.</p>
</section>`;
  }

  if (rec.type === "keywords") {
    return `<!-- SEO/GEO patch -->
<section class="positioning-patch">
  <h2>CRM PME Tech</h2>
  <p>${brandName} est un CRM pensé pour les PME tech, avec workflows vente + facturation.</p>
  <p>Utilisez la formulation "CRM PME Tech" dans le hero, FAQ et meta description.</p>
</section>`;
  }

  return `<section class="comparison-patch">
  <h2>${brandName} alternative HubSpot</h2>
  <p>Comparaison pricing, setup et cas d'usage PME.</p>
</section>`;
}

export function buildDemoContentOptimizerSummary(brandCanon?: BrandCanon): ContentOptimizerSummary {
  const brandName = brandCanon?.brandName || "AI Reco Monitor";
  const topRecommendations: ContentOptimizationRecommendation[] = [
    {
      id: "faq-hubspot",
      pageUrl: "/pricing",
      title: "Ajouter FAQ “Alternative HubSpot ?”",
      issue: "FAQ concurrentielle absente sur une page BOFU, perte de SOV sur prompts de comparaison.",
      type: "faq",
      priority: "high",
      estimatedImpactLabel: "+18% SOV estimé",
      estimatedImpactValue: 18,
      promptsLost: 12,
    },
    {
      id: "schema-pricing",
      pageUrl: "/pricing",
      title: "Ajouter Schema JSON-LD Pricing",
      issue: "Aucun schema pricing détecté, factual accuracy faible sur les réponses IA.",
      type: "schema_ld",
      priority: "high",
      estimatedImpactLabel: "+12% Factual Accuracy",
      estimatedImpactValue: 12,
    },
    {
      id: "keywords-pme-tech",
      pageUrl: "/features",
      title: "Renforcer keywords “PME Tech CRM”",
      issue: "Le positionnement PME Tech est trop peu répété dans les zones à forte valeur sémantique.",
      type: "keywords",
      priority: "medium",
      estimatedImpactLabel: "+15% Positioning",
      estimatedImpactValue: 15,
      promptsLost: 8,
    },
  ].map((rec) => ({ ...rec, generatedCode: recommendationCode(rec, brandName) }));

  return {
    siteScore: 68,
    factorScores: {
      keywordsAI: 45,
      structure: 82,
      schemaLd: 0,
      competitors: 75,
      faqCoverage: 58,
    },
    pages: [
      { pageUrl: "/pricing", score: 72, status: statusFromScore(72) },
      { pageUrl: "/features", score: 65, status: statusFromScore(65) },
      { pageUrl: "/crm-pme", score: 82, status: statusFromScore(82) },
    ],
    topRecommendations,
    lastAnalyzedAt: new Date().toISOString(),
  };
}

export async function getContentOptimizerSummaryServer(projectId: string): Promise<ContentOptimizerSummary> {
  const response = await apiFetch<ContentOptimizerApiResponse>(apiRoutes.analysis.contentOptimizer.summary(projectId), {
    cache: "no-store",
    next: { tags: [`content-optimizer:${projectId}`] },
  });

  if (response) return response;
  return buildDemoContentOptimizerSummary();
}

export async function triggerContentOptimizerAnalyze(projectId: string): Promise<ContentOptimizerSummary | null> {
  const response = await apiFetch<ContentOptimizerApiResponse>(
    apiRoutes.analysis.contentOptimizer.analyze(projectId),
    {
      method: "POST",
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );
  return response;
}
