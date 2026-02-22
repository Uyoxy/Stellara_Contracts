#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};
use proptest::prelude::*;

// Helper to setup environment for property tests
fn setup_test() -> (Env, AcademyVestingContractClient<'static>, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token = Address::generate(&env);
    let governance = Address::generate(&env);
    
    let contract_id = env.register_contract(None, AcademyVestingContract);
    let client = AcademyVestingContractClient::new(&env, &contract_id);
    
    // Initialize contract
    // Note: Assuming init signature matches README: init(env, admin, reward_token, governance)
    client.init(&admin, &token, &governance);
    
    (env, client, admin, user, token, governance)
}

proptest! {
    // Test 1: Vested amount conservation and bounds
    // Verifies that vested amount is always between 0 and Total Amount
    // and respects cliff/duration boundaries regardless of time inputs.
    #[test]
    fn test_vesting_bounds_invariant(
        amount in 1..1_000_000_000_000i128,
        start_time in 1000..1_000_000_000u64,
        cliff_duration in 1..1_000_000u64,
        added_duration in 0..1_000_000u64, // duration = cliff + added
        time_check in 0..2_000_000_000u64
    ) {
        // Ensure duration >= cliff
        let total_duration = cliff_duration + added_duration;
        
        let (env, client, admin, user, _, _) = setup_test();
        
        // Set ledger to start time
        env.ledger().set_timestamp(start_time);
        
        let grant_res = client.try_grant_vesting(
            &admin, 
            &user, 
            &amount, 
            &start_time, 
            &cliff_duration, 
            &total_duration
        );
        
        if let Ok(grant_id) = grant_res {
            // Move time to random check point
            // Ensure we don't go back in time before start (though contract should handle it)
            let check_time = if time_check < start_time { start_time } else { time_check };
            env.ledger().set_timestamp(check_time);
            
            let vested = client.get_vested_amount(&grant_id);
            
            // Invariant 1: Vested amount must be non-negative
            prop_assert!(vested >= 0);
            
            // Invariant 2: Vested amount must not exceed total grant amount
            prop_assert!(vested <= amount);
            
            // Invariant 3: Before cliff (start + cliff), vested must be exactly 0
            if check_time < start_time + cliff_duration {
                prop_assert_eq!(vested, 0);
            }
            
            // Invariant 4: After total duration, vested must be exactly Total Amount
            if check_time >= start_time + total_duration {
                prop_assert_eq!(vested, amount);
            }
        }
    }

    // Test 2: Monotonicity
    // Verifies that vested amount never decreases as time moves forward
    #[test]
    fn test_vesting_monotonicity(
        amount in 1..1_000_000_000i128,
        start_time in 1000..1_000_000u64,
        cliff in 100..10_000u64,
        duration_add in 0..100_000u64,
        time_step_1 in 0..50_000u64,
        time_step_2 in 0..50_000u64
    ) {
        let duration = cliff + duration_add;
        let (env, client, admin, user, _, _) = setup_test();
        
        env.ledger().set_timestamp(start_time);
        
        if let Ok(grant_id) = client.try_grant_vesting(&admin, &user, &amount, &start_time, &cliff, &duration) {
            // Time 1
            let t1 = start_time + time_step_1;
            env.ledger().set_timestamp(t1);
            let v1 = client.get_vested_amount(&grant_id);
            
            // Time 2 (must be >= Time 1)
            let t2 = t1 + time_step_2;
            env.ledger().set_timestamp(t2);
            let v2 = client.get_vested_amount(&grant_id);
            
            // Invariant: Vested amount at T2 must be >= Vested amount at T1
            prop_assert!(v2 >= v1);
        }
    }
}