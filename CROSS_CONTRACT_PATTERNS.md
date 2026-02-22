# Cross-Contract Communication Patterns

## Overview
This document establishes the standardized patterns for secure and efficient communication between Stellara smart contracts. Following these patterns ensures atomicity, proper error propagation, and system-wide consistency.

## 1. The Safe Call Pattern

Direct calls using `env.invoke_contract` can cause the entire transaction to panic if the target contract fails. To handle failures gracefully and maintain state integrity, use the `safe_invoke` wrapper from the `shared` module.

### Usage

```rust
use shared::safe_call::{safe_invoke, CrossContractError};

fn execute_trade(env: Env, dex: Address, token: Address, amount: i128) {
    let args = (token, amount).into_val(&env);
    
    match safe_invoke::<bool>(&env, &dex, &Symbol::new(&env, "swap"), args) {
        Ok(success) => {
            // Handle success
        },
        Err(CrossContractError::ExecutionFailed) => {
            // Handle downstream failure (e.g., revert local state changes)
        },
        Err(e) => {
            // Handle other errors
        }
    }
}
```

### Guarantees
- **Atomicity**: If `safe_invoke` returns an error, the caller can decide whether to rollback its own state or proceed with a fallback logic.
- **Type Safety**: Return values are automatically checked against the expected type `T`.

## 2. Standardized Error Handling

All cross-contract interactions must map internal errors to the standardized `CrossContractError` enum when propagating failures across boundaries.

| Error Code | Name | Description |
|------------|------|-------------|
| `0` | `Success` | Call completed successfully |
| `9001` | `ExecutionFailed` | Target contract panicked or returned an error |
| `9002` | `InvalidReturnType` | Return value did not match expected type |
| `9003` | `AccessDenied` | Caller not authorized to perform action |

## 3. Event Emission Standards

To ensure off-chain indexers can track cross-contract flows, use `emit_cross_contract_event`.

### Structure
- **Topic 1**: `"cross_call"` (Fixed)
- **Topic 2**: `source_contract` (Address)
- **Topic 3**: `target_contract` (Address)
- **Topic 4**: `action` (Symbol, e.g., "mint", "swap")
- **Data**: `Val` (Context specific data)

## 4. Security Considerations

### Reentrancy
While Soroban's current execution model limits reentrancy, always update local state **before** making a cross-contract call (Checks-Effects-Interactions pattern).

```rust
// BAD
safe_invoke(...);
self.balance -= amount;

// GOOD
self.balance -= amount;
if let Err(_) = safe_invoke(...) {
    self.balance += amount; // Rollback if needed, or rely on tx failure
}
```

### Authorization
Never assume the caller is who they claim to be. Always verify `env.require_auth()` or check the `source` address in cross-contract payloads if implementing custom callbacks.

### Resource Limits
Cross-contract calls consume significant gas.
- Limit call depth to 2-3 hops.
- Avoid calls inside loops.
- Pass only necessary data to save bandwidth.

---
*Last Updated: February 2026*