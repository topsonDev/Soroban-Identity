import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentityClient } from './identity';
import type { SorobanIdentityConfig, DidDocument } from './types';

const { mockSimulateTransaction, mockIsSimulationError } = vi.hoisted(() => ({
  mockSimulateTransaction: vi.fn(),
  mockIsSimulationError: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', () => ({
  SorobanRpc: {
    Server: vi.fn().mockImplementation(() => ({
      getAccount: vi.fn().mockResolvedValue({ id: 'GABC', sequence: '0' }),
      simulateTransaction: mockSimulateTransaction,
      prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      sendTransaction: vi
        .fn()
        .mockResolvedValue({ status: 'PENDING', hash: 'abc123' }),
      getTransaction: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        returnValue: { id: 'did:stellar:GABC' },
      }),
    })),
    Api: {
      isSimulationError: mockIsSimulationError,
      GetTransactionStatus: { SUCCESS: 'SUCCESS', FAILED: 'FAILED' },
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
  BASE_FEE: '100',
  Keypair: {
    fromSecret: vi.fn().mockReturnValue({
      publicKey: () => 'GABC',
    }),
  },
  nativeToScVal: vi.fn().mockReturnValue({}),
  scValToNative: vi.fn().mockImplementation((v) => v),
}));

const config: SorobanIdentityConfig = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  identityRegistryId: 'CONTRACT_A',
  credentialManagerId: 'CONTRACT_B',
};

describe('IdentityClient', () => {
  let client: IdentityClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new IdentityClient(config);
  });

  it('constructs without throwing', () => {
    expect(client).toBeDefined();
  });

  it('resolveDid — happy path returns a DidDocument', async () => {
    const mockDidDoc: DidDocument = {
      id: 'did:stellar:GABC',
      controller: 'GABC',
      metadata: {},
      createdAt: 1000,
      updatedAt: 1000,
      active: true,
    };

    mockIsSimulationError.mockReturnValue(false);
    mockSimulateTransaction.mockResolvedValue({
      result: { retval: mockDidDoc },
    });

    const result = await client.resolveDid('GABC');

    expect(result).toEqual(mockDidDoc);
  });

  it('resolveDid — throws when simulation fails', async () => {
    mockIsSimulationError.mockReturnValue(true);
    mockSimulateTransaction.mockResolvedValue({ error: 'Contract error' });

    await expect(client.resolveDid('GABC')).rejects.toThrow('Simulation failed');
  });

  it('hasActiveDid — returns true for active DID', async () => {
    mockIsSimulationError.mockReturnValue(false);
    mockSimulateTransaction.mockResolvedValue({
      result: { retval: true },
    });

    const result = await client.hasActiveDid('GABC');

    expect(result).toBe(true);
  });

  it('hasActiveDid — returns false for inactive or missing DID', async () => {
    mockIsSimulationError.mockReturnValue(true);
    mockSimulateTransaction.mockResolvedValue({ error: 'No DID' });

    const result = await client.hasActiveDid('GABC');

    expect(result).toBe(false);
  });

  describe('deactivateDid', () => {
    it('deactivates an active DID successfully', async () => {
      // hasActiveDid returns true
      mockIsSimulationError.mockReturnValue(false);
      mockSimulateTransaction.mockResolvedValue({ result: { retval: true } });

      const keypair = { publicKey: () => 'GABC', sign: vi.fn() } as any;
      await expect(client.deactivateDid(keypair)).resolves.toBeUndefined();
    });

    it('throws when DID is already inactive', async () => {
      // hasActiveDid returns false
      mockIsSimulationError.mockReturnValue(true);
      mockSimulateTransaction.mockResolvedValue({ error: 'No DID' });

      const keypair = { publicKey: () => 'GABC', sign: vi.fn() } as any;
      await expect(client.deactivateDid(keypair)).rejects.toThrow(
        'already inactive or does not exist'
      );
    });

    it('throws when transaction is rejected by the network', async () => {
      // hasActiveDid returns true
      mockIsSimulationError.mockReturnValue(false);
      mockSimulateTransaction.mockResolvedValue({ result: { retval: true } });

      // sendTransaction returns ERROR status
      const { SorobanRpc } = await import('@stellar/stellar-sdk');
      (SorobanRpc.Server as any).mockImplementationOnce(() => ({
        getAccount: vi.fn().mockResolvedValue({ id: 'GABC', sequence: '0' }),
        simulateTransaction: mockSimulateTransaction,
        prepareTransaction: vi.fn().mockImplementation((tx) => tx),
        sendTransaction: vi.fn().mockResolvedValue({ status: 'ERROR' }),
        getTransaction: vi.fn(),
      }));

      const freshClient = new IdentityClient(config);
      // re-mock simulate for hasActiveDid inside freshClient
      mockSimulateTransaction.mockResolvedValue({ result: { retval: true } });

      const keypair = { publicKey: () => 'GABC', sign: vi.fn() } as any;
      await expect(freshClient.deactivateDid(keypair)).rejects.toThrow(
        'Transaction failed'
      );
    });
  });
});
