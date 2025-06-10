use anchor_lang::prelude::*;

use crate::vault::VaultLedger;

#[event]
pub struct VaultLedgerLogEvent {
    pub id: u64,
    pub data: VaultLedger,
}