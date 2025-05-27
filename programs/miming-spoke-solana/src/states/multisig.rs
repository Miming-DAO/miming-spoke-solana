use anchor_lang::prelude::*;

pub const STRING_LEN: usize = 64;
pub const PUBKEY_SIZE: usize = 32;
pub const ENUM_SIZE: usize = 1;
pub const DISCRIMINATOR: usize = 8;

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
    pub uuid: String,
    pub name: String,
    pub action_type: MultisigProposalType,
    pub target_pubkey: Pubkey,
    pub status: MultisigStatus,
}

impl MultisigProposal {
    pub const LEN: usize = 8 +
        STRING_LEN + // uuid
        STRING_LEN + // name
        ENUM_SIZE + // action_type
        PUBKEY_SIZE + // target_pubkey
        ENUM_SIZE; // status
}

#[account]
pub struct MultisigProposalCounter { pub count: u64,}

#[account]
pub struct MultisigSignature {
    pub proposal_uuid: String,
    pub pubkey: Pubkey,
}

impl MultisigSignature {
    pub const PUBKEY_SIZE: usize = 32;
    
    pub const LEN: usize = 8 + 
        PUBKEY_SIZE;  // pubkey
}

#[account]
pub struct MultisigSignatureCounter { pub count: u64,}

#[account]
pub struct MultisigMember {
    pub proposal_uuid: String,
    pub name: String,
    pub pubkey: Pubkey,
}

impl MultisigMember {
    pub const STRING_LEN: usize = 8 + 64;
    pub const PUBKEY_SIZE: usize = 32;
    
    pub const LEN: usize = 8 + 
        STRING_LEN + // name
        PUBKEY_SIZE;  // pubkey

    pub const MAX_MEMBER_SIZE: usize = 5;
}

#[account]
pub struct MultisigMemberCounter { pub count: u64,}