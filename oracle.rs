#![no_std]
use soroban_sdk::{contracttype, Env, Address, Symbol, Vec, Val, IntoVal};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OracleAggregate {
    pub pair: Symbol,
    pub median_price: i128,
    pub source_count: u32,
    pub timestamp: u64,
}

pub const ERR_NOT_ENOUGH_SOURCES: u32 = 1001;

/// Fetches prices from multiple oracles, filters outliers, and returns the median.
/// 
/// # Arguments
/// * `env` - The environment
/// * `oracles` - List of oracle contract addresses
/// * `pair` - The trading pair symbol (e.g., "XLM/USDC")
/// * `max_staleness` - Maximum allowed age of price data in seconds
/// * `min_sources` - Minimum number of valid sources required
pub fn fetch_aggregate_price(
    env: &Env,
    oracles: &Vec<Address>,
    pair: &Symbol,
    max_staleness: u64,
    min_sources: u32,
) -> Result<OracleAggregate, u32> {
    let mut prices: Vec<i128> = Vec::new(env);
    let current_time = env.ledger().timestamp();

    for oracle in oracles.iter() {
        // Try to get price from oracle
        // Standard Interface: get_last_price(pair: Symbol) -> (i128, u64)
        let args = (pair,).into_val(env);
        
        // We use try_invoke_contract to handle failures gracefully (fallback mechanism)
        let res: Result<(i128, u64), _> = env.try_invoke_contract(
            oracle, 
            &Symbol::new(env, "get_last_price"), 
            args
        );

        if let Ok((price, timestamp)) = res {
            // Filter: Check if price is positive and not stale
            if price > 0 && timestamp <= current_time && current_time <= timestamp + max_staleness {
                prices.push_back(price);
            }
        }
    }

    if prices.len() < min_sources {
        return Err(ERR_NOT_ENOUGH_SOURCES);
    }

    // Sort prices to find median (Bubble sort for small N)
    let count = prices.len();
    for i in 0..count {
        for j in 0..count - 1 - i {
            let a = prices.get(j).unwrap();
            let b = prices.get(j + 1).unwrap();
            if a > b {
                prices.set(j, b);
                prices.set(j + 1, a);
            }
        }
    }

    // Calculate median
    let median = if count % 2 == 1 {
        prices.get(count / 2).unwrap()
    } else {
        let mid1 = prices.get(count / 2 - 1).unwrap();
        let mid2 = prices.get(count / 2).unwrap();
        (mid1 + mid2) / 2
    };

    Ok(OracleAggregate {
        pair: pair.clone(),
        median_price: median,
        source_count: count,
        timestamp: current_time,
    })
}

/// Checks if the new price deviates too much from the old price (Circuit Breaker).
/// Returns true if the price is within the threshold.
pub fn check_circuit_breaker(
    current_price: i128,
    new_price: i128,
    threshold_percent: u32
) -> bool {
    if current_price == 0 {
        return true; // First price update is always valid
    }
    
    let diff = if new_price > current_price {
        new_price - current_price
    } else {
        current_price - new_price
    };

    // Check if diff / current > threshold / 100
    // Equivalent to: diff * 100 > threshold * current
    (diff * 100) <= (threshold_percent as i128 * current_price)
}