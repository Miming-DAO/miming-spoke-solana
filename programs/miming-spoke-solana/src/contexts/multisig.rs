use crate::states::multisig::MultisigRegistry;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct NewMultisig<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MultisigRegistry::LEN,
        seeds = [b"miming_multisig_registry"],
        bump
    )]
    pub multisig_registry: Account<'info, MultisigRegistry>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMultisig<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"miming_multisig_registry"],
        bump
    )]
    pub multisig_registry: Account<'info, MultisigRegistry>,

    pub system_program: Program<'info, System>,
}