# Testing Strategy & Fuzzing Guide

## Overview
This document outlines the enhanced testing strategy for the Academy Vesting Contract, incorporating property-based testing and fuzzing to ensure robustness against edge cases and potential attack vectors.

## 1. Property-Based Testing (Proptest)

We utilize the `proptest` crate to automatically generate thousands of test cases covering a wide range of inputs. This helps identify edge cases that manual testing might miss.

### Key Invariants Verified

1.  **Conservation of Value**: 
    - `0 <= vested_amount <= total_amount`
    - The contract never mints more tokens than granted.

2.  **Monotonicity**:
    - `vested_amount(t + 1) >= vested_amount(t)`
    - Vested tokens never decrease over time (prevents clawback bugs).

3.  **Boundary Conditions**:
    - Before Cliff: `vested == 0`
    - After Duration: `vested == total_amount`
    - Exact boundary checks at `start_time`, `start + cliff`, and `start + duration`.

4.  **Input Validation**:
    - Fuzzing random inputs for `amount`, `start_time`, `cliff`, and `duration` ensures the contract handles extreme values (e.g., 0, max u64) gracefully without panicking.

## 2. Running the Tests

To run the property-based tests, you need to include the `proptest` dependency in your `Cargo.toml`.

```toml
[dev-dependencies]
proptest = "1.0"
```

Run the tests using cargo:

```bash
cargo test --package academy --lib property_tests
```

## 3. Fuzzing Parameters

The current test suite fuzzes the following parameters:

| Parameter | Range | Description |
|-----------|-------|-------------|
| `amount` | 1 to 10^12 | Token amounts (handling large balances) |
| `start_time` | 1000 to 10^9 | Ledger timestamps |
| `cliff` | 1 to 10^6 | Cliff duration in seconds |
| `duration` | cliff to 10^6 | Total vesting duration |
| `time_offset` | 0 to 2*10^9 | Random points in time to check vesting status |

## 4. Integration Scenarios

In addition to unit and property tests, we recommend the following integration scenarios (covered in `src/test.rs`):

1.  **Full Lifecycle**: Grant -> Wait -> Partial Claim -> Wait -> Full Claim.
2.  **Revocation Flow**: Grant -> Wait -> Revoke -> Attempt Claim (should fail).
3.  **Upgrade Compatibility**: Ensure storage layout remains compatible during upgrades.

## 5. Future Improvements

- **Stateful Fuzzing**: Implement state machine testing to verify complex sequences of `grant`, `claim`, and `revoke` operations.
- **Mutation Testing**: Use `cargo-mutants` to verify test suite quality by injecting artificial bugs.

---
*Last Updated: February 2026*