use anchor_lang::prelude::*;

#[error_code]
pub enum MultisigErrorCode {
    #[msg("The maximum threshold for this proposal has been reached.")]
    ThresholdLimitReached,

    #[msg("The maximum number of allowed signers has been reached.")]
    SignerLimitReached,

    #[msg("The proposal has already been resolved and cannot be modified.")]
    AlreadyResolved,

    #[msg("The provided public key is not authorized as a signer.")]
    UnauthorizedSigner,

    #[msg("The provided public key is not recognized as a member.")]
    UnauthorizedMember,

    #[msg("This public key has already submitted a signature.")]
    DuplicateSignature,

    #[msg("The required number of signatures has not yet been collected.")]
    InsufficientSignatures,
}

#[error_code]
pub enum StakingErrorCode {
    #[msg("Insufficient token balance to stake.")]
    InsufficientStakingBalance,
}

#[error_code]
pub enum VaultErrorCode {
    #[msg("Insufficient SOL balance.")]
    InsufficientSolBalance,

    #[msg("Insufficient MIMING token balance.")]
    InsufficientMimingBalance,
}
