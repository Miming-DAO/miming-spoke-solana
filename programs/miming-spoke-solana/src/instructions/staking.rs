use crate::contexts::staking::{Freeze, Thaw};
use crate::errors::StakingErrorCode;
use {
    anchor_lang::prelude::*,
    anchor_spl::token::{freeze_account, thaw_account, FreezeAccount, ThawAccount},
};

pub fn freeze(ctx: Context<Freeze>, reference_number: String) -> Result<()> {
    let user_balance = ctx.accounts.staker_token.amount;
    let min_required = ctx.accounts.staking_config.min_staking_amount;

    require!(
        user_balance > min_required,
        StakingErrorCode::InsufficientStakingBalance
    );

    freeze_account(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        FreezeAccount {
            account: ctx.accounts.staker_token.to_account_info(),
            mint: ctx.accounts.token.to_account_info(),
            authority: ctx.accounts.staker.to_account_info(),
        },
    ))?;

    let staking_registry = &mut ctx.accounts.staking_registry;
    staking_registry.reference_id = String::from(reference_number);

    Ok(())
}

pub fn thaw(ctx: Context<Thaw>) -> Result<()> {
    thaw_account(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        ThawAccount {
            account: ctx.accounts.staker_token.to_account_info(),
            mint: ctx.accounts.token.to_account_info(),
            authority: ctx.accounts.staker.to_account_info(),
        },
    ))?;

    let staking_registry = &mut ctx.accounts.staking_registry;
    staking_registry.reference_id = String::from("");

    Ok(())
}
