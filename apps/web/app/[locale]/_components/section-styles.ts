export const sectionHeadingClass =
  "text-primary font-display text-[clamp(2.75rem,8vw,4.5rem)] leading-[0.94] tracking-tight";

export const sectionHeadingMutedClass = "text-muted-foreground";

export const sectionIntroTextClass =
  "max-w-2xl text-base sm:text-lg lg:text-xl text-muted-foreground leading-relaxed";

export const sectionFeatureTitleClass =
  "font-display tracking-tight text-2xl sm:text-3xl lg:text-4xl";

export const sectionFeatureBodyClass =
  "text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed";

export const sectionCompactTitleClass =
  "font-display tracking-tight text-xl sm:text-2xl lg:text-3xl";

export const sectionCompactBodyClass =
  "text-sm sm:text-base text-muted-foreground leading-relaxed";

export const sectionRevealBaseClass =
  "opacity-100 translate-x-0 translate-y-0 lg:transform-gpu lg:transition-all lg:duration-700 lg:ease-[cubic-bezier(0.22,1,0.36,1)] lg:will-change-transform";

export const sectionRevealDelaySmClass = "lg:delay-100";
export const sectionRevealDelayMdClass = "lg:delay-200";
export const sectionRevealDelayLgClass = "lg:delay-300";

type RevealDirection = "up" | "left" | "right";
type RevealDistance = "sm" | "md";

export function getSectionRevealClass(
  isVisible: boolean,
  direction: RevealDirection = "up",
  distance: RevealDistance = "md",
) {
  const hiddenState =
    direction === "left"
      ? distance === "sm"
        ? "lg:opacity-0 lg:-translate-x-4"
        : "lg:opacity-0 lg:-translate-x-8"
      : direction === "right"
        ? distance === "sm"
          ? "lg:opacity-0 lg:translate-x-4"
          : "lg:opacity-0 lg:translate-x-8"
        : distance === "sm"
          ? "lg:opacity-0 lg:translate-y-4"
          : "lg:opacity-0 lg:translate-y-8";

  return `${sectionRevealBaseClass} ${
    isVisible ? "lg:opacity-100 lg:translate-x-0 lg:translate-y-0" : hiddenState
  }`;
}
