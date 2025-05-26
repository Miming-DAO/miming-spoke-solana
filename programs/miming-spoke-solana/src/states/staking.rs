use anchor_lang::prelude::*;

#[account]
pub struct StakingConfig {
    pub min_staking_amount: u64,
}

impl Default for StakingConfig {
    fn default() -> Self {
        Self {
            min_staking_amount: 10_000,
        }
    }
}

impl StakingConfig {
    pub const SIZE_U64: usize = 8;
    pub const LEN: usize = 8 + Self::SIZE_U64; // min_staking_amount
}

#[account]
pub struct StakingRegistry {
    pub reference_id: String,
}

impl StakingRegistry {
    pub const SIZE_STRING: usize = 8 + 64;
    pub const LEN: usize = 8 + Self::SIZE_STRING; // reference_id
}
