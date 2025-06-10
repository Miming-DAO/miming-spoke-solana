//! # Multisig Module
//!
//! This module implements a multisignature (multisig) account management system for Solana programs using the Anchor framework.
//! It provides the ability to create, manage, and update multisig accounts through a proposal and approval process, ensuring
//! that changes to the multisig configuration require consensus among a set of authorized signers.
//!
//! ## Features
//!
//! - **Multisig Account Management:** Define multisig accounts with a customizable name, signing threshold, and a list of signers.
//! - **Proposal System:** Propose changes to the multisig account (such as updating signers or threshold) via proposals.
//! - **Signature Collection:** Collect signatures from authorized signers to approve proposals.
//! - **Approval Workflow:** Only apply changes to the multisig account when the required number of signatures is collected.
//! - **Access Control:** Enforce signer and threshold limits, and prevent unauthorized or duplicate signatures.
//!
//! ## Main Data Structures
//!
//! - [`MultisigSigners`]: Represents an individual signer with a name and public key.
//! - [`Multisig`]: Represents the configuration of a multisig account (name, threshold, signers).
//! - [`MultisigProposalAccount`]: Stores a proposal to update the multisig account, including required signers, collected signatures, and status.
//! - [`MultisigAccount`]: The on-chain account representing the current state of the multisig.
//!
//! ## Instructions
//!
//! - [`MultisigInstructions::initialize`]: Initializes a new multisig account with default values.
//! - [`MultisigInstructions::create_proposal`]: Creates a proposal to update the multisig account's configuration.
//! - [`MultisigInstructions::sign_proposal`]: Allows an authorized signer to sign a pending proposal.
//! - [`MultisigInstructions::approve_proposal`]: Approves and applies a proposal if enough signatures are collected.
//!
//! ## Error Handling
//!
//! Custom error codes are defined in [`MultisigErrorCode`] to handle cases such as exceeding signer or threshold limits,
//! unauthorized or duplicate signatures, and insufficient signatures for approval.
//!
//! ## Constants
//!
//! - `MAX_THRESHOLD`: Maximum allowed threshold for signatures.
//! - `MAX_SIGNERS`: Maximum number of allowed signers.
//!
//! ## Usage
//!
//! 1. **Initialize** a multisig account using `initialize`.
//! 2. **Create a proposal** to update the multisig configuration using `create_proposal`.
//! 3. **Sign the proposal** by collecting signatures from authorized signers using `sign_proposal`.
//! 4. **Approve the proposal** and apply changes when enough signatures are collected using `approve_proposal`.
//!
//! ## Security Considerations
//!
//! - Only authorized signers can sign or approve proposals.
//! - Proposals cannot be modified after being resolved (approved).
//! - All state transitions are validated to prevent unauthorized or duplicate actions.
//!
//! ## Integration
//!
//! This module is designed to be used as part of a larger Solana program, and can be integrated to provide robust
//! multisignature governance or access control for program operations.
use anchor_lang::prelude::*;
use crate::{
    states::{
        constants::{
            DISCRIMINATOR, 
            STRING_LEN, U8_SIZE, U64_SIZE, 
            ENUM_SIZE, VEC_SIZE, 
            PUBKEY_SIZE,
        },
        errors::MultisigErrorCode,
    },
    IdentifierAccount
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct MultisigSigners {
    pub name: String,
    pub pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct Multisig {
    pub name: String,
    pub threshold: u8,
    pub signers: Vec<MultisigSigners>,
}

pub const MAX_THRESHOLD: u8 = 10;
pub const MAX_SIGNERS: usize = 10;

pub const MULTISIG_SIGNERS_SIZE: usize = DISCRIMINATOR +
    // name
    STRING_LEN + 
    // pubkey
    PUBKEY_SIZE; 

pub const MULTISIG_SIZE: usize = DISCRIMINATOR +
    // name
    STRING_LEN + 
    // threshold
    U8_SIZE + 
    // data
    VEC_SIZE + (MAX_SIGNERS * MULTISIG_SIGNERS_SIZE); 

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MultisigProposalStatus {
    Pending,
    Approved,
}

#[account]
pub struct MultisigProposalAccount {
    pub id: u64,
    pub data: Multisig,
    pub required_signers: Vec<Pubkey>,
    pub signers: Vec<Pubkey>,
    pub status: MultisigProposalStatus,
}

impl MultisigProposalAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        // id
        U64_SIZE + 
        // data
        MULTISIG_SIZE + 
        // required_signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  
         // signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) + 
        // status
        ENUM_SIZE; 
}

#[account]
pub struct MultisigAccount {
    pub name: String,
    pub threshold: u8,
    pub signers: Vec<MultisigSigners>,
}

impl MultisigAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        // name
        STRING_LEN + 
        // threshold
        U8_SIZE + 
        // signers
        VEC_SIZE + (MAX_SIGNERS * MULTISIG_SIGNERS_SIZE); 
}

#[derive(Accounts)]
pub struct MultisigInitialization<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(init, payer = signer, space = 8 + IdentifierAccount::LEN, seeds = [b"proposal_identifier"], bump)]
    pub proposal_identifier: Account<'info, IdentifierAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigAccount::LEN,
        seeds = [
            b"multisig"
        ],
        bump
    )]
    pub multisig: Account<'info, MultisigAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MultisigCreateProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    #[account(mut)]
    pub proposal_identifier: Account<'info, IdentifierAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigProposalAccount::LEN,
        seeds = [
            b"proposal", 
            proposal_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub proposal: Account<'info, MultisigProposalAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MultisigSignProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_proposal: Account<'info, MultisigProposalAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MultisigApproveProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_proposal: Account<'info, MultisigProposalAccount>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    pub system_program: Program<'info, System>,
}

pub struct MultisigInstructions;

impl MultisigInstructions {
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
    pub fn initialize(ctx: Context<MultisigInitialization>) -> Result<()> {
        ctx.accounts.proposal_identifier.id = 0;

        let multisig = &mut ctx.accounts.multisig;
        multisig.name = String::from("System");
        multisig.threshold = 0;
        multisig.signers = Vec::new();

        Ok(())
    }

    /// Creates a new multisig proposal with the specified parameters.
    ///
    /// This function performs the following steps:
    /// - Ensures the provided `threshold` does not exceed `MAX_THRESHOLD`.
    /// - Ensures the number of provided `signers` does not exceed `MAX_SIGNERS`.
    /// - Increments the proposal identifier.
    /// - Initializes a new proposal with the given `name`, `threshold`, and `signers`.
    /// - Sets the required signers for the proposal based on the current multisig's signers.
    /// - Sets the proposal status to `Pending`.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required for proposal creation.
    /// * `name` - The name of the new multisig proposal.
    /// * `threshold` - The minimum number of signatures required to approve the proposal.
    /// * `signers` - A vector of `MultisigSigners` representing the signers for the proposal.
    ///
    /// ## Errors
    ///
    /// Returns an error if:
    /// - The `threshold` exceeds `MAX_THRESHOLD`.
    /// - The number of `signers` exceeds `MAX_SIGNERS`.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the proposal is created successfully, otherwise returns an error.
    pub fn create_proposal(
        ctx: Context<MultisigCreateProposal>,
        name: String,
        threshold: u8,
        signers: Vec<MultisigSigners>,
    ) -> Result<()> {
        require!(
            threshold <= MAX_THRESHOLD,
            MultisigErrorCode::ThresholdLimitReached
        );

        require!(
            signers.len() <= MAX_SIGNERS,
            MultisigErrorCode::SignerLimitReached
        );

        let proposal_identifier = &mut ctx.accounts.proposal_identifier;

        let current_multisig = &ctx.accounts.current_multisig;
        let required_signers = current_multisig.signers.iter().map(|d| d.pubkey).collect();

        let proposal = &mut ctx.accounts.proposal;
        proposal.id = proposal_identifier.id;
        proposal.data = Multisig {
            name,
            threshold,
            signers,
        };
        proposal.required_signers = required_signers;
        proposal.signers = Vec::new();
        proposal.status = MultisigProposalStatus::Pending;
        
        proposal_identifier.id += 1;

        Ok(())
    }
        
    /// Signs a multisig proposal by the calling signer.
    ///
    /// This function performs the following checks and actions:
    /// - Ensures the proposal status is `Pending`.
    /// - Verifies that the signer is among the required signers (if any are specified).
    /// - Ensures the signer has not already signed the proposal.
    /// - Adds the signer's public key to the list of signers for the proposal.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required for signing the proposal.
    ///
    /// ## Errors
    ///
    /// Returns an error if:
    /// - The proposal is not in the `Pending` state.
    /// - The signer is not authorized to sign the proposal.
    /// - The signer has already signed the proposal.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the proposal is signed successfully, otherwise returns an error.
    pub fn sign_proposal(ctx: Context<MultisigSignProposal>) -> Result<()> {
        let signer_key = ctx.accounts.signer.key();
        let current_proposal = &mut ctx.accounts.current_proposal;

        require!(
            current_proposal.status == MultisigProposalStatus::Pending,
            MultisigErrorCode::AlreadyResolved
        );

        if current_proposal.required_signers.len() > 0 {
            require!(
                current_proposal.required_signers.contains(&signer_key),
                MultisigErrorCode::UnauthorizedSigner
            );
        }

        if current_proposal.signers.len() > 0 {
            require!(
                !current_proposal.signers.contains(&signer_key),
                MultisigErrorCode::DuplicateSignature
            );
        }

        current_proposal.signers.push(signer_key);

        Ok(())
    }

    /// Approves a multisig proposal if all required signatures have been collected.
    ///
    /// This function performs the following checks and actions:
    /// - Ensures the proposal status is `Pending`.
    /// - Verifies that the signer has already signed the proposal.
    /// - Checks that all required signers have signed the proposal.
    /// - Updates the current multisig account with the proposal's data (name, threshold, signers).
    /// - Sets the proposal status to `Approved`.
    ///
    /// ## Arguments
    ///
    /// * `ctx` - The context containing the accounts required for approving the proposal.
    ///
    /// ## Errors
    ///
    /// Returns an error if:
    /// - The proposal is not in the `Pending` state.
    /// - The signer has not signed the proposal.
    /// - Not all required signers have signed the proposal.
    ///
    /// ## Returns
    ///
    /// Returns `Ok(())` if the proposal is approved successfully, otherwise returns an error.
    pub fn approve_proposal(ctx: Context<MultisigApproveProposal>) -> Result<()> {
        let signer_key = ctx.accounts.signer.key();
        let current_proposal = &mut ctx.accounts.current_proposal;

        require!(
            current_proposal.status == MultisigProposalStatus::Pending,
            MultisigErrorCode::AlreadyResolved
        );

        if current_proposal.signers.len() > 0 {
            require!(
                current_proposal.signers.iter().any(|s| *s == signer_key),
                MultisigErrorCode::UnauthorizedSigner
            );
        }

        let all_signed = current_proposal
            .required_signers
            .iter()
            .all(|req| current_proposal.signers.contains(req));

        require!(all_signed, MultisigErrorCode::InsufficientSignatures);

        let current_multisig = &mut ctx.accounts.current_multisig;
        current_multisig.name = current_proposal.data.name.clone();
        current_multisig.threshold = current_proposal.data.threshold;
        current_multisig.signers = current_proposal.data.signers.clone();

        current_proposal.status = MultisigProposalStatus::Approved;

        Ok(())
    }
}