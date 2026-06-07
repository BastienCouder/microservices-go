# Backend Standard

Standard backend Go du monorepo `microservices-go`.

Objectif: garder des services simples, cohérents, faciles a relire et a faire evoluer sans multiplier les styles de code.

## Pourquoi ce standard

Sans standard, les services derivent vite:

- duplication de config, bootstrap, auth interne et erreurs HTTP
- handlers HTTP qui contiennent du metier
- gateway qui devient un "mega service" cache
- packages nommes differemment pour la meme responsabilite

Ce standard fixe une structure commune et des regles de placement du code.

## Principes

- Un service porte son metier. Le gateway ne porte pas de moteur metier.
- Les adapters font l'I/O. Ils ne prennent pas les decisions metier.
- Les handlers HTTP restent minces.
- L'orchestration multi-services vit dans une couche `internal/app`, pas dans `adapter/http`.
- Ce qui est purement transversal va dans `services/contracts/pkg`, jamais dans un service metier.
- On prefere un petit nombre de patterns stables a plusieurs variantes "equivalentes".

## Structure canonique d'un service

Pour un service metier classique:

```text
services/<service-name>/
  cmd/api/main.go
  internal/
    adapter/
      http/
      grpc/
      client/
      messaging/
      repository/
      state/
    config/
    domain/
    usecase/
```

Regles:

- `cmd/api/main.go`: wiring, startup, shutdown, rien de metier.
- `internal/config`: lecture de l'env et validation de config.
- `internal/adapter/http`: routing, decode/encode, mapping erreurs HTTP.
- `internal/adapter/client`: appels vers d'autres services.
- `internal/adapter/repository` ou `state`: acces DB / persistence.
- `internal/usecase`: logique applicative et orchestration a l'interieur du service.
- `internal/domain`: types de domaine stables quand ils ont une vraie valeur metier.

## Structure canonique d'un gateway ou BFF

Pour `api-gateway`, on accepte une couche supplementaire:

```text
services/api-gateway/
  cmd/api/main.go
  internal/
    adapter/
      http/
    app/
      <feature>/
    config/
```

Regles:

- `adapter/http`: auth, routing, proxying, rate limiting, headers, transport.
- `internal/app/<feature>`: orchestration multi-services exposee par le gateway.
- Le gateway ne doit pas contenir un moteur metier complet.

Exemples:

- Correct: [services/api-gateway/internal/app/onboarding/service.go](../services/api-gateway/internal/app/onboarding/service.go)
- Incorrect: moteur d'analyse complet directement dans `services/api-gateway/internal/adapter/http`

## Ce qui doit aller dans `services/contracts/pkg`

Uniquement le code partage, stable et non metier:

- `envcfg`: parsing env et secrets
- `serviceboot`: bootstrap commun
- `httpjson`: ecriture uniforme des erreurs HTTP, decode JSON, `405`, helpers de succes
- `internalauth` et `internaljwt`: auth interne partagee
- `grpctls`, `httpsrv`

Question simple:

- si le code pourrait etre copie dans 5 services sans changer le metier, il doit probablement vivre dans `services/contracts/pkg`

Question inverse:

- si le code parle du domaine produit, d'un workflow specifique ou d'un endpoint fonctionnel, il ne doit pas aller dans `services/contracts/pkg`

## Regles HTTP

Les handlers HTTP doivent:

- valider l'auth et les headers necessaires
- decoder la requete
- appeler une methode de service/usecase/app
- encoder la reponse

Les handlers HTTP ne doivent pas:

- construire plusieurs appels inter-services complexes
- contenir la logique de fallback metier
- embarquer du parsing ou scoring metier important

Exemple de bon placement:

- Handler mince: [services/api-gateway/internal/adapter/http/onboarding_bootstrap.go](../services/api-gateway/internal/adapter/http/onboarding_bootstrap.go)
- Orchestration applicative: [services/api-gateway/internal/app/onboarding/service.go](../services/api-gateway/internal/app/onboarding/service.go)
- Feature metier d'analyse: [services/analysis-service/internal/adapter/http/agent_ready_scan_handlers.go](../services/analysis-service/internal/adapter/http/agent_ready_scan_handlers.go)

## Regles de reponses

Par defaut:

- les endpoints HTTP applicatifs renvoient `{"success": true, "data": ...}` via `httpjson.WriteSuccess`
- les clients Go internes doivent decoder via `httpjson.DecodeSuccessData`
- le frontend gateway doit unwrap `success.data` dans le helper partage
- seules exceptions normales: `health`, `ready`, `204 No Content`, ou un endpoint public legacy qu'on garde volontairement compatible

Regle pratique:

- utiliser `httpjson.WriteSuccess` pour tout succes metier
- reserver `httpjson.WriteJSON` aux reponses techniques simples (`health`, `ready`, diagnostics)
- ne pas mixer payload brut et enveloppe `success/data` dans un meme flux sans raison claire

## Regles d'erreurs HTTP

La couche HTTP ne doit pas exposer `err.Error()` brut pour les erreurs metier ou de validation.

Utiliser les helpers partages:

- `httpjson.WriteValidationError`
- `httpjson.WriteNotFoundError`
- `httpjson.WriteForbiddenError`
- `httpjson.WriteConflictError`
- `httpjson.WriteDependencyUnavailable`
- `httpjson.WriteInternalError`
- `httpjson.WriteRateLimitExceeded`
- `httpjson.WriteQuotaExceeded`

Regle pratique:

- les messages detailles restent dans le domaine, les logs ou les audits
- le transport HTTP renvoie un vocabulaire stable et securise
- si un endpoint doit conserver un message plus precis, cela doit etre deliberement documente

## Regles de config

Tous les services doivent suivre le meme pattern:

- `Load()` dans `internal/config/config.go`
- aucun default silencieux pour les variables obligatoires
- helpers partages depuis `services/contracts/pkg/envcfg`
- secrets lus via env direct ou fichier

Exemple:

- [services/contracts/pkg/envcfg/envcfg.go](../services/contracts/pkg/envcfg/envcfg.go)
- [services/api-gateway/internal/config/config.go](../services/api-gateway/internal/config/config.go)

## Regles de bootstrap

Tous les services doivent suivre le meme pattern dans `cmd/api/main.go`:

- charger la config
- executer le mode `healthcheck` si demande
- attendre DB / RabbitMQ si necessaire
- construire les dependencies
- demarrer HTTP / gRPC / metrics
- gerer le shutdown propre

Helpers communs:

- [services/contracts/pkg/serviceboot/serviceboot.go](../services/contracts/pkg/serviceboot/serviceboot.go)

## Regles d'erreurs

On n'utilise pas `err.Error()` comme contrat applicatif.

On prefere:

- erreurs sentinelles
- `fmt.Errorf("%w: ...", ErrValidation)`
- `errors.Is` et `errors.As`

Exemple:

- `onboarding.ErrValidation` dans [services/api-gateway/internal/app/onboarding/service.go](../services/api-gateway/internal/app/onboarding/service.go)

Pour les erreurs `429`:

- `rate limit exceeded` pour un limiteur de trafic ou de requetes
- `quota exceeded` pour une limite de plan, credits ou consommation metier

Helpers a utiliser:

- `httpjson.WriteRateLimitExceeded`
- `httpjson.WriteQuotaExceeded`

## Regles de nommage

- `NewHandler(...)` pour les adapters HTTP
- `NewService(...)` ou `NewServiceWithDependencies(...)` pour la couche usecase/app
- `Load()` pour la config
- `Register(mux)` pour brancher les routes HTTP
- `handleXxx` pour les handlers
- `List/Get/Create/Update/Delete/...` pour les cas d'usage publics

Eviter:

- plusieurs styles pour la meme idee
- noms vagues comme `utils.go`, `helpers2.go`, `misc.go`

## Quand creer `internal/app`

Creer `internal/app/<feature>` si au moins un des points est vrai:

- le workflow orchestre plusieurs services
- le workflow n'appartient pas clairement a un seul service metier existant
- le handler HTTP devient trop gros
- le code est expose par le gateway mais ne releve pas du transport

Ne pas creer `internal/app` si:

- la logique appartient deja clairement a un service metier
- on deplace juste du code pour masquer un handler trop long sans vraie responsabilite stable

## Regles specifiques au `api-gateway`

Le gateway peut faire:

- auth
- proxy
- routage public API
- adaptation de headers
- rate limiting
- orchestration BFF courte

Le gateway ne doit pas faire:

- scoring metier
- analyse de contenu
- logique de persistence metier
- workflows longs qui meritent leur propre service

Decision pratique:

- si une feature peut vivre naturellement dans `analysis-service`, `project-service`, `organizations-service`, etc., elle ne doit pas rester dans le gateway

## Checklist pour un nouveau service

1. Creer `cmd/api/main.go` avec `serviceboot`.
2. Mettre la config dans `internal/config` avec `envcfg`.
3. Ajouter un `adapter/http/handler.go` mince.
4. Mettre le metier dans `internal/usecase`.
5. Mettre DB et clients externes dans `internal/adapter/...`.
6. Utiliser `services/contracts/pkg/httpjson` pour les erreurs.
   Utiliser `DecodeJSON`, `WriteInvalidJSON` et `WriteMethodNotAllowed` pour garder des rejets identiques.
7. Utiliser `services/contracts/pkg/internalauth` pour l'auth interne.
8. Ajouter les tests unitaires du usecase et des routes sensibles.

## Checklist pour une refactorisation

Avant de deplacer du code, poser ces questions:

1. Est-ce du transport, du metier, de l'orchestration, ou de l'infrastructure partagee ?
2. Est-ce reutilisable sans connaitre le domaine produit ?
3. Est-ce que ce code depend de plusieurs services ?
4. Est-ce que ce code doit vivre dans le service qui possede la ressource ?

Destination selon la reponse:

- transport -> `adapter/http`
- metier du service -> `internal/usecase`
- orchestration gateway/BFF -> `internal/app`
- transversal partage -> `services/contracts/pkg`

## Etat actuel du repo

Le repo est maintenant plus coherent sur ces points:

- config factorisee via `envcfg`
- bootstrap factorise via `serviceboot`
- auth interne factorisee
- erreurs HTTP uniformisees
- `agent ready scan` deplace vers `analysis-service`
- `onboarding bootstrap` isole dans `api-gateway/internal/app/onboarding`

Il reste encore des sujets a harmoniser plus tard:

- taille du `Handler` du gateway
- conventions de reponse HTTP encore un peu mixtes
- fragmentation variable des usecases selon les services

Ce document sert de reference pour les prochains refactors.

## Template concret

Pour creer un nouveau service sans repartir de zero:

- Guide: [backend-service-template.md](./backend-service-template.md)
- Squelette: [../templates/backend-service](../templates/backend-service)
