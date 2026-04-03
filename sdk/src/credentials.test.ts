import { describe, it, expect, vi, beforeEach } from "vitest";
import { CredentialClient } from "./credentials";
import type { SorobanIdentityConfig } from "./types";

vi.mock("@stellar/stellar-sdk", () => {
  const mockSimResult = {
    result: {
      retval: true,
    },
  };

  return {
    SorobanRpc: {
      Server: vi.fn().mockImplementation(() => ({
        getAccount: vi.fn().mockResolvedValue({ id: "GABC", sequence: "0" }),
        simulateTransaction: vi.fn().mockResolvedValue(mockSimResult),
        prepareTransaction: vi.fn().mockImplementation((tx) => tx),
        sendTransaction: vi.fn().mockResolvedValue({ status: "PENDING", hash: "def456" }),
        getTransaction: vi.fn().mockResolvedValue({
          status: "SUCCESS",
          returnValue: new Uint8Array(32),
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

describe("CredentialClient", () => {
  let client: CredentialClient;

  beforeEach(() => {
    client = new CredentialClient(config);
  });

  it("constructs without throwing", () => {
    expect(client).toBeDefined();
  });

  it("verifyCredential returns a boolean", async () => {
    const result = await client.verifyCredential("GABC", "aabbcc");
    expect(typeof result).toBe("boolean");
  });
});
