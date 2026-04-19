import { describe, expect, it } from "vitest";
import type { GearParams } from "../types";

describe("gear type exports", () => {
  it("accepts basic GearParams shape", () => {
    const params: GearParams = { module: 3, teeth: 17, pressureAngle: 20 };
    expect(params.module).toBe(3);
    expect(params.teeth).toBe(17);
  });
});
