use anchor_lang::prelude::*;

#[event]
pub struct VaultTeleportSuccessful {
    pub id: u64,
    pub user: Pubkey,
    pub sol_amount: u64,
    pub miming_fee: u64,
}

#[event]
pub struct VaultTransferSuccessful {
    pub id: u64,
    pub user: Pubkey,
    pub sol_amount: u64,
}