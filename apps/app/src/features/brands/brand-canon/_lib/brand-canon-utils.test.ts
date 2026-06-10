import { describe, expect, test } from "bun:test";

import {
  buildBrandCanonLocation,
  buildBrandsLocation,
  normalizeBrandCanonSearch,
} from "./brand-canon-utils";

describe("brand canon route helpers", () => {
  test("preserves the selected project and organization when opening the editor", () => {
    expect(buildBrandCanonLocation("?project=acme&org=demo")).toEqual({
      pathname: "/brand-canon",
      search: "?project=acme&org=demo",
    });
  });

  test("removes editor-only state when returning to the brand overview", () => {
    expect(buildBrandsLocation("?project=acme&org=demo&tab=brand")).toEqual({
      pathname: "/brands",
      search: "?project=acme&org=demo",
    });
  });

  test("unwraps legacy brand search parameters from existing editor URLs", () => {
    const legacySearch = `?${new URLSearchParams({
      brand: "?project=acme&org=demo",
      tab: "brand",
    }).toString()}`;

    expect(normalizeBrandCanonSearch(legacySearch)).toBe("?project=acme&org=demo");
    expect(buildBrandsLocation(legacySearch)).toEqual({
      pathname: "/brands",
      search: "?project=acme&org=demo",
    });
  });
});
