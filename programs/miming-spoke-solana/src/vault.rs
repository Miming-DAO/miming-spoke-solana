use anchor_lang::prelude::*;
use crate::{
    states::{
        constants::{
            DISCRIMINATOR, U64_SIZE, 
            ENUM_SIZE, VEC_SIZE, 
            PUBKEY_SIZE,
            MIMING_FEE
        },
        events::VaultLedgerEvent,
        errors::VaultErrorCode,
    },
    multisig::{MAX_SIGNERS, MultisigAccount},
    IdentifierAccount
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultTransaction {
    Teleport { from: Pubkey, amount: u64  },
    Transfer { to: Pubkey, amount: u64  },
}

pub const TRANSACTION_SIZE: usize = DISCRIMINATOR + 
    PUBKEY_SIZE + 
    PUBKEY_SIZE + 
    U64_SIZE;

pub const LEDGER_SIZE: usize = DISCRIMINATOR + 
    // id
    U64_SIZE +
    // user
    PUBKEY_SIZE + 
    // token_address
    PUBKEY_SIZE + 
    // transaction
    ENUM_SIZE + TRANSACTION_SIZE + 
    // amount
    U64_SIZE; 

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct VaultLedger {
    pub id: u64,
    pub user: Pubkey,
    pub transaction: VaultTransaction,
    pub amount: i64,
    pub miming_fee: u64
}

#[account]
pub struct VaultLedgerAccount {
    pub id: u64,
    pub ledger: VaultLedger
}

impl VaultLedgerAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        // ledger
        LEDGER_SIZE;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultTransferProposalStatus {
    Pending,
    Approved,
}

#[account]
pub struct VaultTransferProposalAccount {
    pub id: u64,
    pub transaction: VaultTransaction,
    pub multisig_required_signers: Vec<Pubkey>,
    pub multisig_signers: Vec<Pubkey>,
    pub status: VaultTransferProposalStatus,
}

impl VaultTransferProposalAccount {
    pub const LEN: usize = DISCRIMINATOR + 
        // id
        U64_SIZE + 
        // transaction
        ENUM_SIZE + (PUBKEY_SIZE + PUBKEY_SIZE + U64_SIZE) + 
        // multisig_required_signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  
        // multisig_signers
        VEC_SIZE + (MAX_SIGNERS * PUBKEY_SIZE) +  
        // status
        ENUM_SIZE; 
}

#[derive(Accounts)]
pub struct VaultInitialization<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(init, payer = signer, space = 8 + IdentifierAccount::LEN, seeds = [b"ledger_identifier"], bump)]
    pub ledger_identifier: Account<'info, IdentifierAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VaultTeleport<'info> {
    #[account(mut)]
    pub teleporter: Signer<'info>,

    /// CHECK: This is the PDA authority for the vault, no need to deserialize
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub ledger_identifier: Account<'info, IdentifierAccount>,

    #[account(
        init_if_needed,
        payer = teleporter,
        space = 8 + VaultLedgerAccount::LEN,
        seeds = [
            b"ledger", 
            ledger_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub ledger: Account<'info, VaultLedgerAccount>,

    pub system_program: Program<'info, System>,
}

pub struct VaultTeleportInstructions;

impl VaultTeleportInstructions {
    pub fn teleport(ctx: Context<VaultTeleport>, amount: u64) -> Result<()> {
        let teleporter = &ctx.accounts.teleporter;
        let vault = &ctx.accounts.vault;

        let total_amount = amount + MIMING_FEE;
        
        let teleporter_sol_balance = teleporter.to_account_info().lamports();
        require!(
            teleporter_sol_balance >= total_amount,
            VaultErrorCode::InsufficientSolBalance
        );

        let sol_transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &teleporter.key(),
            &vault.key(),
            total_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &sol_transfer_instruction,
            &[teleporter.to_account_info(), vault.to_account_info()],
        )?;

        let ledger_identifier = &mut ctx.accounts.ledger_identifier;
        ledger_identifier.id += 1;

        let ledger = &mut ctx.accounts.ledger;
        ledger.ledger = VaultLedger {
            id: ledger_identifier.id,
            user: teleporter.key(),
            transaction: VaultTransaction::Teleport { 
                from: teleporter.key(), 
                amount: amount
            },
            amount: amount as i64,
            miming_fee: MIMING_FEE,
        };

        emit!(VaultLedgerEvent {
            id: ledger_identifier.id,
            data: ledger.ledger.clone()
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct VaultCreateTransferProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    #[account(mut)]
    pub transfer_proposal_identifier: Account<'info, IdentifierAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + VaultTransferProposalAccount::LEN,
        seeds = [
            b"transfer_proposal", 
            transfer_proposal_identifier.id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub transfer_proposal: Account<'info, VaultTransferProposalAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VaultSignTransferProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    #[account(mut)]
    pub current_transfer_proposal: Account<'info, VaultTransferProposalAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VaultExecuteTransferProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub current_multisig: Account<'info, MultisigAccount>,

    #[account(mut)]
    pub current_transfer_proposal: Account<'info, VaultTransferProposalAccount>,

    /// CHECK: This is the PDA authority for the vault, no need to deserialize
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub ledger_identifier: Account<'info, IdentifierAccount>,

    #[account(mut)]
    pub ledger: Account<'info, VaultLedgerAccount>,

    pub system_program: Program<'info, System>,
}

pub struct VaultTransferProposalInstructions;

impl VaultTransferProposalInstructions {
    pub fn create_transfer_proposal(ctx: Context<VaultCreateTransferProposal>, recipient: Pubkey, amount: u64) -> Result<()> {
        let transfer_proposal_identifier = &mut ctx.accounts.transfer_proposal_identifier;
        transfer_proposal_identifier.id += 1;

        let current_multisig = &ctx.accounts.current_multisig;
        let multisig_required_signers: Vec<Pubkey> = current_multisig.signers.iter().map(|d| d.pubkey).collect();

        let transfer_proposal = &mut ctx.accounts.transfer_proposal;
        transfer_proposal.id = transfer_proposal_identifier.id;
        transfer_proposal.transaction = VaultTransaction::Transfer { 
            to: recipient, 
            amount: amount 
        };
        transfer_proposal.multisig_required_signers = multisig_required_signers.clone();
        transfer_proposal.multisig_signers = Vec::new();
        transfer_proposal.status = VaultTransferProposalStatus::Pending;

        Ok(())
    }

    pub fn sign_transfer_proposal(ctx: Context<VaultSignTransferProposal>) -> Result<()> {
        let signer_key = ctx.accounts.signer.key();
        let current_transfer_proposal = &mut ctx.accounts.current_transfer_proposal;

        require!(
            current_transfer_proposal.status == VaultTransferProposalStatus::Pending,
            VaultErrorCode::AlreadyResolved
        );

        if current_transfer_proposal.multisig_required_signers.len() > 0 {
            require!(
                current_transfer_proposal.multisig_required_signers.contains(&signer_key),
                VaultErrorCode::UnauthorizedSigner
            );
        }

        if current_transfer_proposal.multisig_signers.len() > 0 {
            require!(
                !current_transfer_proposal.multisig_signers.contains(&signer_key),
                VaultErrorCode::DuplicateSignature
            );
        }

        current_transfer_proposal.multisig_signers.push(signer_key);

        Ok(())
    }

    pub fn execute_transfer_proposal(ctx: Context<VaultExecuteTransferProposal>) -> Result<()> {
        let signer_key = ctx.accounts.signer.key();
        let current_transfer_proposal = &mut ctx.accounts.current_transfer_proposal;

        require!(
            current_transfer_proposal.status == VaultTransferProposalStatus::Pending,
            VaultErrorCode::AlreadyResolved
        );

        if current_transfer_proposal.multisig_required_signers.len() > 0 {
            require!(
                current_transfer_proposal.multisig_required_signers.contains(&signer_key),
                VaultErrorCode::UnauthorizedSigner
            );
        }

        let all_signed = current_transfer_proposal
            .multisig_required_signers
            .iter()
            .all(|req| current_transfer_proposal.multisig_signers.contains(req));

        require!(all_signed, VaultErrorCode::InsufficientSignatures);

        if let VaultTransaction::Transfer { to, amount } = current_transfer_proposal.transaction {
            let vault = &ctx.accounts.vault;

            let vault_sol_balance = vault.to_account_info().lamports();
            require!(
                vault_sol_balance >= amount,
                VaultErrorCode::InsufficientSolBalance
            );

            let sol_transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
                &vault.key(),
                &to,
                amount,
            );
            anchor_lang::solana_program::program::invoke(
                &sol_transfer_instruction,
                &[vault.to_account_info()],
            )?;

            let ledger_identifier = &mut ctx.accounts.ledger_identifier;
            ledger_identifier.id += 1;

            let ledger = &mut ctx.accounts.ledger;
            ledger.ledger = VaultLedger {
                id: ledger_identifier.id,
                user: vault.key(),
                transaction: VaultTransaction::Transfer { 
                    to: to, 
                    amount: amount
                },
                amount: (amount as i64) * -1,
                miming_fee: 0, 
            };

            emit!(VaultLedgerEvent {
                id: ledger_identifier.id,
                data: ledger.ledger.clone()
            });
        }

        Ok(())
    }
}

/// # Raydium Proxy Modules
///
/// ## To Implement
///
/// - The `RaydiumProxyInstructions` struct is defined but not yet implemented. 
///   Please implement the logic for Raydium proxy instructions as needed for your application.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct RaydiumProxyInstructions { }

impl RaydiumProxyInstructions {
    
}