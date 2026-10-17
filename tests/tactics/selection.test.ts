import { describe, it, expect } from "vitest";
import { chooseEntity } from "../../src/tactics/presentation/selection";
describe("tactical input priority with inspectable tissue", () => {
  it("keeps an immune-cell touch target even when a background epithelial center is closer", () => {
    expect(
      chooseEntity([
        { type: "host", id: "h7", d: 4 },
        { type: "cell", id: "u1", d: 23 },
      ])?.id,
    ).toBe("u1");
    expect(
      chooseEntity([
        { type: "host", id: "h7", d: 4 },
        { type: "colony", id: "p4", d: 12 },
      ])?.id,
    ).toBe("p4");
  });
  it("selects the nearest visible tissue when it does not compete with a tactical target", () => {
    expect(
      chooseEntity([
        { type: "host", id: "h7", d: 8 },
        { type: "host", id: "h8", d: 19 },
        { type: "cell", id: "u1", d: 35 },
      ])?.id,
    ).toBe("h7");
    expect(chooseEntity([{ type: "host", id: "h7", d: 30 }])).toBeUndefined();
  });
  it("explicit movement passes through background tissue selection, without losing tactical targets", () => {
    expect(
      chooseEntity([{ type: "host", id: "h7", d: 1 }], true),
    ).toBeUndefined();
    expect(chooseEntity([{ type: "cell", id: "u1", d: 5 }], true)?.id).toBe(
      "u1",
    );
  });
});
