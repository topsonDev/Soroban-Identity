#!/usr/bin/env bash
# Deploy Soroban Identity contracts to Stellar testnet
set -euo pipefail

NETWORK="testnet"
SOURCE_ACCOUNT="${STELLAR_SECRET_KEY:?Set STELLAR_SECRET_KEY}"

echo "==> Building contracts..."
(cd contracts && cargo build --target wasm32-unknown-unknown --release)

REGISTRY_WASM="contracts/target/wasm32-unknown-unknown/release/identity_registry.wasm"
CREDENTIAL_WASM="contracts/target/wasm32-unknown-unknown/release/credential_manager.wasm"
REPUTATION_WASM="contracts/target/wasm32-unknown-unknown/release/reputation.wasm"

echo "==> Deploying identity-registry..."
REGISTRY_ID=$(stellar contract deploy \
  --wasm "$REGISTRY_WASM" \
  --source "$SOURCE_ACCOUNT" \
  --network "$NETWORK")
echo "identity-registry: $REGISTRY_ID"

echo "==> Deploying credential-manager..."
CREDENTIAL_ID=$(stellar contract deploy \
  --wasm "$CREDENTIAL_WASM" \
  --source "$SOURCE_ACCOUNT" \
  --network "$NETWORK")
echo "credential-manager: $CREDENTIAL_ID"

echo "==> Deploying reputation..."
REPUTATION_ID=$(stellar contract deploy \
  --wasm "$REPUTATION_WASM" \
  --source "$SOURCE_ACCOUNT" \
  --network "$NETWORK")
echo "reputation: $REPUTATION_ID"

echo "==> Initializing contracts..."
ADMIN_ADDRESS=$(stellar keys address "$SOURCE_ACCOUNT" --network "$NETWORK")

stellar contract invoke \
  --id "$REGISTRY_ID" \
  --source "$SOURCE_ACCOUNT" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS"

stellar contract invoke \
  --id "$CREDENTIAL_ID" \
  --source "$SOURCE_ACCOUNT" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS"

stellar contract invoke \
  --id "$REPUTATION_ID" \
  --source "$SOURCE_ACCOUNT" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS"

DEPLOYED_ENV="$(dirname "$0")/../deployed.env"
cat > "$DEPLOYED_ENV" <<EOF
IDENTITY_REGISTRY_ID=$REGISTRY_ID
CREDENTIAL_MANAGER_ID=$CREDENTIAL_ID
REPUTATION_ID=$REPUTATION_ID
EOF

echo ""
echo "========================================"
echo "  Deployment Summary"
echo "========================================"
echo "  identity-registry:  $REGISTRY_ID"
echo "  credential-manager: $CREDENTIAL_ID"
echo "  reputation:         $REPUTATION_ID"
echo "========================================"
echo ""
echo "Contract IDs written to deployed.env"
echo "Update sdk/src/index.ts with the IDs above."
