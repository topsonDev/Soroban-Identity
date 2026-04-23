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
  reputationId: "CONTRACT_C",
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

  it("getCredentialsBySubject — returns empty array when subject has no credentials", async () => {
    const server = (client as any).server;
    server.simulateTransaction.mockResolvedValueOnce({
      result: { retval: [] },
    });

    const result = await client.getCredentialsBySubject("GABC", "GSUBJECT");

    expect(result).toEqual([]);
  });

  it("getCredentialsBySubject — returns Credential[] for each ID", async () => {
    const mockCredential = {
      id: "aabbcc",
      subject: "GSUBJECT",
      issuer: "GABC",
      credentialType: "Kyc",
      claims: {},
      signature: "",
      issuedAt: 1000,
      expiresAt: 0,
      revoked: false,
    };

    const server = (client as any).server;

    // First simulate call returns a list of one ID
    server.simulateTransaction
      .mockResolvedValueOnce({
        result: { retval: [new Uint8Array(32)] },
      })
      // Second simulate call (getCredential) returns the credential
      .mockResolvedValueOnce({
        result: { retval: mockCredential },
      });

    const result = await client.getCredentialsBySubject("GABC", "GSUBJECT");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockCredential);
  });
});
