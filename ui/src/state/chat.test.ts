import { describe, expect, it } from "vitest";
import { daToBigInt } from "./chat";
import bigInt from "big-integer";

describe("da to bigInt conversion", () => {
  it("should work", () => {
    const num = bigInt("170141184505588617053681428332804046848");
    const res = daToBigInt("~2022.4.14..19.06.51..a41c");
    const diff = res.subtract(num);
    console.log(diff.toString());
    console.log(diff.toString().length);
    expect(diff.eq(bigInt.zero)).to.eq(true);
  });
});
