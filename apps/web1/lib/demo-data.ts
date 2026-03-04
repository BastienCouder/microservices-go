export const DEMO_DATA = {
    project: {
        name: "Nike",
        tagline: "Leading athletic footwear and apparel",
        industry: "Fashion / Sportswear",
        competitors: [
            { name: "Adidas", sov: 20, trend: "up", color: "hsl(var(--warning))", mentions: 125, website: "adidas.com", initials: "Ad" },
            { name: "Puma", sov: 12, trend: "stable", color: "hsl(220, 40%, 40%)", mentions: 85, website: "puma.com", initials: "Pu" },
            { name: "Under Armour", sov: 8, trend: "down", color: "hsl(var(--destructive))", mentions: 45, website: "underarmour.com", initials: "UA" },
            { name: "New Balance", sov: 9, trend: "up", color: "hsl(190, 65%, 45%)", mentions: 64, website: "newbalance.com", initials: "NB" },
            { name: "ASICS", sov: 6, trend: "stable", color: "hsl(205, 70%, 40%)", mentions: 39, website: "asics.com", initials: "AS" },
            { name: "Reebok", sov: 5, trend: "down", color: "hsl(12, 70%, 48%)", mentions: 31, website: "reebok.com", initials: "Re" },
        ]
    },
    models: [
        {
            id: "chatgpt",
            name: "ChatGPT",
            description: "Access web search results...",
            live: true,
            icon: "/models/openai.svg",
        },
        {
            id: "perplexity",
            name: "Perplexity Search",
            description: "Online model with real-time...",
            live: true,
            icon: "/models/perplexity.svg",
        },
        {
            id: "claude",
            name: "Claude 3.5",
            description: "High intelligence model...",
            live: true,
            icon: "/models/claude.svg",
        },
        {
            id: "gemini",
            name: "Google Gemini",
            description: "Multimodal reasoning...",
            live: true,
            icon: "/models/gemini.svg",
        },
        {
            id: "mistral",
            name: "Mistral",
            description: "Search Generative Exp...",
            live: true,
            icon: "/models/mistral.svg",
        },
        {
            id: "copilot",
            name: "Microsoft Copilot",
            description: "GPT-4 powered assistant...",
            live: true,
            icon: "/models/copilot.svg",
        },],

    kpis: {
        mention_rate: { value: "58%", trend: "+12% vs 7j", trendDir: "up", sub: "23/40 prompts incluent votre marque" },
        visibility_score: { value: "72 / 100", trend: "-3 vs 7j", trendDir: "down", sub: "Score combiné mention × position × sentiment", badge: "Legere baisse" },
        avg_position: { value: "2.3", trend: "-0.4 (meilleure position)", trendDir: "up", sub: "Sur toutes les réponses où vous êtes cité" },
        sov: { value: "32%", sub: "vs 7 concurrents", trend: "Vous vs top concurrent", topCompetitorValue: "38%" },
        prompts_covered: { value: "120 actifs", sub: "Mise à jour quotidienne", footer: "Plan : 500 prompts max" },
        ai_traffic: { value: "480 cette semaine", sub: "Provenant ChatGPT/Perplexity/Google AI" }
    },
    trends: {
        visibility: [
            { date: "Feb 01", chatgpt: 75, perplexity: 60, claude: 40, gemini: 65, mistral: 30, copilot: 55 },
            { date: "Feb 03", chatgpt: 78, perplexity: 65, claude: 42, gemini: 68, mistral: 32, copilot: 58 },
            { date: "Feb 05", chatgpt: 82, perplexity: 70, claude: 50, gemini: 72, mistral: 35, copilot: 60 },
            { date: "Feb 07", chatgpt: 80, perplexity: 68, claude: 55, gemini: 75, mistral: 38, copilot: 62 },
            { date: "Feb 09", chatgpt: 85, perplexity: 75, claude: 58, gemini: 78, mistral: 40, copilot: 65 },
        ],
        sov: [
            { date: "W1", brand: 40, comp1: 35, comp2: 15, other: 10 }, // Brand=Nike, Comp1=Adidas, Comp2=Puma
            { date: "W2", brand: 42, comp1: 33, comp2: 15, other: 10 },
            { date: "W3", brand: 45, comp1: 30, comp2: 15, other: 10 },
        ],
        brand_visibility: [
            { date: "Feb 01", nike: 25, adidas: 30, puma: 12, ua: 8 },
            { date: "Feb 03", nike: 28, adidas: 32, puma: 14, ua: 9 },
            { date: "Feb 05", nike: 35, adidas: 28, puma: 15, ua: 7 },
            { date: "Feb 07", nike: 32, adidas: 31, puma: 18, ua: 11 },
            { date: "Feb 09", nike: 36, adidas: 29, puma: 16, ua: 10 },
        ]
    },
    clusters: [
        { title: "Running Shoes", score: "A", alert: false },
        { title: "Sustainability", score: "C", alert: true },
        { title: "Price/Value", score: "B", alert: false },
    ],
    alerts: [
        { type: 'critical', msg: "Lost mention on 'Best running shoes 2024' in Perplexity", prompts: "0/5" },
        { type: 'warning', msg: "Adidas overtakes you on 'Sustainable sneakers'", time: "2h ago" },
        { type: 'warning', msg: "Hallucination on 'Nike Air Max' pricing detected", time: "5h ago" },
    ],
    recent_prompts: [
        { text: "Best running shoes for marathon?", model: "ChatGPT", mention: true, rank: 1, score: 98, time: "10m", persona: "athlete", competitorsMentioned: ["Adidas"] },
        { text: "Nike vs Adidas running shoes", model: "Perplexity", mention: true, rank: 1, score: 92, time: "42m", persona: "casual", competitorsMentioned: ["Adidas"] },
        { text: "Ethical sneaker brands 2024", model: "Claude", mention: false, rank: null, score: 20, time: "1h", persona: "sneakerhead", competitorsMentioned: [] },
        { text: "Is Nike Air Zoom comfortable?", model: "Gemini", mention: true, rank: 1, score: 100, time: "3h", persona: "casual", competitorsMentioned: ["Puma", "ASICS"] },
        { text: "Cheapest durable running shoes", model: "Google", mention: false, rank: null, score: 15, time: "5h", persona: "athlete", competitorsMentioned: ["Under Armour", "Reebok"] },
        { text: "Top streetwear brands 2024", model: "ChatGPT", mention: true, rank: 2, score: 75, time: "1d", persona: "sneakerhead", competitorsMentioned: ["Adidas", "Puma", "New Balance"] },
        { text: "Best trail running shoes for coaches", model: "Perplexity", mention: true, rank: 3, score: 81, time: "2d", persona: "coach", competitorsMentioned: ["ASICS", "New Balance"] },
        { text: "Best kids sneakers for school sports", model: "Claude", mention: false, rank: null, score: 46, time: "3d", persona: "parent", competitorsMentioned: ["Reebok", "Puma"] },
        { text: "Collector guide: retro runners 90s", model: "ChatGPT", mention: true, rank: 2, score: 84, time: "4d", persona: "collector", competitorsMentioned: ["Adidas", "ASICS"] },
        { text: "Marathon prep shoes for overpronation", model: "Gemini", mention: true, rank: 1, score: 90, time: "6d", persona: "runner", competitorsMentioned: ["ASICS", "New Balance"] },
    ]
};
