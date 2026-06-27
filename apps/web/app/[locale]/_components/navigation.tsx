"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/app/[locale]/_components/locale-switcher";
import {
  clearAuthReturnTo,
  clearCheckoutIntent,
} from "@/src/auth/browser-intent";
import { getLocalizedPathname, type Locale } from "@/src/i18n/config";

export function Navigation() {
  const t = useTranslations("navigation");
  const authT = useTranslations("auth");
  const locale = useLocale() as Locale;
  const pathname = usePathname();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const gatewayURL =
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:50000";

  const appURL =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:30004";

  const homePath = getLocalizedPathname(locale, "/");
  const loginPath = getLocalizedPathname(locale, "/login");

  const isLoginPage = pathname === loginPath;

  const navLinks = [
    { name: t("features"), href: `${homePath}#features` },
    { name: t("howItWorks"), href: `${homePath}#how-it-works` },
    { name: t("developers"), href: `${homePath}#developers` },
    { name: t("pricing"), href: `${homePath}#pricing` },
    { name: t("faq"), href: `${homePath}#faq` },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let active = true;

    const loadAuthState = async () => {
      try {
        const response = await fetch(`${gatewayURL}/auth/me`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!active) {
          return;
        }

        setIsAuthenticated(response.ok);
      } catch {
        if (active) {
          setIsAuthenticated(false);
        }
      }
    };

    void loadAuthState();

    return () => {
      active = false;
    };
  }, [gatewayURL]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyTouchAction = body.style.touchAction;
    const previousHtmlOverflow = documentElement.style.overflow;

    if (isMobileMenuOpen) {
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
      documentElement.style.overflow = "hidden";
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.touchAction = previousBodyTouchAction;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isMobileMenuOpen]);

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch(`${gatewayURL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setIsAuthenticated(false);
      clearAuthReturnTo();
      clearCheckoutIntent();
      closeMobileMenu();
      window.location.href = homePath;
    }
  }

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        isScrolled ? "lg:left-4 lg:right-4 lg:top-4" : ""
      }`}
    >
      <nav
        className={`relative z-50 mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl lg:max-w-[1200px] lg:rounded-2xl lg:border lg:border-foreground/10"
            : "max-w-[1400px] bg-transparent"
        }`}
      >
        <div
          className={`flex h-20 items-center justify-between px-5 transition-all duration-500 sm:px-6 lg:px-8 ${
            isScrolled ? "lg:h-14" : "lg:h-20"
          }`}
        >
          <Link
            href={homePath}
            className="flex items-center gap-2"
            onClick={closeMobileMenu}
          >
            <Image
              src="/logos/logo.svg"
              alt="Visia"
              width={96}
              height={48}
              priority
              className="h-auto w-[86px] sm:w-[96px] lg:w-[100px]"
            />
          </Link>

          <div className="hidden items-center gap-6 lg:flex xl:gap-10 2xl:gap-12">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="group relative whitespace-nowrap text-sm text-foreground/70 transition-colors duration-300 hover:text-foreground"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex xl:gap-4">
            <LocaleSwitcher />

            {isAuthenticated ? (
              <>
                <Button
                  asChild
                  size="sm"
                  className={`rounded-full bg-primary text-primary-foreground transition-all duration-500 hover:bg-primary/90 ${
                    isScrolled ? "h-8 px-4 text-xs" : "h-9 px-5 text-sm"
                  }`}
                >
                  <a href={appURL}>{t("accessApp")}</a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`rounded-full transition-all duration-500 ${
                    isScrolled ? "h-8 px-4 text-xs" : "h-9 px-5 text-sm"
                  }`}
                  disabled={isLoggingOut}
                  onClick={() => void handleLogout()}
                  type="button"
                >
                  {authT("logout")}
                </Button>
              </>
            ) : !isLoginPage ? (
              <Button
                asChild
                size="sm"
                className={`rounded-full bg-primary text-primary-foreground transition-all duration-500 hover:bg-primary/90 ${
                  isScrolled ? "h-8 px-4 text-xs" : "h-9 px-5 text-sm"
                }`}
              >
                <Link href={loginPath}>{t("signIn")}</Link>
              </Button>
            ) : null}
          </div>

          <button
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 text-foreground transition-colors hover:bg-foreground/5 lg:hidden"
            aria-label={isMobileMenuOpen ? t("closeMenu") : t("toggleMenu")}
            type="button"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="h-px w-full bg-foreground/10 lg:hidden" />
      </nav>

      <div
        className={`fixed inset-0 z-40 bg-background transition-all duration-500 lg:hidden ${
          isMobileMenuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex h-full flex-col px-6 pb-8 pt-28 sm:px-8">
          <div className="flex items-center justify-end gap-4">
            <LocaleSwitcher />
          </div>

          <div className="flex flex-1 flex-col justify-center gap-6 sm:gap-8">
            {navLinks.map((link, index) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={closeMobileMenu}
                className={`font-display text-4xl text-foreground transition-all duration-500 hover:text-muted-foreground sm:text-5xl ${
                  isMobileMenuOpen
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                }`}
                style={{
                  transitionDelay: isMobileMenuOpen
                    ? `${index * 75}ms`
                    : "0ms",
                }}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div
            className={`flex flex-col gap-4 border-t border-foreground/10 pt-8 transition-all duration-500 sm:flex-row ${
              isMobileMenuOpen
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
            style={{
              transitionDelay: isMobileMenuOpen ? "300ms" : "0ms",
            }}
          >
            {isAuthenticated ? (
              <>
                <Button
                  asChild
                  className="h-14 flex-1 rounded-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
                  onClick={closeMobileMenu}
                >
                  <a href={appURL}>{t("accessApp")}</a>
                </Button>
                <Button
                  variant="outline"
                  className="h-14 flex-1 rounded-full text-base"
                  disabled={isLoggingOut}
                  onClick={() => void handleLogout()}
                  type="button"
                >
                  {authT("logout")}
                </Button>
              </>
            ) : !isLoginPage ? (
              <Button
                asChild
                className="h-14 flex-1 rounded-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
                onClick={closeMobileMenu}
              >
                <Link href={loginPath}>{t("signIn")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
