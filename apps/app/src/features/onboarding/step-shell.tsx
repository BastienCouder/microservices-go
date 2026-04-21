import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type OnboardingStepProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function OnboardingStep({
  title,
  description,
  children,
  footer,
  headerAction,
  className,
  contentClassName,
}: OnboardingStepProps) {
  return (
    <Card
      className={cn(
        "h-full w-full rounded-md border-white/70 bg-white/95 shadow-none",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </CardHeader>

      <CardContent className={cn("space-y-4", contentClassName)}>
        {children}
      </CardContent>

      {footer ? (
        <CardFooter className="flex items-center justify-between border-t border-border/70 pt-4">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

type OnboardingStepFooterProps = {
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  hideBack?: boolean;
};

export function OnboardingStepFooter({
  onNext,
  nextLabel,
  nextDisabled = false,
  onBack,
  hideBack = false,
}: OnboardingStepFooterProps) {
  const { t } = useScopedI18n("onboarding");

  return (
    <>
      {hideBack ? (
        <div />
      ) : (
        <Button variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
      )}
      <Button className="min-w-36" onClick={onNext} disabled={nextDisabled}>
        {nextLabel ?? t("next")}
      </Button>
    </>
  );
}

type OnboardingFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  children: ReactNode;
};

export function OnboardingField({
  label,
  htmlFor,
  description,
  children,
}: OnboardingFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-base font-bold">
        {label}
      </Label>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
