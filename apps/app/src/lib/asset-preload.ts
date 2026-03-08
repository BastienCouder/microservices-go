export const MODEL_SVG_ICON_PATHS = [
  "/models/openai.svg",
  "/models/perplexity.svg",
  "/models/claude.svg",
  "/models/gemini.svg",
  "/models/mistral.svg",
  "/models/copilot.svg",
] as const;

export function preloadModelSvgIcons() {
  if (typeof document === "undefined") return;

  MODEL_SVG_ICON_PATHS.forEach((href) => {
    const existingLink = document.head.querySelector(`link[rel="preload"][href="${href}"]`);
    if (existingLink) return;

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.type = "image/svg+xml";
    link.href = href;
    link.setAttribute("fetchpriority", "high");
    document.head.appendChild(link);
  });
}
