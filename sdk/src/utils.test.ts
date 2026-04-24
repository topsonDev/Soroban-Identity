import { describe, it, expect, vi } from "vitest";
import { validateStellarAddress } from "./utils";

vi.mock("@stellar/stellar-sdk", () => ({
  StrKey: {
    // Accept any string starting with G and at least 10 chars as "valid" in tests
    isValidEd25519PublicKey: (addr: string) => typeof addr === "string" && addr.startsWith("G") && addr.length >= 10,
  },
}));

const VALID_ADDRESS = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJ";

describe("validateStellarAddress", () => {
  it("does not throw for a valid Stellar address", () => {
    expect(() => validateStellarAddress(VALID_ADDRESS)).not.toThrow();
  });

  it("throws InvalidAddress for an empty string", () => {
    expect(() => validateStellarAddress("")).toThrow("InvalidAddress");
  });

  it("throws InvalidAddress for a random string", () => {
    expect(() => validateStellarAddress("not-an-address")).toThrow("InvalidAddress");
  });

  it("throws InvalidAddress for an Ethereum-style address", () => {
    expect(() => validateStellarAddress("0xdeadbeef")).toThrow("InvalidAddress");
  });

  it("error message includes the invalid address", () => {
    expect(() => validateStellarAddress("bad")).toThrow('"bad"');
  });
});
