use crate::states::multisig::{
    MultisigIdentifier, MultisigMember, MultisigProposal, MultisigProposalType, MultisigSignature,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitMultisigIdentifierAccounts<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(init, payer = signer, space = 8 + MultisigIdentifier::LEN, seeds = [b"proposal_identifier"], bump)]
    pub proposal_identifier: Account<'info, MultisigIdentifier>,

    #[account(init, payer = signer, space = 8 + MultisigIdentifier::LEN, seeds = [b"signature_identifier"], bump)]
    pub signature_identifier: Account<'info, MultisigIdentifier>,

    #[account(init, payer = signer, space = 8 + MultisigIdentifier::LEN, seeds = [b"member_identifier"], bump)]
    pub member_identifier: Account<'info, MultisigIdentifier>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMultisigProposalAccounts<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub proposal_identifier: Account<'info, MultisigIdentifier>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigProposal::LEN,
        seeds = [
            b"proposal", 
            proposal_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub proposal: Account<'info, MultisigProposal>,

    #[account(mut)]
    pub verify_target_member: Option<Account<'info, MultisigMember>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SignMultisigProposalAccounts<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub signature_identifier: Account<'info, MultisigIdentifier>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigSignature::LEN,
        seeds = [
            b"signature", 
            signature_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub signature: Account<'info, MultisigSignature>,

    #[account(mut)]
    pub current_proposal: Account<'info, MultisigProposal>,

    #[account(mut)]
    pub member_identifier: Account<'info, MultisigIdentifier>,

    #[account(mut)]
    pub verify_signer_member: Option<Account<'info, MultisigMember>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveMultisigAccounts<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub member_identifier: Account<'info, MultisigIdentifier>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigMember::LEN,
        seeds = [
            b"member", 
            member_identifier.id.to_le_bytes().as_ref()
        ],
        bump,
    )]
    pub member: Account<'info, MultisigMember>,

    #[account(mut)]
    pub current_proposal: Account<'info, MultisigProposal>,

    #[account(mut)]
    pub verify_signer_signature: Account<'info, MultisigSignature>,

    pub system_program: Program<'info, System>,
}
