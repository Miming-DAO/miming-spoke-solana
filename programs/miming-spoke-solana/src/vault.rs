
//! # Vault Module
//!
//! This module implements a vault system for Solana programs using the Anchor framework. It provides secure SOL custody,
//! teleport (deposit), and multisig-governed transfer operations, along with detailed ledger tracking for all vault activities.
//!
//! ## Features
//!
//! - **Vault Custody:** Securely holds SOL in a program-derived address (PDA) vault account.
//! - **Teleport (Deposit):** Allows users to deposit SOL into the vault, recording each deposit in a ledger with an associated fee.
//! - **Multisig Transfer Proposals:** Enables creation, signing, and execution of transfer proposals, requiring approval from a configurable set of multisig signers.
//! - **Ledger Tracking:** Maintains a detailed ledger of all vault transactions, including deposits and transfers, for auditability.
//! - **Event Emission:** Emits events for all ledger updates to facilitate off-chain tracking and analytics.
//!
//! ## Main Data Structures
//!
//! - [`VaultTransaction`]: Enum representing supported vault transactions (Teleport/Deposit, Transfer).
//! - [`VaultLedger`]: Struct capturing the details of a single vault transaction, including user, type, amount, and fee.
//! - [`VaultLedgerAccount`]: On-chain account storing a vault ledger entry.
//! - [`VaultTransferProposalAccount`]: Stores a multisig transfer proposal, including required signers, collected signatures, and status.
//!
//! ## Instructions
//!
//! - [`VaultTeleportInstructions::teleport`]: Deposits SOL into the vault, records the transaction in the ledger, and charges a fee.
//! - [`VaultTransferProposalInstructions::create_transfer_proposal`]: Creates a new transfer proposal requiring multisig approval.
//! - [`VaultTransferProposalInstructions::sign_transfer_proposal`]: Allows an authorized signer to sign a pending transfer proposal.
//! - [`VaultTransferProposalInstructions::execute_transfer_proposal`]: Executes a transfer from the vault if all required signatures are collected, and records the transaction in the ledger.
//!
//! ## Error Handling
//!
//! Custom error codes are defined in [`VaultErrorCode`] to handle cases such as insufficient SOL balance, unauthorized or duplicate signatures, and proposal status violations.
//!
//! ## Constants
//!
//! - `MIMING_FEE`: Fee charged for teleport (deposit) operations.
//! - `MAX_SIGNERS`: Maximum number of allowed multisig signers (from the multisig module).
//! - Size constants for account serialization (e.g., `DISCRIMINATOR`, `U64_SIZE`, `PUBKEY_SIZE`, etc.).
//!
//! ## Usage
//!
//! 1. **Initialize** the vault and ledger identifier accounts.
//! 2. **Teleport (Deposit)** SOL into the vault using the `teleport` instruction; each deposit is recorded in the ledger.
//! 3. **Create a transfer proposal** specifying the recipient and amount, requiring multisig approval.
//! 4. **Sign the proposal** by collecting signatures from authorized multisig signers.
//! 5. **Execute the proposal** to transfer SOL from the vault to the recipient once all required signatures are collected; the transfer is recorded in the ledger.
//!
//! ## Security Considerations
//!
//! - Only authorized signers can create, sign, or execute transfer proposals.
//! - All SOL transfers from the vault require multisig approval, preventing unauthorized withdrawals.
//! - Teleport (deposit) operations require sufficient user balance and charge a fixed fee.
//! - All ledger entries are immutable and auditable for transparency.
//!
//! ## Integration
//!
//! This module is designed to be integrated into larger Solana programs requiring secure custody, deposit, and multisig-governed transfer of SOL, with full auditability and event-driven tracking.
//!
//! ## Extensibility
//!
//! - The module includes a placeholder for Raydium proxy instructions, allowing future integration with DeFi protocols or additional vault operations.
use anchor_lang::prelude::*;
use crate::{
    states::{
        constants::{
            DISCRIMINATOR, U64_SIZE, 
            ENUM_SIZE, VEC_SIZE, 
            PUBKEY_SIZE,
            MIMING_FEE
        },
        events::VaultLedgerLogEvent,
        errors::VaultErrorCode,
    },
    multisig::{MAX_SIGNERS, MultisigAccount},
    IdentifierAccount
};

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
pub enum VaultTransaction {
    Teleport { from: Pubkey, amount: u64  },
    Transfer { to: Pubkey, amount: u64  },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct VaultLedger {
    pub id: u64,
    pub user: Pubkey,
    pub transaction: VaultTransaction,
    pub amount: i64,
    pub miming_fee: u64
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
    pub signer: Signer<'info>,

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
        payer = signer,
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

pub struct VaultTeleportInstructions;

impl VaultTeleportInstructions {
    /// Teleports SOL from the signer to the vault, records the transaction in the ledger, and emits an event.
    ///
    /// This function performs the following steps:
    /// - Checks that the signer has enough SOL to cover the requested amount plus the `MIMING_FEE`.
    /// - Transfers the total amount (requested amount + fee) from the signer to the vault account.
    /// - Increments the ledger identifier to ensure unique transaction IDs.
    /// - Records the teleport transaction in the ledger, including the user, amount, and fee.
    /// - Emits a `VaultLedgerEvent` with the transaction details.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing all accounts required for the teleport operation, including the signer, vault, ledger, and ledger identifier.
    /// * `amount` - The amount of SOL to teleport (excluding the fee).
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the teleport operation is successful, otherwise returns an error (e.g., if the signer has insufficient balance).
    pub fn teleport(ctx: Context<VaultTeleport>, amount: u64) -> Result<()> {
        let signer = &ctx.accounts.signer;
        let total_amount = amount + MIMING_FEE;
        let signer_sol_balance = signer.to_account_info().lamports();

        require!(
            signer_sol_balance >= total_amount,
            VaultErrorCode::InsufficientSolBalance
        );

        let vault = &ctx.accounts.vault;
        let sol_transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &signer.key(),
            &vault.key(),
            total_amount,
        );

        anchor_lang::solana_program::program::invoke(
            &sol_transfer_instruction,
            &[signer.to_account_info(), vault.to_account_info()],
        )?;

        let ledger_identifier = &mut ctx.accounts.ledger_identifier;
        ledger_identifier.id += 1;

        let ledger = &mut ctx.accounts.ledger;
        ledger.ledger = VaultLedger {
            id: ledger_identifier.id,
            user: signer.key(),
            transaction: VaultTransaction::Teleport { 
                from: signer.key(), 
                amount: amount
            },
            amount: amount as i64,
            miming_fee: MIMING_FEE,
        };

        emit!(VaultLedgerLogEvent {
            id: ledger_identifier.id,
            data: ledger.ledger.clone()
        });

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultTransferProposalStatus {
    Pending,
    Approved,
}

#[account]
pub struct VaultTransferProposalAccount {
    pub id: u64,
    pub transaction: VaultTransaction,
    pub multisig_required_signers: Vec<Pubkey>,
    pub multisig_signers: Vec<Pubkey>,
    pub status: VaultTransferProposalStatus,
}

impl VaultTransferProposalAccount {
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
pub struct VaultCreateTransferProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    #[account(mut)]
    pub transfer_proposal_identifier: Account<'info, IdentifierAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + VaultTransferProposalAccount::LEN,
        seeds = [
            b"transfer_proposal", 
            transfer_proposal_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub transfer_proposal: Account<'info, VaultTransferProposalAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VaultSignTransferProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    #[account(mut)]
    pub current_transfer_proposal: Account<'info, VaultTransferProposalAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VaultExecuteTransferProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    #[account(mut)]
    pub current_transfer_proposal: Account<'info, VaultTransferProposalAccount>,

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

pub struct VaultTransferProposalInstructions;

impl VaultTransferProposalInstructions {
    /// Creates a new transfer proposal within the vault multisig system.
    /// 
    /// This function performs the following actions:
    /// - Increments the transfer proposal identifier.
    /// - Collects the current multisig's required signers.
    /// - Initializes a new transfer proposal with:
    ///   - A unique `id`
    ///   - The specified recipient and amount as a `VaultTransaction::Transfer`
    ///   - The list of required multisig signers
    ///   - An empty list of actual signers
    ///   - Status set to `Pending`
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required to create a transfer proposal.
    /// * `recipient` - The public key of the recipient to receive the transfer.
    /// * `amount` - The amount of lamports to be transferred.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the proposal is created successfully, otherwise returns an error.
    pub fn create_transfer_proposal(ctx: Context<VaultCreateTransferProposal>, recipient: Pubkey, amount: u64) -> Result<()> {
        let transfer_proposal_identifier = &mut ctx.accounts.transfer_proposal_identifier;
        transfer_proposal_identifier.id += 1;

        let current_multisig = &ctx.accounts.current_multisig;
        let multisig_required_signers: Vec<Pubkey> = current_multisig.signers.iter().map(|d| d.pubkey).collect();

        let transfer_proposal = &mut ctx.accounts.transfer_proposal;
        transfer_proposal.id = transfer_proposal_identifier.id;
        transfer_proposal.transaction = VaultTransaction::Transfer { 
            to: recipient, 
            amount: amount 
        };
        transfer_proposal.multisig_required_signers = multisig_required_signers;
        transfer_proposal.multisig_signers = Vec::new();
        transfer_proposal.status = VaultTransferProposalStatus::Pending;

        Ok(())
    }

    /// Signs a transfer proposal within the vault multisig system.
    /// 
    /// This function allows an authorized multisig signer to sign a pending transfer proposal by:
    /// - Verifying the proposal is still in the `Pending` status.
    /// - Ensuring the signer is among the required multisig signers (if any are specified).
    /// - Preventing duplicate signatures from the same signer.
    /// - Appending the signer's public key to the list of actual signers for the proposal.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required to sign the transfer proposal.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the proposal is signed successfully, otherwise returns an error.
    pub fn sign_transfer_proposal(ctx: Context<VaultSignTransferProposal>) -> Result<()> {
        let signer_key = ctx.accounts.signer.key();
        let current_transfer_proposal = &mut ctx.accounts.current_transfer_proposal;

        require!(
            current_transfer_proposal.status == VaultTransferProposalStatus::Pending,
            VaultErrorCode::AlreadyResolved
        );

        if current_transfer_proposal.multisig_required_signers.len() > 0 {
            require!(
                current_transfer_proposal.multisig_required_signers.contains(&signer_key),
                VaultErrorCode::UnauthorizedSigner
            );
        }

        if current_transfer_proposal.multisig_signers.len() > 0 {
            require!(
                !current_transfer_proposal.multisig_signers.contains(&signer_key),
                VaultErrorCode::DuplicateSignature
            );
        }

        current_transfer_proposal.multisig_signers.push(signer_key);

        Ok(())
    }

    /// Executes a transfer proposal within the vault multisig system.
    /// 
    /// This function performs the following actions:
    /// - Verifies that the transfer proposal is still in the `Pending` status.
    /// - Ensures the executing signer is among the required multisig signers (if any are specified).
    /// - Checks that all required multisig signers have signed the proposal.
    /// - Validates that the vault has sufficient SOL balance for the transfer.
    /// - Executes the SOL transfer from the vault to the specified recipient.
    /// - Increments the ledger identifier and records the transaction in the vault ledger.
    /// - Emits a `VaultLedgerEvent` with the details of the executed transaction.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required to execute the transfer proposal.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the transfer is executed successfully, otherwise returns an error.
    pub fn execute_transfer_proposal(ctx: Context<VaultExecuteTransferProposal>) -> Result<()> {
        let signer_key = ctx.accounts.signer.key();
        let current_transfer_proposal = &mut ctx.accounts.current_transfer_proposal;

        require!(
            current_transfer_proposal.status == VaultTransferProposalStatus::Pending,
            VaultErrorCode::AlreadyResolved
        );

        if current_transfer_proposal.multisig_required_signers.len() > 0 {
            require!(
                current_transfer_proposal.multisig_required_signers.contains(&signer_key),
                VaultErrorCode::UnauthorizedSigner
            );
        }

        let all_signed = current_transfer_proposal
            .multisig_required_signers
            .iter()
            .all(|req| current_transfer_proposal.multisig_signers.contains(req));

        require!(all_signed, VaultErrorCode::InsufficientSignatures);

        if let VaultTransaction::Transfer { to, amount } = current_transfer_proposal.transaction {
            let vault = &ctx.accounts.vault;
            let vault_sol_balance = vault.to_account_info().lamports();

            require!(
                vault_sol_balance >= amount,
                VaultErrorCode::InsufficientSolBalance
            );

            let sol_transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
                &vault.key(),
                &to,
                amount,
            );

            anchor_lang::solana_program::program::invoke(
                &sol_transfer_instruction,
                &[vault.to_account_info()],
            )?;

            let ledger_identifier = &mut ctx.accounts.ledger_identifier;
            ledger_identifier.id += 1;

            let ledger = &mut ctx.accounts.ledger;
            ledger.ledger = VaultLedger {
                id: ledger_identifier.id,
                user: vault.key(),
                transaction: VaultTransaction::Transfer { 
                    to: to, 
                    amount: amount
                },
                amount: (amount as i64) * -1,
                miming_fee: 0, 
            };

            emit!(VaultLedgerLogEvent {
                id: ledger_identifier.id,
                data: ledger.ledger.clone()
            });
        }

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