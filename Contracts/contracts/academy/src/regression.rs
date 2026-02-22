// Regression test for gas/performance optimizations
#[cfg(test)]
mod regression {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, token, Address, Env};

    fn set_timestamp(env: &Env, timestamp: u64) {
        let mut ledger_info = env.ledger().get();
        ledger_info.timestamp = timestamp;
        env.ledger().set(ledger_info);
    }

    #[test]
    fn test_grant_and_claim_regression() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, AcademyVestingContract);
        let client = AcademyVestingContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let governance = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let issuer = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(issuer);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);

        client.init(&admin, &token_id, &governance);
        let grant_id = client.grant_vesting(&admin, &beneficiary, &1000, &0, &0, &1000);

        token_admin.mint(&contract_id, &1000);
        set_timestamp(&env, 1000);
        let _ = client.claim(&grant_id, &beneficiary);
        // If any optimization breaks logic, this will fail
        let schedule = client.get_vesting(&grant_id);
        assert!(schedule.claimed);
    }
}
