use crate::contexts::multisig::{
    ApproveMultisigAccounts, CreateMultisigProposalAccounts, InitMultisigCountersAccounts,
    SignMultisigProposalAccounts,
};
use crate::errors::MultisigErrorCode;
use crate::states::multisig::{
    MultisigMember, MultisigProposal, MultisigProposalType, MultisigStatus,
};
use crate::states::{
    MultisigMemberCounter, MultisigProposalCounter, MultisigSignature, MultisigSignatureCounter,
};
use anchor_lang::prelude::*;
use solana_program::keccak::hash;

pub fn generate_uuid_string(
    created_by: &Pubkey,
    created_at: i64,
    action_type: &MultisigProposalType,
    proposal_counter: u64,
    member_counter: u64,
) -> String {
    let mut data = Vec::new();
    data.extend_from_slice(created_by.as_ref());
    data.extend_from_slice(&created_at.to_le_bytes());
    data.extend_from_slice(&proposal_counter.to_le_bytes());
    data.extend_from_slice(&member_counter.to_le_bytes());

    let enum_value = match action_type {
        MultisigProposalType::RegisterMember => 0,
        MultisigProposalType::UnregisterMember => 1,
    };
    data.push(enum_value);

    let hash_result = hash(&data);
    let uuid_bytes = &hash_result.0[..16];

    uuid_bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn init_counters(ctx: Context<InitMultisigCountersAccounts>) -> Result<()> {
    ctx.accounts.proposal_counter.count = 0;
    ctx.accounts.signature_counter.count = 0;
    ctx.accounts.member_counter.count = 0;

    Ok(())
}

pub fn get_proposals(
    proposal_counter: &Account<MultisigProposalCounter>,
    remaining_accounts: &[AccountInfo],
    program_id: &Pubkey,
) -> Vec<MultisigProposal> {
    let mut proposals: Vec<MultisigProposal> = Vec::new();

    for i in 0..proposal_counter.count {
        let (proposal_pda, _bump) = Pubkey::find_program_address(
            &[
                b"miming_multisig_proposal",
                (i as u64).to_le_bytes().as_ref(),
            ],
            program_id,
        );

        if let Some(account_info) = remaining_accounts
            .iter()
            .find(|acc| acc.key() == proposal_pda)
        {
            if let Ok(proposal_account) =
                MultisigProposal::try_deserialize(&mut &account_info.data.borrow()[..])
            {
                proposals.push(proposal_account);
            }
        }
    }

    proposals
}

pub fn get_signatures(
    signature_counter: &Account<MultisigSignatureCounter>,
    remaining_accounts: &[AccountInfo],
    program_id: &Pubkey,
) -> Vec<MultisigSignature> {
    let mut signatures: Vec<MultisigSignature> = Vec::new();

    for i in 0..signature_counter.count {
        let (signature_pda, _bump) = Pubkey::find_program_address(
            &[
                b"miming_multisig_signature",
                (i as u64).to_le_bytes().as_ref(),
            ],
            program_id,
        );

        if let Some(account_info) = remaining_accounts
            .iter()
            .find(|acc| acc.key() == signature_pda)
        {
            if let Ok(signature_account) =
                MultisigSignature::try_deserialize(&mut &account_info.data.borrow()[..])
            {
                signatures.push(signature_account);
            }
        }
    }

    signatures
}

pub fn get_members(
    member_counter: &Account<MultisigMemberCounter>,
    remaining_accounts: &[AccountInfo],
    program_id: &Pubkey,
) -> Vec<MultisigMember> {
    let mut members: Vec<MultisigMember> = Vec::new();

    for i in 0..member_counter.count {
        let (member_pda, _bump) = Pubkey::find_program_address(
            &[b"miming_multisig_member", (i as u64).to_le_bytes().as_ref()],
            program_id,
        );

        if let Some(account_info) = remaining_accounts
            .iter()
            .find(|acc| acc.key() == member_pda)
        {
            if let Ok(member_account) =
                MultisigMember::try_deserialize(&mut &account_info.data.borrow()[..])
            {
                members.push(member_account);
            }
        }
    }

    members
}

pub fn create_proposal(
    ctx: Context<CreateMultisigProposalAccounts>,
    name: String,
    action_type: MultisigProposalType,
    target_pubkey: Pubkey,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    if action_type == MultisigProposalType::UnregisterMember {
        let member_accounts = get_members(
            &ctx.accounts.member_counter,
            &ctx.remaining_accounts,
            ctx.program_id,
        );

        if member_accounts.len() > 0 {
            let multisig_member = member_accounts.iter().find(|m| m.pubkey == target_pubkey);
            require!(multisig_member.is_some(), MultisigErrorCode::NotRegistered);
        }
    }

    let proposal = &mut ctx.accounts.proposal;
    let proposal_counter_count = ctx.accounts.proposal_counter.count;
    let member_counter_count = ctx.accounts.member_counter.count;

    proposal.uuid = generate_uuid_string(
        &signer_key,
        Clock::get()?.unix_timestamp,
        &action_type,
        proposal_counter_count,
        member_counter_count,
    );
    proposal.name = name;
    proposal.action_type = action_type;
    proposal.target_pubkey = target_pubkey;
    proposal.status = MultisigStatus::Pending;

    let proposal_counter = &mut ctx.accounts.proposal_counter;
    proposal_counter.count += 1;

    Ok(())
}

pub fn sign_proposal(ctx: Context<SignMultisigProposalAccounts>, uuid: String) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    let proposal_accounts = get_proposals(
        &ctx.accounts.proposal_counter,
        &ctx.remaining_accounts,
        ctx.program_id,
    );

    if proposal_accounts.len() > 0 {
        let multisig_proposal = proposal_accounts.iter().find(|m| m.uuid == uuid);
        match multisig_proposal {
            Some(proposal) => {
                require!(
                    proposal.status == MultisigStatus::Pending,
                    MultisigErrorCode::AlreadySigned
                );
            }
            None => return Err(MultisigErrorCode::ProposalNotFound.into()),
        }
    }

    let signature_accounts = get_signatures(
        &ctx.accounts.signature_counter,
        &ctx.remaining_accounts,
        ctx.program_id,
    );

    if signature_accounts.len() > 0 {
        let multisig_signature = signature_accounts.iter().find(|m| m.pubkey == signer_key);

        require!(
            multisig_signature.is_none(),
            MultisigErrorCode::AlreadySigned
        );
    }

    let member_accounts = get_members(
        &ctx.accounts.member_counter,
        &ctx.remaining_accounts,
        ctx.program_id,
    );

    if member_accounts.len() > 0 {
        let multisig_member = member_accounts.iter().find(|m| m.pubkey == signer_key);
        require!(multisig_member.is_some(), MultisigErrorCode::NotAMember);
    }

    let proposal_signatures = &mut ctx.accounts.signature;
    proposal_signatures.proposal_uuid = uuid.clone();
    proposal_signatures.pubkey = signer_key;

    let signature_counter = &mut ctx.accounts.signature_counter;
    signature_counter.count += 1;

    Ok(())
}

pub fn approve_proposal(ctx: Context<ApproveMultisigAccounts>, uuid: String) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    let proposal_accounts = get_proposals(
        &ctx.accounts.proposal_counter,
        &ctx.remaining_accounts,
        ctx.program_id,
    );

    let mut current_proposal: Option<MultisigProposal> = None;

    if proposal_accounts.len() > 0 {
        let multisig_proposal = proposal_accounts.iter().find(|m| m.uuid == uuid);
        match multisig_proposal {
            Some(proposal) => {
                current_proposal = Some(proposal.clone());

                require!(
                    proposal.status == MultisigStatus::Pending,
                    MultisigErrorCode::AlreadySigned
                );
            }
            None => return Err(MultisigErrorCode::ProposalNotFound.into()),
        }
    }

    let mut required_signers: Vec<MultisigMember> = Vec::new();
    let mut signatures: Vec<Pubkey> = Vec::new();

    let member_accounts = get_members(
        &ctx.accounts.member_counter,
        &ctx.remaining_accounts,
        ctx.program_id,
    );

    if member_accounts.len() > 0 {
        for member in &member_accounts {
            required_signers.push(member.clone());
        }

        let multisig_member = member_accounts.iter().find(|m| m.pubkey == signer_key);
        require!(multisig_member.is_some(), MultisigErrorCode::NotAMember);
    }

    let signature_accounts = get_signatures(
        &ctx.accounts.signature_counter,
        &ctx.remaining_accounts,
        ctx.program_id,
    );

    if signature_accounts.len() > 0 {
        for signature in signature_accounts {
            signatures.push(signature.pubkey);
        }
    }

    if required_signers.len() > 0 {
        for signer in required_signers {
            if !signatures.contains(&signer.pubkey) {
                return Err(MultisigErrorCode::IncompleteSignatures.into());
            }
        }
    }

    match current_proposal {
        Some(proposal) => match proposal.action_type {
            MultisigProposalType::RegisterMember => {
                let member = &mut ctx.accounts.member;
                member.proposal_uuid = uuid.clone();
                member.name = proposal.name.clone();
                member.pubkey = signer_key;

                let member_counter = &mut ctx.accounts.member_counter;
                member_counter.count += 1;
            }
            MultisigProposalType::UnregisterMember => {
                let member_counter = &mut ctx.accounts.member_counter;
                member_counter.count -= 1;
            }
        },
        None => return Err(MultisigErrorCode::ProposalNotFound.into()),
    }

    Ok(())
}
