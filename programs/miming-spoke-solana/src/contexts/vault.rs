use {
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{Mint, Token, TokenAccount},
    },
};
use solana_program::sysvar;

#[derive(Accounts)]
pub struct Teleport<'info> {
    #[account(mut)]
    pub teleporter: Signer<'info>,

    /// CHECK: This is the PDA authority for the vault, no need to deserialize
    #[account(
        mut,
        seeds = [b"miming_vault"],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub miming_token: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = miming_token,
        associated_token::authority = teleporter,
    )]
    pub teleporter_miming_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = miming_token,
        associated_token::authority = vault,
    )]
    pub vault_miming_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}