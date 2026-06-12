import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./step-account-type.tsx", import.meta.url)).text();

describe("step account type", () => {
  test("keeps the account setup as the first visible onboarding step", () => {
    expect(source.includes("setStep(2)")).toBe(false);
    expect(source.includes('title={t("accountTypeTitle")}')).toBe(true);
    expect(source.includes('description={t("accountTypeDescription")}')).toBe(true);
    expect(source.includes('actionLabel={t("accountTypeBusinessAction")}')).toBe(true);
    expect(source.includes("onAction={nextStep}")).toBe(true);
  });
});
