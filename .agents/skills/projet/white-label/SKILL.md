# Skill: White-label reporting for GEO SaaS agencies

## Purpose

Concevoir, vendre et livrer une expérience de reporting white-label complète pour des agences qui utilisent la plateforme GEO SaaS pour servir plusieurs clients finaux sous leur propre marque.

Le produit doit permettre à une agence de :
- présenter les données sous son identité visuelle ;
- isoler strictement chaque client final ;
- automatiser l'envoi et le partage des rapports ;
- revendre la plateforme avec une marge forte ;
- opérer sans intervention manuelle après configuration initiale.

---

## Core outcome

Le client final ne doit jamais avoir l'impression d'utiliser un outil tiers.

L'agence doit percevoir la plateforme comme :
- un levier de rétention ;
- un multiplicateur de marge ;
- un support de reporting premium ;
- une brique revendable à grande échelle.

---

## Mandatory features

### Branding

Le white-label doit être total, pas cosmétique.

#### Required
- Logo entièrement remplaçable.
- Couleurs entièrement configurables.
- Typographie configurable.
- Favicon personnalisable.
- Nom de plateforme personnalisable.
- Email branding personnalisable.
- Aucun footer, badge, watermark ou mention du fournisseur.
- Domaine ou sous-domaine personnalisé, par exemple `reports.agence-xyz.com`.
- Branding distinct par client final au sein d'une même agence.
- Prévisualisation en temps réel du rendu de marque.

#### Product rules
- Une agence peut gérer plusieurs identités visuelles.
- Un projet/client final peut avoir son propre thème.
- Les assets de marque doivent être versionnés.
- Le fallback branding ne doit jamais exposer la marque fournisseur dans l'espace client final.

---

### Delivery

Le reporting doit être automatisé et exploitable sans manipulation humaine récurrente.

#### Required
- Rapports automatiques planifiés : hebdomadaire, mensuel, trimestriel.
- Envoi direct aux clients finaux par email.
- Export PDF.
- Lien live partageable.
- Historique des rapports générés.
- Génération automatique après setup initial.
- Fonctionnement "set and forget".

#### Recommended
- Modèles de rapports réutilisables.
- Périodes de comparaison.
- Envoi à plusieurs destinataires.
- Résumé exécutif en tête de rapport.
- Scheduling par projet/client.
- Fuseau horaire configurable.
- Langue du rapport configurable.

#### Product rules
- Une agence doit pouvoir définir un template global puis le surcharger projet par projet.
- Un client final ne doit voir que les rapports qui lui sont destinés.
- Les liens partagés doivent pouvoir expirer.
- Les exports doivent respecter le branding associé au projet.

---

### Technical foundation

Le white-label n'a de valeur que si l'isolation et les permissions sont irréprochables.

#### Required
- Multi-tenancy stricte.
- Isolation totale des données entre clients d'une même agence.
- Permissions granulaires.
- Contrôle précis de ce que chaque client final voit.
- OAuth ou SSO.
- Aucune gestion artisanale ou exposée des mots de passe.
- Audit minimal des accès.
- Journalisation des exports et partages.

#### Access model
- Une `organization` représente l'agence ou l'entreprise.
- Une `project` représente une brand, un client final ou un domaine.
- Un `user` peut appartenir à plusieurs organizations.
- Une organization peut avoir plusieurs projects.
- Les permissions peuvent être définies au niveau org et au niveau projet.

#### Minimum roles
- `owner`
- `admin`
- `member`
- `viewer`
- `client`

#### Product rules
- Un client final ne doit jamais voir les autres projets de l'agence.
- Les requêtes doivent toujours être filtrées par tenant actif.
- Les exports, dashboards et liens partagés doivent respecter le périmètre du projet.
- Une erreur de permission ne doit jamais révéler l'existence d'autres tenants ou brands.

---

## Agency pricing structure

Les agences doivent pouvoir revendre la plateforme avec une marge claire et prévisible.

### Pricing principles
- Le pricing doit être pensé en wholesale.
- La revente cible doit permettre une marge de 3x à 5x.
- Le pricing doit encourager l'ajout de nouveaux projets.
- Le plan doit être simple à comprendre pour l'agence et simple à revendre à ses clients.

### Suggested plans

| Plan | Prix facturé agence | Capacité incluse | Revente typique | Marge potentielle |
|---|---:|---|---:|---:|
| Starter | €199/mo | 5 domaines clients | €500 à €800/mo | x2.5 à x4 |
| Growth | €499/mo | 20 domaines clients | €1500 à €2500/mo | x3 à x5 |
| Agency Pro | €999/mo | Illimité + API | €3000 à €5000/mo | x3 à x5 |

### Packaging logic
- **Starter** : pour petites agences ou test du canal.
- **Growth** : pour agences structurées avec portefeuille en croissance.
- **Agency Pro** : pour agences avancées, multi-comptes, reporting intensif, intégrations et API.

### Expansion levers
- domaines supplémentaires ;
- projets supplémentaires ;
- sièges équipe ;
- fréquence de refresh ;
- historique étendu ;
- exports avancés ;
- API ;
- connecteurs externes ;
- SSO avancé ;
- support prioritaire.

---

## What to avoid

Certaines implémentations détruisent la perception premium et bloquent la vente.

### Anti-patterns
- Iframe basique utilisée comme faux white-label.
- Branding partiel.
- Mention du fournisseur dans un footer, email, URL, PDF ou écran de login.
- Données cross-client visibles.
- Shared views mal isolées.
- Permissions trop globales.
- Génération manuelle des rapports.
- PDFs non brandés ou incohérents avec le dashboard live.
- Liens publics non expirables.
- Authentification faible ou bricolée.

### Business risks
- Si le client final détecte l'outil tiers, l'agence perd de la valeur perçue.
- Si l'isolation échoue, l'agence peut churn immédiatement.
- Si le setup demande trop d'opérations manuelles, la marge agence s'effondre.
- Si le reporting n'est pas automatisé, le white-label devient un service et non un produit scalable.

---

## UX requirements

Le produit doit être simple pour l'agence, invisible pour le client final.

### Agency side
- Onboarding rapide.
- Création d'un projet/client en quelques minutes.
- Configuration marque simple.
- Template reporting réutilisable.
- Vue portefeuille multi-clients.
- Gestion fine des accès.
- Historique d'envois.
- Alertes d'échec de génération ou de délivrabilité.

### Client side
- Expérience sobre.
- Branding cohérent.
- Accès limité à ses propres données.
- Lecture simple des rapports.
- Lien live accessible sans confusion produit.
- Aucun élément parasite.

---

## Suggested architecture principles

### Data isolation
- Tenant principal = organization.
- Scope fonctionnel = project.
- Filtrage systématique par `organization_id`.
- Contrôle additionnel par `project_id`.
- Policies d'accès au niveau base de données recommandées.

### Branding system
- Table ou service dédié aux brand themes.
- Assets stockés séparément par org/projet.
- Résolution du thème selon domaine + projet + contexte utilisateur.
- Génération PDF avec moteur de rendu compatible multi-thèmes.

### Reporting pipeline
- Scheduler pour jobs planifiés.
- Génération asynchrone.
- Historique des versions.
- Stockage sécurisé des PDFs.
- Service d'envoi email compatible branding dynamique.
- Liens signés ou temporaires pour partage public.

### Identity and access
- SSO/OAuth natif ou compatible.
- Sessions contextualisées par org active.
- Support du multi-org membership.
- Rôles org + rôles projet.
- Audit trail des connexions, exports et partages.

---

## Sales positioning

Le white-label ne se vend pas comme une feature secondaire. Il se vend comme un moteur de revenu pour l'agence.

### Positioning messages
- "Revendez la plateforme sous votre marque."
- "Automatisez vos rapports GEO sans effort manuel."
- "Gardez la relation client et la valeur perçue."
- "Servez plusieurs clients avec isolation stricte."
- "Ajoutez un revenu récurrent à forte marge."

### Buyer outcomes
- plus de rétention ;
- plus de marge ;
- moins de temps passé en reporting ;
- meilleure crédibilité vis-à-vis du client final ;
- scaling du portefeuille sans augmenter proportionnellement l'équipe.

---

## Readiness checklist

Le produit white-label est prêt si :
- le branding est 100 % remplaçable ;
- aucun élément fournisseur n'est visible côté client final ;
- une agence peut gérer plusieurs clients avec des identités différentes ;
- les rapports sont planifiés et envoyés automatiquement ;
- PDF et live link sont cohérents ;
- l'isolation multi-tenant est testée ;
- les permissions projet sont strictes ;
- OAuth/SSO est fonctionnel ;
- le pricing wholesale laisse une marge claire à l'agence ;
- aucun flux critique n'exige d'opération manuelle récurrente.

---

## Definition of done

La feature white-label est terminée quand une agence peut :
1. créer un client/projet ;
2. appliquer une identité visuelle propre ;
3. connecter son domaine de reporting ;
4. inviter un client final avec accès restreint ;
5. planifier des rapports automatiques ;
6. partager un PDF ou un lien live ;
7. opérer le tout sans qu'aucune trace du fournisseur n'apparaisse.
