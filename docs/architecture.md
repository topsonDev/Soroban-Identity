# Architecture

## Overview

Soroban Identity is composed of three layers:

```
┌─────────────────────────────────────────┐
│              dApps / Frontend           │
├─────────────────────────────────────────┤
│           TypeScript SDK                │
│   IdentityClient  |  CredentialClient   │
├──────────────────┬──────────────────────┤
│ identity-registry│  credential-manager  │  ← Soroban contracts
└──────────────────┴──────────────────────┘
         Stellar Network (Soroban)
```

## Contracts

### identity-registry

Manages DID documents on-chain.

| Function | Description |
|---|---|
| `initialize(admin)` | One-time setup |
| `create_did(controller, metadata)` | Mint a new DID |
| `update_did(controller, metadata)` | Update metadata |
| `deactivate_did(controller)` | Soft-delete a DID |
| `resolve_did(controller)` | Read a DID document |
| `has_active_did(controller)` | Boolean check |

### credential-manager

Issues and verifies verifiable credentials.

| Function | Description |
|---|---|
| `initialize(admin)` | One-time setup |
| `add_issuer(issuer)` | Register a trusted issuer (admin) |
| `remove_issuer(issuer)` | Remove an issuer (admin) |
| `issue_credential(...)` | Issue a credential |
| `revoke_credential(issuer, id)` | Revoke a credential |
| `verify_credential(id)` | Check validity |
| `get_credential(id)` | Fetch full credential |

## DID Format

```
did:stellar:<bech32-stellar-address>
```

Example: `did:stellar:GABC...XYZ`

This is W3C DID-compatible and portable across any dApp that integrates the SDK.

## Credential Flow

```
Issuer                Subject               Verifier
  │                     │                      │
  │── issue_credential ─▶│                      │
  │                     │── present cred id ──▶│
  │                     │                      │── verify_credential
  │                     │                      │◀─ true / false
```

## Privacy

- Claims are stored on-chain as key-value pairs (public by default)
- For sensitive data, store an IPFS CID or encrypted reference in claims
- ZKP integration is planned for selective disclosure without revealing raw claims

## Storage

- `persistent` storage is used for DID documents and credentials (survives ledger expiry with TTL bumps)
- `instance` storage is used for admin and issuer registry
