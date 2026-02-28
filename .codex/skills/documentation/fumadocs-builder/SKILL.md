---
name: fumadocs-builder
description: Guide for building high-quality documentation sites with Fumadocs and Next.js App Router. Use when creating or extending a Fumadocs project with MDX content, theming, search, and navigation.
---

# Fumadocs Documentation Builder Guide

## Overview

Fumadocs is a documentation framework built on top of Next.js App Router. It provides a flexible, composable system to build beautiful documentation sites using MDX files, with built-in search, theming, and navigation.

## Version Policy (Mandatory)

- Always use the latest stable version of dependencies and documentation tooling.
- For Fumadocs projects, always target the latest stable releases of `fumadocs-ui`, `fumadocs-core`, and `fumadocs-mdx`.
- Always use a compatible latest stable `next` version for the project.
- Never use prerelease versions (`alpha`, `beta`, `rc`) unless explicitly requested.
- Verify stable versions before pinning them in `package.json` or examples.

---

## Phase 1: Project Setup

### 1.1 Create a Next.js App

```bash
npx create-next-app@latest my-docs --typescript --tailwind --app
cd my-docs
```

### 1.2 Install Fumadocs

```bash
npm install fumadocs-ui fumadocs-core
npm install fumadocs-mdx
npm install @next/mdx @mdx-js/loader @mdx-js/react
```

---

## Phase 2: Project Structure

```
my-docs/
├── app/
│   ├── layout.tsx              # Root layout with RootProvider
│   ├── page.tsx                # Landing page
│   └── docs/
│       ├── layout.tsx          # Docs layout with DocsLayout
│       └── [[...slug]]/
│           └── page.tsx        # Dynamic docs page
├── content/
│   └── docs/                   # MDX content files
│       ├── index.mdx
│       └── getting-started.mdx
├── lib/
│   └── source.ts               # Fumadocs source configuration
├── source.config.ts            # MDX + content collection config
├── next.config.mjs             # Next.js config with Fumadocs MDX plugin
└── tailwind.config.ts
```

---

## Phase 3: Configuration Files

### next.config.mjs

```js
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withMDX(config);
```

### source.config.ts

```ts
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

export default defineConfig({
  mdxOptions: {
    // Add remark/rehype plugins here if needed
  },
});
```

### lib/source.ts

```ts
import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { docs } from '@/.source';

export const source = loader({
  baseUrl: '/docs',
  source: createMDXSource(docs),
});
```

---

## Phase 4: App Layout & Providers

### app/layout.tsx

```tsx
import './globals.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
```

### app/docs/layout.tsx

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{ title: 'My Docs' }}
    >
      {children}
    </DocsLayout>
  );
}
```

### app/docs/[[...slug]]/page.tsx

```tsx
import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
```

---

## Phase 5: MDX Content

### content/docs/index.mdx

```mdx
---
title: Introduction
description: Welcome to my documentation.
---

## Getting Started

This is the introduction page.
```

### content/docs/getting-started.mdx

```mdx
---
title: Getting Started
description: How to get started quickly.
---

## Installation

Install the package:

\`\`\`bash
npm install my-package
\`\`\`
```

### Frontmatter Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Page title shown in sidebar and h1 |
| `description` | string | No | Subtitle shown below title |
| `full` | boolean | No | Hide TOC and use full-width layout |
| `icon` | string | No | Lucide icon name for sidebar |

---

## Phase 6: Theming

### globals.css

```css
@import 'fumadocs-ui/style.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### tailwind.config.ts

```ts
import { createPreset } from 'fumadocs-ui/tailwind-plugin';
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  presets: [createPreset()],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.mdx',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
};

export default config;
```

### Preset Options

```ts
createPreset({ preset: 'ocean' })   // ocean | purple | dusk | default
```

---

## Phase 7: Built-in Search (Orama)

Fumadocs ships with Orama search out-of-the-box. No external service needed.

### app/api/search/route.ts

```ts
import { source } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';

export const { GET } = createSearchAPI('advanced', {
  indexes: source.getPages().map((page) => ({
    title: page.data.title,
    description: page.data.description ?? '',
    url: page.url,
    id: page.url,
    structuredData: page.data.structuredData,
  })),
});
```

Search is automatically wired into `RootProvider` and accessible via Cmd+K.

---

## Phase 8: Navigation & Sidebar

### Auto-generated page tree

The sidebar is auto-generated from `content/docs/` file structure.
Folders become groups, files become links.

### meta.json (manual ordering)

Create a `meta.json` in any folder to control order and labels:

```json
{
  "title": "Getting Started",
  "pages": ["index", "installation", "configuration"]
}
```

### DocsLayout with links

```tsx
<DocsLayout
  tree={source.pageTree}
  nav={{ title: 'My Docs' }}
  sidebar={{
    banner: <div>Custom sidebar banner</div>,
    footer: <div>Custom footer</div>,
  }}
  links={[
    {
      text: 'GitHub',
      url: 'https://github.com/yourorg/yourrepo',
      external: true,
    },
  ]}
>
  {children}
</DocsLayout>
```

---

## Phase 9: Custom MDX Components

### Built-in UI Components

```tsx
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { CodeBlock } from 'fumadocs-ui/components/codeblock';
```

### Usage in MDX

```mdx
<Callout type="warn">Watch out!</Callout>

<Tabs items={['npm', 'yarn']}>
  <Tab value="npm">npm install</Tab>
  <Tab value="yarn">yarn add</Tab>
</Tabs>

<Steps>
  <Step>Step one</Step>
  <Step>Step two</Step>
</Steps>

<Cards>
  <Card title="Feature" href="/docs/feature" />
</Cards>
```

### Override components globally

```tsx
// app/docs/[[...slug]]/page.tsx
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from '@/components/callout';

<MDX
  components={{
    ...defaultMdxComponents,
    Callout,
    h2: (props) => <h2 className="text-2xl font-bold mt-8" {...props} />,
  }}
/>
```

---

## Phase 10: OpenAPI / API Reference

### Install plugin

```bash
npm install fumadocs-openapi
```

### Generate MDX from OpenAPI spec

```bash
npx fumadocs-openapi generate ./openapi.yaml ./content/docs/api
```

### source.config.ts with remarkInstall

```ts
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { remarkInstall } from 'fumadocs-docgen';

export const docs = defineDocs({ dir: 'content/docs' });

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkInstall],
  },
});
```

---

## Phase 11: Internationalization (i18n)

### lib/i18n.ts

```ts
import { I18nConfig } from 'fumadocs-core/i18n';

export const i18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: ['en', 'fr'],
};
```

### lib/source.ts (with i18n)

```ts
import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { docs } from '@/.source';
import { i18n } from './i18n';

export const source = loader({
  baseUrl: '/docs',
  i18n,
  source: createMDXSource(docs),
});
```

### Content folder structure for i18n

```
content/docs/
├── en/
│   └── index.mdx
└── fr/
    └── index.mdx
```

---

## Quality Checklist

### Setup
- [ ] `fumadocs-ui`, `fumadocs-core`, `fumadocs-mdx` installed
- [ ] `next.config.mjs` uses `createMDX()` wrapper
- [ ] `source.config.ts` defines `docs` collection pointing to `content/docs/`
- [ ] `lib/source.ts` exports `source` via `loader()`

### Layouts
- [ ] `app/layout.tsx` wraps everything with `<RootProvider>`
- [ ] `app/docs/layout.tsx` uses `<DocsLayout tree={source.pageTree}>`
- [ ] `app/docs/[[...slug]]/page.tsx` implements `generateStaticParams` and `generateMetadata`

### Content
- [ ] All MDX files have `title` in frontmatter
- [ ] `meta.json` files used to control sidebar ordering
- [ ] Built-in components imported from `fumadocs-ui/components/*`

### Theming
- [ ] `globals.css` imports `fumadocs-ui/style.css` before Tailwind directives
- [ ] `tailwind.config.ts` uses `createPreset()` and includes `fumadocs-ui/dist/**/*.js` in content paths
- [ ] Dark mode strategy set to `class`

### Search
- [ ] `app/api/search/route.ts` exports `GET` from `createSearchAPI`
- [ ] Pages include `structuredData` in search indexes

### Build
- [ ] `next build` completes without errors
- [ ] All dynamic routes resolve correctly
- [ ] No missing `generateStaticParams` warnings
- [ ] `source.getPages()` returns expected pages
