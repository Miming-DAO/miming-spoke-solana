use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use solana_program::keccak::hash;

#[derive(Accounts)]
pub struct Teleport<'info> {
    #[account(mut)]
    pub teleporter: Signer<'info>,

    /// CHECK: This is the PDA authority for the vault, no need to deserialize
    #[account(
        mut,
        seeds = [b"vault"],
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

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    /// CHECK: This is the PDA authority for the vault, no need to deserialize
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub miming_token: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = miming_token,
        associated_token::authority = recipient,
    )]
    pub recipient_miming_token: Account<'info, TokenAccount>,

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

#[error_code]
pub enum VaultErrorCode {
    #[msg("Insufficient SOL balance.")]
    InsufficientSolBalance,

    #[msg("Insufficient MIMING token balance.")]
    InsufficientMimingBalance,
}

pub fn generate_uuid_string(user: &Pubkey, timestamp: i64) -> String {
    let mut data = Vec::new();
    data.extend_from_slice(user.as_ref());
    data.extend_from_slice(&timestamp.to_le_bytes());

    let hash_result = hash(&data);
    let uuid_bytes = &hash_result.0[..16];

    uuid_bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn teleport(ctx: Context<Teleport>, amount: u64) -> Result<()> {
    let teleporter = &ctx.accounts.teleporter;
    let vault = &ctx.accounts.vault;

    let teleporter_sol_balance = teleporter.to_account_info().lamports();
    require!(
        teleporter_sol_balance >= amount,
        VaultErrorCode::InsufficientSolBalance
    );

    let sol_transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &teleporter.key(),
        &vault.key(),
        amount,
    );
    anchor_lang::solana_program::program::invoke(
        &sol_transfer_instruction,
        &[teleporter.to_account_info(), vault.to_account_info()],
    )?;

    let teleporter_miming_balance = ctx.accounts.teleporter_miming_token.amount;
    require!(
        teleporter_miming_balance > 100u64,
        VaultErrorCode::InsufficientMimingBalance
    );

    let miming_transfer_instruction = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        anchor_spl::token::Transfer {
            from: ctx.accounts.teleporter_miming_token.to_account_info(),
            to: ctx.accounts.vault_miming_token.to_account_info(),
            authority: ctx.accounts.teleporter.to_account_info(),
        },
    );
    let miming_token_amount = 100u64 * 10u64.pow(ctx.accounts.miming_token.decimals as u32);
    anchor_spl::token::transfer(miming_transfer_instruction, miming_token_amount)?;

    Ok(())
}

pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
    let recipient = &ctx.accounts.recipient;
    let vault = &ctx.accounts.vault;

    let vault_sol_balance = vault.to_account_info().lamports();
    require!(
        vault_sol_balance >= amount,
        VaultErrorCode::InsufficientSolBalance
    );

    let sol_transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &vault.key(),
        &recipient.key(),
        amount,
    );
    anchor_lang::solana_program::program::invoke(
        &sol_transfer_instruction,
        &[recipient.to_account_info(), vault.to_account_info()],
    )?;

    let vault_seeds = &[b"vault".as_ref(), &[ctx.bumps.vault]];
    let vault_signer = &[&vault_seeds[..]];

    let miming_transfer_instruction = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        anchor_spl::token::Transfer {
            from: ctx.accounts.vault_miming_token.to_account_info(),
            to: ctx.accounts.recipient_miming_token.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        vault_signer,
    );
    let miming_token_amount = 100u64 * 10u64.pow(ctx.accounts.miming_token.decimals as u32);
    anchor_spl::token::transfer(miming_transfer_instruction, miming_token_amount)?;

    Ok(())
}
