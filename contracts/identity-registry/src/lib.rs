#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, symbol_short,
    Address, Bytes, Env, Map, String, Symbol,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum ContractError {
    DidNotFound    = 1,
    DidDeactivated = 2,
    MetadataTooLong = 3,
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const IDENTITY: Symbol = symbol_short!("IDENTITY");
const ADMIN: Symbol = symbol_short!("ADMIN");

// ── Data types ────────────────────────────────────────────────────────────────

/// W3C-aligned DID document stored on-chain.
#[contracttype]
#[derive(Clone)]
pub struct DidDocument {
    /// did:stellar:<address>
    pub id: String,
    /// Wallet that owns this DID
    pub controller: Address,
    /// Arbitrary metadata (e.g. service endpoints, public keys)
    pub metadata: Map<String, String>,
    /// Unix timestamp of creation
    pub created_at: u64,
    /// Unix timestamp of last update
    pub updated_at: u64,
    /// Whether this DID is active
    pub active: bool,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct IdentityRegistry;

#[contractimpl]
impl IdentityRegistry {
    // ── Admin ─────────────────────────────────────────────────────────────────

    /// Initialize the registry with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
    }

    // ── DID management ────────────────────────────────────────────────────────

    /// Create a new DID for the caller.
    pub fn create_did(env: Env, controller: Address, metadata: Map<String, String>) -> Result<String, ContractError> {
        controller.require_auth();

        let storage = env.storage().persistent();
        let key = Self::did_key(&env, &controller);

        if storage.has(&key) {
            panic!("DID already exists for this address");
        }

        Self::validate_metadata(&metadata)?;

        let did_id = Self::build_did_id(&env, &controller);
        let now = env.ledger().timestamp();

        let doc = DidDocument {
            id: did_id.clone(),
            controller: controller.clone(),
            metadata,
            created_at: now,
            updated_at: now,
            active: true,
        };

        storage.set(&key, &doc);
        env.events().publish((IDENTITY, symbol_short!("created")), controller);

        Ok(did_id)
    }

    /// Update metadata on an existing DID.
    pub fn update_did(env: Env, controller: Address, metadata: Map<String, String>) -> Result<(), ContractError> {
        controller.require_auth();

        Self::validate_metadata(&metadata)?;

        let storage = env.storage().persistent();
        let key = Self::did_key(&env, &controller);
        let mut doc: DidDocument = storage.get(&key).expect("DID not found");

        doc.metadata = metadata;
        doc.updated_at = env.ledger().timestamp();

        storage.set(&key, &doc);
        env.events().publish((IDENTITY, symbol_short!("updated")), controller);
        Ok(())
    }

    /// Deactivate a DID (soft delete).
    pub fn deactivate_did(env: Env, controller: Address) {
        controller.require_auth();

        let storage = env.storage().persistent();
        let key = Self::did_key(&env, &controller);
        let mut doc: DidDocument = storage.get(&key).expect("DID not found");

        doc.active = false;
        doc.updated_at = env.ledger().timestamp();

        storage.set(&key, &doc);
        env.events().publish((IDENTITY, symbol_short!("deactivated")), controller);
    }

    /// Resolve a DID document by controller address.
    pub fn resolve_did(env: Env, controller: Address) -> Result<DidDocument, ContractError> {
        let key = Self::did_key(&env, &controller);
        let doc: DidDocument = env.storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::DidNotFound)?;
        if !doc.active {
            return Err(ContractError::DidDeactivated);
        }
        Ok(doc)
    }

    /// Check whether an address has an active DID.
    pub fn has_active_did(env: Env, controller: Address) -> bool {
        let key = Self::did_key(&env, &controller);
        match env.storage().persistent().get::<Bytes, DidDocument>(&key) {
            Some(doc) => doc.active,
            None => false,
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn validate_metadata(metadata: &Map<String, String>) -> Result<(), ContractError> {
        for (k, v) in metadata.iter() {
            if k.len() > 64 || v.len() > 256 {
                return Err(ContractError::MetadataTooLong);
            }
        }
        Ok(())
    }

    fn did_key(env: &Env, controller: &Address) -> Bytes {
        // Use the raw address bytes as the storage key
        let mut key = Bytes::new(env);
        key.extend_from_array(&[b'd', b'i', b'd', b':']);
        // append address bytes — Address implements IntoVal<Env, Bytes> indirectly
        // so we serialize via the env
        let addr_bytes = controller.to_string().into_bytes();
        key.extend_from_slice(&addr_bytes);
        key
    }

    fn build_did_id(env: &Env, controller: &Address) -> String {
        // did:stellar:<bech32-address>
        let prefix = String::from_str(env, "did:stellar:");
        let addr_str = controller.to_string();
        let mut result = prefix.into_bytes();
        result.extend_from_slice(&addr_str.into_bytes());
        String::from_bytes(env, &result)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, Map};

    #[test]
    fn test_create_and_resolve_did() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, IdentityRegistry);
        let client = IdentityRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let user = Address::generate(&env);
        let metadata: Map<String, String> = Map::new(&env);

        let did_id = client.create_did(&user, &metadata);
        assert!(did_id.to_string().contains("did:stellar:"));

        let doc = client.resolve_did(&user);
        assert!(doc.active);
        assert_eq!(doc.controller, user);
    }

    #[test]
    fn test_deactivate_did() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, IdentityRegistry);
        let client = IdentityRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let user = Address::generate(&env);
        let metadata: Map<String, String> = Map::new(&env);
        client.create_did(&user, &metadata);

        assert!(client.has_active_did(&user));
        client.deactivate_did(&user);
        assert!(!client.has_active_did(&user));
    }

    /// resolve_did on a deactivated DID must return DidDeactivated error.
    #[test]
    fn test_resolve_deactivated_did_returns_error() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, IdentityRegistry);
        let client = IdentityRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let user = Address::generate(&env);
        client.create_did(&user, &Map::new(&env));
        client.deactivate_did(&user);

        let result = client.try_resolve_did(&user);
        assert_eq!(result, Err(Ok(ContractError::DidDeactivated)));
    }

    /// resolve_did on a non-existent DID must return DidNotFound error.
    #[test]
    fn test_resolve_nonexistent_did_returns_error() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, IdentityRegistry);
        let client = IdentityRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let user = Address::generate(&env);
        let result = client.try_resolve_did(&user);
        assert_eq!(result, Err(Ok(ContractError::DidNotFound)));
    }

    /// create_did must return MetadataTooLong when a key exceeds 64 chars.
    #[test]
    fn test_create_did_metadata_key_too_long() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, IdentityRegistry);
        let client = IdentityRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let user = Address::generate(&env);
        let mut metadata: Map<String, String> = Map::new(&env);
        // 65-character key
        metadata.set(
            String::from_str(&env, "aaaaaaaaaabbbbbbbbbbccccccccccddddddddddeeeeeeeeeefffff1234567890"),
            String::from_str(&env, "value"),
        );

        let result = client.try_create_did(&user, &metadata);
        assert_eq!(result, Err(Ok(ContractError::MetadataTooLong)));
    }

    /// update_did must return MetadataTooLong when a value exceeds 256 chars.
    #[test]
    fn test_update_did_metadata_value_too_long() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, IdentityRegistry);
        let client = IdentityRegistryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let user = Address::generate(&env);
        client.create_did(&user, &Map::new(&env));

        let mut metadata: Map<String, String> = Map::new(&env);
        // 257-character value
        let long_val = "a".repeat(257);
        metadata.set(
            String::from_str(&env, "key"),
            String::from_str(&env, &long_val),
        );

        let result = client.try_update_did(&user, &metadata);
        assert_eq!(result, Err(Ok(ContractError::MetadataTooLong)));
    }
}
