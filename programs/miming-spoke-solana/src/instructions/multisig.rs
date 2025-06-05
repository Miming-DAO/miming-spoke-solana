use crate::{
    contexts::multisig::{ApproveProposal, CreateProposal, Initialization, SignProposal},
    errors::MultisigErrorCode,
    states::multisig::{Multisig, ProposalStatus, Signers, MAX_SIGNERS, MAX_THRESHOLD},
};
use anchor_lang::prelude::*;

pub fn initialization(ctx: Context<Initialization>) -> Result<()> {
    ctx.accounts.proposal_identifier.id = 0;

    let multisig = &mut ctx.accounts.multisig;
    multisig.name = String::from("System");
    multisig.threshold = 0;
    multisig.signers = Vec::new();

    Ok(())
}

pub fn create_proposal(
    ctx: Context<CreateProposal>,
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
    proposal.status = ProposalStatus::Pending;

    Ok(())
}

pub fn sign_proposal(ctx: Context<SignProposal>) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();
    let current_proposal = &mut ctx.accounts.current_proposal;

    require!(
        current_proposal.status == ProposalStatus::Pending,
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

pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();
    let current_proposal = &mut ctx.accounts.current_proposal;

    require!(
        current_proposal.status == ProposalStatus::Pending,
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

    current_proposal.status = ProposalStatus::Approved;

    Ok(())
}
