import { describe, expect, test } from "bun:test";

import { buildConfirmDialogPreview } from "./confirm-dialog";

describe("buildConfirmDialogPreview", () => {
  test("limits preview items and reports the remaining count", () => {
    const preview = buildConfirmDialogPreview(
      ["one", "two", "three", "four", "five", "six"],
      4,
    );

    expect(preview.visibleItems).toEqual(["one", "two", "three", "four"]);
    expect(preview.remainingCount).toBe(2);
  });

  test("returns all items when the preview limit covers the full list", () => {
    const preview = buildConfirmDialogPreview(["one", "two"], 5);

    expect(preview.visibleItems).toEqual(["one", "two"]);
    expect(preview.remainingCount).toBe(0);
  });
});
