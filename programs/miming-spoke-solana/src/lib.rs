pub mod constants;
pub mod multisig;
pub mod staking;
pub mod vault;

use anchor_lang::prelude::*;

use constants::*;
use multisig::*;
use staking::*;
use vault::*;

declare_id!("3e2igyWExmDZmJfRpMRwn5mrM838Fam3AMzPYvttxRT8");

#[program]
pub mod miming_spoke_solana {
    use super::*;

    pub fn multisig_initialize(ctx: Context<MultisigInitialization>) -> Result<()> {
        multisig::initialize(ctx)
    }

    pub fn multisig_create_proposal(
        ctx: Context<MultisigCreateProposal>,
        name: String,
        threshold: u8,
        signers: Vec<Signers>,
    ) -> Result<()> {
        multisig::create_proposal(ctx, name, threshold, signers)
    }

    pub fn multisig_sign_proposal(ctx: Context<MultisigSignProposal>) -> Result<()> {
        multisig::sign_proposal(ctx)
    }

    pub fn multisig_approve_proposal(ctx: Context<MultisigApproveProposal>) -> Result<()> {
        multisig::approve_proposal(ctx)
    }

    pub fn staking_freeze(ctx: Context<Freeze>, reference_number: String) -> Result<()> {
        staking::freeze(ctx, reference_number)
    }

    pub fn staking_thaw(ctx: Context<Thaw>) -> Result<()> {
        staking::thaw(ctx)
    }

    pub fn vault_teleport(ctx: Context<Teleport>, amount: u64) -> Result<()> {
        vault::teleport(ctx, amount)
    }
}

#[account]
pub struct IdentifierAccount {
    pub id: u64,
}

impl IdentifierAccount {
    pub const LEN: usize = DISCRIMINATOR + U64_SIZE; // id
}
