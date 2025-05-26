use crate::states::{StakingConfig, StakingRegistry};
use {
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{Mint, Token, TokenAccount},
    },
};

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
