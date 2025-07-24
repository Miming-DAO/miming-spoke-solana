# 🛡️ Miming Spoke - Solana Smart Contracts

**Miming Spoke** is a modular Solana smart contract suite built with the Anchor framework. It provides robust multisignature governance, secure vault custody for SOL, and SPL token staking functionalities. Designed for security, transparency, and extensibility, this on-chain system is ideal for DeFi protocols, DAOs, and advanced Solana-based applications.

---

## 📦 Modules Overview

### 🔐 Multisig Module

Implements a multisignature account system to ensure secure and decentralized decision-making via a proposal and approval workflow.

#### Features
- Customizable multisig accounts with signer threshold
- Proposal creation and approval workflow
- Signature collection from authorized signers
- Strict access control to prevent unauthorized or duplicate signatures

#### Key Data Structures
- `Multisig`: Defines a multisig account (name, threshold, signers)
- `MultisigSigners`: Represents a signer (name, public key)
- `MultisigProposalAccount`: Stores proposal and approval state

#### Instructions
- `initialize`: Create a new multisig account
- `create_proposal`: Propose updates to the multisig configuration
- `sign_proposal`: Sign a proposal as an authorized signer
- `approve_proposal`: Apply a proposal if it meets the threshold

---

### 🏦 Vault Module

Manages a secure vault for holding, depositing (teleport), and transferring SOL under multisig governance, with full auditability.

#### Features
- PDA-based vault for SOL custody
- Deposit (teleport) system with ledger tracking and fees
- Multisig-controlled transfer proposals
- Event emission for off-chain analytics
- Immutable and auditable ledger entries

#### Key Data Structures
- `VaultTransaction`: Enum for deposit/transfer types
- `VaultLedger`: Captures transaction metadata
- `VaultLedgerAccount`: On-chain record for vault actions
- `VaultTransferProposalAccount`: Stores transfer proposals and status

#### Instructions
- `teleport`: Deposit SOL into the vault and charge fee
- `create_transfer_proposal`: Propose a multisig-controlled transfer
- `sign_transfer_proposal`: Sign a transfer proposal
- `execute_transfer_proposal`: Execute transfer if proposal is approved

---

### 📈 Staking Module

Implements staking logic for SPL tokens, allowing users to freeze and thaw token accounts based on a minimum staking requirement.

#### Features
- Freeze token accounts for staking
- Thaw token accounts to end staking
- Enforces minimum staking amount
- Tracks staking with a reference ID registry

#### Key Data Structures
- `StakingConfigAccount`: Holds minimum staking configuration
- `StakingRegistryAccount`: Tracks staking reference ID

#### Instructions
- `freeze`: Freeze the token account if staking amount is met
- `thaw`: Thaw the token account and clear staking record

---

## ⚠️ Error Handling

Custom error codes are defined across modules to ensure safe execution:

- `MultisigErrorCode`: Signer validation, threshold enforcement, etc.
- `VaultErrorCode`: Balance checks, signature rules, proposal validity
- `StakingErrorCode`: Token balance enforcement, account constraints

---

## ⚙️ Constants

Common constants used throughout the project:

- `MAX_THRESHOLD`: Max allowed threshold for multisig
- `MAX_SIGNERS`: Max allowed signers per multisig group
- `MIMING_FEE`: Fixed teleport deposit fee
- Account layout sizes (`DISCRIMINATOR`, `U64_SIZE`, `PUBKEY_SIZE`, etc.)

---

## 🔐 Security Considerations

- Only authorized signers can propose, sign, or approve changes
- Multisig approval is mandatory for any fund transfers
- Proposal and ledger data are immutable once finalized
- Token accounts can only be frozen/thawed by the authority (owner)
- Full validation of account constraints and signer identities

---

## 🧩 Integration

This contract suite is designed for easy integration with:
- DAO governance protocols
- Treasury management platforms
- DeFi dApps requiring staking, custody, or governance
- Off-chain analytics platforms (via emitted events)

---

## 🛠️ Built With

- [Solana](https://solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/docs)
- Rust (for smart contract logic)

---

## 📄 License

This project is open-source and available under the [MIT License](https://github.com/Miming-DAO/miming-spoke-solana/blob/main/programs/miming-spoke-solana/src/lib.rs#L36).

---

## 🙌 Contributing

Feel free to open issues or submit PRs. For major changes, please discuss with the core team first.
