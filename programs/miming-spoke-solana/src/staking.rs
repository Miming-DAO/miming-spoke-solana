//! # Staking Module
//!
//! This module implements a staking mechanism for SPL tokens on Solana using the Anchor framework.
//! It allows users to freeze and thaw their token accounts as part of a staking process, enforcing a minimum staking amount
//! and tracking staking activity with a registry.
//!
//! ## Features
//!
//! - **Staking Freeze:** Users can freeze their associated token accounts if they meet the minimum staking amount requirement.
//! - **Staking Thaw:** Users can thaw (unfreeze) their token accounts, effectively ending the staking period.
//! - **Minimum Staking Enforcement:** The module enforces a configurable minimum staking amount before allowing freezing.
//! - **Staking Registry:** Each staker has a registry account to track their staking reference ID.
//!
//! ## Main Data Structures
//!
//! - [`StakingConfigAccount`]: Stores the minimum staking amount required to participate in staking.
//! - [`StakingRegistryAccount`]: Tracks a reference ID for each staker, used to identify or associate staking actions.
//!
//! ## Instructions
//!
//! - [`StakingInstructions::freeze`]: Freezes the staker's token account if the minimum staking amount is met and records a reference ID.
//! - [`StakingInstructions::thaw`]: Thaws the staker's token account and clears the reference ID in the registry.
//!
//! ## Error Handling
//!
//! Custom error codes are defined in [`StakingErrorCode`] to handle cases such as insufficient token balance for staking.
//!
//! ## Constants
//!
//! - `StakingConfigAccount::LEN`: The size of the staking configuration account.
//! - `StakingRegistryAccount::LEN`: The size of the staking registry account.
//!
//! ## Usage
//!
//! 1. **Freeze tokens:** Call `freeze` with a reference number to freeze the user's token account for staking.
//! 2. **Thaw tokens:** Call `thaw` to unfreeze the user's token account and clear the staking registry.
//!
//! ## Security Considerations
//!
//! - Only the freeze authority (the staker) can freeze or thaw their token account.
//! - The minimum staking amount is enforced to prevent staking with insufficient tokens.
//! - All account constraints are validated to ensure correct and secure operation.
//!
//! ## Integration
//!
//! This module can be integrated into larger DeFi or staking protocols on Solana to provide basic staking functionality
//! with SPL tokens, leveraging Anchor's security and account management features.
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{freeze_account, thaw_account, FreezeAccount, Mint, ThawAccount, Token, TokenAccount},
};

#[account]
pub struct StakingConfigAccount {
    pub min_staking_amount: u64,
}

impl Default for StakingConfigAccount {
    fn default() -> Self {
        Self {
            min_staking_amount: 10_000,
        }
    }
}

impl StakingConfigAccount {
    pub const SIZE_U64: usize = 8;
    pub const LEN: usize = 8 + Self::SIZE_U64; // min_staking_amount
}

#[account]
pub struct StakingRegistryAccount {
    pub reference_id: String,
}

impl StakingRegistryAccount {
    pub const SIZE_STRING: usize = 8 + 64;
    pub const LEN: usize = 8 + Self::SIZE_STRING; // reference_id
}

#[derive(Accounts)]
pub struct StakingFreeze<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        mut,
        constraint = token.freeze_authority.unwrap() == *staker.key,
    )]
    pub token: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token,
        associated_token::authority = staker,
    )]
    pub staker_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + StakingConfigAccount::LEN,
        seeds = [b"staking_config"],
        bump
    )]
    pub staking_config: Account<'info, StakingConfigAccount>,

    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + StakingRegistryAccount::LEN,
        seeds = [
            b"staking_registry",
            staker.key().as_ref(),
        ],
        bump
    )]
    pub staking_registry: Account<'info, StakingRegistryAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakingThaw<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        mut,
        constraint = token.freeze_authority.unwrap() == *staker.key,
    )]
    pub token: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token,
        associated_token::authority = staker,
    )]
    pub staker_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"staking_config"],
        bump
    )]
    pub staking_config: Account<'info, StakingConfigAccount>,

    #[account(
        mut,
        seeds = [
            b"staking_registry",
            staker.key().as_ref(),
        ],
        bump
    )]
    pub staking_registry: Account<'info, StakingRegistryAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum StakingErrorCode {
    #[msg("Insufficient token balance to stake.")]
    InsufficientStakingBalance,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct StakingInstructions {}

impl StakingInstructions {
    /// Freezes the staker's token account and records a reference identifier in the staking registry.
    ///
    /// This function performs the following actions:
    /// - Checks that the staker's token account balance is greater than the minimum required staking amount.
    /// - Freezes the staker's token account using the SPL Token program.
    /// - Stores the provided reference number in the staking registry for tracking purposes.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required for the freeze operation, including the staker, token account, staking configuration, and staking registry.
    /// * `reference_number` - A string identifier to associate with this staking freeze operation.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the freeze operation is successful, otherwise returns an error.
    pub fn freeze(ctx: Context<StakingFreeze>, reference_number: String) -> Result<()> {
        let user_balance = ctx.accounts.staker_token.amount;
        let min_required = ctx.accounts.staking_config.min_staking_amount;

        require!(
            user_balance > min_required,
            StakingErrorCode::InsufficientStakingBalance
        );

        freeze_account(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.staker_token.to_account_info(),
                mint: ctx.accounts.token.to_account_info(),
                authority: ctx.accounts.staker.to_account_info(),
            },
        ))?;

        let staking_registry = &mut ctx.accounts.staking_registry;
        staking_registry.reference_id = String::from(reference_number);

        Ok(())
    }

    /// Thaws the staker's previously frozen token account and clears the reference identifier in the staking registry.
    ///
    /// This function performs the following actions:
    /// - Unfreezes the staker's token account using the SPL Token program.
    /// - Clears the reference number in the staking registry to indicate the staking freeze has been lifted.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required for the thaw operation, including the staker, token account, and staking registry.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the thaw operation is successful, otherwise returns an error.
    pub fn thaw(ctx: Context<StakingThaw>) -> Result<()> {
        thaw_account(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            ThawAccount {
                account: ctx.accounts.staker_token.to_account_info(),
                mint: ctx.accounts.token.to_account_info(),
                authority: ctx.accounts.staker.to_account_info(),
            },
        ))?;

        let staking_registry = &mut ctx.accounts.staking_registry;
        staking_registry.reference_id = String::from("");

        Ok(())
    }
}
