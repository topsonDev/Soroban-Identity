import { describe, it, expect, vi, beforeEach } from "vitest";
import { IdentityClient } from "./identity";
import type { SorobanIdentityConfig } from "./types";

// Mock @stellar/stellar-sdk so tests run without a live network
vi.mock("@stellar/stellar-sdk", () => {
  const mockSimResult = {
    result: {
      retval: {
        id: "did:stellar:GABC",
        controller: "GABC",
        metadata: {},
        createdAt: 1000,
        updatedAt: 1000,
        active: true,
      },
    },
  };

  return {
    SorobanRpc: {
      Server: vi.fn().mockImplementation(() => ({
        getAccount: vi.fn().mockResolvedValue({ id: "GABC", sequence: "0" }),
        simulateTransaction: vi.fn().mockResolvedValue(mockSimResult),
        prepareTransaction: vi.fn().mockImplementation((tx) => tx),
        sendTransaction: vi.fn().mockResolvedValue({ status: "PENDING", hash: "abc123" }),
        getTransaction: vi.fn().mockResolvedValue({
          status: "SUCCESS",
          returnValue: "did:stellar:GABC",
        }),
      })),
      Api: {
        isSimulationError: vi.fn().mockReturnValue(false),
        GetTransactionStatus: { SUCCESS: "SUCCESS", FAILED: "FAILED" },
      },
    },
    Contract: vi.fn().mockImplementation(() => ({
      call: vi.fn().mockReturnValue({}),
    })),
    TransactionBuilder: vi.fn().mockImplementation(() => ({
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({ sign: vi.fn() }),
    })),
    BASE_FEE: "100",
    Keypair: {
      fromSecret: vi.fn().mockReturnValue({
        publicKey: () => "GABC",
        sign: vi.fn().mockReturnValue(new Uint8Array(64)),
      }),
    },
    nativeToScVal: vi.fn().mockReturnValue({}),
    scValToNative: vi.fn().mockImplementation((v) => v),
  };
});

const config: SorobanIdentityConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  identityRegistryId: "CONTRACT_A",
  credentialManagerId: "CONTRACT_B",
};

describe("IdentityClient", () => {
  let client: IdentityClient;

  beforeEach(() => {
    client = new IdentityClient(config);
  });

  it("constructs without throwing", () => {
    expect(client).toBeDefined();
  });

  it("hasActiveDid returns a boolean", async () => {
    const result = await client.hasActiveDid("GABC");
    expect(typeof result).toBe("boolean");
  });

  it("resolveDid returns a DID document shape", async () => {
    const doc = await client.resolveDid("GABC");
    expect(doc).toHaveProperty("id");
    expect(doc).toHaveProperty("controller");
    expect(doc).toHaveProperty("active");
  });
});
