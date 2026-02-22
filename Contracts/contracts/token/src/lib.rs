#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, Env, Error, IntoVal, String, Symbol, Val, Vec,
};

mod admin;
mod storage;

use storage::{Allowance, TokenMetadata, NftMetadata, SemiFungibleToken};
pub use storage::TokenType;

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    /// Initialize token metadata and admin.
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String, decimals: u32) {
        if storage::has_admin(&env) {
            panic!("Already initialized");
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);
        storage::set_metadata(&env, &TokenMetadata { name, symbol, decimals });
        storage::set_total_supply(&env, 0);
    }

    // --------- Standard token interface ---------
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        storage::get_allowance_amount(&env, &from, &spender)
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        ensure_nonnegative(amount);

        let current_ledger = env.ledger().sequence();
        if expiration_ledger < current_ledger && amount != 0 {
            panic!("Invalid expiration");
        }

        let allowance = Allowance {
            amount,
            expiration_ledger,
        };
        storage::set_allowance(&env, &from, &spender, &allowance);

        env.events().publish(
            (Symbol::new(&env, "approve"), from, spender),
            (amount, expiration_ledger),
        );
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        storage::balance_of(&env, &id)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        ensure_nonnegative(amount);
        require_authorized(&env, &from);

        internal_transfer(&env, &from, &to, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        ensure_nonnegative(amount);
        require_authorized(&env, &from);

        spend_allowance(&env, &from, &spender, amount);
        internal_transfer(&env, &from, &to, amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        ensure_nonnegative(amount);
        require_authorized(&env, &from);

        burn_balance(&env, &from, amount);
        env.events()
            .publish((Symbol::new(&env, "burn"), from), amount);
    }

    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        ensure_nonnegative(amount);
        require_authorized(&env, &from);

        spend_allowance(&env, &from, &spender, amount);
        burn_balance(&env, &from, amount);
        env.events()
            .publish((Symbol::new(&env, "burn"), from), amount);
    }

    pub fn decimals(env: Env) -> u32 {
        storage::get_metadata(&env).decimals
    }

    pub fn name(env: Env) -> String {
        storage::get_metadata(&env).name
    }

    pub fn symbol(env: Env) -> String {
        storage::get_metadata(&env).symbol
    }

    // --------- Admin interface ---------
    pub fn set_admin(env: Env, new_admin: Address) {
        let current_admin = storage::get_admin(&env);
        current_admin.require_auth();
        storage::set_admin(&env, &new_admin);
        env.events().publish(
            (Symbol::new(&env, "set_admin"), current_admin),
            new_admin,
        );
    }

    pub fn admin(env: Env) -> Address {
        storage::get_admin(&env)
    }

    pub fn set_authorized(env: Env, id: Address, authorize: bool) {
        admin::require_admin(&env);
        storage::set_authorized(&env, &id, authorize);
        env.events().publish(
            (Symbol::new(&env, "set_authorized"), id),
            authorize,
        );
    }

    pub fn authorized(env: Env, id: Address) -> bool {
        storage::get_authorized(&env, &id)
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        admin::require_admin(&env);
        ensure_nonnegative(amount);

        let balance = storage::balance_of(&env, &to);
        let new_balance = balance.checked_add(amount).expect("Overflow");
        storage::set_balance(&env, &to, &new_balance);

        let supply = storage::total_supply(&env);
        let new_supply = supply.checked_add(amount).expect("Overflow");
        storage::set_total_supply(&env, new_supply);

        env.events().publish(
            (Symbol::new(&env, "mint"), storage::get_admin(&env), to),
            amount,
        );
    }

    pub fn clawback(env: Env, from: Address, amount: i128) {
        admin::require_admin(&env);
        ensure_nonnegative(amount);

        burn_balance(&env, &from, amount);
        env.events().publish(
            (Symbol::new(&env, "clawback"), storage::get_admin(&env), from),
            amount,
        );
    }

    // --------- Additional helpers ---------
    pub fn total_supply(env: Env) -> i128 {
        storage::total_supply(&env)
    }

    // --------- Advanced Token Interface ---------

    // Token Type Management
    pub fn set_token_type(env: Env, _admin: Address, token_type: TokenType) {
        let current_admin = storage::get_admin(&env);
        current_admin.require_auth();
        
        storage::set_token_type(&env, &token_type);
        
        env.events()
            .publish((Symbol::new(&env, "set_token_type"), current_admin), token_type);
    }

    pub fn get_token_type(env: Env) -> TokenType {
        storage::get_token_type(&env)
    }

    // NFT Functions
    pub fn mint_nft(
        env: Env,
        _admin: Address,
        owner: Address,
        token_id: u128,
        uri: String,
        name: String,
        description: String,
    ) {
        let current_admin = storage::get_admin(&env);
        current_admin.require_auth();
        
        // Ensure token type is NonFungible
        let current_token_type = storage::get_token_type(&env);
        if current_token_type != TokenType::NonFungible {
            panic!("Token type must be NonFungible for NFT operations");
        }
        
        // Check if token already exists
        if storage::get_nft_owner(&env, token_id).is_some() {
            panic!("NFT with this token ID already exists");
        }
        
        // Create NFT metadata
        let metadata = NftMetadata {
            token_id,
            owner: owner.clone(),
            uri,
            name,
            description,
        };
        
        // Store NFT data
        storage::set_nft_owner(&env, token_id, &owner);
        storage::set_nft_metadata(&env, token_id, &metadata);
        
        // Track ownership
        let count = storage::get_owner_token_count(&env, &owner);
        storage::set_owner_token(&env, &owner, count, token_id);
        storage::set_owner_token_count(&env, &owner, count + 1);
        
        env.events()
            .publish((Symbol::new(&env, "mint_nft"), current_admin, owner, token_id), ());
    }

    pub fn transfer_nft(env: Env, from: Address, to: Address, token_id: u128) {
        from.require_auth();
        
        // Verify token exists and belongs to 'from'
        if let Some(current_owner) = storage::get_nft_owner(&env, token_id) {
            if current_owner != from {
                panic!("Sender does not own this NFT");
            }
        } else {
            panic!("NFT does not exist");
        }
        
        // Update ownership
        storage::set_nft_owner(&env, token_id, &to);
        
        // Update the NFT metadata to reflect new owner
        if let Some(mut metadata) = storage::get_nft_metadata(&env, token_id) {
            metadata.owner = to.clone();
            storage::set_nft_metadata(&env, token_id, &metadata);
        }
        
        env.events()
            .publish((Symbol::new(&env, "transfer_nft"), from, to, token_id), ());
    }

    pub fn nft_owner(env: Env, token_id: u128) -> Option<Address> {
        storage::get_nft_owner(&env, token_id)
    }

    pub fn nft_metadata(env: Env, token_id: u128) -> Option<NftMetadata> {
        storage::get_nft_metadata(&env, token_id)
    }

    // Semi-Fungible Token Functions
    pub fn mint_semi_fungible(
        env: Env,
        _admin: Address,
        owner: Address,
        token_id: u128,
        amount: i128,
    ) {
        let current_admin = storage::get_admin(&env);
        current_admin.require_auth();
        
        ensure_nonnegative(amount);
        
        // Ensure token type is SemiFungible
        let current_token_type = storage::get_token_type(&env);
        if current_token_type != TokenType::SemiFungible {
            panic!("Token type must be SemiFungible for semi-fungible token operations");
        }
        
        // Get existing token or create new one
        let mut sft = if let Some(existing) = storage::get_semi_fungible_token(&env, token_id) {
            if existing.owner != owner {
                panic!("Cannot mint to different owner for existing token");
            }
            existing
        } else {
            // Create new semi-fungible token
            SemiFungibleToken {
                token_id,
                balance: 0,
                owner: owner.clone(),
            }
        };
        
        // Increase balance
        sft.balance = sft.balance.checked_add(amount).expect("Overflow");
        
        // Store updated token
        storage::set_semi_fungible_token(&env, token_id, &sft);
        
        env.events()
            .publish((Symbol::new(&env, "mint_semi_fungible"), current_admin, owner, token_id), amount);
    }

    pub fn transfer_semi_fungible(
        env: Env,
        from: Address,
        to: Address,
        token_id: u128,
        amount: i128,
    ) {
        from.require_auth();
        ensure_nonnegative(amount);
        
        // Get the semi-fungible token
        let mut sft = if let Some(token) = storage::get_semi_fungible_token(&env, token_id) {
            if token.owner != from {
                panic!("Sender does not own this semi-fungible token");
            }
            token
        } else {
            panic!("Semi-fungible token does not exist");
        };
        
        if amount > sft.balance {
            panic!("Insufficient balance");
        }
        
        // Update sender's balance
        sft.balance -= amount;
        storage::set_semi_fungible_token(&env, token_id, &sft);
        
        // Handle receiver's balance
        let receiver_sft = if let Some(mut existing) = storage::get_semi_fungible_token(&env, token_id) {
            if existing.owner != to {
                // Different owner - need to create separate record
                SemiFungibleToken {
                    token_id,
                    balance: amount,
                    owner: to.clone(),
                }
            } else {
                existing.balance += amount;
                existing
            }
        } else {
            // First time receiving this token_id
            SemiFungibleToken {
                token_id,
                balance: amount,
                owner: to.clone(),
            }
        };
        
        storage::set_semi_fungible_token(&env, token_id, &receiver_sft);
        
        env.events()
            .publish((Symbol::new(&env, "transfer_semi_fungible"), from, to, token_id), amount);
    }

    pub fn semi_fungible_balance(env: Env, token_id: u128) -> Option<i128> {
        if let Some(sft) = storage::get_semi_fungible_token(&env, token_id) {
            Some(sft.balance)
        } else {
            None
        }
    }

    pub fn semi_fungible_owner(env: Env, token_id: u128) -> Option<Address> {
        if let Some(sft) = storage::get_semi_fungible_token(&env, token_id) {
            Some(sft.owner)
        } else {
            None
        }
    }
}

fn ensure_nonnegative(amount: i128) {
    if amount < 0 {
        panic!("Negative amount");
    }
}

fn require_authorized(env: &Env, id: &Address) {
    if !storage::get_authorized(env, id) {
        panic!("Unauthorized");
    }
}

fn spend_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) {
    let allowance = storage::get_allowance(env, from, spender);
    let current_ledger = env.ledger().sequence();

    let available = if allowance.expiration_ledger < current_ledger {
        0
    } else {
        allowance.amount
    };

    if amount > available {
        panic!("Allowance exceeded");
    }

    let remaining = available.checked_sub(amount).expect("Overflow");
    let updated = Allowance {
        amount: remaining,
        expiration_ledger: allowance.expiration_ledger,
    };
    storage::set_allowance(env, from, spender, &updated);
}

fn burn_balance(env: &Env, from: &Address, amount: i128) {
    let balance = storage::balance_of(env, from);
    if amount > balance {
        panic!("Insufficient balance");
    }

    let new_balance = balance.checked_sub(amount).expect("Overflow");
    storage::set_balance(env, from, &new_balance);

    let supply = storage::total_supply(env);
    let new_supply = supply.checked_sub(amount).expect("Overflow");
    storage::set_total_supply(env, new_supply);
}

fn internal_transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
    if amount == 0 || from == to {
        return;
    }

    let from_balance = storage::balance_of(env, from);
    if amount > from_balance {
        panic!("Insufficient balance");
    }

    let to_balance = storage::balance_of(env, to);

    let new_from = from_balance.checked_sub(amount).expect("Overflow");
    let new_to = to_balance.checked_add(amount).expect("Overflow");

    storage::set_balance(env, from, &new_from);
    storage::set_balance(env, to, &new_to);

    env.events()
        .publish((Symbol::new(env, "transfer"), from, to), amount);

    invoke_transfer_hook(env, from, to, amount);
}

fn invoke_transfer_hook(env: &Env, from: &Address, to: &Address, amount: i128) {
    let func = Symbol::new(env, "on_token_transfer");
    let mut args = Vec::new(env);
    args.push_back(env.current_contract_address().into_val(env));
    args.push_back(from.clone().into_val(env));
    args.push_back(amount.into_val(env));

    let _ = env.try_invoke_contract::<Val, Error>(to, &func, args);
}