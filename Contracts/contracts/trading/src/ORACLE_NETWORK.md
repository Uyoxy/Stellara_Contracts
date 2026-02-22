# Decentralized Oracle Network

## Overview
The Stellara Oracle Network provides secure, tamper-resistant price feeds by aggregating data from multiple independent on-chain sources. It employs medianization to filter outliers and circuit breakers to halt operations during extreme market volatility.

## Architecture

### 1. Aggregation Logic
The `fetch_aggregate_price` function in the shared library performs the following steps:
1.  **Query**: Iterates through a configured list of oracle provider addresses.
2.  **Filter**: Discards sources that return errors, zero values, or stale timestamps (older than `max_staleness`).
3.  **Validate**: Ensures the number of valid responses meets `min_sources`.
4.  **Medianize**: Sorts the valid prices and selects the median value. This protects against single-source manipulation or "fat finger" errors.

### 2. Circuit Breakers
To protect the protocol from flash crashes or oracle attacks, a circuit breaker is implemented in the Trading Contract.

- **Threshold**: 20% deviation from the last recorded price.
- **Action**: If the new aggregated price deviates by more than 20%, the update is rejected, and a failure is recorded.
- **Recovery**: Requires manual intervention or price stabilization within bounds.

### 3. Fallback Mechanisms
- **Partial Failure**: If some oracles fail but `min_sources` is still met, the system continues to function using the remaining healthy sources.
- **Total Failure**: If valid sources drop below `min_sources`, the price update fails safely, preventing trades based on insufficient data.

## Integration Guide

### Configuring Oracles
Admins can configure the oracle network using `set_oracle_config`:

```rust
client.set_oracle_config(
    &admin,
    &vec![&env, oracle_1, oracle_2, oracle_3], // List of providers
    &300, // max_staleness (5 minutes)
    &2    // min_sources
);
```

### Oracle Interface
External oracle contracts must implement the following method:

```rust
fn get_last_price(env: Env, pair: Symbol) -> (i128, u64);
// Returns: (price, timestamp)
```

## Security Considerations

1.  **Sybil Resistance**: The `oracles` list is managed by governance. Only trusted, independent providers should be added.
2.  **Staleness Checks**: Prevents the use of old prices during network congestion.
3.  **Circuit Breaker**: Prevents the protocol from accepting sudden, massive price swings that could drain liquidity.

---
*Last Updated: February 2026*