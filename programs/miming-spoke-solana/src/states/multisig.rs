use anchor_lang::prelude::*;

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
pub struct MultisigMember {
    pub name: String,
    pub pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MultisigProposalType {
    RegisterMember,
    UnregisterMember,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct MultisigProposal {
    pub uuid: String,
    pub name: String,
    pub action_type: MultisigProposalType,
    pub target_pubkey: Pubkey,
    pub required_signers: Vec<MultisigMember>,
    pub signatures: Vec<Pubkey>,
    pub status: MultisigStatus,
}

#[account]
pub struct MultisigRegistry {
    pub members: Vec<MultisigMember>,
    pub proposals: Vec<MultisigProposal>,
}

impl MultisigRegistry {
    pub const SIZE_STRING: usize = 8 + 64;
    pub const SIZE_PUBKEY: usize = 32;
    pub const SIZE_ENUM: usize = 1;
    pub const SIZE_VEC_PREFIX: usize = 8;
    
    pub const MAX_MEMBERS_LEN: usize = 5; // members: Vec<MultisigMember>,
    pub const MAX_PROPOSALS_LEN: usize = 5; // proposals: Vec<MultisigProposal>,
    pub const MAX_REQUIRED_SIGNERS_LEN: usize = 5; // required_signers: Vec<MultisigMember>,

    pub const SIZE_MULTISIG_MEMBER: usize = 8 + 
        Self::SIZE_STRING + // name
        Self::SIZE_PUBKEY;  // pubkey

    pub const SIZE_PROPOSAL: usize = 8 +
        Self::SIZE_STRING + // uuid
        Self::SIZE_STRING + // name
        Self::SIZE_ENUM + // action_type
        Self::SIZE_PUBKEY + // target_pubkey
        Self::SIZE_VEC_PREFIX + (Self::MAX_REQUIRED_SIGNERS_LEN * Self::SIZE_MULTISIG_MEMBER) + // required_signers
        Self::SIZE_VEC_PREFIX + (Self::MAX_REQUIRED_SIGNERS_LEN * Self::SIZE_PUBKEY) + // signatures
        Self::SIZE_ENUM; // status

    pub const LEN: usize = 8 +
        Self::SIZE_VEC_PREFIX + (Self::MAX_MEMBERS_LEN * Self::SIZE_MULTISIG_MEMBER) + // members
        Self::SIZE_VEC_PREFIX + (Self::MAX_PROPOSALS_LEN * Self::SIZE_PROPOSAL); // proposals
}
