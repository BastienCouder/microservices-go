import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditCheckID, CheckGroup } from "../../_lib/shared/types";
import { CheckToggle } from "./check-toggle";

type CheckGroupCardProps = {
  group: CheckGroup;
  selectedChecks: AuditCheckID[];
  onToggle: (checkID: AuditCheckID) => void;
};

export function CheckGroupCard({
  group,
  selectedChecks,
  onToggle,
}: CheckGroupCardProps) {
  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader>
        <CardTitle className="text-base">{group.label}</CardTitle>
        <CardDescription>{group.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.checks.map((check) => (
          <CheckToggle
            key={check.id}
            check={check}
            checked={check.id !== "web_bot_auth" && selectedChecks.includes(check.id)}
            onToggle={onToggle}
          />
        ))}
      </CardContent>
    </Card>
  );
}
