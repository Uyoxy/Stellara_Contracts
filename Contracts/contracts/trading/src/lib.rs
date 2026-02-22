#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short, Vec};
use shared::fees::{FeeManager, FeeError};
use shared::governance::{
    GovernanceManager, GovernanceRole, UpgradeProposal,
};
use shared::oracle::{OracleAggregate, fetch_aggregate_price, check_circuit_breaker};
use shared::events::{EventEmitter, TradeExecutedEvent, FeeCollectedEvent};

mod storage;
use storage::{TradingStorage, OptimizedTradeStats, OptimizedOracleConfig, OptimizedOracleStatus, OptimizedTrade, TradingStorageMigration};

/// Version of this contract implementation
const CONTRACT_VERSION: u32 = 2;

/// Trading contract with upgradeability and governance
#[contract]
pub struct UpgradeableTradingContract;

/// Trade record for tracking (legacy - maintained for backward compatibility)
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

// Re-export optimized types for backward compatibility
pub type TradeStats = OptimizedTradeStats;
pub type OracleConfig = OptimizedOracleConfig;
pub type OracleStatus = OptimizedOracleStatus;

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

// Note: TradeStats, OracleConfig, OracleStatus are now re-exported from storage module

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
        // Check if already initialized using optimized storage
        if TradingStorage::is_initialized(&env) {
            return Err(TradeError::Unauthorized);
        }

        // Set initialization flag
        TradingStorage::set_initialized(&env);

        let mut roles = soroban_sdk::Map::new(&env);
        roles.set(admin.clone(), GovernanceRole::Admin);
        for approver in approvers.iter() {
            roles.set(approver, GovernanceRole::Approver);
        }
        roles.set(executor.clone(), GovernanceRole::Executor);
        TradingStorage::set_roles(&env, &roles);

        let roles_key = symbol_short!("roles");
        env.storage().persistent().set(&roles_key, &roles);

        // Initialize stats in instance storage
        TradingStorage::set_stats(&env, &OptimizedTradeStats::default());

        // Store contract version
        TradingStorage::set_version(&env, CONTRACT_VERSION);

        Ok(())
    }
    
    /// Migrate storage from legacy format (admin only)
    pub fn migrate_storage(env: Env, admin: Address) -> Result<u64, TradeError> {
        admin.require_auth();
        
        // Verify admin role
        if !Self::is_admin(&env, &admin) {
            return Err(TradeError::Unauthorized);
        }
        
        if !TradingStorageMigration::has_legacy_data(&env) {
            return Ok(0);
        }
        
        let migrated = TradingStorageMigration::migrate_from_legacy(&env);
        TradingStorage::set_version(&env, CONTRACT_VERSION);
        
        Ok(migrated)
    }

    pub fn set_oracle_config(
        env: Env,
        admin: Address,
        oracles: Vec<Address>,
        max_staleness: u64,
        min_sources: u32,
    ) -> Result<(), TradeError> {
        admin.require_auth();

        // Verify admin role using optimized storage
        let role = TradingStorage::get_role(&env, &admin)
            .ok_or(TradeError::Unauthorized)?;

        if role != GovernanceRole::Admin {
            return Err(TradeError::Unauthorized);
        }

        // Store in instance storage (cheaper for config data)
        let config = OptimizedOracleConfig {
            oracles,
            max_staleness,
            min_sources,
        };
        TradingStorage::set_oracle_config(&env, &config);

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

        // Verify not paused using optimized storage
        if TradingStorage::is_paused(&env) {
            panic!("PAUSED");
        }

        // Collect fee first
        FeeManager::collect_fee(&env, &fee_token, &trader, &fee_recipient, fee_amount)?;

        // Create trade record with optimized storage
        let trade_id = TradingStorage::increment_trade_stats(&env, amount);
        let trade = OptimizedTrade {
            id: trade_id,
            trader: trader.clone(),
            pair,
            amount,
            price,
            timestamp: env.ledger().timestamp(),
            is_buy,
        };

        // Store trade with optimized individual key
        TradingStorage::set_trade(&env, &trade);

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

        // Verify not paused using optimized storage
        if TradingStorage::is_paused(&env) {
            return Err(TradeError::ContractPaused);
        }

        let mut successful_trades = soroban_sdk::Vec::new(&env);
        let mut failed_trades = soroban_sdk::Vec::new(&env);
        let mut total_fees_collected = 0i128;
        let mut total_gas_saved = 0i128;

        // Get current stats from optimized storage
        let mut stats = TradingStorage::get_stats(&env);

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

        // Update stats in optimized storage
        TradingStorage::set_stats(&env, &stats);

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
        stats: &mut OptimizedTradeStats,
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

        // Emit fee collected event
        EventEmitter::fee_collected(env, FeeCollectedEvent {
            payer: request.trader.clone(),
            recipient: request.fee_recipient.clone(),
            amount: request.fee_amount,
            token: request.fee_token.clone(),
            timestamp: env.ledger().timestamp(),
        });

        // Create trade record with optimized storage
        let trade_id = stats.last_trade_id + 1;
        let timestamp = env.ledger().timestamp();
        let trade = OptimizedTrade {
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

        // Store trade with optimized individual key
        TradingStorage::set_trade(env, &trade);

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
        TradingStorage::get_version(&env)
    }

    /// Get trading statistics
    pub fn get_stats(env: Env) -> OptimizedTradeStats {
        TradingStorage::get_stats(&env)
    }
    
    /// Get trade by ID
    pub fn get_trade(env: Env, trade_id: u64) -> Option<OptimizedTrade> {
        TradingStorage::get_trade(&env, trade_id)
    }
    
    /// Get trades by trader
    pub fn get_trades_by_trader(env: Env, trader: Address) -> soroban_sdk::Vec<OptimizedTrade> {
        TradingStorage::get_trader_trades(&env, &trader)
    }

    pub fn refresh_oracle_price(env: Env, pair: Symbol) -> Result<OracleAggregate, TradeError> {
        let config = TradingStorage::get_oracle_config(&env)
            .ok_or(TradeError::NotInitialized)?;

        let aggregate =
            fetch_aggregate_price(&env, &config.oracles, &pair, config.max_staleness, config.min_sources)
                .map_err(|_| TradeError::OracleFailure)?;

        let mut status = TradingStorage::get_oracle_status(&env);
        
        // Circuit Breaker: Check for extreme volatility (20% threshold)
        if status.last_price > 0 {
            if !check_circuit_breaker(status.last_price, aggregate.median_price, 20) {
                Self::record_oracle_failure(env.clone(), pair.clone());
                return Err(TradeError::OracleFailure);
            }
        }

        status.last_pair = aggregate.pair.clone();
        status.last_price = aggregate.median_price;
        status.last_updated_at = env.ledger().timestamp();
        status.last_source_count = aggregate.source_count;
        status.consecutive_failures = 0;

        TradingStorage::set_oracle_status(&env, &status);

        env.events().publish(
            (symbol_short!("orc_upd"),),
            (aggregate.pair.clone(), aggregate.median_price, aggregate.source_count),
        );

        Ok(aggregate)
    }

    pub fn record_oracle_failure(env: Env, _pair: Symbol) {
        let mut status = TradingStorage::get_oracle_status(&env);
        status.consecutive_failures += 1;
        TradingStorage::set_oracle_status(&env, &status);

        env.events().publish(
            (symbol_short!("orc_fail"),),
            status.consecutive_failures,
        );
    }

    pub fn get_oracle_status(env: Env) -> OptimizedOracleStatus {
        TradingStorage::get_oracle_status(&env)
    }

    /// Pause the contract (admin only)
    pub fn pause(env: Env, admin: Address) -> Result<(), TradeError> {
        admin.require_auth();

        // Verify admin role using optimized storage
        let role = TradingStorage::get_role(&env, &admin)
            .ok_or(TradeError::Unauthorized)?;

        if role != GovernanceRole::Admin {
            return Err(TradeError::Unauthorized);
        }

        TradingStorage::set_paused(&env, true);

        Ok(())
    }

    /// Unpause the contract (admin only)
    pub fn unpause(env: Env, admin: Address) -> Result<(), TradeError> {
        admin.require_auth();

        let role = TradingStorage::get_role(&env, &admin)
            .ok_or(TradeError::Unauthorized)?;

        if role != GovernanceRole::Admin {
            return Err(TradeError::Unauthorized);
        }

        TradingStorage::set_paused(&env, false);

        Ok(())
    }

    pub fn pause_upgrade_governance(env: Env, admin: Address) -> Result<(), TradeError> {
        admin.require_auth();

        GovernanceManager::pause_governance(&env, admin)
            .map_err(|_| TradeError::Unauthorized)
    }

    pub fn resume_upgrade_governance(env: Env, admin: Address) -> Result<(), TradeError> {
        admin.require_auth();

        GovernanceManager::resume_governance(&env, admin)
            .map_err(|_| TradeError::Unauthorized)
    }

    /// Helper: Check if address is admin
    fn is_admin(env: &Env, address: &Address) -> bool {
        TradingStorage::get_role(env, address) == Some(GovernanceRole::Admin)
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
