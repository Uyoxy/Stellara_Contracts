use soroban_sdk::{testutils::Address as _, Address, Env};

pub fn random_address(env: &Env) -> Address {
    Address::generate(env)
}
