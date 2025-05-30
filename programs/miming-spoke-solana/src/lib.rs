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

    pub fn init_multisig_identifiers(ctx: Context<InitMultisigIdentifierAccounts>) -> Result<()> {
        instructions::multisig::init_identifiers(ctx)
    }

    pub fn multisig_create_proposal(
        ctx: Context<CreateMultisigProposalAccounts>,
        name: String,
        action_type: MultisigProposalType,
        pubkey: Pubkey,
        verify_target_member_id: Option<u64>,
    ) -> Result<()> {
        instructions::multisig::create_proposal(
            ctx,
            name,
            action_type,
            pubkey,
            verify_target_member_id,
        )
    }

    pub fn multisig_sign_proposal(
        ctx: Context<SignMultisigProposalAccounts>,
        current_proposal_id: u64,
        verify_signer_member_id: Option<u64>,
    ) -> Result<()> {
        instructions::multisig::sign_proposal(ctx, current_proposal_id, verify_signer_member_id)
    }

    pub fn multisig_approve_proposal(
        ctx: Context<ApproveMultisigAccounts>,
        current_proposal_id: u64,
        verify_signer_signature_id: u64,
    ) -> Result<()> {
        instructions::multisig::approve_proposal(
            ctx,
            current_proposal_id,
            verify_signer_signature_id,
        )
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
