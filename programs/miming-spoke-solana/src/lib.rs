use anchor_lang::prelude::*;

pub mod contexts;
pub mod errors;
pub mod instructions;
pub mod states;

use crate::{contexts::*, states::Signers};

declare_id!("3e2igyWExmDZmJfRpMRwn5mrM838Fam3AMzPYvttxRT8");

#[program]
pub mod miming_spoke_solana {
    use super::*;

    pub fn initialization(ctx: Context<Initialization>) -> Result<()> {
        instructions::multisig::initialization(ctx)
    }

    pub fn multisig_create_proposal(
        ctx: Context<CreateProposal>,
        name: String,
        threshold: u8,
        signers: Vec<Signers>,
    ) -> Result<()> {
        instructions::multisig::create_proposal(ctx, name, threshold, signers)
    }

    pub fn multisig_sign_proposal(ctx: Context<SignProposal>) -> Result<()> {
        instructions::multisig::sign_proposal(ctx)
    }

    pub fn multisig_approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
        instructions::multisig::approve_proposal(ctx)
    }

    pub fn vault_teleport(ctx: Context<Teleport>, amount: u64) -> Result<()> {
        instructions::vault::teleport(ctx, amount)
    }

    pub fn staking_freeze(ctx: Context<Freeze>, reference_number: String) -> Result<()> {
        instructions::staking::freeze(ctx, reference_number)
    }

    pub fn staking_thaw(ctx: Context<Thaw>) -> Result<()> {
        instructions::staking::thaw(ctx)
    }
}
