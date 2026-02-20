#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short, Vec};
use shared::fees::{FeeManager, FeeError};
use shared::governance::{
    GovernanceManager, GovernanceRole, UpgradeProposal,
};
use shared::oracle::{OracleAggregate, fetch_aggregate_price};
use shared::events::{EventEmitter, TradeExecutedEvent};

/// Version of this contract implementation
const CONTRACT_VERSION: u32 = 1;

/// Trading contract with upgradeability and governance
#[contract]
pub struct UpgradeableTradingContract;

/// Trade record for tracking
#[contracttype]
#[derive(Clone, Debug)]
pub struct Trade {
    pub id: u64,
    pub trader: Address,
    pub pair: Symbol,
    pub amount: i128,
    pub price: i128,
    pub timestamp: u64,
    pub is_buy: bool,
}

/// Batch trade request
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchTradeRequest {
    pub trader: Address,
    pub pair: Symbol,
    pub amount: i128,
    pub price: i128,
    pub is_buy: bool,
    pub fee_token: Address,
    pub fee_amount: i128,
    pub fee_recipient: Address,
}

/// Batch trade result
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchTradeResult {
    pub trade_id: Option<u64>,
    pub success: bool,
    pub error_code: Option<u32>,
}

/// Batch trade operation result
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BatchTradeOperation {
    pub successful_trades: soroban_sdk::Vec<u64>,
    pub failed_trades: soroban_sdk::Vec<BatchTradeResult>,
    pub total_fees_collected: i128,
    pub gas_saved: i128, // Estimated gas savings
}

/// Trading statistics
#[contracttype]
#[derive(Clone, Debug)]
pub struct TradeStats {
    pub total_trades: u64,
    pub total_volume: i128,
    pub last_trade_id: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct OracleConfig {
    pub oracles: Vec<Address>,
    pub max_staleness: u64,
    pub min_sources: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct OracleStatus {
    pub last_pair: Symbol,
    pub last_price: i128,
    pub last_updated_at: u64,
    pub last_source_count: u32,
    pub consecutive_failures: u32,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TradeError {
    Unauthorized = 3001,
    InvalidAmount = 3002,
    ContractPaused = 3003,
    NotInitialized = 3004,
    BatchSizeExceeded = 3005,
    BatchOperationFailed = 3006,
    OracleFailure = 3007,
}

impl From<TradeError> for soroban_sdk::Error {
    fn from(error: TradeError) -> Self {
        soroban_sdk::Error::from_contract_error(error as u32)
    }
}

impl From<&TradeError> for soroban_sdk::Error {
    fn from(error: &TradeError) -> Self {
        soroban_sdk::Error::from_contract_error(*error as u32)
    }
}

impl From<soroban_sdk::Error> for TradeError {
    fn from(_error: soroban_sdk::Error) -> Self {
        TradeError::Unauthorized
    }
}

impl From<FeeError> for TradeError {
    fn from(error: FeeError) -> Self {
        match error {
            FeeError::InsufficientBalance => TradeError::Unauthorized,
            FeeError::InvalidAmount => TradeError::InvalidAmount,
        }
    }
}

#[contractimpl]
impl UpgradeableTradingContract {
    /// Initialize the contract with admin and initial approvers
    pub fn init(
        env: Env,
        admin: Address,
        approvers: soroban_sdk::Vec<Address>,
        executor: Address,
    ) -> Result<(), TradeError> {
        // Check if already initialized
        let init_key = symbol_short!("init");
        if env.storage().persistent().has(&init_key) {
            return Err(TradeError::Unauthorized);
        }

        // Set initialization flag
        env.storage().persistent().set(&init_key, &true);

        // Store roles
        let roles_key = symbol_short!("roles");
        let mut roles = soroban_sdk::Map::new(&env);

        // Set admin role
        roles.set(admin, GovernanceRole::Admin);

        // Set approvers
        for approver in approvers.iter() {
            roles.set(approver, GovernanceRole::Approver);
        }

        // Set executor
        roles.set(executor, GovernanceRole::Executor);

        env.storage().persistent().set(&roles_key, &roles);

        // Initialize stats
        let stats = TradeStats {
            total_trades: 0,
            total_volume: 0,
            last_trade_id: 0,
        };
        let stats_key = symbol_short!("stats");
        env.storage().persistent().set(&stats_key, &stats);

        // Store contract version
        let version_key = symbol_short!("ver");
        env.storage().persistent().set(&version_key, &CONTRACT_VERSION);

        Ok(())
    }

    pub fn set_oracle_config(
        env: Env,
        admin: Address,
        oracles: Vec<Address>,
        max_staleness: u64,
        min_sources: u32,
    ) -> Result<(), TradeError> {
        admin.require_auth();

        let roles_key = symbol_short!("roles");
        let roles: soroban_sdk::Map<Address, GovernanceRole> = env
            .storage()
            .persistent()
            .get(&roles_key)
            .ok_or(TradeError::Unauthorized)?;

        let role = roles
            .get(admin)
            .ok_or(TradeError::Unauthorized)?;

        if role != GovernanceRole::Admin {
            return Err(TradeError::Unauthorized);
        }

        let config = OracleConfig {
            oracles,
            max_staleness,
            min_sources,
        };
        let config_key = symbol_short!("orc_cfg");
        env.storage().persistent().set(&config_key, &config);

        Ok(())
    }

    /// Execute a trade with fee collection
    pub fn trade(
        env: Env,
        trader: Address,
        pair: Symbol,
        amount: i128,
        price: i128,
        is_buy: bool,
        fee_token: Address,
        fee_amount: i128,
        fee_recipient: Address,
    ) -> Result<u64, FeeError> {
        trader.require_auth();

        // Verify not paused
        let paused_key = symbol_short!("pause");
        let is_paused: bool = env
            .storage()
            .persistent()
            .get(&paused_key)
            .unwrap_or(false);

        if is_paused {
            panic!("PAUSED");
        }

        // Collect fee first
        FeeManager::collect_fee(&env, &fee_token, &trader, &fee_recipient, fee_amount)?;

        // Create trade record
        let stats_key = symbol_short!("stats");
        let mut stats: TradeStats = env
            .storage()
            .persistent()
            .get(&stats_key)
            .unwrap_or(TradeStats {
                total_trades: 0,
                total_volume: 0,
                last_trade_id: 0,
            });

        let trade_id = stats.last_trade_id + 1;
        let trade = Trade {
            id: trade_id,
            trader,
            pair,
            amount,
            price,
            timestamp: env.ledger().timestamp(),
            is_buy,
        };

        // Update stats
        stats.total_trades += 1;
        stats.total_volume += amount;
        stats.last_trade_id = trade_id;

        // Store trade
        let trades_key = symbol_short!("trades");
        let mut trades: soroban_sdk::Vec<Trade> = env
            .storage()
            .persistent()
            .get(&trades_key)
            .unwrap_or_else(|| soroban_sdk::Vec::new(&env));

        trades.push_back(trade);

        // Update persistent storage
        env.storage().persistent().set(&trades_key, &trades);
        env.storage().persistent().set(&stats_key, &stats);

        Ok(trade_id)
    }

    /// Execute multiple trades in a single transaction
    pub fn batch_trade(
        env: Env,
        requests: soroban_sdk::Vec<BatchTradeRequest>,
    ) -> Result<BatchTradeOperation, TradeError> {
        // Maximum batch size to prevent resource exhaustion
        const MAX_BATCH_SIZE: u32 = 50;
        
        if requests.len() > MAX_BATCH_SIZE {
            return Err(TradeError::BatchSizeExceeded);
        }

        // Verify not paused
        let paused_key = symbol_short!("pause");
        let is_paused: bool = env
            .storage()
            .persistent()
            .get(&paused_key)
            .unwrap_or(false);

        if is_paused {
            return Err(TradeError::ContractPaused);
        }

        let mut successful_trades = soroban_sdk::Vec::new(&env);
        let mut failed_trades = soroban_sdk::Vec::new(&env);
        let mut total_fees_collected = 0i128;
        let mut total_gas_saved = 0i128;

        // Get current stats
        let stats_key = symbol_short!("stats");
        let mut stats: TradeStats = env
            .storage()
            .persistent()
            .get(&stats_key)
            .unwrap_or(TradeStats {
                total_trades: 0,
                total_volume: 0,
                last_trade_id: 0,
            });

        // Process each trade request
        for (index, request) in requests.iter().enumerate() {
            // Authenticate the trader
            request.trader.require_auth();

            let result = match Self::process_single_trade(
                &env,
                &request,
                &mut stats,
                index as u32,
            ) {
                Ok(trade_id) => {
                    successful_trades.push_back(trade_id);
                    total_fees_collected += request.fee_amount;
                    total_gas_saved += 1000i128; // Estimated gas savings per trade
                    BatchTradeResult {
                        trade_id: Some(trade_id),
                        success: true,
                        error_code: None,
                    }
                }
                Err(error) => BatchTradeResult {
                    trade_id: None,
                    success: false,
                    error_code: Some(error as u32),
                },
            };

            failed_trades.push_back(result);
        }

        // Update stats in storage
        env.storage().persistent().set(&stats_key, &stats);

        Ok(BatchTradeOperation {
            successful_trades,
            failed_trades,
            total_fees_collected,
            gas_saved: total_gas_saved,
        })
    }

    /// Process a single trade within a batch operation
    fn process_single_trade(
        env: &Env,
        request: &BatchTradeRequest,
        stats: &mut TradeStats,
        _batch_index: u32,
    ) -> Result<u64, TradeError> {
        // Validate amount
        if request.amount <= 0 {
            return Err(TradeError::InvalidAmount);
        }

        // Collect fee first
        FeeManager::collect_fee(
            env,
            &request.fee_token,
            &request.trader,
            &request.fee_recipient,
            request.fee_amount,
        )?;

        // Create trade record
        let trade_id = stats.last_trade_id + 1;
        let timestamp = env.ledger().timestamp();
        let trade = Trade {
            id: trade_id,
            trader: request.trader.clone(),
            pair: request.pair.clone(),
            amount: request.amount,
            price: request.price,
            timestamp,
            is_buy: request.is_buy,
        };

        // Update stats
        stats.total_trades += 1;
        stats.total_volume += request.amount;
        stats.last_trade_id = trade_id;

        // Store trade
        let trades_key = symbol_short!("trades");
        let mut trades: soroban_sdk::Vec<Trade> = env
            .storage()
            .persistent()
            .get(&trades_key)
            .unwrap_or_else(|| soroban_sdk::Vec::new(env));

        trades.push_back(trade);
        env.storage().persistent().set(&trades_key, &trades);

        // Emit trade executed event with batch index
        EventEmitter::trade_executed(env, TradeExecutedEvent {
            trade_id,
            trader: request.trader.clone(),
            pair: request.pair.clone(),
            amount: request.amount,
            price: request.price,
            is_buy: request.is_buy,
            fee_amount: request.fee_amount,
            fee_token: request.fee_token.clone(),
            timestamp,
        });

        Ok(trade_id)
    }

    /// Get current contract version
    pub fn get_version(env: Env) -> u32 {
        let version_key = symbol_short!("ver");
        env.storage()
            .persistent()
            .get(&version_key)
            .unwrap_or(0)
    }

    /// Get trading statistics
    pub fn get_stats(env: Env) -> TradeStats {
        let stats_key = symbol_short!("stats");
        env.storage()
            .persistent()
            .get(&stats_key)
            .unwrap_or(TradeStats {
                total_trades: 0,
                total_volume: 0,
                last_trade_id: 0,
            })
    }

    pub fn refresh_oracle_price(env: Env, pair: Symbol) -> Result<OracleAggregate, TradeError> {
        let config_key = symbol_short!("orc_cfg");
        let config: OracleConfig = env
            .storage()
            .persistent()
            .get(&config_key)
            .ok_or(TradeError::NotInitialized)?;

        let aggregate =
            fetch_aggregate_price(&env, &config.oracles, &pair, config.max_staleness, config.min_sources)
                .map_err(|_| TradeError::OracleFailure)?;

        let status_key = symbol_short!("orc_sts");
        let mut status: OracleStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(OracleStatus {
                last_pair: pair.clone(),
                last_price: 0,
                last_updated_at: 0,
                last_source_count: 0,
                consecutive_failures: 0,
            });

        status.last_pair = aggregate.pair.clone();
        status.last_price = aggregate.median_price;
        status.last_updated_at = env.ledger().timestamp();
        status.last_source_count = aggregate.source_count;
        status.consecutive_failures = 0;

        env.storage().persistent().set(&status_key, &status);

        env.events().publish(
            (symbol_short!("orc_upd"),),
            (aggregate.pair.clone(), aggregate.median_price, aggregate.source_count),
        );

        Ok(aggregate)
    }

    pub fn record_oracle_failure(env: Env, pair: Symbol) {
        let status_key = symbol_short!("orc_sts");
        let mut status: OracleStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(OracleStatus {
                last_pair: pair,
                last_price: 0,
                last_updated_at: 0,
                last_source_count: 0,
                consecutive_failures: 0,
            });

        status.consecutive_failures += 1;
        env.storage().persistent().set(&status_key, &status);

        env.events().publish(
            (symbol_short!("orc_fail"),),
            status.consecutive_failures,
        );
    }

    pub fn get_oracle_status(env: Env) -> OracleStatus {
        let status_key = symbol_short!("orc_sts");
        env.storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(OracleStatus {
                last_pair: Symbol::new(&env, "NONE"),
                last_price: 0,
                last_updated_at: 0,
                last_source_count: 0,
                consecutive_failures: 0,
            })
    }

    /// Pause the contract (admin only)
    pub fn pause(env: Env, admin: Address) -> Result<(), TradeError> {
        admin.require_auth();

        // Verify admin role
        let roles_key = symbol_short!("roles");
        let roles: soroban_sdk::Map<Address, GovernanceRole> = env
            .storage()
            .persistent()
            .get(&roles_key)
            .ok_or(TradeError::Unauthorized)?;

        let role = roles
            .get(admin)
            .ok_or(TradeError::Unauthorized)?;

        if role != GovernanceRole::Admin {
            return Err(TradeError::Unauthorized);
        }

        let paused_key = symbol_short!("pause");
        env.storage().persistent().set(&paused_key, &true);

        Ok(())
    }

    /// Unpause the contract (admin only)
    pub fn unpause(env: Env, admin: Address) -> Result<(), TradeError> {
        admin.require_auth();

        let roles_key = symbol_short!("roles");
        let roles: soroban_sdk::Map<Address, GovernanceRole> = env
            .storage()
            .persistent()
            .get(&roles_key)
            .ok_or(TradeError::Unauthorized)?;

        let role = roles
            .get(admin)
            .ok_or(TradeError::Unauthorized)?;

        if role != GovernanceRole::Admin {
            return Err(TradeError::Unauthorized);
        }

        let paused_key = symbol_short!("pause");
        env.storage().persistent().set(&paused_key, &false);

        Ok(())
    }

    /// Propose an upgrade via governance
    pub fn propose_upgrade(
        env: Env,
        admin: Address,
        new_contract_hash: Symbol,
        description: Symbol,
        approvers: soroban_sdk::Vec<Address>,
        approval_threshold: u32,
        timelock_delay: u64,
    ) -> Result<u64, TradeError> {
        admin.require_auth();

        let proposal_result = GovernanceManager::propose_upgrade(
            &env,
            admin,
            new_contract_hash,
            env.current_contract_address(),
            description,
            approval_threshold,
            approvers,
            timelock_delay,
        );

        match proposal_result {
            Ok(id) => Ok(id),
            Err(_) => Err(TradeError::Unauthorized),
        }
    }

    /// Approve an upgrade proposal
    pub fn approve_upgrade(
        env: Env,
        proposal_id: u64,
        approver: Address,
    ) -> Result<(), TradeError> {
        approver.require_auth();

        GovernanceManager::approve_proposal(&env, proposal_id, approver)
            .map_err(|_| TradeError::Unauthorized)
    }

    /// Execute an approved upgrade proposal
    pub fn execute_upgrade(
        env: Env,
        proposal_id: u64,
        executor: Address,
    ) -> Result<(), TradeError> {
        executor.require_auth();

        GovernanceManager::execute_proposal(&env, proposal_id, executor)
            .map_err(|_| TradeError::Unauthorized)
    }

    /// Get upgrade proposal details
    pub fn get_upgrade_proposal(env: Env, proposal_id: u64) -> Result<UpgradeProposal, TradeError> {
        GovernanceManager::get_proposal(&env, proposal_id)
            .map_err(|_| TradeError::Unauthorized)
    }

    /// Reject an upgrade proposal
    pub fn reject_upgrade(
        env: Env,
        proposal_id: u64,
        rejector: Address,
    ) -> Result<(), TradeError> {
        rejector.require_auth();

        GovernanceManager::reject_proposal(&env, proposal_id, rejector)
            .map_err(|_| TradeError::Unauthorized)
    }

    /// Cancel an upgrade proposal (admin only)
    pub fn cancel_upgrade(
        env: Env,
        proposal_id: u64,
        admin: Address,
    ) -> Result<(), TradeError> {
        admin.require_auth();

        GovernanceManager::cancel_proposal(&env, proposal_id, admin)
            .map_err(|_| TradeError::Unauthorized)
    }
}

#[cfg(test)]
mod test;
