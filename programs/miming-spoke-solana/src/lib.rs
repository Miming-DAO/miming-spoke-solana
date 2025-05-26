pub mod contexts;
pub mod errors;
pub mod instructions;
pub mod states;

use anchor_lang::prelude::*;

use crate::contexts::*;
use crate::states::MultisigProposalType;

declare_id!("3e2igyWExmDZmJfRpMRwn5mrM838Fam3AMzPYvttxRT8");

#[program]
pub mod miming_spoke_solana {
    use super::*;
    
    pub fn multisig_create_proposal(
        ctx: Context<NewMultisig>,
        name: String,
        action_type: MultisigProposalType,
        target_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::multisig::create_proposal(ctx, name, action_type, target_pubkey)
    }

    pub fn multisig_sign_proposal(ctx: Context<SetMultisig>, uuid: String) -> Result<()> {
        instructions::multisig::sign_proposal(ctx, uuid)
    }

    pub fn multisig_approve_proposal(ctx: Context<SetMultisig>, uuid: String) -> Result<()> {
        instructions::multisig::approve_proposal(ctx, uuid)
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

#[derive(Accounts)]
pub struct Initialize {}
