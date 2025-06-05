use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use crate::{
    constants::{
        DISCRIMINATOR, 
        STRING_LEN, U8_SIZE, U64_SIZE, 
        ENUM_SIZE, VEC_SIZE, 
        PUBKEY_SIZE,
    },
    multisig::{MAX_SIGNERS},
    IdentifierAccount
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Transaction {
    Teleport { 
        token: Pubkey, 
        from: Pubkey, 
        amount: u64 
    },
    Transfer { 
        token: Pubkey, 
        to: Pubkey, 
        amount: u64 
    },
}

pub const TRANSACTION_SIZE: usize = DISCRIMINATOR + 
    PUBKEY_SIZE + 
    PUBKEY_SIZE + 
    U64_SIZE;

pub const LEDGER_SIZE: usize = DISCRIMINATOR + 
    U64_SIZE + // id
    PUBKEY_SIZE + // user
    PUBKEY_SIZE + // token_address
    ENUM_SIZE + TRANSACTION_SIZE + // transaction
    U64_SIZE; // amount

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct Ledger {
    pub id: u64,
    pub user: Pubkey,
    pub token_address: Pubkey,
    pub transaction: Transaction,
    pub amount: i64
}

#[account]
pub struct LedgerAccount {
    pub id: u64,
    pub sol_ledger: Ledger,
    pub miming_ledger: Ledger
}

impl LedgerAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        LEDGER_SIZE + // sol ledger
        LEDGER_SIZE; // miming ledger
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalStatus {
    Pending,
    Approved,
}

#[account]
pub struct ProposalAccount {
    pub id: u64,
    pub transaction: Transaction,
    pub multisig_required_signers: Vec<Pubkey>,
    pub multisig_signers: Vec<Pubkey>,
    pub status: ProposalStatus,
}

impl ProposalAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        U64_SIZE + // id
        ENUM_SIZE + (PUBKEY_SIZE + PUBKEY_SIZE + U64_SIZE) + // transaction
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  // required_signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  // signers
        ENUM_SIZE; // status
}

#[derive(Accounts)]
pub struct Initialization<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(init, payer = signer, space = 8 + IdentifierAccount::LEN, seeds = [b"ledger_identifier"], bump)]
    pub ledger_identifier: Account<'info, IdentifierAccount>,

    pub system_program: Program<'info, System>,
}

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

    #[account(mut)]
    pub ledger_identifier: Account<'info, IdentifierAccount>,

    #[account(
        init_if_needed,
        payer = teleporter,
        space = 8 + LedgerAccount::LEN,
        seeds = [
            b"ledger", 
            ledger_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub ledger: Account<'info, LedgerAccount>,

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

    #[account(mut)]
    pub ledger_identifier: Account<'info, IdentifierAccount>,

    #[account(mut)]
    pub ledger: Account<'info, LedgerAccount>,

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

    let ledger_identifier = &mut ctx.accounts.ledger_identifier;
    ledger_identifier.id += 1;

    let ledger = &mut ctx.accounts.ledger;
    ledger.sol_ledger = Ledger {
        id: ledger_identifier.id,
        user: teleporter.key(),
        token_address: Pubkey::default(),
        transaction: Transaction::Teleport { 
            token: Pubkey::default(), 
            from: teleporter.key(), 
            amount: amount
        },
        amount: amount as i64,
    };
    ledger.miming_ledger = Ledger {
        id: ledger_identifier.id,
        user: teleporter.key(),
        token_address: ctx.accounts.miming_token.key(),
        transaction: Transaction::Teleport { 
            token: ctx.accounts.miming_token.key(), 
            from: teleporter.key(), 
            amount: miming_token_amount 
        },
        amount: miming_token_amount as i64,
    };

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

    let ledger_identifier = &mut ctx.accounts.ledger_identifier;
    ledger_identifier.id += 1;

    let ledger = &mut ctx.accounts.ledger;
    ledger.sol_ledger = Ledger {
        id: ledger_identifier.id,
        user: recipient.key(),
        token_address: Pubkey::default(),
        transaction: Transaction::Transfer { 
            token: Pubkey::default(), 
            to: recipient.key(), 
            amount: amount
        },
        amount: (amount as i64) * -1,
    };
    ledger.miming_ledger = Ledger {
        id: ledger_identifier.id,
        user: recipient.key(),
        token_address: ctx.accounts.miming_token.key(),
        transaction: Transaction::Transfer { 
            token: ctx.accounts.miming_token.key(), 
            to: recipient.key(), 
            amount: miming_token_amount
        },
        amount: (miming_token_amount as i64) * -1,
    };

    Ok(())
}
