# Frontend API Standard

## Objectif

Uniformiser la gestion front de :

- `success/data`
- erreurs HTTP backend
- validations utilisateur

## Regle de succes

Toutes les requêtes HTTP passent par `src/shared/api/gateway.ts`.

- utiliser `gatewayJSON(...)` pour exécuter la requête
- utiliser `requireGatewayResult(...)` ou `requireGatewayData(...)` pour exiger un succès
- ne pas re-parser manuellement une enveloppe `{"success": true, "data": ...}`

Le helper partagé unwrap déjà `success.data`.

## Regle d'erreur

Ne pas faire :

- `throw new Error(result.error || "...")`
- mapping local de `status` ou `error.code` dans chaque feature

Faire :

- `throw toGatewayError(result, "Message de fallback")`
- ou `requireGatewayResult(result, "Message de fallback")`

Le helper central classe les erreurs en :

- `validation`
- `unauthorized`
- `forbidden`
- `not_found`
- `conflict`
- `rate_limited`
- `quota_exceeded`
- `dependency_unavailable`
- `internal`
- `timeout`
- `cancelled`
- `network`
- `unknown`

## Regle de validation

Validation locale :

- vérifier les champs avant l'appel API
- afficher les erreurs inline pres des champs quand c'est possible

Validation backend :

- si le backend renvoie `invalid_request`, le front doit afficher un message standard utilisateur
- ne pas exposer de message technique brut si le backend renvoie seulement une erreur generique

## Pattern recommandé

```ts
const result = await gatewayJSON<MyPayload>(apiBaseURL, path, init);
const data = requireGatewayResult(result, "Impossible de charger la ressource.");
return data;
```

## Règle de mutation

Après une requête non-`GET`, le front doit toujours avoir une stratégie explicite de rafraîchissement.

Faire :

- déclencher la requête via `useMutation(...)`
- au succès, utiliser `setQueryData(...)` et/ou invalider les clés React Query concernées
- préférer les helpers partagés de `src/shared/api/query-refresh.ts` quand une mutation touche un scope `organization` ou `project`
- si l'écran ne repose pas sur React Query, mettre à jour l'état local de façon explicite et immédiate

Ne pas faire :

- compter sur un “hot reload” implicite du front
- supposer qu'un `POST`, `PATCH`, `PUT` ou `DELETE` va se refléter tout seul dans l'UI

## Exceptions

Exceptions acceptables seulement si documentées :

- transformation domaine très spécifique
- compat legacy temporaire
- endpoint non-JSON
