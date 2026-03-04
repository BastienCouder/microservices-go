"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV_LINKS, ACTION_NAV_ITEMS } from "@/config/nav-links";
import { OrganizationSelector } from "@/components/organizations/organization-selector";

type IconName = "settings" | "bell" | "user";

const Icon = React.memo(function Icon({ name }: { name: IconName }) {
  if (name === "settings") {
    return (
      <svg
        viewBox="0 0 32 32"
        className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-180"
        aria-hidden
      >
        <path
          d="M28.6,13c-1.6,0.2-3.1-0.5-4-2c-0.8-1.4-0.7-3.2,0.3-4.4c-1.5-1.4-3.3-2.4-5.2-3C19.1,5,17.7,6,16,6
          s-3.1-1-3.7-2.5c-2,0.6-3.8,1.6-5.2,3C8,7.8,8.2,9.6,7.3,11c-0.8,1.4-2.4,2.2-4,2c-0.2,1-0.4,2-0.4,3c0,1,0.1,2.1,0.4,3
          c1.6-0.2,3.1,0.5,4,2c0.8,1.4,0.7,3.2-0.3,4.4c1.5,1.4,3.3,2.4,5.2,3c0.6-1.4,2-2.5,3.7-2.5s3.1,1,3.7,2.5c2-0.6,3.8-1.6,5.2-3
          c-0.9-1.2-1.1-3-0.3-4.4c0.8-1.4,2.4-2.2,4-2c0.2-1,0.4-2,0.4-3C29,15,28.9,13.9,28.6,13z"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="16"
          cy="16"
          r="3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg viewBox="0 0 32 32" className="h-4.5 w-4.5" aria-hidden>
        <path
          d="M28.6,13c-1.6,0.2-3.1-0.5-4-2c-0.8-1.4-0.7-3.2,0.3-4.4c-1.5-1.4-3.3-2.4-5.2-3C19.1,5,17.7,6,16,6
          s-3.1-1-3.7-2.5c-2,0.6-3.8,1.6-5.2,3C8,7.8,8.2,9.6,7.3,11c-0.8,1.4-2.4,2.2-4,2c-0.2,1-0.4,2-0.4,3c0,1,0.1,2.1,0.4,3
          c1.6-0.2,3.1,0.5,4,2c0.8,1.4,0.7,3.2-0.3,4.4c1.5,1.4,3.3,2.4,5.2,3c0.6-1.4,2-2.5,3.7-2.5s3.1,1,3.7,2.5c2-0.6,3.8-1.6,5.2-3
          c-0.9-1.2-1.1-3-0.3-4.4c0.8-1.4,2.4-2.2,4-2c0.2-1,0.4-2,0.4-3C29,15,28.9,13.9,28.6,13z"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="16"
          cy="16"
          r="3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
      <path
        d="M16 17a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.1 0-8 2-8 5v1h16v-1c0-3-3.9-5-8-5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

const NavItem = React.memo(function NavItem({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap px-4 text-xs sm:px-6 sm:text-sm transition-colors ${active ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
        }`}
    >
      {label}
    </Link>
  );
});

const ActionItem = React.memo(function ActionItem({
  label,
  icon,
  href
}: {
  label?: string;
  icon: IconName;
  href: string;
}) {
  const onlyIcon = !label;
  const isSettings = icon === "settings";

  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center justify-center rounded-full bg-white ${onlyIcon
        ? "h-14 w-14 text-xs"
        : "h-14 px-3 sm:px-4 text-[11px] sm:text-xs gap-2"
        } text-gray-700 ${isSettings ? "group" : ""}`}
    >
      <Icon name={icon} />
      {!onlyIcon && <span className="hidden sm:inline">{label}</span>}
    </Link>
  );
});

export const TopNavbar = React.memo(function TopNavbar() {
  const pathname = usePathname();

  const normalizedPath = useMemo(() => {
    if (!pathname) return "/";
    return pathname.replace(/\/+$/, "") || "/";
  }, [pathname]);

  return (
    <div className="flex w-full bg-gray-50 justify-end px-4">
      <div className="flex max-w-6xl py-6">
        <div className="flex-1">
          <div className="flex h-14 justify-between items-center rounded-full bg-white">
            {MAIN_NAV_LINKS.map((item) => {
              const itemPath = item.href.replace(/\/+$/, "") || "/";
              const active = itemPath === normalizedPath;
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={active}
                />
              );
            })}
          </div>
        </div>
        <div className="flex h-14 items-center ml-1 gap-1">
          <div className="mr-2">
            <OrganizationSelector />
          </div>
          {ACTION_NAV_ITEMS.map((action) => (
            <ActionItem
              key={action.id}
              label={action.label}
              icon={action.icon}
              href={action.href}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
