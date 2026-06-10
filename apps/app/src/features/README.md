# Features Pattern

La structure de reference est celle de `features/monitoring`.

```text
features/<feature>/
  index.tsx
  layout.tsx
  _components/
    <panel>/
      index.tsx
      template.tsx
      *.tsx
  _lib/
    <panel>/
      use-<panel>-panel-view-model.ts
      *.ts
      types.ts
    shared/
      *.ts
```

Regles:

- `index.tsx` est l'entree publique de la feature. Il compose les providers propres a la feature et rend le layout.
- `layout.tsx` porte la composition generale de la page ou de la feature.
- `_components/<panel>/index.tsx` est le conteneur du panel: view-model, etats de chargement, composition UI.
- `_components/<panel>/template.tsx` porte le skeleton/loading state du panel.
- `_components/<panel>/*.tsx` contient les composants UI internes au panel.
- `_lib/<panel>/use-*-view-model.ts` porte l'orchestration UI, les donnees derivees et les callbacks.
- `_lib/<panel>/*.ts` contient les helpers, mappers, constantes et types locaux au panel.
- `_lib/shared/` contient la logique partagee par plusieurs panels de la meme feature.

Conventions:

- utiliser cette structure pour les nouvelles features et les migrations.
- ne pas melanger ce pattern avec `view/`, `views/`, `components/`, `hooks/` ou `core/` dans une feature migree.
- garder les dossiers prives de feature prefixes par `_`: `_components`, `_lib`.
- utiliser des noms de fichiers en kebab-case.
- garder `layout.tsx` fin: pas de mapping metier, pas de gros etat local.
- placer le partage transversal dans `apps/app/src/components/shared` ou `features/shared`, pas dans les `_components` d'une autre feature.

Skill associe:

- `.agents/skills/frontend/feature-structure/SKILL.md`
