# Changelog

All notable changes to the Soroban Identity SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- SDK changelog following Keep a Changelog format
- Copy-to-clipboard button for DID strings in IdentityPanel

## [0.1.0] - 2026-04-25

### Added
- `IdentityClient` for DID management
  - `createDid()` - Create a new DID for a wallet address
  - `updateDid()` - Update DID metadata
  - `resolveDid()` - Resolve a DID document by controller address
  - `hasActiveDid()` - Check if an address has an active DID
  - `deactivateDid()` - Deactivate a DID
- `CredentialClient` for verifiable credentials
  - `issueCredential()` - Issue a credential to a subject
  - `verifyCredential()` - Verify a credential is valid (not revoked, not expired)
  - `getCredential()` - Get a credential by ID
  - `getCredentialsBySubject()` - Get all credentials issued to a subject
  - `verifyCredentialsBatch()` - Verify multiple credentials in parallel
- `ReputationClient` for on-chain reputation scoring
  - `getReputation()` - Get the reputation record for a subject
  - `getScoreHistory()` - Get score submission history for a subject from a specific reporter
  - `passesSybilCheck()` - Check if a subject passes custom sybil thresholds
  - `passesSybilCheckDefault()` - Check if a subject passes default sybil thresholds
  - `submitScore()` - Submit a score delta (for registered reporters)
- TypeScript type definitions
  - `DidDocument` - DID document structure
  - `Credential` - Verifiable credential structure
  - `CredentialType` - Supported credential types (Kyc, Reputation, Achievement, Custom)
  - `VerifyResult` - Credential verification result with failure reasons
  - `ReputationRecord` - Reputation data structure
  - `ScoreHistoryEntry` - Score history entry structure
  - `SorobanIdentityConfig` - SDK configuration interface
  - `CallOptions` - Per-call configuration options
  - `WriteResult` - Transaction result with fee estimation
- Utility functions
  - `retryWithBackoff()` - Retry failed operations with exponential backoff
  - `validateStellarAddress()` - Validate Stellar address format
- Pre-configured network settings
  - `TESTNET_CONFIG` - Testnet RPC and network passphrase
  - `MAINNET_CONFIG` - Mainnet RPC and network passphrase
- Comprehensive test suite with Vitest
  - Unit tests for IdentityClient
  - Unit tests for CredentialClient
  - Unit tests for ReputationClient
  - Unit tests for utility functions

[unreleased]: https://github.com/El-Chapo-Npm/Soroban-Identity/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/El-Chapo-Npm/Soroban-Identity/releases/tag/v0.1.0
