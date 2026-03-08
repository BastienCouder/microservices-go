export function loadPromptsPageModule() {
  return import("@/features/prompts").then((module) => ({
    default: module.PromptsPage,
  }));
}

export function preloadPromptsPage() {
  void loadPromptsPageModule();
}
