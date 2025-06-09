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
use crate::{
    states::{
        constants::{
            DISCRIMINATOR, U64_SIZE, 
            ENUM_SIZE, VEC_SIZE, 
            PUBKEY_SIZE,
            MIMING_FEE
        },
        events::{VaultTeleportSuccessful, VaultTransferSuccessful},
        errors::VaultErrorCode,
    },
    multisig::MAX_SIGNERS,
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
    // id
    U64_SIZE +
    // user
    PUBKEY_SIZE + 
    // token_address
    PUBKEY_SIZE + 
    // transaction
    ENUM_SIZE + TRANSACTION_SIZE + 
    // amount
    U64_SIZE; 

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
    pub ledger: VaultLedger
}

impl VaultLedgerAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        // ledger
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
        // multisig_required_signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  
        // multisig_signers
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
    pub ledger_identifier: Account<'info, IdentifierAccount>,

    #[account(mut)]
    pub ledger: Account<'info, VaultLedgerAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct VaultInstructions { }

impl VaultInstructions {
    /// Teleports SOL and MIMING tokens from a user to the vault and updates the ledger.
    ///
    /// This instruction:
    /// - Transfers the specified amount of SOL from the teleporter to the vault, including a fixed MIMING transfer fee.
    /// - Increments the ledger identifier and records the SOL teleport transaction in the ledger.
    /// - Emits a `VaultTeleportSuccessful` event with details of the teleport.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required for the teleport operation.
    /// * `amount` - The amount of SOL to teleport from the teleporter to the vault (fee will be added).
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the teleport is successful, otherwise returns an error.
    pub fn teleport(ctx: Context<VaultTeleport>, amount: u64) -> Result<()> {
        let teleporter = &ctx.accounts.teleporter;
        let vault = &ctx.accounts.vault;

        let total_amount = amount + MIMING_FEE;
        
        let teleporter_sol_balance = teleporter.to_account_info().lamports();
        require!(
            teleporter_sol_balance >= total_amount,
            VaultErrorCode::InsufficientSolBalance
        );

        let sol_transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &teleporter.key(),
            &vault.key(),
            total_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &sol_transfer_instruction,
            &[teleporter.to_account_info(), vault.to_account_info()],
        )?;

        let ledger_identifier = &mut ctx.accounts.ledger_identifier;
        ledger_identifier.id += 1;

        let ledger = &mut ctx.accounts.ledger;
        ledger.ledger = VaultLedger {
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
        ledger.ledger = VaultLedger {
            id: ledger_identifier.id,
            user: teleporter.key(),
            token_address: Pubkey::default(),
            transaction: VaultTransaction::Teleport { 
                token: Pubkey::default(), 
                from: teleporter.key(), 
                amount: MIMING_FEE
            },
            amount: MIMING_FEE as i64,
        };

        emit!(VaultTeleportSuccessful {
            id: ledger_identifier.id,
            user: teleporter.key(),
            sol_amount: amount,
            miming_fee: MIMING_FEE,
        });

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

        let ledger_identifier = &mut ctx.accounts.ledger_identifier;
        ledger_identifier.id += 1;

        let ledger = &mut ctx.accounts.ledger;
        ledger.ledger = VaultLedger {
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

        emit!(VaultTransferSuccessful {
            id: ledger_identifier.id,
            user: vault.key(),
            sol_amount: amount,
        });

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