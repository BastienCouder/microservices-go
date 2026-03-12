# Features Pattern

Chaque feature doit suivre la meme structure de base:

```text
features/<feature>/
  index.ts
  core/
  hooks/
  components/
  view/
    index.tsx
    template.tsx
    client.tsx
```

Regles:

- `index.ts` est l'entree publique de la feature. Les imports externes passent par la.
- `view/index.tsx` est le point d'entree de page ou de route.
- `view/template.tsx` porte le layout de la page, les etats `loading`, `empty`, `error`.
- `view/client.tsx` porte l'orchestration UI, les filtres, la composition et l'etat local lourd.
- `components/` contient les blocs UI internes a la feature.
- `core/` contient la logique de domaine de la feature: acces donnees, mapping, config, contrats.
- `hooks/` contient seulement les hooks propres a la feature.

Conventions:

- pas de dossier `_components`
- pas de dossier `views`
- pas de fichier `*-client.tsx` a la racine de la feature
- pas de suffixe `.view.tsx` dans les noms de fichiers
- si une feature est simple, `template.tsx` et `client.tsx` sont optionnels

Sous-features:

```text
features/perception/
  components/
  core/
  view/
  brand-canon/
    index.ts
    view/
      index.tsx
      client.tsx
```

Exceptions acceptees:

- les parcours en etapes comme `onboarding/step-*.tsx` peuvent rester plats tant que le flux est plus lisible ainsi
- `shared/` expose des briques transverses et ne suit pas forcement une structure de page
