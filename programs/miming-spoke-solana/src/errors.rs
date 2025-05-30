use anchor_lang::prelude::*;

#[error_code]
pub enum MultisigErrorCode {
    #[msg("Missing 'verify_member_id' in the request.")]
    MissingVerifyMemberId,

    #[msg("Verify member PDA could not be derived from 'verify_member_id'.")]
    MissingVerifyMemberPDA,

    #[msg("The given public key is not a recognized multisig member.")]
    UnauthorizedMember,

    #[msg("The specified proposal does not exist or is invalid.")]
    ProposalNotFound,

    #[msg("Only pending proposals can be signed.")]
    ProposalAlreadyResolved,

    #[msg("Only pending proposals can be approved.")]
    CannotApproveResolvedProposal,

    #[msg("The provided signature is invalid or corrupted.")]
    InvalidSignature,

    #[msg("Proposal cannot proceed; required signatures are incomplete.")]
    SignaturesIncomplete,
}

#[error_code]
pub enum VaultErrorCode {
    #[msg("Insufficient SOL balance.")]
    InsufficientSolBalance,

    #[msg("Insufficient MIMING token balance.")]
    InsufficientMimingBalance,
}

#[error_code]
pub enum StakingErrorCode {
    #[msg("Insufficient token balance to stake.")]
    InsufficientStakingBalance,
}
