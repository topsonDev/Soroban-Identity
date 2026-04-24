export interface DidDocument {
  id: string; // did:stellar:<address>
  controller: string;
  metadata: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  active: boolean;
}

export type CredentialType = "Kyc" | "Reputation" | "Achievement" | "Custom";

export interface Credential {
  id: string; // hex-encoded 32-byte hash
  subject: string;
  issuer: string;
  credentialType: CredentialType;
  claims: Record<string, string>;
  signature: string; // hex
  issuedAt: number;
  expiresAt: number; // 0 = no expiry
  revoked: boolean;
}

export type VerifyFailReason = "not_found" | "revoked" | "expired" | "unknown";

export type VerifyResult =
  | { valid: true }
  | { valid: false; reason: VerifyFailReason };

export interface SorobanIdentityConfig {
  rpcUrl: string;
  networkPassphrase: string;
  identityRegistryId: string;
  credentialManagerId: string;
  reputationId: string;
  /** Transaction timeout in seconds. Defaults to 30. */
  txTimeout?: number;
}

/** Per-call options that override the global config. */
export interface CallOptions {
  /** Override transaction timeout in seconds for this call only. */
  timeoutSeconds?: number;
}
