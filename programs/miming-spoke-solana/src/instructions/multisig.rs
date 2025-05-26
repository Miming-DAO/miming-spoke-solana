use crate::contexts::multisig::{NewMultisig, SetMultisig};
use crate::errors::MultisigErrorCode;
use crate::states::multisig::{
    MultisigMember, MultisigProposal, MultisigProposalType, MultisigRegistry, MultisigStatus,
};
use anchor_lang::prelude::*;
use solana_program::keccak::hash;

pub fn get_members(multisig_registry: &MultisigRegistry) -> Vec<MultisigMember> {
    multisig_registry.members.clone()
}

pub fn get_member(
    multisig_registry: &MultisigRegistry,
    target_pubkey: &Pubkey,
) -> Option<MultisigMember> {
    multisig_registry
        .members
        .iter()
        .find(|member| member.pubkey == *target_pubkey)
        .cloned()
}

pub fn get_proposals(multisig_registry: &MultisigRegistry) -> Vec<MultisigProposal> {
    multisig_registry.proposals.clone()
}

pub fn get_proposal(
    multisig_registry: &MultisigRegistry,
    uuid: &String,
) -> Option<MultisigProposal> {
    multisig_registry
        .proposals
        .iter()
        .find(|proposal| proposal.uuid == *uuid)
        .cloned()
}

pub fn generate_uuid_string(
    created_by: &Pubkey,
    created_at: i64,
    proposal_type: &MultisigProposalType,
) -> String {
    let mut data = Vec::new();
    data.extend_from_slice(created_by.as_ref());
    data.extend_from_slice(&created_at.to_le_bytes());

    let enum_value = match proposal_type {
        MultisigProposalType::RegisterMember => 0,
        MultisigProposalType::UnregisterMember => 1,
    };
    data.push(enum_value);

    let hash_result = hash(&data);
    let uuid_bytes = &hash_result.0[..16];

    uuid_bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn create_proposal(
    ctx: Context<NewMultisig>,
    name: String,
    action_type: MultisigProposalType,
    target_pubkey: Pubkey,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();
    let multisig_registry = &mut ctx.accounts.multisig_registry;

    if action_type == MultisigProposalType::UnregisterMember {
        require!(
            get_member(multisig_registry, &target_pubkey).is_some(),
            MultisigErrorCode::NotRegistered
        );
    }

    let uuid = generate_uuid_string(
        &signer_key,
        Clock::get()?.unix_timestamp,
        &action_type,
    );
    let members = get_members(multisig_registry);
    let cloned_members = members
        .iter()
        .map(|member| (*member).clone())
        .filter(|member| member.pubkey != target_pubkey)
        .collect();

    let new_proposal = MultisigProposal {
        uuid,
        name,
        action_type: action_type,
        target_pubkey: target_pubkey,
        required_signers: cloned_members,
        signatures: vec![],
        status: MultisigStatus::Pending,
    };

    multisig_registry.proposals.push(new_proposal);

    Ok(())
}

pub fn sign_proposal(ctx: Context<SetMultisig>, uuid: String) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();
    let multisig_registry = &mut ctx.accounts.multisig_registry;

    let members = get_members(multisig_registry);
    if members.len() > 0 {
        let current_member = members.iter().find(|member| member.pubkey == signer_key);
        require!(current_member.is_some(), MultisigErrorCode::NotAMember);
    }

    let proposal = match get_proposal(multisig_registry, &uuid) {
        Some(p) => p,
        None => return Err(MultisigErrorCode::ProposalNotFound.into()),
    };

    require!(
        proposal.status == MultisigStatus::Pending,
        MultisigErrorCode::AlreadyProcessed
    );

    let required_signers = &proposal.required_signers;
    if required_signers.len() > 0 {
        let current_signer = required_signers
            .iter()
            .find(|member| member.pubkey == signer_key);

        require!(
            current_signer.is_some(),
            MultisigErrorCode::NotARequiredSigner
        );
    }

    let signatures = &proposal.signatures;
    if signatures.len() > 0 {
        let current_signature = signatures.iter().find(|pubkey| **pubkey == signer_key);
        require!(
            current_signature.is_none(),
            MultisigErrorCode::AlreadySigned
        );
    }

    let proposal = multisig_registry
        .proposals
        .iter_mut()
        .find(|proposal| proposal.uuid == uuid);

    if let Some(update_proposal) = proposal {
        update_proposal.signatures.push(signer_key);
    }

    Ok(())
}

pub fn approve_proposal(ctx: Context<SetMultisig>, uuid: String) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();
    let multisig_registry = &mut ctx.accounts.multisig_registry;

    let members = get_members(multisig_registry);
    if members.len() > 0 {
        let current_member = members.iter().find(|member| member.pubkey == signer_key);
        require!(current_member.is_some(), MultisigErrorCode::NotAMember);
    }

    let proposal = match get_proposal(multisig_registry, &uuid) {
        Some(p) => p,
        None => return Err(MultisigErrorCode::ProposalNotFound.into()),
    };

    require!(
        proposal.status == MultisigStatus::Pending,
        MultisigErrorCode::AlreadyProcessed
    );

    let required_signers = &proposal.required_signers;
    if required_signers.len() > 0 {
        for signer in required_signers {
            let signatures = &proposal.signatures;

            if !signatures.contains(&signer.pubkey) {
                return Err(MultisigErrorCode::IncompleteSignatures.into());
            }
        }
    }

    let action_type = proposal.action_type.clone();
    let name = proposal.name.clone();
    let target_pubkey = proposal.target_pubkey;

    let proposal = multisig_registry
        .proposals
        .iter_mut()
        .find(|proposal| proposal.uuid == uuid);

    if let Some(update_proposal) = proposal {
        update_proposal.status = MultisigStatus::Approved;
    }

    match action_type {
        MultisigProposalType::RegisterMember => {
            multisig_registry.members.push(MultisigMember {
                name: name.clone(),
                pubkey: target_pubkey,
            });
        }
        MultisigProposalType::UnregisterMember => {
            multisig_registry
                .members
                .retain(|member| member.pubkey != target_pubkey);
        }
    }

    Ok(())
}
