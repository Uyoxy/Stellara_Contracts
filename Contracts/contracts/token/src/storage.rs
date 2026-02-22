use soroban_sdk::{contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug)]
pub struct AllowanceKey {
    pub from: Address,
    pub spender: Address,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Allowance {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TokenType {
    Fungible,
    NonFungible,
    SemiFungible,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct NftMetadata {
    pub token_id: u128,
    pub owner: Address,
    pub uri: String,
    pub name: String,
    pub description: String,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct SemiFungibleToken {
    pub token_id: u128,
    pub balance: i128,
    pub owner: Address,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Metadata,
    TotalSupply,
    Balance(Address),
    Allowance(AllowanceKey),
    Authorized(Address),
    CurrentTokenType, // New key to store the current token type
    NftOwner(u128),  // Maps token_id to owner
    NftMetadata(u128), // Maps token_id to metadata
    SemiFungibleToken(u128), // Maps token_id to semi-fungible token
    TokenUri(u128), // URI for tokens
    TokenName(u128), // Name for tokens
    TokenDescription(u128), // Description for tokens
    OwnerTokenList(Address, u32), // Tracks owned tokens by address (owner, index)
    OwnerTokenCount(Address), // Count of tokens owned by address
}

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("Admin not set")
}

pub fn set_metadata(env: &Env, metadata: &TokenMetadata) {
    env.storage().instance().set(&DataKey::Metadata, metadata);
}

pub fn get_metadata(env: &Env) -> TokenMetadata {
    env.storage()
        .instance()
        .get(&DataKey::Metadata)
        .expect("Metadata not set")
}

pub fn set_total_supply(env: &Env, total: i128) {
    env.storage().instance().set(&DataKey::TotalSupply, &total);
}

pub fn total_supply(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0)
}

pub fn balance_of(env: &Env, id: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(id.clone()))
        .unwrap_or(0)
}

pub fn set_balance(env: &Env, id: &Address, amount: &i128) {
    if *amount == 0 {
        env.storage().persistent().remove(&DataKey::Balance(id.clone()));
    } else {
        env.storage()
            .persistent()
            .set(&DataKey::Balance(id.clone()), amount);
    }
}

pub fn set_allowance(env: &Env, from: &Address, spender: &Address, allowance: &Allowance) {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    env.storage().persistent().set(&key, allowance);
}

pub fn get_allowance(env: &Env, from: &Address, spender: &Address) -> Allowance {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    env.storage().persistent().get(&key).unwrap_or(Allowance {
        amount: 0,
        expiration_ledger: 0,
    })
}

pub fn get_allowance_amount(env: &Env, from: &Address, spender: &Address) -> i128 {
    let allowance = get_allowance(env, from, spender);
    let current_ledger = env.ledger().sequence();
    if allowance.expiration_ledger < current_ledger {
        0
    } else {
        allowance.amount
    }
}

pub fn set_authorized(env: &Env, id: &Address, authorized: bool) {
    env.storage()
        .persistent()
        .set(&DataKey::Authorized(id.clone()), &authorized);
}

pub fn get_authorized(env: &Env, id: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Authorized(id.clone()))
        .unwrap_or(true)
}

// Token Type Management
pub fn set_token_type(env: &Env, token_type: &TokenType) {
    env.storage().instance().set(&DataKey::CurrentTokenType, token_type);
}

pub fn get_token_type(env: &Env) -> TokenType {
    // Default to fungible if not set
    env.storage()
        .instance()
        .get(&DataKey::CurrentTokenType)
        .unwrap_or(TokenType::Fungible)
}

// NFT and Semi-Fungible Token Functions
pub fn set_nft_owner(env: &Env, token_id: u128, owner: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::NftOwner(token_id), owner);
}

pub fn get_nft_owner(env: &Env, token_id: u128) -> Option<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::NftOwner(token_id))
}

pub fn set_nft_metadata(env: &Env, token_id: u128, metadata: &NftMetadata) {
    env.storage()
        .persistent()
        .set(&DataKey::NftMetadata(token_id), metadata);
}

pub fn get_nft_metadata(env: &Env, token_id: u128) -> Option<NftMetadata> {
    env.storage()
        .persistent()
        .get(&DataKey::NftMetadata(token_id))
}

pub fn set_semi_fungible_token(env: &Env, token_id: u128, sft: &SemiFungibleToken) {
    env.storage()
        .persistent()
        .set(&DataKey::SemiFungibleToken(token_id), sft);
}

pub fn get_semi_fungible_token(env: &Env, token_id: u128) -> Option<SemiFungibleToken> {
    env.storage()
        .persistent()
        .get(&DataKey::SemiFungibleToken(token_id))
}

pub fn set_token_uri(env: &Env, token_id: u128, uri: &String) {
    env.storage()
        .persistent()
        .set(&DataKey::TokenUri(token_id), uri);
}

pub fn get_token_uri(env: &Env, token_id: u128) -> Option<String> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenUri(token_id))
}

pub fn set_token_name(env: &Env, token_id: u128, name: &String) {
    env.storage()
        .persistent()
        .set(&DataKey::TokenName(token_id), name);
}

pub fn get_token_name(env: &Env, token_id: u128) -> Option<String> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenName(token_id))
}

pub fn set_token_description(env: &Env, token_id: u128, description: &String) {
    env.storage()
        .persistent()
        .set(&DataKey::TokenDescription(token_id), description);
}

pub fn get_token_description(env: &Env, token_id: u128) -> Option<String> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenDescription(token_id))
}

pub fn set_owner_token(env: &Env, owner: &Address, index: u32, token_id: u128) {
    env.storage()
        .persistent()
        .set(&DataKey::OwnerTokenList(owner.clone(), index), &token_id);
}

pub fn get_owner_token(env: &Env, owner: &Address, index: u32) -> Option<u128> {
    env.storage()
        .persistent()
        .get(&DataKey::OwnerTokenList(owner.clone(), index))
}

pub fn set_owner_token_count(env: &Env, owner: &Address, count: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::OwnerTokenCount(owner.clone()), &count);
}

pub fn get_owner_token_count(env: &Env, owner: &Address) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::OwnerTokenCount(owner.clone()))
        .unwrap_or(0)
}