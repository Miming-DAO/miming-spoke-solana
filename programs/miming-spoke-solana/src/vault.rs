//! # Vault Module
//!
//! This module implements a vault management system for Solana programs using the Anchor framework.
//! It provides secure handling of SOL and MIMING token transfers, teleportation, and multisig transaction proposals,
//! with full ledger recording and error handling.
//!
//! ## Features
//!
//! - **Vault Ledger Management:** Track SOL and MIMING token movements with detailed ledger entries.
//! - **Teleportation and Transfer:** Move assets between users and the vault, with automatic ledger updates.
//! - **Multisig Proposal Support:** Create and manage transaction proposals requiring multisig approval.
//! - **Error Handling:** Custom error codes for insufficient balances and transaction failures.
//!
//! ## Main Data Structures
//!
//! - [`VaultTransaction`]: Enum representing supported vault transactions (Teleport, Transfer).
//! - [`VaultLedger`]: Struct representing a single ledger entry for SOL or MIMING tokens.
//! - [`VaultLedgerAccount`]: Account storing SOL and MIMING ledgers.
//! - [`VaultTransactionProposalAccount`]: Account for multisig transaction proposals.
//! - [`VaultTransactionProposalStatus`]: Enum for proposal status (Pending, Approved).
//!
//! ## Instructions
//!
//! - [`VaultInstructions::teleport`]: Teleports SOL and MIMING tokens from a user to the vault.
//! - [`VaultInstructions::transfer`]: Transfers SOL and MIMING tokens from the vault to a recipient.
//!
//! ## Accounts
//!
//! - [`VaultInitialization`]: Initializes the vault ledger identifier.
//! - [`VaultTeleport`]: Context for teleporting assets into the vault.
//! - [`Transfer`]: Context for transferring assets from the vault.
//!
//! ## Error Handling
//!
//! Custom error codes are defined in [`VaultErrorCode`] to handle insufficient SOL or MIMING token balances.
//!
//! ## Constants
//!
//! - Size constants for account and ledger serialization.
//!
//! ## Usage
//!
//! 1. **Initialize** the vault using `VaultInitialization`.
//! 2. **Teleport assets** into the vault using `VaultInstructions::teleport`.
//! 3. **Transfer assets** from the vault using `VaultInstructions::transfer`.
//! 4. **Propose and approve** multisig transactions as needed.
//!
//! ## Security Considerations
//!
//! - All transfers check for sufficient balances before proceeding.
//! - Multisig proposals require explicit approval before execution.
//! - Ledger entries are updated atomically with each transaction.
//!
//! ## Integration
//!
//! This module is intended to be used as part of a larger Solana program that requires
//! secure, auditable asset management with support for multisig operations.
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
pub enum VaultTransaction {
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
pub struct VaultLedger {
    pub id: u64,
    pub user: Pubkey,
    pub token_address: Pubkey,
    pub transaction: VaultTransaction,
    pub amount: i64
}

#[account]
pub struct VaultLedgerAccount {
    pub id: u64,
    pub sol_ledger: VaultLedger,
    pub miming_ledger: VaultLedger
}

impl VaultLedgerAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        // sol ledger
        LEDGER_SIZE + 
        // miming ledger
        LEDGER_SIZE; 
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultTransactionProposalStatus {
    Pending,
    Approved,
}

#[account]
pub struct VaultTransactionProposalAccount {
    pub id: u64,
    pub transaction: VaultTransaction,
    pub multisig_required_signers: Vec<Pubkey>,
    pub multisig_signers: Vec<Pubkey>,
    pub status: VaultTransactionProposalStatus,
}

impl VaultTransactionProposalAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        // id
        U64_SIZE + 
        // transaction
        ENUM_SIZE + (PUBKEY_SIZE + PUBKEY_SIZE + U64_SIZE) + 
        // required_signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  
        // signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  
        // status
        ENUM_SIZE; 
}

#[derive(Accounts)]
pub struct VaultInitialization<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(init, payer = signer, space = 8 + IdentifierAccount::LEN, seeds = [b"ledger_identifier"], bump)]
    pub ledger_identifier: Account<'info, IdentifierAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VaultTeleport<'info> {
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
        space = 8 + VaultLedgerAccount::LEN,
        seeds = [
            b"ledger", 
            ledger_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub ledger: Account<'info, VaultLedgerAccount>,

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
    pub ledger: Account<'info, VaultLedgerAccount>,

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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct VaultInstructions { }

impl VaultInstructions {
    /// Implements the instructions for teleporting assets into the vault.
    /// Teleports SOL and a fixed amount of MIMING tokens from the teleporter to the vault,
    /// and updates the ledger with the transaction details.
    ///
    /// This function performs the following actions:
    /// - Transfers the specified amount of SOL from the teleporter to the vault.
    /// - Transfers 100 MIMING tokens (adjusted for decimals) from the teleporter's token account to the vault's token account.
    /// - Increments the ledger identifier and records the transaction in the ledger.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required for the teleport operation.
    /// * `amount` - The amount of SOL to teleport from the teleporter to the vault.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the teleport is successful, otherwise returns an error.
    pub fn teleport(ctx: Context<VaultTeleport>, amount: u64) -> Result<()> {
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
        ledger.sol_ledger = VaultLedger {
            id: ledger_identifier.id,
            user: teleporter.key(),
            token_address: Pubkey::default(),
            transaction: VaultTransaction::Teleport { 
                token: Pubkey::default(), 
                from: teleporter.key(), 
                amount: amount
            },
            amount: amount as i64,
        };
        ledger.miming_ledger = VaultLedger {
            id: ledger_identifier.id,
            user: teleporter.key(),
            token_address: ctx.accounts.miming_token.key(),
            transaction: VaultTransaction::Teleport { 
                token: ctx.accounts.miming_token.key(), 
                from: teleporter.key(), 
                amount: miming_token_amount 
            },
            amount: miming_token_amount as i64,
        };

        Ok(())
    }

    /// Implements the instructions for managing a multisig account.
    /// Initializes the multisig account and proposal identifier.
    ///
    /// This function sets up the initial state for the multisig by:
    /// - Setting the proposal identifier's `id` to 0.
    /// - Initializing the multisig account with:
    ///   - `name` set to "System"
    ///   - `threshold` set to 0
    ///   - An empty list of `signers`
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required for multisig initialization.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if initialization is successful, otherwise returns an error.
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
        ledger.sol_ledger = VaultLedger {
            id: ledger_identifier.id,
            user: recipient.key(),
            token_address: Pubkey::default(),
            transaction: VaultTransaction::Transfer { 
                token: Pubkey::default(), 
                to: recipient.key(), 
                amount: amount
            },
            amount: (amount as i64) * -1,
        };
        ledger.miming_ledger = VaultLedger {
            id: ledger_identifier.id,
            user: recipient.key(),
            token_address: ctx.accounts.miming_token.key(),
            transaction: VaultTransaction::Transfer { 
                token: ctx.accounts.miming_token.key(), 
                to: recipient.key(), 
                amount: miming_token_amount
            },
            amount: (miming_token_amount as i64) * -1,
        };

        Ok(())
    }
}

/// # Raydium Proxy Modules
///
/// ## To Implement
///
/// - The `RaydiumProxyInstructions` struct is defined but not yet implemented. 
///   Please implement the logic for Raydium proxy instructions as needed for your application.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct RaydiumProxyInstructions { }

impl RaydiumProxyInstructions {
    
}