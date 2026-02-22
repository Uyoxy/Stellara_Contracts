use soroban_sdk::{contracterror, contracttype, Address, Env, Symbol, Val, Vec, IntoVal, FromVal};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum OracleError {
    CallFailed = 4001,
    InvalidPrice = 4002,
    StalePrice = 4003,
    InsufficientSources = 4004,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct OracleSample {
    pub source: Address,
    pub price: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct OracleAggregate {
    pub pair: Symbol,
    pub median_price: i128,
    pub source_count: u32,
    pub latest_timestamp: u64,
}

pub fn fetch_aggregate_price(
    env: &Env,
    oracles: &Vec<Address>,
    pair: &Symbol,
    max_staleness: u64,
    min_sources: u32,
) -> Result<OracleAggregate, OracleError> {
    let mut samples: Vec<OracleSample> = Vec::new(env);
    let now = env.ledger().timestamp();

    let func = Symbol::new(env, "get_price");

    for oracle in oracles.iter() {
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(pair.into_val(env));

        let res = env.try_invoke_contract::<Val, soroban_sdk::Error>(&oracle, &func, args);

        if let Ok(Ok(val)) = res {
            let decoded: Result<(i128, u64), soroban_sdk::Error> =
                FromVal::from_val(env, &val);

            if let Ok((price, timestamp)) = decoded {
                if price <= 0 {
                    continue;
                }

                if timestamp > now {
                    continue;
                }

                if max_staleness > 0 && now.saturating_sub(timestamp) > max_staleness {
                    continue;
                }

                let sample = OracleSample {
                    source: oracle.clone(),
                    price,
                    timestamp,
                };

                samples.push_back(sample);
            }
        }
    }

    let count = samples.len();
    if count < min_sources || count == 0 {
        return Err(OracleError::InsufficientSources);
    }

    let mut prices: Vec<i128> = Vec::new(env);
    let mut latest_timestamp: u64 = 0;

    for sample in samples.iter() {
        prices.push_back(sample.price);
        if sample.timestamp > latest_timestamp {
            latest_timestamp = sample.timestamp;
        }
    }

    let len = prices.len();
    let mut i: u32 = 0;
    while i < len {
        let mut j: u32 = i + 1;
        while j < len {
            let a = prices.get(i).unwrap();
            let b = prices.get(j).unwrap();
            if a > b {
                prices.set(i, b);
                prices.set(j, a);
            }
            j += 1;
        }
        i += 1;
    }

    let middle = len / 2;
    let median_price = if len % 2 == 1 {
        prices.get(middle).unwrap()
    } else {
        let a = prices.get(middle - 1).unwrap();
        let b = prices.get(middle).unwrap();
        (a + b) / 2
    };

    Ok(OracleAggregate {
        pair: pair.clone(),
        median_price,
        source_count: len,
        latest_timestamp,
    })
}
