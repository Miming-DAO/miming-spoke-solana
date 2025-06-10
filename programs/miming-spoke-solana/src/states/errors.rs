use anchor_lang::prelude::*;

#[error_code]
pub enum MultisigErrorCode {
    #[msg("The proposal has already reached the required number of approvals.")]
    ThresholdLimitReached,

    #[msg("The number of signers has reached the allowed maximum.")]
    SignerLimitReached,

    #[msg("This proposal has been finalized and cannot be changed.")]
    AlreadyResolved,

    #[msg("The public key is not authorized to sign this proposal.")]
    UnauthorizedSigner,

    #[msg("This public key has already provided a signature.")]
    DuplicateSignature,

    #[msg("Not enough signatures have been collected to proceed.")]
    InsufficientSignatures,
}

#[error_code]
pub enum StakingErrorCode {
    #[msg("Token balance is too low to complete the staking request.")]
    InsufficientStakingBalance,
}

#[error_code]
pub enum VaultErrorCode {
    #[msg("SOL balance is insufficient for this operation.")]
    InsufficientSolBalance,

    #[msg("This proposal has already been processed and cannot be updated.")]
    AlreadyResolved,

    #[msg("The public key does not have signing permission for this transaction.")]
    UnauthorizedSigner,

    #[msg("A signature from this public key has already been recorded.")]
    DuplicateSignature,

    #[msg("The minimum required signatures have not been met.")]
    InsufficientSignatures,
}
