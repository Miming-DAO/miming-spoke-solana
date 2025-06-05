use anchor_lang::prelude::*;

pub const DISCRIMINATOR: usize = 8;

pub const STRING_LEN: usize = 64;
pub const U8_SIZE: usize = 1;
pub const U64_SIZE: usize = 8;
pub const ENUM_SIZE: usize = 1;
pub const VEC_SIZE: usize = 8;
pub const PUBKEY_SIZE: usize = 32;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct Signers {
    pub name: String,
    pub pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct Multisig {
    pub name: String,
    pub threshold: u8,
    pub signers: Vec<Signers>,
}

pub const MAX_THRESHOLD: u8 = 10;
pub const MAX_SIGNERS: usize = 10;

pub const MULTISIG_SIGNERS_SIZE: usize = DISCRIMINATOR +
    STRING_LEN + // name
    PUBKEY_SIZE; // pubkey

pub const MULTISIG_SIZE: usize = DISCRIMINATOR +
    STRING_LEN + // name
    U8_SIZE + // threshold
    VEC_SIZE + (MAX_SIGNERS * MULTISIG_SIGNERS_SIZE); // data

#[account]
pub struct IdentifierAccount {
    pub id: u64,
}

impl IdentifierAccount {
    pub const LEN: usize = DISCRIMINATOR + U64_SIZE; // id
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalStatus {
    Pending,
    Approved,
}

#[account]
pub struct ProposalAccount {
    pub id: u64,
    pub data: Multisig,
    pub required_signers: Vec<Pubkey>,
    pub signers: Vec<Pubkey>,
    pub status: ProposalStatus,
}

impl ProposalAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        U64_SIZE + // id
        MULTISIG_SIZE + // data
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  // required_signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  // signers
        ENUM_SIZE; // status
}

#[account]
pub struct MultisigAccount {
    pub name: String,
    pub threshold: u8,
    pub signers: Vec<Signers>,
}

impl MultisigAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        STRING_LEN + // name
        U8_SIZE + // threshold
        VEC_SIZE + (MAX_SIGNERS * MULTISIG_SIGNERS_SIZE); // signers
}