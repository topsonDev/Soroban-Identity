import { useState } from 'react';
import type { WalletState } from '../hooks/useWallet';
import type { ReputationRecord } from '../../../sdk/src/reputation';

interface Props {
  wallet: WalletState & {
    connect: () => void;
    signTransaction: (xdr: string) => Promise<string>;
  };
}

export default function IdentityPanel({ wallet }: Props) {
  const [resolveAddress, setResolveAddress] = useState('');
  const [resolveResult, setResolveResult] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [reputation, setReputation] = useState<ReputationRecord | null>(null);
  const [reputationLoading, setReputationLoading] = useState(false);

  const [createResult, setCreateResult] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleResolve = async () => {
    if (!resolveAddress.trim()) return;
    setResolving(true);
    setResolveResult(null);
    setReputation(null);
    try {
      // TODO: wire IdentityClient.resolveDid() from SDK
      await new Promise((r) => setTimeout(r, 800));
      const mock = {
        id: `did:stellar:${resolveAddress}`,
        controller: resolveAddress,
        metadata: {},
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
        active: true,
      };
      setResolveResult(JSON.stringify(mock, null, 2));

      // Fetch reputation alongside DID resolution
      setReputationLoading(true);
      try {
        // TODO: wire ReputationClient.getReputation() from SDK
        await new Promise((r) => setTimeout(r, 600));
        const mockRep: ReputationRecord = {
          subject: resolveAddress,
          score: 42,
          reporterCount: 3,
          updatedAt: Math.floor(Date.now() / 1000),
        };
        setReputation(mockRep);
      } catch {
        setReputation(null);
      } finally {
        setReputationLoading(false);
      }
    } catch (e: unknown) {
      setResolveResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setResolving(false);
    }
  };

  const handleCreate = async () => {
    if (!wallet.connected || !wallet.publicKey) return;
    setCreating(true);
    setCreateResult(null);
    try {
      // TODO: build tx via IdentityClient, sign via wallet.signTransaction(), submit
      await new Promise((r) => setTimeout(r, 1000));
      setCreateResult(`DID created: did:stellar:${wallet.publicKey}`);
    } catch (e: unknown) {
      setCreateResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="card">
        <h2>Resolve DID</h2>
        <input
          placeholder="Stellar address (G…)"
          value={resolveAddress}
          onChange={(e) => setResolveAddress(e.target.value)}
        />
        <button onClick={handleResolve} disabled={resolving || !resolveAddress}>
          {resolving ? 'Resolving…' : 'Resolve'}
        </button>
        {resolveResult && <pre className="result">{resolveResult}</pre>}

        {reputationLoading && (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '1rem' }}>
            Loading reputation…
          </p>
        )}

        {!reputationLoading && reputation && (
          <div
            className="card"
            style={{ marginTop: '1rem', background: '#1e1b4b', border: '1px solid #4c1d95' }}
          >
            <h3 style={{ marginBottom: '0.5rem', color: '#a78bfa' }}>Reputation</h3>
            <p>Score: {reputation.score}</p>
            <p>Reporters: {reputation.reporterCount}</p>
            <p>
              Last updated:{' '}
              {new Date(reputation.updatedAt * 1000).toLocaleDateString()}
            </p>
          </div>
        )}

        {!reputationLoading && resolveResult && !reputation && (
          <div
            className="card"
            style={{ marginTop: '1rem', background: '#1e1b4b', border: '1px solid #334155' }}
          >
            <h3 style={{ marginBottom: '0.5rem', color: '#94a3b8' }}>Reputation</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              No reputation record found for this address.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Create DID</h2>
        {wallet.connected && wallet.publicKey ? (
          <>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Connected as{' '}
              <span style={{ color: '#a78bfa' }}>
                {wallet.publicKey.slice(0, 6)}…{wallet.publicKey.slice(-4)}
              </span>
            </p>
            <button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create DID'}
            </button>
          </>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Connect your Freighter wallet to create a new on-chain DID.
          </p>
        )}
        {createResult && <pre className="result">{createResult}</pre>}
      </div>
    </>
  );
}
