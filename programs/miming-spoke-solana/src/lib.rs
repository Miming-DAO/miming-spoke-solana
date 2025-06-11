//! # Miming Spoke Solana Program
//!
//! This Solana program implements a modular system for multisig account management, vault operations, and staking functionalities using the Anchor framework.
//!
//! ## Modules
//!
//! - **multisig**: Provides multisignature account creation, proposal management, and approval workflows.
//! - **vault**: Enables secure token storage, teleportation, and multisig-governed transfer proposals from vaults.
//! - **staking**: Supports staking account freezing and thawing operations.
//! - **states**: Contains shared state definitions and account structures.
//!
//! ## Program Features
//!
//! - **Multisig Account Management**
//!   - Initialize multisig accounts with customizable signers and thresholds.
//!   - Create, sign, and approve proposals for multisig actions.
//!
//! - **Vault Operations**
//!   - Teleport tokens from vaults.
//!   - Create, sign, and execute transfer proposals from vaults, governed by multisig approval.
//!
//! - **Staking Controls**
//!   - Freeze and thaw staking accounts for advanced staking management.
//!
//! - **Identifier Account**
//!   - Provides a simple on-chain account for unique identifier management, useful for indexing or referencing entities.
//!
//! ## Usage
//!
//! Integrate this program into your Solana project to leverage secure multisig workflows, vault-based token management, and advanced staking controls.
//!
//! ---
//!
//! ## License
//!
//! MIT License
//!
//! Copyright (c) 2024
//!
//! Permission is hereby granted, free of charge, to any person obtaining a copy
//! of this software and associated documentation files (the "Software"), to deal
//! in the Software without restriction, including without limitation the rights
//! to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//! copies of the Software, and to permit persons to whom the Software is
//! furnished to do so, subject to the following conditions:
//!
//! The above copyright notice and this permission notice shall be included in all
//! copies or substantial portions of the Software.
//!
//! THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//! IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//! FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//! AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//! LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//! OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//! SOFTWARE.
use anchor_lang::prelude::*;

pub mod multisig;
pub mod staking;
pub mod states;
pub mod vault;

use multisig::*;
use staking::*;
use states::*;
use vault::*;

declare_id!("3e2igyWExmDZmJfRpMRwn5mrM838Fam3AMzPYvttxRT8");

#[program]
/// This module contains the implementation of the Miming Spoke Solana program.
///
/// It defines the functions for interacting with the multisig, vault, and staking functionalities.
pub mod miming_spoke_solana {
    use super::*;

    /// Initializes a new multisig account.
    ///
    /// This function calls the `initialize` function from the `multisig::MultisigInstructions` module
    /// to perform the initialization.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `MultisigInitialization` instruction.
    pub fn multisig_initialize(ctx: Context<MultisigInitialization>) -> Result<()> {
        multisig::MultisigInstructions::initialize(ctx)
    }

    /// Creates a new proposal for a multisig account.
    ///
    /// This function calls the `create_proposal` function from the `multisig::MultisigInstructions` module
    /// to create the proposal.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `MultisigCreateProposal` instruction.
    /// * `name` - The name of the proposal.
    /// * `threshold` - The number of approvals required for the proposal to be executed.
    /// * `signers` - The list of signers for the proposal.
    pub fn multisig_create_proposal(
        ctx: Context<MultisigCreateProposal>,
        name: String,
        threshold: u8,
        signers: Vec<MultisigSigners>,
    ) -> Result<()> {
        multisig::MultisigInstructions::create_proposal(ctx, name, threshold, signers)
    }

    /// Signs a proposal for a multisig account.
    ///
    /// This function calls the `sign_proposal` function from the `multisig::MultisigInstructions` module
    /// to sign the proposal.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `MultisigSignProposal` instruction.
    pub fn multisig_sign_proposal(ctx: Context<MultisigSignProposal>) -> Result<()> {
        multisig::MultisigInstructions::sign_proposal(ctx)
    }

    /// Approves a proposal for a multisig account.
    ///
    /// This function calls the `approve_proposal` function from the `multisig::MultisigInstructions` module
    /// to approve the proposal.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `MultisigApproveProposal` instruction.
    pub fn multisig_approve_proposal(ctx: Context<MultisigApproveProposal>) -> Result<()> {
        multisig::MultisigInstructions::approve_proposal(ctx)
    }

    /// Initializes a new vault account.
    ///
    /// This function calls the `initialize` function from the `vault::VaultInitializationInstructions` module
    /// to perform the initialization.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `VaultInitialization` instruction.
    pub fn vault_initialize(ctx: Context<VaultInitialization>) -> Result<()> {
        vault::VaultInitializationInstructions::initialize(ctx)
    }

    /// Teleports tokens from a vault.
    ///
    /// This function calls the `teleport` function from the `vault::VaultTeleportInstructions` module
    /// to perform the teleportation.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `VaultTeleport` instruction.
    /// * `amount` - The amount of tokens to teleport.
    pub fn vault_teleport(ctx: Context<VaultTeleport>, amount: u64) -> Result<()> {
        vault::VaultTeleportInstructions::teleport(ctx, amount)
    }

    /// Creates a new transfer proposal from a vault.
    ///
    /// This function calls the `create_transfer_proposal` function from the `vault::VaultTransferProposalInstructions` module
    /// to create a proposal for transferring tokens from the vault to a specified recipient.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `VaultCreateTransferProposal` instruction.
    /// * `recipient` - The public key of the recipient who will receive the tokens.
    /// * `amount` - The amount of tokens to be transferred in the proposal.
    pub fn vault_create_transfer_proposal(
        ctx: Context<VaultCreateTransferProposal>,
        recipient: Pubkey,
        amount: u64,
    ) -> Result<()> {
        vault::VaultTransferProposalInstructions::create_transfer_proposal(ctx, recipient, amount)
    }

    /// Signs a transfer proposal from a vault.
    ///
    /// This function calls the `sign_transfer_proposal` function from the `vault::VaultTransferProposalInstructions` module
    /// to sign a transfer proposal for transferring tokens from the vault.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `VaultSignTransferProposal` instruction.
    pub fn vault_sign_transfer_proposal(ctx: Context<VaultSignTransferProposal>) -> Result<()> {
        vault::VaultTransferProposalInstructions::sign_transfer_proposal(ctx)
    }

    // Executes a transfer proposal from a vault.
    ///
    /// This function calls the `execute_transfer_proposal` function from the `vault::VaultTransferProposalInstructions` module
    /// to execute a transfer proposal, transferring tokens from the vault to the specified recipient if the proposal has met the required approvals.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `VaultExecuteTransferProposal` instruction.
    pub fn vault_execute_transfer_proposal(
        ctx: Context<VaultExecuteTransferProposal>,
    ) -> Result<()> {
        vault::VaultTransferProposalInstructions::execute_transfer_proposal(ctx)
    }

    /// Freezes a staking account.
    ///
    /// This function calls the `freeze` function from the `staking::StakingInstructions` module
    /// to freeze the account.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `StakingFreeze` instruction.
    /// * `reference_number` - The reference number for the freeze operation.
    pub fn staking_freeze(ctx: Context<StakingFreeze>, reference_number: String) -> Result<()> {
        staking::StakingInstructions::freeze(ctx, reference_number)
    }

    /// Thaws a staking account.
    ///
    /// This function calls the `thaw` function from the `staking::StakingInstructions` module
    /// to thaw the account.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context for the `StakingThaw` instruction.
    pub fn staking_thaw(ctx: Context<StakingThaw>) -> Result<()> {
        staking::StakingInstructions::thaw(ctx)
    }
}

#[account]
/// Stores a unique identifier for account management.
///
/// The `IdentifierAccount` struct is an on-chain account that holds a single `u64` identifier.
/// This account can be used to track or reference unique entities within the program, such as
/// for indexing, mapping, or associating data with a specific ID.
///
/// ## Fields
///
/// - `id` - A 64-bit unsigned integer representing the unique identifier.
///
/// ## Size
///
/// The total size of the account is defined by `IdentifierAccount::LEN`, which includes
/// the Anchor account discriminator and the size of the `u64` field.
///
/// ## Example
///
/// ```rust
/// let identifier_account = IdentifierAccount { id: 42 };
/// ```
pub struct IdentifierAccount {
    pub id: u64,
}

impl IdentifierAccount {
    pub const LEN: usize = DISCRIMINATOR + U64_SIZE; // id
}
