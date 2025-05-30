use crate::contexts::multisig::{
    ApproveMultisigAccounts, CreateMultisigProposalAccounts, InitMultisigIdentifierAccounts,
    SignMultisigProposalAccounts,
};
use crate::errors::MultisigErrorCode;
use crate::states::multisig::{MultisigProposalType, MultisigStatus};
use solana_program::keccak::{hash, Hash};

use anchor_lang::prelude::*;

pub fn generate_uuid_string(signer_key: &Pubkey, unix_timestamp: i64) -> Hash {
    let mut data = Vec::new();
    data.extend_from_slice(signer_key.as_ref());
    data.extend_from_slice(&unix_timestamp.to_le_bytes());

    let hash_result = hash(&data);
    let uuid_bytes = &hash_result.0[..16];

    hash(uuid_bytes)
}

pub fn init_identifiers(ctx: Context<InitMultisigIdentifierAccounts>) -> Result<()> {
    ctx.accounts.proposal_identifier.id = 0;
    ctx.accounts.signature_identifier.id = 0;
    ctx.accounts.member_identifier.id = 0;

    Ok(())
}

pub fn create_proposal(
    ctx: Context<CreateMultisigProposalAccounts>,
    name: String,
    action_type: MultisigProposalType,
    pubkey: Pubkey,
    verify_target_member_id: Option<u64>,
) -> Result<()> {
    if action_type == MultisigProposalType::UnregisterMember {
        require!(
            verify_target_member_id.is_some(),
            MultisigErrorCode::MissingVerifyMemberId
        );

        let verify_target_member = &mut ctx.accounts.verify_target_member;
        match verify_target_member {
            Some(target_member) => {
                require!(
                    target_member.id == verify_target_member_id.unwrap()
                        && target_member.pubkey == pubkey,
                    MultisigErrorCode::UnauthorizedMember
                );
            }
            None => return Err(MultisigErrorCode::MissingVerifyMemberPDA.into()),
        };
    }

    let proposal_identifier = &mut ctx.accounts.proposal_identifier;
    proposal_identifier.id += 1;

    let proposal = &mut ctx.accounts.proposal;
    proposal.id = proposal_identifier.id;
    proposal.name = name;
    proposal.action_type = action_type;
    proposal.pubkey = pubkey;
    proposal.status = MultisigStatus::Pending;

    Ok(())
}

pub fn sign_proposal(
    ctx: Context<SignMultisigProposalAccounts>,
    current_proposal_id: u64,
    verify_signer_member_id: Option<u64>,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    let current_proposal = &mut ctx.accounts.current_proposal;
    require!(
        current_proposal.id == current_proposal_id,
        MultisigErrorCode::ProposalNotFound
    );
    require!(
        current_proposal.status == MultisigStatus::Pending,
        MultisigErrorCode::ProposalAlreadyResolved
    );

    let member_identifier = &mut ctx.accounts.member_identifier;
    if member_identifier.id > 0 {
        require!(
            verify_signer_member_id.is_some(),
            MultisigErrorCode::MissingVerifyMemberId
        );

        let verify_signer_member = &mut ctx.accounts.verify_signer_member;
        match verify_signer_member {
            Some(member) => {
                require!(
                    member.id == verify_signer_member_id.unwrap() && member.pubkey == signer_key,
                    MultisigErrorCode::UnauthorizedMember
                );
            }
            None => return Err(MultisigErrorCode::MissingVerifyMemberPDA.into()),
        };
    }

    let signature_identifier = &mut ctx.accounts.signature_identifier;
    signature_identifier.id += 1;

    let signature = &mut ctx.accounts.signature;
    signature.id = signature_identifier.id;
    signature.proposal_id = current_proposal_id;
    signature.no_required_signers = member_identifier.id;
    signature.no_signatures += if member_identifier.id > 0 { 1 } else { 0 };
    signature.pubkey = signer_key;

    Ok(())
}

pub fn approve_proposal(
    ctx: Context<ApproveMultisigAccounts>,
    current_proposal_id: u64,
    verify_signer_signature_id: u64,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    let current_proposal = &mut ctx.accounts.current_proposal;
    require!(
        current_proposal.id == current_proposal_id,
        MultisigErrorCode::ProposalNotFound
    );
    require!(
        current_proposal.status == MultisigStatus::Pending,
        MultisigErrorCode::CannotApproveResolvedProposal
    );

    let verify_signer_signature = &mut ctx.accounts.verify_signer_signature;
    require!(
        verify_signer_signature.id == verify_signer_signature_id
            && verify_signer_signature.pubkey == signer_key,
        MultisigErrorCode::InvalidSignature
    );
    require!(
        verify_signer_signature.no_required_signers == verify_signer_signature.no_signatures,
        MultisigErrorCode::SignaturesIncomplete
    );

    let member_identifier = &mut ctx.accounts.member_identifier;

    match current_proposal.action_type {
        MultisigProposalType::RegisterMember => {
            member_identifier.id += 1;

            let member = &mut ctx.accounts.member;
            member.id = member_identifier.id;
            member.proposal_id = current_proposal_id;
            member.name = current_proposal.name.clone();
            member.pubkey = current_proposal.pubkey;

            current_proposal.status = MultisigStatus::Approved;
        }
        MultisigProposalType::UnregisterMember => {
            member_identifier.id -= 1;
        }
    };

    Ok(())
}
