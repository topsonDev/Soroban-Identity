import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReputationClient } from "./reputation";
import type { SorobanIdentityConfig } from "./types";

// ── Shared mocks ──────────────────────────────────────────────────────────────

const mockSimulateTransaction = vi.fn();
const mockGetAccount = vi.fn().mockResolvedValue({ id: "GCALLER" });

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: vi.fn().mockImplementation(() => ({
        getAccount: mockGetAccount,
        simulateTransaction: mockSimulateTransaction,
      })),
      Api: {
        isSimulationError: (r: unknown) =>
          (r as { error?: string }).error !== undefined,
      },
    },
    Contract: vi.fn().mockImplementation(() => ({
      call: vi.fn().mockReturnValue({}),
    })),
    TransactionBuilder: vi.fn().mockImplementation(() => ({
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({}),
    })),
    BASE_FEE: "100",
    nativeToScVal: vi.fn(),
    scValToNative: vi.fn(),
    StrKey: {
      isValidEd25519PublicKey: (addr: string) => typeof addr === "string" && addr.startsWith("G"),
    },
  };
});

// ── Config ────────────────────────────────────────────────────────────────────

const config: SorobanIdentityConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  identityRegistryId: "CONTRACT_IDENTITY",
  credentialManagerId: "CONTRACT_CREDENTIAL",
  reputationId: "CONTRACT_REPUTATION",
};

describe("ReputationClient.getReporters", () => {
  let client: ReputationClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ReputationClient(config);
  });

  it("returns decoded reporter addresses array on success", async () => {
    const { scValToNative } = await import("@stellar/stellar-sdk");

    const mockReporters = ["GREPORTER1", "GREPORTER2", "GREPORTER3"];

    (scValToNative as ReturnType<typeof vi.fn>).mockReturnValue(mockReporters);
    mockSimulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const result = await client.getReporters("GCALLER");

    expect(result).toEqual(mockReporters);
    expect(result).toHaveLength(3);
  });

  it("returns an empty array when no reporters are registered", async () => {
    const { scValToNative } = await import("@stellar/stellar-sdk");

    (scValToNative as ReturnType<typeof vi.fn>).mockReturnValue([]);
    mockSimulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const result = await client.getReporters("GCALLER");

    expect(result).toEqual([]);
  });

  it("throws when simulation returns an error", async () => {
    mockSimulateTransaction.mockResolvedValue({ error: "contract trap" });

    await expect(
      client.getReporters("GCALLER")
    ).rejects.toThrow("Simulation failed: contract trap");
  });

  it("throws InvalidAddress when callerAddress is invalid", async () => {
    await expect(
      client.getReporters("bad-address")
    ).rejects.toThrow("InvalidAddress");
  });
});

describe("ReputationClient.getScoreHistory", () => {
  let client: ReputationClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ReputationClient(config);
  });

  it("returns decoded ScoreHistoryEntry array on success", async () => {
    const { scValToNative } = await import("@stellar/stellar-sdk");

    const mockEntries = [
      { reporter: "GREPORTER", delta: 50, reason: "completed KYC", submittedAt: 1700000000 },
      { reporter: "GREPORTER", delta: 25, reason: "active trader",  submittedAt: 1700001000 },
    ];

    (scValToNative as ReturnType<typeof vi.fn>).mockReturnValue(mockEntries);
    mockSimulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const result = await client.getScoreHistory("GCALLER", "GSUBJECT", "GREPORTER");

    expect(result).toEqual(mockEntries);
    expect(result).toHaveLength(2);
    expect(result[0].delta).toBe(50);
    expect(result[1].reason).toBe("active trader");
  });

  it("uses default limit=20 and offset=0 when not provided", async () => {
    const { nativeToScVal, scValToNative } = await import("@stellar/stellar-sdk");

    (scValToNative as ReturnType<typeof vi.fn>).mockReturnValue([]);
    mockSimulateTransaction.mockResolvedValue({ result: { retval: {} } });

    await client.getScoreHistory("GCALLER", "GSUBJECT", "GREPORTER");

    expect(nativeToScVal).toHaveBeenCalledWith(0,  { type: "u32" }); // offset
    expect(nativeToScVal).toHaveBeenCalledWith(20, { type: "u32" }); // limit
  });

  it("forwards custom limit and offset to the contract call", async () => {
    const { nativeToScVal, scValToNative } = await import("@stellar/stellar-sdk");

    (scValToNative as ReturnType<typeof vi.fn>).mockReturnValue([]);
    mockSimulateTransaction.mockResolvedValue({ result: { retval: {} } });

    await client.getScoreHistory("GCALLER", "GSUBJECT", "GREPORTER", 40, 10);

    expect(nativeToScVal).toHaveBeenCalledWith(40, { type: "u32" }); // offset
    expect(nativeToScVal).toHaveBeenCalledWith(10, { type: "u32" }); // limit
  });

  it("returns an empty array for a reporter with no history", async () => {
    const { scValToNative } = await import("@stellar/stellar-sdk");

    (scValToNative as ReturnType<typeof vi.fn>).mockReturnValue([]);
    mockSimulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const result = await client.getScoreHistory("GCALLER", "GSUBJECT", "GREPORTER_NEW");

    expect(result).toEqual([]);
  });

  it("throws when simulation returns an error", async () => {
    mockSimulateTransaction.mockResolvedValue({ error: "contract trap" });

    await expect(
      client.getScoreHistory("GCALLER", "GSUBJECT", "GREPORTER")
    ).rejects.toThrow("Simulation failed: contract trap");
  });

  it("throws InvalidAddress when callerAddress is invalid", async () => {
    await expect(
      client.getScoreHistory("bad-address", "GSUBJECT", "GREPORTER")
    ).rejects.toThrow("InvalidAddress");
  });

  it("throws InvalidAddress when subjectAddress is invalid", async () => {
    await expect(
      client.getReputation("GCALLER", "not-valid")
    ).rejects.toThrow("InvalidAddress");
  });
});
