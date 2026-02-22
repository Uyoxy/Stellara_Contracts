# Feature: Decentralized Oracle Network & Circuit Breakers

## 🔍 Description
This PR addresses issue #183 by implementing a decentralized oracle aggregation layer for the Stellara ecosystem. It introduces medianization logic to filter outliers from multiple price sources and adds circuit breakers to the Trading Contract to prevent execution during extreme volatility.

## 🛠 Changes
- **Added `contracts/shared/src/oracle.rs`**: Implements `fetch_aggregate_price` with median calculation and `check_circuit_breaker`.
- **Modified `contracts/trading/src/lib.rs`**: Integrated circuit breaker check (20% threshold) into `refresh_oracle_price`.
- **Added `ORACLE_NETWORK.md`**: Documentation for the oracle architecture and security parameters.

## 🎯 Key Features
- **Multi-Source Aggregation**: Queries multiple on-chain oracles and calculates the median.
- **Outlier Detection**: Median logic naturally filters out single-source deviations.
- **Circuit Breaker**: Rejects price updates that deviate >20% from the previous price.
- **Staleness Checks**: Ignores price data older than the configured threshold.

## 🧪 Testing
- Verified median calculation with odd and even number of sources.
- Tested circuit breaker rejection on >20% price jumps.
- Tested fallback when individual oracles fail (but `min_sources` is met).

## ✅ Checklist
- [x] Oracle aggregation with medianization
- [x] Circuit breaker implementation
- [x] Integration with Trading Contract
- [x] Documentation added

Closes #183