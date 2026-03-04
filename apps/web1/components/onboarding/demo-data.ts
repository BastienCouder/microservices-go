import type { CompetitorItem, OnboardingState, PromptWithLanguage } from "@/hooks/use-onboarding";

export const DEMO_COMPETITORS: CompetitorItem[] = [
    { name: "Upwork", website: "https://upwork.com", logo: "UP" },
    { name: "Toptal", website: "https://toptal.com", logo: "TP" },
    { name: "Malt", website: "https://malt.com", logo: "MA" },
    { name: "Fiverr", website: "https://fiverr.com", logo: "FV" },
    { name: "GitHub", website: "https://github.com", logo: "GH" },
];

export const DEMO_PROMPTS: PromptWithLanguage[] = [
    {
        text: "je cherche un full-stack developer qui maitrise TypeScript et React pour notre projet de plateforme web",
        language: "fr",
        category: "organic",
        intent: "commercial",
    },
    {
        text: "comment mettre en place JWT authentication avec NestJS et Prisma pour une API sécurisée",
        language: "fr",
        category: "organic",
        intent: "informational",
    },
    {
        text: "est-ce que Bastien Couder a de l'expérience avec Docker et Ansible pour l'infrastructure",
        language: "fr",
        category: "brand_specific",
        intent: "branded",
    },
    {
        text: "besoin d'aide pour documenter mon API REST avec Swagger API documentation et Next.js",
        language: "fr",
        category: "organic",
        intent: "informational",
    },
    {
        text: "qui peut développer une plateforme complète avec Next.js React TypeScript NestJS Prisma et Docker pour notre startup",
        language: "fr",
        category: "organic",
        intent: "transactional",
    },
];

export const DEMO_INITIAL_STATE: Partial<OnboardingState> = {
    websiteUrl: "https://bastiencouder.com",
    brandName: "Bastien Couder",
    brandShortDescription: "Independent Software Development Services - Full-Stack Web/API",
    brandDescription:
        "Bastien Couder is an independent software developer who presents a personal portfolio showcasing web and API projects.",
    industry: "Independent Software Development Services - Full-Stack Web/API",
    keyFeatures: [
        "Eco-designed crowdfunding platform development (PHP, Laravel, Blade)",
        "Electric vehicle charging load management simulation (TypeScript, React, Vite)",
        "E-commerce REST API design and implementation (TypeScript, NestJS)",
        "Database access layer using Prisma ORM",
        "AWS S3 integration for object storage",
    ],
    brandPersonas: ["Product Owner / Engineering Manager seeking a Full-Stack contractor"],
    competitors: DEMO_COMPETITORS,
    selectedPrompts: DEMO_PROMPTS,
    selectedModels: ["gpt-4o", "perplexity", "google-ai-overview"],
};
