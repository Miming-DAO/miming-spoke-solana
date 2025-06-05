use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{freeze_account, thaw_account, FreezeAccount, Mint, ThawAccount, Token, TokenAccount},
};

#[account]
pub struct StakingConfig {
    pub min_staking_amount: u64,
}

impl Default for StakingConfig {
    fn default() -> Self {
        Self {
            min_staking_amount: 10_000,
        }
    }
}

impl StakingConfig {
    pub const SIZE_U64: usize = 8;
    pub const LEN: usize = 8 + Self::SIZE_U64; // min_staking_amount
}

#[account]
pub struct StakingRegistry {
    pub reference_id: String,
}

impl StakingRegistry {
    pub const SIZE_STRING: usize = 8 + 64;
    pub const LEN: usize = 8 + Self::SIZE_STRING; // reference_id
}

#[derive(Accounts)]
pub struct Freeze<'info> {
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
        space = 8 + StakingConfig::LEN,
        seeds = [b"miming_staking_config"],
        bump
    )]
    pub staking_config: Account<'info, StakingConfig>,

    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + StakingRegistry::LEN,
        seeds = [
            b"miming_staking_registry",
            staker.key().as_ref(),
        ],
        bump
    )]
    pub staking_registry: Account<'info, StakingRegistry>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Thaw<'info> {
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
        seeds = [b"miming_staking_config"],
        bump
    )]
    pub staking_config: Account<'info, StakingConfig>,

    #[account(
        mut,
        seeds = [
            b"miming_staking_registry",
            staker.key().as_ref(),
        ],
        bump
    )]
    pub staking_registry: Account<'info, StakingRegistry>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum StakingErrorCode {
    #[msg("Insufficient token balance to stake.")]
    InsufficientStakingBalance,
}

pub fn freeze(ctx: Context<Freeze>, reference_number: String) -> Result<()> {
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

pub fn thaw(ctx: Context<Thaw>) -> Result<()> {
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
