import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();

describe("error hub", () => {
  test("opens perception-style detail sheets from kanban cards", () => {
    expect(source.includes("ErrorDetailsContent")).toBe(true);
    expect(source.includes("const [selectedError, setSelectedError]")).toBe(true);
    expect(source.includes("onOpenDetails={() => setSelectedError(error)}")).toBe(true);
    expect(source.includes("<Sheet open={selectedError !== null}")).toBe(true);
    expect(source.includes("<Drawer open={selectedError !== null}")).toBe(true);
    expect(source.includes("actionStatus={actionStatusesByErrorId.get(selectedError.id)}")).toBe(true);
    expect(source.includes("onMarkActionDone={() => void onMarkDone(selectedError)}")).toBe(true);
    expect(source.includes("ACTION_STATUS_OPTIONS")).toBe(true);
    expect(source.includes("filterErrorsByActionStatus")).toBe(true);
    expect(source.includes("setActionStatusFilter")).toBe(true);
    expect(source.includes("sortErrorsByActionStatus")).toBe(true);
    expect(source.includes('if (status === "processing") return 0;')).toBe(true);
    expect(source.includes('if (status === "done") return 2;')).toBe(true);
  });
});
