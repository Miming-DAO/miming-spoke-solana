use anchor_lang::prelude::*;

pub const STRING_LEN: usize = 64;
pub const PUBKEY_SIZE: usize = 32;
pub const ENUM_SIZE: usize = 1;
pub const U64_SIZE: usize = 8;
pub const DISCRIMINATOR: usize = 8;

#[account]
pub struct MultisigIdentifier {
    pub id: u64,
}

impl MultisigIdentifier {
    pub const LEN: usize = 8 + 
        U64_SIZE; // id
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MultisigStatus {
    Pending,
    Approved,
    Rejected,
    Unregister,
}

impl Default for MultisigStatus {
    fn default() -> Self {
        MultisigStatus::Pending
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MultisigProposalType {
    RegisterMember,
    UnregisterMember,
}

#[account]
pub struct MultisigProposal {
    pub id: u64,
    pub name: String,
    pub action_type: MultisigProposalType,
    pub pubkey: Pubkey,
    pub status: MultisigStatus,
}

impl MultisigProposal {
    pub const LEN: usize = 8 +
        U64_SIZE + // id
        STRING_LEN + // name
        ENUM_SIZE + // action_type
        PUBKEY_SIZE + // target_pubkey
        ENUM_SIZE; // status
}

#[account]
pub struct MultisigSignature {
    pub id: u64,
    pub proposal_id: u64,
    pub no_required_signers: u64,
    pub no_signatures: u64,
    pub pubkey: Pubkey,
}

impl MultisigSignature {
    pub const LEN: usize = 8 + 
        U64_SIZE + // id
        U64_SIZE + // proposal_id
        U64_SIZE + // no_required_signers
        U64_SIZE + // no_signatures
        PUBKEY_SIZE;  // pubkey
}

#[account]
pub struct MultisigMember {
    pub id: u64,
    pub proposal_id: u64,
    pub name: String,
    pub pubkey: Pubkey,
}

impl MultisigMember {
    pub const LEN: usize = 8 + 
        U64_SIZE + // id
        U64_SIZE + // proposal_id
        STRING_LEN + // name
        PUBKEY_SIZE; // pubkey

    pub const MAX_MEMBER_SIZE: usize = 5;
}