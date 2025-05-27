use crate::states::multisig::{
    MultisigMember, MultisigMemberCounter, MultisigProposal, MultisigProposalCounter,
    MultisigSignature, MultisigSignatureCounter,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitMultisigCountersAccounts<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(init, payer = signer, space = 8 + 8, seeds = [b"miming_proposal_counter"], bump)]
    pub proposal_counter: Account<'info, MultisigProposalCounter>,

    #[account(init, payer = signer, space = 8 + 8, seeds = [b"miming_signature_counter"], bump)]
    pub signature_counter: Account<'info, MultisigSignatureCounter>,

    #[account(init, payer = signer, space = 8 + 8, seeds = [b"miming_member_counter"], bump)]
    pub member_counter: Account<'info, MultisigMemberCounter>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMultisigProposalAccounts<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub proposal_counter: Account<'info, MultisigProposalCounter>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigProposal::LEN,
        seeds = [
            b"miming_multisig_proposal", 
            proposal_counter.count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub proposal: Account<'info, MultisigProposal>,

    #[account(mut)]
    pub member_counter: Account<'info, MultisigMemberCounter>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigMember::LEN,
        seeds = [
            b"miming_multisig_member", 
            member_counter.count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub member: Account<'info, MultisigMember>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SignMultisigProposalAccounts<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub proposal_counter: Account<'info, MultisigProposalCounter>,

    #[account(
        mut,
        seeds = [
            b"miming_multisig_proposal", 
            proposal_counter.count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub proposal: Account<'info, MultisigProposal>,

    #[account(mut)]
    pub signature_counter: Account<'info, MultisigSignatureCounter>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigSignature::LEN,
        seeds = [
            b"miming_multisig_signature", 
            proposal.uuid.as_bytes(),
            signature_counter.count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub signature: Account<'info, MultisigSignature>,

    #[account(mut)]
    pub member_counter: Account<'info, MultisigMemberCounter>,

    #[account(
        mut,
        seeds = [
            b"miming_multisig_member", 
            member_counter.count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub member: Account<'info, MultisigMember>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveMultisigAccounts<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub proposal_counter: Account<'info, MultisigProposalCounter>,

    #[account(
        mut,
        seeds = [
            b"miming_multisig_proposal", 
            proposal_counter.count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub proposal: Account<'info, MultisigProposal>,

    #[account(mut)]
    pub signature_counter: Account<'info, MultisigSignatureCounter>,

    #[account(
        mut,
        seeds = [
            b"miming_multisig_signature", 
            proposal.uuid.as_bytes(),
            signature_counter.count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub signature: Account<'info, MultisigSignature>,

    #[account(mut)]
    pub member_counter: Account<'info, MultisigMemberCounter>,

    #[account(
        mut,
        seeds = [
            b"miming_multisig_member", 
            member_counter.count.to_le_bytes().as_ref()
        ],
        bump,
        close = closing_account_receiver
    )]
    pub member: Account<'info, MultisigMember>,

    #[account(mut)]
    pub closing_account_receiver: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
