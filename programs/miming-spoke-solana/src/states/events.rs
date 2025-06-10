use anchor_lang::prelude::*;

use crate::vault::VaultLedger;

#[event]
pub struct VaultLedgerEvent {
    pub id: u64,
    pub data: VaultLedger,
}