use crate::states::multisig::{IdentifierAccount, MultisigAccount, ProposalAccount};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialization<'info> {
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
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    #[account(mut)]
    pub proposal_identifier: Account<'info, IdentifierAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + ProposalAccount::LEN,
        seeds = [
            b"proposal", 
            proposal_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub proposal: Account<'info, ProposalAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SignProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_proposal: Account<'info, ProposalAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_proposal: Account<'info, ProposalAccount>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    pub system_program: Program<'info, System>,
}
