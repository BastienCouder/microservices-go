# Skill: API Docs UI inspired by Redocly

## Goal
Build an API documentation interface inspired by the best interaction patterns of modern API docs, especially the Redocly-style experience, without copying brand assets, proprietary text, or exact visual identity. The result must feel clean, developer-first, fast to scan, and production-ready. Redocly’s reference pattern is characterized by a responsive three-panel layout, synchronized navigation, strong search, and a dedicated area for request/response examples. [web:21][web:20][web:24]

## Product intent
Design a documentation experience for developers who need to:
- understand the API quickly,
- find endpoints fast,
- inspect schemas without friction,
- copy code samples immediately,
- and test requests with minimal context switching. These goals align with the interaction model Redocly promotes in its reference docs and configuration options. [web:24][web:20]

## Core layout
Use a responsive three-panel layout by default:
- Left panel: sticky sidebar with search and grouped navigation.
- Center panel: endpoint overview, descriptions, parameters, schemas, guides.
- Right panel: code samples, request example, response example, status codes, and optional “try it” console.

This three-panel structure is the default Redoc pattern and is one of the clearest parts of its UX. [web:21][web:20][web:23]

## UX rules
- Keep the sidebar visible on desktop and collapsible on tablet/mobile. Redoc emphasizes responsive navigation and configurable sidebar behavior. [web:21][web:20]
- Synchronize scroll position with the active navigation item.
- Make search available globally and place it at the top-left.
- Optimize for scanability: short labels, strong hierarchy, generous spacing.
- Group endpoints by tag/category, and allow high-level grouping. Redoc supports side-menu grouping and tag group organization. [web:21]
- Let users switch to a stacked/mobile-friendly reading mode when space is limited. Redocly documents both three-panel and stacked layouts, plus a layout toggle. [web:20][web:23]

## Visual style
Create a neutral, modern visual language:
- White or near-white background.
- Soft gray dividers.
- One primary accent color only.
- Rounded corners, but subtle.
- Sharp typography hierarchy with high contrast.
- Dense but breathable code blocks.
- Minimal shadows.
- Avoid flashy gradients or marketing-site effects in the reference area.

The UI should feel calm, technical, and structured rather than decorative, matching the “modern, responsive, interactive API documentation” positioning of Redocly. [web:27][web:24]

## Navigation behavior
- Left nav must support:
  - section groups,
  - endpoint anchors,
  - current section highlighting,
  - collapse/expand behavior,
  - path-first or summary-first display modes.
- Search should return operations, tags, and schema matches.
- Keep top-level navigation concise; Redocly’s navigation guidance recommends concise primary navigation and sparing use of groups. [web:26][web:20]

## Endpoint page structure
For each endpoint, render content in this order:
1. HTTP method + path
2. One-line summary
3. Description
4. Authentication requirements
5. Path/query/header/body parameters
6. Request example
7. Response examples by status code
8. Schema details
9. Error states
10. Related links or guides

This order should prioritize first-use clarity and code-first consumption.

## Right-panel behavior
The right panel should:
- remain sticky on desktop,
- show language tabs for code examples,
- support copy buttons,
- show example request and example response,
- optionally include a live API console,
- update contextually based on the endpoint currently viewed.

Redoc documents a right panel dedicated to examples and supports interactive docs behavior. [web:21][web:22][web:20]

## Content components
Include these reusable components:
- Search bar
- Sidebar group
- Endpoint item
- Method badge
- Status code badge
- Parameter table
- Schema tree
- Tabs for code languages
- Copy button
- Expand/collapse blocks
- Error callout
- Changelog note
- Authentication block
- Empty state
- Mobile drawer nav

## Accessibility
- WCAG-minded contrast.
- Full keyboard navigation.
- Visible focus states.
- Large enough click targets.
- ARIA labels on search, tabs, copy buttons, and collapsible sections.
- Code blocks must remain readable in both light and dark themes.

## Responsive behavior
- Desktop: three panels.
- Tablet: collapsible left nav, narrower right panel.
- Mobile: stacked layout; nav becomes drawer; code/examples move below content.

This mirrors the responsive and stacked-vs-three-panel layout ideas documented by Redocly. [web:21][web:23]

## Styling constraints
Do not copy:
- Redocly logo,
- proprietary illustrations,
- exact spacing scale,
- exact font stack if branded,
- exact colors,
- exact page copy,
- trademarked wording as product branding.

Instead, reproduce only the interaction model and information architecture patterns visible in modern API docs UX.

## Technical implementation hints
Preferred stack:
- React or Next.js
- Tailwind CSS or CSS variables
- MDX/OpenAPI-driven content
- Sticky CSS panels
- Client-side search index
- Syntax-highlighted code tabs
- Optional OpenAPI parser for schemas and examples

## Output expectations
Generate:
1. The page layout,
2. reusable UI components,
3. a sample API reference page,
4. light and dark themes,
5. responsive behavior,
6. realistic placeholder API data,
7. clean production-grade code.

## Quality bar
The final product should feel:
- faster to scan than a blog post,
- more structured than Swagger UI,
- and close to the clarity of a Redocly-style API reference experience, especially in layout, navigation, and example presentation. Redoc is explicitly known for responsive three-panel reference docs with search/navigation on the left and examples on the right. [web:21][web:22]
