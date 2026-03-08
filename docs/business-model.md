# AI Reco Monitor — Business Model & Stratégie Pricing

> Outil de GEO (Generative Engine Optimization) pour SaaS B2B :
> monitor, comprendre, corriger et attribuer la visibilité dans les LLMs.

---

## 🎯 Positionnement

**Catégorie** : AI Visibility & GEO Platform  
**Cible** : PME et scale-ups SaaS B2B  
**Proposition de valeur** : Transformer la présence dans les réponses des IA (ChatGPT, Perplexity, Claude…) en levier de croissance mesurable et actionnable.

---

## 🧩 Les 4 Modules Produit

### 1. Monitoring — *"Que disent les IA de toi ?"*
- Interroge les LLMs comme un client mystère via prompts auto-générés
- Connexion site : scrape homepage/pricing → extrait marque, description, industrie, concurrents
- Génération de prompts : *"Quel CRM pour PME ?"*, *"Alternative Notion 2026"*, *"Comparer [marque] vs HubSpot"*
- **Métriques clés** : AI mention rate, visibility score par prompt, top concurrent détecté

### 2. Understanding — *"Comment les IA te perçoivent ?"*
- Évalue la perception du positionnement B2B vs brand canon extrait du site
- Scores sur : pricing accuracy, feature understanding, use case fit
- **Métriques clés** : `brand_positioning_accuracy`, `hallucination_risk`, `competitor_confusion`, `recommendation_quality`
- Détection erreurs : mauvais pricing, mauvais use case, confusion concurrent

### 3. Correction — *"Comment corriger la perception ?"*
- Recommandations auto : *"Ajoute page comparative vs HubSpot"*, *"FAQ use case factures"*
- Génération de contenu via API IA (OpenAI) : FAQ, sections pricing, pages comparatives en draft
- Intégrations CMS : push Webflow/Next.js ou export Markdown
- **Métriques clés** : liste priorisée par impact estimé (ex. *"High impact : +20% reco rate"*)

### 4. Attribution — *"Quel est le ROI réel des LLMs ?"*
- Track referrals IA (chatgpt.com, perplexity.ai) via GA4 API
- Tags trials/inscriptions "IA-referred" via HubSpot & Stripe
- **Métriques clés** : AI trials, AI MRR, ROI (ex. 480 visits → 27 trials → 5k€ MRR)
- Dashboard : AI revenue funnel (visits → signups → paid)

---

## 💶 Modèle Business : Hybride Tiered + Usage

### Structure des Plans

| Plan | Cible | Prix | Inclus |
|---|---|---|---|
| **Starter** | Fondateur / early-stage | 79–149 €/mois | 1 marque, 3 LLMs, 50 prompts/mois, Monitoring + Understanding |
| **Growth** | PME / scale-up | 299–499 €/mois | 3 marques, 6 LLMs, 200 prompts, Correction (drafts IA), GA4 |
| **Pro** | Équipe marketing SaaS | 799–1 200 €/mois | 10 marques, tous LLMs, prompts illimités, Attribution HubSpot/Stripe, push CMS |
| **Agency / Enterprise** | Agences, grands groupes | Sur devis | Multi-clients, white-label, SLA, API complète |

### Add-ons & Leviers

- ➕ **Add-on Correction** : crédits de génération de contenu à la page produite (~5 €/draft)
- 📅 **Remise annuelle** : 20–25% pour sécuriser la trésorerie
- 🏢 **Tarif agence** : dashboard multi-clients white-label, LTV multiplié

---

## 📐 Règles de Pricing

1. **Ne pas facturer des tokens** — facturer des *actions métier* (prompts analysés, drafts générés, marques trackées)
2. **Module Attribution réservé aux plans supérieurs** — c'est le seul qui connecte l'outil au pipeline revenue → rétention maximale
3. **Cap d'usage sur les petits plans** — protège les marges d'inférence LLM
4. **Abonnement fixe + sur-couche crédits** pour le module Correction — coût variable absorbé sans compression de marge

---

## 🏆 Fossé Défensif (Moat)

| Avantage | Détail |
|---|---|
| **Verticalisation B2B SaaS** | Focus sur un segment homogène avec use cases répétables |
| **Intégrations CRM/CMS** | HubSpot, Stripe, Webflow, Next.js → switching cost élevé |
| **Attribution IA → Revenue** | Seul module qui relie directement la visibilité LLM au MRR |
| **Données propriétaires** | Accumulation de benchmarks sectoriels (hallucination rates, mention rates par industrie) |

---