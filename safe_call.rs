#![no_std]
use soroban_sdk::{Env, Address, Symbol, Val, Vec, IntoVal, TryFromVal, Error};

/// Standardized error codes for cross-contract communication
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum CrossContractError {
    Success = 0,
    ExecutionFailed = 9001,
    InvalidReturnType = 9002,
    AccessDenied = 9003,
}

impl IntoVal<Env, Val> for CrossContractError {
    fn into_val(&self, env: &Env) -> Val {
        (*self as u32).into_val(env)
    }
}

impl TryFromVal<Env, Val> for CrossContractError {
    type Error = Error;

    fn try_from_val(_env: &Env, v: &Val) -> Result<Self, Self::Error> {
        let val: u32 = u32::try_from_val(_env, v)?;
        match val {
            0 => Ok(CrossContractError::Success),
            9001 => Ok(CrossContractError::ExecutionFailed),
            9002 => Ok(CrossContractError::InvalidReturnType),
            9003 => Ok(CrossContractError::AccessDenied),
            _ => Err(Error::from_type_and_code(soroban_sdk::xdr::ScErrorType::Context, soroban_sdk::xdr::ScErrorCode::InvalidInput)),
        }
    }
}

/// Safely invokes a function on another contract with standardized error handling.
/// 
/// # Arguments
/// * `env` - The current environment
/// * `contract` - Address of the contract to call
/// * `func` - Symbol name of the function to call
/// * `args` - Vector of arguments
/// 
/// # Returns
/// * `Result<T, CrossContractError>` - The result of the call or a standardized error
pub fn safe_invoke<T>(
    env: &Env,
    contract: &Address,
    func: &Symbol,
    args: Vec<Val>,
) -> Result<T, CrossContractError>
where
    T: TryFromVal<Env, Val>,
{
    // Attempt the cross-contract call
    // try_invoke_contract returns Result<Val, Error>
    // If the called contract panics, this returns Err(Error)
    let res: Result<Val, Error> = env.try_invoke_contract(contract, func, args);

    match res {
        Ok(val) => {
            // Attempt to convert the return value to the expected type
            match T::try_from_val(env, &val) {
                Ok(v) => Ok(v),
                Err(_) => Err(CrossContractError::InvalidReturnType),
            }
        },
        Err(_) => {
            // The called contract failed (panic or error)
            // We propagate this as a standardized ExecutionFailed error
            Err(CrossContractError::ExecutionFailed)
        }
    }
}

/// Emits a standardized cross-contract event
pub fn emit_cross_contract_event(
    env: &Env,
    source: &Address,
    target: &Address,
    action: Symbol,
    data: Val
) {
    let topics = (Symbol::new(env, "cross_call"), source.clone(), target.clone(), action);
    env.events().publish(topics, data);
}