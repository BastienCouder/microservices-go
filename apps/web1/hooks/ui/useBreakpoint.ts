import { useCallback, useEffect, useState } from "react";

type BreakpointKey = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const breakpoints: Record<BreakpointKey, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

/**
 * A hook that returns whether the viewport is currently within a specific breakpoint range
 *
 * @example
 * ```tsx
 * // Check if the viewport is at the "md" breakpoint or larger
 * const isMediumOrLarger = useBreakpoint('md');
 *
 * // Render different layouts based on breakpoint
 * return (
 *   <div>
 *     {isMediumOrLarger ? (
 *       <DesktopLayout />
 *     ) : (
 *       <MobileLayout />
 *     )}
 *   </div>
 * );
 * ```
 */
export function useBreakpoint(breakpoint: BreakpointKey): boolean {
  const [isBreakpoint, setIsBreakpoint] = useState<boolean>(false);

  const checkBreakpoint = useCallback(() => {
    const width = window.innerWidth;
    setIsBreakpoint(width >= breakpoints[breakpoint]);
  }, [breakpoint]);

  useEffect(() => {
    // Initial check
    checkBreakpoint();

    // Add event listener
    window.addEventListener("resize", checkBreakpoint);

    // Clean up event listener
    return () => {
      window.removeEventListener("resize", checkBreakpoint);
    };
  }, [checkBreakpoint]);

  return isBreakpoint;
}

/**
 * A hook that returns the current active breakpoint key
 *
 * @example
 * ```tsx
 * // Get the current active breakpoint
 * const currentBreakpoint = useActiveBreakpoint();
 *
 * // Use the breakpoint to make UI decisions
 * return (
 *   <div>
 *     <p>Current breakpoint: {currentBreakpoint}</p>
 *     {currentBreakpoint === 'xs' && <MobileOnlyFeature />}
 *     {(currentBreakpoint === 'lg' || currentBreakpoint === 'xl') && <DesktopFeature />}
 *   </div>
 * );
 * ```
 */
export function useActiveBreakpoint(): BreakpointKey {
  const [activeBreakpoint, setActiveBreakpoint] = useState<BreakpointKey>("xs");

  const updateActiveBreakpoint = useCallback(() => {
    const width = window.innerWidth;

    // Find the largest breakpoint that the current width is greater than or equal to
    const breakpointEntries = Object.entries(breakpoints) as [
      BreakpointKey,
      number,
    ][];
    const sortedBreakpoints = [...breakpointEntries].sort(
      (a, b) => b[1] - a[1],
    );

    for (const [key, minWidth] of sortedBreakpoints) {
      if (width >= minWidth) {
        setActiveBreakpoint(key);
        break;
      }
    }
  }, []);

  useEffect(() => {
    // Initial check
    updateActiveBreakpoint();

    // Add event listener
    window.addEventListener("resize", updateActiveBreakpoint);

    // Clean up event listener
    return () => {
      window.removeEventListener("resize", updateActiveBreakpoint);
    };
  }, [updateActiveBreakpoint]);

  return activeBreakpoint;
}
