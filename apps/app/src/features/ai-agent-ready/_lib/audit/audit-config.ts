import type { AuditCheckID, CheckGroup, ScanMode } from "../shared/types";

export const DEFAULT_AUDIT_CHECKS: AuditCheckID[] = [
  "robots_txt",
  "sitemap",
  "link_headers",
  "markdown_negotiation",
  "ai_bot_rules",
  "content_signals",
];

export const SCAN_MODES: Array<{
  id: ScanMode;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    id: "all-checks",
    label: "Tous les checks",
    description: "Lance tous les contrôles disponibles pour le contenu public, avec de la place pour des checks API et commerce plus tard.",
  },
  {
    id: "content-site",
    label: "Site de contenu",
    description: "Se concentre sur la découvrabilité, la lisibilité du contenu et les signaux d'accès pour les bots IA.",
  },
  {
    id: "api-application",
    label: "API / Application",
    description: "Réservé aux futurs checks de préparation API, auth, MCP et commerce.",
    disabled: true,
  },
];

export const CHECK_GROUPS: CheckGroup[] = [
  {
    id: "discoverability",
    label: "Découvrabilité",
    description: "Aide les agents à trouver les points d'entrée publics et le plan de crawl.",
    checks: [
      {
        id: "robots_txt",
        label: "robots.txt",
        description: "Présence du fichier, groupes de crawl et directives allow/disallow.",
      },
      {
        id: "sitemap",
        label: "sitemap",
        description: "Déclaration dans robots.txt ou fallback sur /sitemap.xml.",
      },
      {
        id: "link_headers",
        label: "link headers",
        description: "Documentation, API, flux ou ressources bien connues détectables par machine.",
      },
    ],
  },
  {
    id: "content",
    label: "Accessibilité du contenu",
    description: "Vérifie si le contenu principal peut être récupéré dans un format propre pour les agents.",
    checks: [
      {
        id: "markdown_negotiation",
        label: "markdown negotiation",
        description: "Support de `Accept: text/markdown` sur la page d'accueil.",
      },
    ],
  },
  {
    id: "bot_access",
    label: "Contrôle d'accès bots",
    description: "Rend explicites la politique d'accès et les signaux d'usage du contenu.",
    checks: [
      {
        id: "ai_bot_rules",
        label: "AI bot rules",
        description: "Présence de groupes de crawlers IA connus dans robots.txt.",
      },
      {
        id: "content_signals",
        label: "Content Signals",
        description: "Header `Content-Signal` ou lien équivalent vers la politique de contenu.",
      },
      {
        id: "web_bot_auth",
        label: "Web Bot Auth",
        description: "Vérification optionnelle d'accès signé pour les bots.",
        disabled: true,
      },
    ],
  },
];
