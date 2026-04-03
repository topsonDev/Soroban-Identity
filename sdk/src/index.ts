export { IdentityClient } from "./identity";
export { CredentialClient } from "./credentials";
export { ReputationClient } from "./reputation";
export type {
  DidDocument,
  Credential,
  CredentialType,
  SorobanIdentityConfig,
} from "./types";
export type { ReputationRecord } from "./reputation";

// Testnet defaults
export const TESTNET_CONFIG = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  identityRegistryId: "", // fill after deployment
  credentialManagerId: "", // fill after deployment
};
