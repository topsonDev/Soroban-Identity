import { useState } from "react";
import type { WalletState } from "../hooks/useWallet";

interface Props {
  wallet: WalletState & {
    connect: () => void;
    signTransaction: (xdr: string) => Promise<string>;
  };
}

type VerifyState = "idle" | "valid" | "invalid";

export default function CredentialsPanel({ wallet }: Props) {
  const [credId, setCredId] = useState("");
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifying, setVerifying] = useState(false);

  const [subject, setSubject] = useState("");
  const [issueResult, setIssueResult] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const handleVerify = async () => {
    if (!credId.trim()) return;
    setVerifying(true);
    setVerifyState("idle");
    try {
      // TODO: wire CredentialClient.verifyCredential() from SDK
      await new Promise((r) => setTimeout(r, 800));
      setVerifyState(credId.startsWith("0") ? "invalid" : "valid");
    } catch {
      setVerifyState("invalid");
    } finally {
      setVerifying(false);
    }
  };

  const handleIssue = async () => {
    if (!wallet.connected || !subject.trim()) return;
    setIssuing(true);
    setIssueResult(null);
    try {
      // TODO: build tx via CredentialClient, sign via wallet.signTransaction(), submit
      await new Promise((r) => setTimeout(r, 1000));
      const mockId = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setIssueResult(`Credential issued.\nID: ${mockId}`);
    } catch (e: unknown) {
      setIssueResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <>
      <div className="card">
        <h2>Verify Credential</h2>
        <input
          placeholder="Credential ID (hex)"
          value={credId}
          onChange={(e) => setCredId(e.target.value)}
        />
        <button onClick={handleVerify} disabled={verifying || !credId}>
          {verifying ? "Verifying…" : "Verify"}
        </button>
        {verifyState !== "idle" && (
          <div style={{ marginTop: "1rem" }}>
            <span
              className={`badge ${
                verifyState === "valid" ? "badge-green" : "badge-red"
              }`}
            >
              {verifyState === "valid" ? "Valid" : "Invalid / Revoked"}
            </span>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Issue Credential</h2>
        {wallet.connected ? (
          <>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "1rem" }}>
              Issuing as{" "}
              <span style={{ color: "#a78bfa" }}>
                {wallet.publicKey?.slice(0, 6)}…{wallet.publicKey?.slice(-4)}
              </span>
            </p>
            <input
              placeholder="Subject address (G…)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <button onClick={handleIssue} disabled={issuing || !subject}>
              {issuing ? "Issuing…" : "Issue KYC Credential"}
            </button>
          </>
        ) : (
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Connect your Freighter wallet to issue credentials as a registered issuer.
          </p>
        )}
        {issueResult && <pre className="result">{issueResult}</pre>}
      </div>
    </>
  );
}
