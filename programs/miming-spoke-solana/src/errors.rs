use anchor_lang::prelude::*;

#[error_code]
pub enum MultisigErrorCode {
    #[msg("This public key is already registered.")]
    AlreadyRegistered,

    #[msg("This public key is not registered.")]
    NotRegistered,

    #[msg("You are not a member of this multisig.")]
    NotAMember,

    #[msg("You are not listed as a required signer.")]
    NotARequiredSigner,

    #[msg("Proposal has already been approved or rejected.")]
    AlreadyProcessed,

    #[msg("Proposal not found.")]
    ProposalNotFound,

    #[msg("Not all required signatures are present.")]
    IncompleteSignatures,

    #[msg("This signer has already signed.")]
    AlreadySigned,
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
