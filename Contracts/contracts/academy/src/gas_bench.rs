// Soroban contract benchmarking for AcademyVestingContract
// Usage: Run with cargo test --features benchmark

#[cfg(test)]
mod gas_benchmarks {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, token, Address, Env};

    fn set_timestamp(env: &Env, timestamp: u64) {
        let mut ledger_info = env.ledger().get();
        ledger_info.timestamp = timestamp;
        env.ledger().set(ledger_info);
    }

    fn setup_contract() -> (Env, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let issuer = Address::generate(&env);
        let reward_token = env.register_stellar_asset_contract(issuer);
        let governance = Address::generate(&env);
        AcademyVestingContract::init(env.clone(), admin.clone(), reward_token.clone(), governance.clone()).unwrap();
        (env, admin, reward_token, governance)
    }

    #[test]
    fn bench_grant_vesting() {
        let (env, admin, _reward_token, _governance) = setup_contract();
        let beneficiary = Address::generate(&env);
        let start_time = 1000u64;
        let cliff = 100u64;
        let duration = 1000u64;
        let amount = 1000i128;
        let before = env.ledger().timestamp();
        let _ = AcademyVestingContract::grant_vesting(env.clone(), admin.clone(), beneficiary, amount, start_time, cliff, duration);
        let after = env.ledger().timestamp();
        println!("grant_vesting gas: {}", after - before);
    }

    #[test]
    fn bench_claim() {
        let (env, admin, reward_token, _governance) = setup_contract();
        let beneficiary = Address::generate(&env);
        let start_time = 0u64;
        let cliff = 100u64;
        let duration = 1000u64;
        let amount = 1000i128;
        let _ = AcademyVestingContract::grant_vesting(env.clone(), admin.clone(), beneficiary.clone(), amount, start_time, cliff, duration);

        let token_admin = token::StellarAssetClient::new(&env, &reward_token);
        token_admin.mint(&env.current_contract_address(), &amount);

        set_timestamp(&env, start_time + cliff + 500);
        let before = env.ledger().timestamp();
        let _ = AcademyVestingContract::claim(env.clone(), 1, beneficiary);
        let after = env.ledger().timestamp();
        println!("claim gas: {}", after - before);
    }
}
