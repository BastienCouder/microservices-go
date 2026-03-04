import { t, type Dictionary } from "intlayer";

const sidebarContent = {
  key: "sidebar",
  content: {
    dashboard: t({
      fr: "Tableau de bord",
      en: "Dashboard",
    }),
    monitoring: t({
      fr: "Surveillance",
      en: "Monitoring",
    }),
    perception: t({
      fr: "Perception",
      en: "Perception",
    }),
    optimize: t({
      fr: "Optimiser",
      en: "Optimize",
    }),
    impact: t({
      fr: "Impact",
      en: "Impact",
    }),
    organizations: t({
      fr: "Organisations",
      en: "Organizations",
    }),
    team: t({
      fr: "Équipe",
      en: "Team",
    }),
    prompts: t({
      fr: "Prompts",
      en: "Prompts",
    }),
    pages: t({
      fr: "Pages",
      en: "Pages",
    }),
    brands: t({
      fr: "Marques",
      en: "Brands",
    }),
    models: t({
      fr: "Modèles",
      en: "Models",
    }),
    settings: t({
      fr: "Paramètres",
      en: "Settings",
    }),
    collapse: t({
      fr: "Réduire",
      en: "Collapse",
    }),
    switchLanguageTo: t({
      fr: "Changer la langue vers",
      en: "Switch language to",
    }),
  },
} satisfies Dictionary;

export default sidebarContent;
