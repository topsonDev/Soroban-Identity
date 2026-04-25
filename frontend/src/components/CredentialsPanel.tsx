import { useState, useEffect } from "react";
import type { CredentialType } from "../../../sdk/src/types";
import type { WalletState } from "../hooks/useWallet";
import SkeletonCard from "./SkeletonCard";

interface Props {
  wallet: WalletState & {
    connect: () => void;
    signTransaction: (xdr: string) => Promise<string>;
  };
}

type VerifyState =
  | "idle"
  | "valid"
  | "not_found"
  | "revoked"
  | "expired"
  | "invalid";

type FilterType = "All" | CredentialType;

function formatExpiry(expiresAt: number): string {
  if (expiresAt === 0) return "No expiry";

  const now = Date.now();
  const expiryMs = expiresAt * 1000;
  const diffMs = expiryMs - now;
  const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
  const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));

  if (diffMs < 0) {
    if (diffDays > 0) return `Expired ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffHours > 0) return `Expired ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `Expired ${diffMinutes} min${diffMinutes > 1 ? "s" : ""} ago`;
  }

  if (diffDays > 0) return `Expires in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
  if (diffHours > 0) return `Expires in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  return `Expires in ${diffMinutes} min${diffMinutes > 1 ? "s" : ""}`;
}

function getExpiryStyle(expiresAt: number): React.CSSProperties {
  if (expiresAt === 0) return { color: "var(--text-muted)" };

  const now = Date.now();
  const expiryMs = expiresAt * 1000;
  const diffMs = expiryMs - now;
  const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    return { color: "var(--error)", fontWeight: 600 };
  }
  if (diffDays <= 7) {
    return { color: "var(--warning)", fontWeight: 600 };
  }
  return { color: "var(--text-muted)" };
}

// Mock credentials for demonstration — replace with SDK data when wired
const MOCK_CREDENTIALS = [
  { id: "abc001", credentialType: "Kyc" as CredentialType, subject: "GABC…", expiresAt: 0 },
  { id: "abc002", credentialType: "Kyc" as CredentialType, subject: "GABC…", expiresAt: Math.floor((Date.now() + 12 * 24 * 60 * 60 * 1000) / 1000) },
  { id: "abc003", credentialType: "Reputation" as CredentialType, subject: "GABC…", expiresAt: Math.floor((Date.now() + 3 * 24 * 60 * 60 * 1000) / 1000) },
  { id: "abc004", credentialType: "Achievement" as CredentialType, subject: "GABC…", expiresAt: Math.floor((Date.now() - 5 * 24 * 60 * 60 * 1000) / 1000) },
  { id: "abc005", credentialType: "Custom" as CredentialType, subject: "GABC…", expiresAt: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000) },
];

const FILTER_OPTIONS: FilterType[] = ["All", "Kyc", "Reputation", "Achievement", "Custom"];

function countByType(type: FilterType): number {
  if (type === "All") return MOCK_CREDENTIALS.length;
  return MOCK_CREDENTIALS.filter((c) => c.credentialType === type).length;
}

export default function CredentialsPanel({ wallet }: Props) {
  const [credId, setCredId] = useState("");
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifying, setVerifying] = useState(false);

  const [subject, setSubject] = useState("");
  const [issueResult, setIssueResult] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [isIssuer, setIsIssuer] = useState(false);
  const [checkingIssuer, setCheckingIssuer] = useState(false);

  // Check if connected wallet is a registered issuer
  useEffect(() => {
    if (!wallet.connected || !wallet.publicKey) {
      setIsIssuer(false);
      return;
    }

    const checkIssuerStatus = async () => {
      setCheckingIssuer(true);
      try {
        // TODO: wire CredentialClient.isIssuer() from SDK
        // For now, mock the check
        await new Promise((r) => setTimeout(r, 300));
        // Mock: assume addresses starting with specific pattern are issuers
        setIsIssuer(wallet.publicKey?.startsWith("G") ?? false);
      } catch {
        setIsIssuer(false);
      } finally {
        setCheckingIssuer(false);
      }
    };

    checkIssuerStatus();
  }, [wallet.connected, wallet.publicKey]);
  const [isIssuer, setIsIssuer] = useState(false);
  const [checkingIssuer, setCheckingIssuer] = useState(false);

  const filteredCredentials =
    activeFilter === "All"
      ? MOCK_CREDENTIALS
      : MOCK_CREDENTIALS.filter((c) => c.credentialType === activeFilter);

  const handleVerify = async () => {
    if (!credId.trim()) return;
    setVerifying(true);
    setVerifyState("idle");
    try {
      // TODO: wire CredentialClient.verifyCredential() from SDK
      await new Promise((r) => setTimeout(r, 800));
      const mockResult = credId.startsWith("0")
        ? { valid: false as const, reason: "revoked" as const }
        : { valid: true as const };
      if (mockResult.valid) {
        setVerifyState("valid");
      } else {
        setVerifyState(mockResult.reason);
      }
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
      const mockFee = 100;
      setIssueResult(
        `Credential issued.\nID: ${mockId}\nEstimated fee: ${mockFee} stroops (${(mockFee / 10_000_000).toFixed(7)} XLM)`
      );
    } catch (e: unknown) {
      setIssueResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <>
      {/* Filter bar */}
      <div className="card">
        <h2>Credentials</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {FILTER_OPTIONS.map((type) => {
            const count = countByType(type);
            const isActive = activeFilter === type;
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                style={{
                  padding: "0.3rem 0.75rem",
                  borderRadius: "999px",
                  border: isActive ? "2px solid var(--accent-light)" : "2px solid var(--border-input)",
                  background: isActive ? "var(--card-bg-accent)" : "transparent",
                  color: isActive ? "var(--accent-light)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: isActive ? 600 : 400,
                }}
                aria-pressed={isActive}
              >
                {type}{" "}
                <span
                  style={{
                    background: isActive ? "var(--filter-badge-active-bg)" : "var(--border-input)",
                    color: isActive ? "var(--filter-badge-active-text)" : "var(--text-muted)",
                    borderRadius: "999px",
                    padding: "0 0.4rem",
                    fontSize: "0.75rem",
                    marginLeft: "0.25rem",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filteredCredentials.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No {activeFilter} credentials found.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {filteredCredentials.map((cred) => (
              <li
                key={cred.id}
                style={{
                  background: "var(--cred-item-bg)",
                  borderRadius: "0.5rem",
                  padding: "0.6rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.85rem",
                  color: "var(--text)",
                  gap: "1rem",
                }}
              >
                <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{cred.id}</span>
                <span className="badge badge-green">{cred.credentialType}</span>
                <span style={getExpiryStyle(cred.expiresAt)}>{formatExpiry(cred.expiresAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

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
        {verifying && <SkeletonCard rows={2} />}
        {!verifying && verifyState !== "idle" && (
          <div style={{ marginTop: "1rem" }}>
            {verifyState === "valid" && (
              <span className="badge badge-green">Valid</span>
            )}
            {verifyState === "revoked" && (
              <span className="badge badge-red">Invalid — credential has been revoked</span>
            )}
            {verifyState === "expired" && (
              <span className="badge badge-red">Invalid — credential has expired</span>
            )}
            {verifyState === "not_found" && (
              <span className="badge badge-red">Invalid — credential not found</span>
            )}
            {(verifyState === "invalid" || verifyState === "unknown" as string) && (
              <span className="badge badge-red">Invalid</span>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Issue Credential</h2>
        {wallet.connected ? (
          isIssuer ? (
            <>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                Issuing as{" "}
                <span style={{ color: "var(--accent-light)" }}>
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
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {checkingIssuer ? "Checking issuer status…" : "Your wallet is not registered as an issuer. Contact the admin to register."}
            </p>
          )
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Connect your Freighter wallet to issue credentials as a registered issuer.
          </p>
        )}
        {issueResult && <pre className="result">{issueResult}</pre>}
      </div>
    </>
  );
}
