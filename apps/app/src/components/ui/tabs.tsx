"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/shared/utils"

function areStylesEqual(
  current: React.CSSProperties,
  next: React.CSSProperties
) {
  return (
    current.opacity === next.opacity &&
    current.width === next.width &&
    current.height === next.height &&
    current.transform === next.transform
  )
}

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "gap-2 group/tabs flex data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "relative rounded-lg p-[3px] group-data-horizontal/tabs:h-8 data-[variant=line]:rounded-none group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground transition-colors duration-300 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  children,
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<React.ElementRef<typeof TabsPrimitive.List>>(null)

  const [indicatorStyle, setIndicatorStyle] =
    React.useState<React.CSSProperties>({
      opacity: 0,
    })

  const [isIndicatorReady, setIsIndicatorReady] = React.useState(false)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    setIsIndicatorReady(false)

    const updateIndicator = () => {
      const activeTrigger = list.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"][data-state="active"]'
      )

      const tabsRoot = list.closest<HTMLElement>('[data-slot="tabs"]')
      const orientation = tabsRoot?.dataset.orientation ?? "horizontal"

      let nextStyle: React.CSSProperties

      if (!activeTrigger) {
        nextStyle = { opacity: 0 }

        setIndicatorStyle((current) =>
          areStylesEqual(current, nextStyle) ? current : nextStyle
        )

        return
      }

      const listRect = list.getBoundingClientRect()
      const triggerRect = activeTrigger.getBoundingClientRect()

      const x = triggerRect.left - listRect.left
      const y = triggerRect.top - listRect.top

      if (variant === "line") {
        if (orientation === "vertical") {
          const height = Math.max(triggerRect.height - 8, 16)

          nextStyle = {
            opacity: 1,
            width: 2,
            height,
            transform: `translate3d(${x + triggerRect.width - 2}px, ${
              y + 4
            }px, 0)`,
          }

          setIndicatorStyle((current) =>
            areStylesEqual(current, nextStyle) ? current : nextStyle
          )

          return
        }

        const width = Math.max(triggerRect.width - 8, 16)

        nextStyle = {
          opacity: 1,
          width,
          height: 2,
          transform: `translate3d(${x + 4}px, ${
            y + triggerRect.height
          }px, 0)`,
        }

        setIndicatorStyle((current) =>
          areStylesEqual(current, nextStyle) ? current : nextStyle
        )

        return
      }

      nextStyle = {
        opacity: 1,
        width: triggerRect.width,
        height: triggerRect.height,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }

      setIndicatorStyle((current) =>
        areStylesEqual(current, nextStyle) ? current : nextStyle
      )
    }

    updateIndicator()

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsIndicatorReady(true)
      })
    })

    const resizeObserver = new ResizeObserver(updateIndicator)

    resizeObserver.observe(list)

    Array.from(
      list.querySelectorAll('[data-slot="tabs-trigger"]')
    ).forEach((trigger) => {
      resizeObserver.observe(trigger)
    })

    const mutationObserver = new MutationObserver(updateIndicator)

    mutationObserver.observe(list, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    })

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [variant])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-0",
          isIndicatorReady &&
            "transition-[transform,width,height,opacity] duration-300 ease-out",
          variant === "default" &&
            "rounded-[calc(var(--radius)+5px)] bg-linear-to-br from-primary/95 via-primary to-primary/80 shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)]",
          variant === "line" && "rounded-full bg-primary"
        )}
        style={indicatorStyle}
      />

      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "z-10 cursor-pointer gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none [&_svg:not([class*='size-'])]:size-4 relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap text-foreground/60 transition-[color,background-color,box-shadow] duration-300 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "group-data-[variant=default]/tabs-list:data-[state=active]:text-primary-foreground group-data-[variant=line]/tabs-list:data-[state=active]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      forceMount
      data-slot="tabs-content"
      className={cn(
        "text-sm flex-1 outline-none data-[state=inactive]:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }