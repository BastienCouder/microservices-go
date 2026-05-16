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
    <article className="rounded-[18px] border border-[#eadfd3] bg-[#fffaf5] p-5 shadow-[0_10px_28px_rgba(58,36,24,0.04)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(58,36,24,0.07)]">
      <div>
        <h3 className="text-base font-extrabold text-[#3a2418]">{group.label}</h3>
        <p className="mt-2 text-sm leading-6 text-[#866d5d]">{group.description}</p>
      </div>
      <div className="mt-5 space-y-3">
        {group.checks.map((check) => (
          <CheckToggle
            key={check.id}
            check={check}
            checked={check.id !== "web_bot_auth" && selectedChecks.includes(check.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </article>
  );
}
