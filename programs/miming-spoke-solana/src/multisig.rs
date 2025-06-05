use anchor_lang::prelude::*;
use crate::{
    constants::{
        DISCRIMINATOR, 
        STRING_LEN, U8_SIZE, U64_SIZE, 
        ENUM_SIZE, VEC_SIZE, 
        PUBKEY_SIZE,
    },
    IdentifierAccount
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct Signers {
    pub name: String,
    pub pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct Multisig {
    pub name: String,
    pub threshold: u8,
    pub signers: Vec<Signers>,
}

pub const MAX_THRESHOLD: u8 = 10;
pub const MAX_SIGNERS: usize = 10;

pub const MULTISIG_SIGNERS_SIZE: usize = DISCRIMINATOR +
    STRING_LEN + // name
    PUBKEY_SIZE; // pubkey

pub const MULTISIG_SIZE: usize = DISCRIMINATOR +
    STRING_LEN + // name
    U8_SIZE + // threshold
    VEC_SIZE + (MAX_SIGNERS * MULTISIG_SIGNERS_SIZE); // data

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
        U64_SIZE + // id
        MULTISIG_SIZE + // data
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  // required_signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  // signers
        ENUM_SIZE; // status
}

#[account]
pub struct MultisigAccount {
    pub name: String,
    pub threshold: u8,
    pub signers: Vec<Signers>,
}

impl MultisigAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        STRING_LEN + // name
        U8_SIZE + // threshold
        VEC_SIZE + (MAX_SIGNERS * MULTISIG_SIGNERS_SIZE); // signers
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

#[error_code]
pub enum MultisigErrorCode {
    #[msg("The maximum threshold for this proposal has been reached.")]
    ThresholdLimitReached,

    #[msg("The maximum number of allowed signers has been reached.")]
    SignerLimitReached,

    #[msg("The proposal has already been resolved and cannot be modified.")]
    AlreadyResolved,

    #[msg("The provided public key is not authorized as a signer.")]
    UnauthorizedSigner,

    #[msg("The provided public key is not recognized as a member.")]
    UnauthorizedMember,

    #[msg("This public key has already submitted a signature.")]
    DuplicateSignature,

    #[msg("The required number of signatures has not yet been collected.")]
    InsufficientSignatures,
}

pub fn initialize(ctx: Context<MultisigInitialization>) -> Result<()> {
    ctx.accounts.proposal_identifier.id = 0;

    let multisig = &mut ctx.accounts.multisig;
    multisig.name = String::from("System");
    multisig.threshold = 0;
    multisig.signers = Vec::new();

    Ok(())
}

pub fn create_proposal(
    ctx: Context<MultisigCreateProposal>,
    name: String,
    threshold: u8,
    signers: Vec<Signers>,
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
    proposal_identifier.id += 1;

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

    Ok(())
}

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
