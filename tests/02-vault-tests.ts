import * as anchor from "@coral-xyz/anchor";
import { MimingSpokeSolana } from "../target/types/miming_spoke_solana";
import { SystemProgram, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import * as multisigTests from "./01-multisig-tests";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.mimingSpokeSolana as anchor.Program<MimingSpokeSolana>;
const connection = program.provider.connection;

const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], program.programId);
const [ledgerIdentifierPda] = PublicKey.findProgramAddressSync([Buffer.from("ledger_identifier")], program.programId);
const [transferProposalIdentifierPda] = PublicKey.findProgramAddressSync([Buffer.from("transfer_proposal_identifier")], program.programId);
const [multisigPda] = PublicKey.findProgramAddressSync([Buffer.from("multisig")], program.programId);

const multisigMembers: anchor.web3.PublicKey[] = [];

describe("02-vault-tests", () => {
    it("should initialize vault.", async () => {
        const signer = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await sleep(2000);

        await program.methods.vaultInitialize()
            .accounts({
                signer: signer.publicKey,
                ledgerIdentifier: ledgerIdentifierPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const multisig = await program.account.multisigAccount.fetch(multisigPda);
        if (multisig.signers.length > 0) {
            multisig.signers.forEach((data) => {
                multisigMembers.push(data.pubkey);
            });
        }
    });

    it("should teleport tokens and update the ledger if the user has sufficient SOL balance.", async () => {
        const signer = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const solBalanceBefore = await connection.getBalance(signer.publicKey);

        const amount = new anchor.BN(2 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods
            .vaultTeleport(amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                vault: vaultPda,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([signer])
            .rpc();

        const ledger = await program.account.vaultLedgerAccount.fetch(ledgerPda);
        expect(ledger.ledger.user.equals(signer.publicKey)).to.equal(true);
        expect(ledger.ledger.transaction.teleport).to.not.be.null;
        expect(ledger.ledger.transaction.teleport.from.equals(signer.publicKey)).to.equal(true);
        expect(ledger.ledger.transaction.teleport.amount.toNumber()).to.equal(amount.toNumber());
        expect(ledger.ledger.transaction.teleport.xodeAddress).to.equal(xodeAddress);
        expect(ledger.ledger.transaction.transfer).to.be.undefined;
        expect(ledger.ledger.balanceIn.toNumber()).to.equal(amount.toNumber());
        expect(ledger.ledger.balanceOut.toNumber()).to.equal(0);
        expect(ledger.ledger.mimingFee.toNumber()).to.equal(0.01 * LAMPORTS_PER_SOL);

        const solBalanceAfter = await connection.getBalance(signer.publicKey);
        expect(solBalanceBefore - solBalanceAfter).to.be.lessThan(3 * LAMPORTS_PER_SOL);
    });

    it("should fail if the teleporter has insufficient SOL balance (InsufficientSolBalance).", async () => {
        const signer = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const solBalanceBefore = await connection.getBalance(signer.publicKey);

        const amount = new anchor.BN(10 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods
            .vaultTeleport(amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                vault: vaultPda,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("InsufficientSolBalance");
                expect(err.error.errorMessage).to.equal("SOL balance is insufficient for this operation.");
            });

        const solBalanceAfter = await connection.getBalance(signer.publicKey);
        expect(solBalanceAfter).to.lessThanOrEqual(solBalanceBefore);
    });

    it("Creating a proposal should succeed with valid signers.", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(17.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const vaultSolBalanceAfter = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceAfter).to.lessThanOrEqual(vaultSolBalanceBefore);
    });

    it("Should sign a proposal if signer is valid and has not signed yet.", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(22.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const multisigSigner of multisigTests.fourthSigners) {
            await program.methods.vaultSignTransferProposal()
                .accounts({
                    signer: multisigSigner.pubkey,
                    currentMultisig: multisigPda,
                    currentTransferProposal: transferProposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([multisigSigner.keypair])
                .rpc();

            signersArray.push(multisigSigner.pubkey);
        };

        const signedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(signedTransferProposal.transaction.transfer).to.not.be.null;
        expect(signedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(signedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(signedTransferProposal.transaction.teleport).to.be.undefined;
        expect(signedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(signedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(signedTransferProposal.status).to.have.property("pending");

        const vaultSolBalanceAfter = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceAfter).to.lessThanOrEqual(vaultSolBalanceBefore);
    });

    it("Signing a proposal should fail if the proposal is already resolved (AlreadyResolved).", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(27.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const multisigSigner of multisigTests.fourthSigners) {
            await program.methods.vaultSignTransferProposal()
                .accounts({
                    signer: multisigSigner.pubkey,
                    currentMultisig: multisigPda,
                    currentTransferProposal: transferProposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([multisigSigner.keypair])
                .rpc();

            signersArray.push(multisigSigner.pubkey);
        };

        const signedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(signedTransferProposal.transaction.transfer).to.not.be.null;
        expect(signedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(signedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(signedTransferProposal.transaction.teleport).to.be.undefined;
        expect(signedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(signedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(signedTransferProposal.status).to.have.property("pending");

        await connection.requestAirdrop(multisigTests.fourthSigners[0].pubkey, 5e9);
        await sleep(2000);

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.vaultExecuteTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                vault: vaultPda,
                recipient: newTransferProposal.transaction.transfer.to,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc();

        const executedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(executedTransferProposal.transaction.transfer).to.not.be.null;
        expect(executedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(executedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(executedTransferProposal.transaction.teleport).to.be.undefined;
        expect(executedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(executedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(executedTransferProposal.status).to.have.property("executed");

        const ledger = await program.account.vaultLedgerAccount.fetch(ledgerPda);
        expect(ledger.ledger.user.equals(vaultPda)).to.equal(true);
        expect(ledger.ledger.transaction.transfer).to.not.be.null;
        expect(ledger.ledger.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(ledger.ledger.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(ledger.ledger.transaction.transfer.xodeAddress).to.equal(xodeAddress);
        expect(ledger.ledger.transaction.teleport).to.be.undefined;
        expect(ledger.ledger.balanceIn.toNumber()).to.equal(0);
        expect(ledger.ledger.balanceOut.toNumber()).to.equal(amount.toNumber());
        expect(ledger.ledger.mimingFee.toNumber()).to.equal(0);

        const vaultSolBalanceAfter = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceAfter).to.lessThanOrEqual(vaultSolBalanceBefore);

        await program.methods.vaultSignTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("AlreadyResolved");
                expect(err.error.errorMessage).to.equal("This proposal has already been processed and cannot be updated.");
            });
    });

    it("Signing a proposal should fail if signer is not among required signers (UnauthorizedSigner).", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(31.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        await program.methods.vaultSignTransferProposal()
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("UnauthorizedSigner");
                expect(err.error.errorMessage).to.equal("The public key does not have signing permission for this transaction.");
            });
    });

    it("Signing a proposal should fail if the signer already signed the proposal (DuplicateSignature).", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(36.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const multisigSigner of multisigTests.fourthSigners) {
            await program.methods.vaultSignTransferProposal()
                .accounts({
                    signer: multisigSigner.pubkey,
                    currentMultisig: multisigPda,
                    currentTransferProposal: transferProposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([multisigSigner.keypair])
                .rpc();

            signersArray.push(multisigSigner.pubkey);
        };

        await program.methods.vaultSignTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("DuplicateSignature");
                expect(err.error.errorMessage).to.equal("A signature from this public key has already been recorded.");
            });
    });

    it("Should execute a transfer if all required signers have signed.", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(41.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(10 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const multisigSigner of multisigTests.fourthSigners) {
            await program.methods.vaultSignTransferProposal()
                .accounts({
                    signer: multisigSigner.pubkey,
                    currentMultisig: multisigPda,
                    currentTransferProposal: transferProposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([multisigSigner.keypair])
                .rpc();

            signersArray.push(multisigSigner.pubkey);
        };

        const signedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(signedTransferProposal.transaction.transfer).to.not.be.null;
        expect(signedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(signedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(signedTransferProposal.transaction.teleport).to.be.undefined;
        expect(signedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(signedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(signedTransferProposal.status).to.have.property("pending");

        await connection.requestAirdrop(multisigTests.fourthSigners[0].pubkey, 5e9);
        await sleep(2000);

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.vaultExecuteTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                vault: vaultPda,
                recipient: newTransferProposal.transaction.transfer.to,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc();

        const executedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(executedTransferProposal.transaction.transfer).to.not.be.null;
        expect(executedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(executedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(executedTransferProposal.transaction.teleport).to.be.undefined;
        expect(executedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(executedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(executedTransferProposal.status).to.have.property("executed");

        const ledger = await program.account.vaultLedgerAccount.fetch(ledgerPda);
        expect(ledger.ledger.user.equals(vaultPda)).to.equal(true);
        expect(ledger.ledger.transaction.transfer).to.not.be.null;
        expect(ledger.ledger.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(ledger.ledger.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(ledger.ledger.transaction.transfer.xodeAddress).to.equal(xodeAddress);
        expect(ledger.ledger.transaction.teleport).to.be.undefined;
        expect(ledger.ledger.balanceIn.toNumber()).to.equal(0);
        expect(ledger.ledger.balanceOut.toNumber()).to.equal(amount.toNumber());
        expect(ledger.ledger.mimingFee.toNumber()).to.equal(0);

        const vaultSolBalanceAfter = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceAfter).to.lessThanOrEqual(vaultSolBalanceBefore);
    });

    it("Executing should fail if the proposal is already resolved (AlreadyResolved).", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(36.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(10 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const multisigSigner of multisigTests.fourthSigners) {
            await program.methods.vaultSignTransferProposal()
                .accounts({
                    signer: multisigSigner.pubkey,
                    currentMultisig: multisigPda,
                    currentTransferProposal: transferProposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([multisigSigner.keypair])
                .rpc();

            signersArray.push(multisigSigner.pubkey);
        };

        const signedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(signedTransferProposal.transaction.transfer).to.not.be.null;
        expect(signedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(signedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(signedTransferProposal.transaction.teleport).to.be.undefined;
        expect(signedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(signedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(signedTransferProposal.status).to.have.property("pending");

        await connection.requestAirdrop(multisigTests.fourthSigners[0].pubkey, 5e9);
        await sleep(2000);

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.vaultExecuteTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                vault: vaultPda,
                recipient: newTransferProposal.transaction.transfer.to,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc();

        const executedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(executedTransferProposal.transaction.transfer).to.not.be.null;
        expect(executedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(executedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(executedTransferProposal.transaction.teleport).to.be.undefined;
        expect(executedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(executedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(executedTransferProposal.status).to.have.property("executed");

        const ledger = await program.account.vaultLedgerAccount.fetch(ledgerPda);
        expect(ledger.ledger.user.equals(vaultPda)).to.equal(true);
        expect(ledger.ledger.transaction.transfer).to.not.be.null;
        expect(ledger.ledger.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(ledger.ledger.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(ledger.ledger.transaction.transfer.xodeAddress).to.equal(xodeAddress);
        expect(ledger.ledger.transaction.teleport).to.be.undefined;
        expect(ledger.ledger.balanceIn.toNumber()).to.equal(0);
        expect(ledger.ledger.balanceOut.toNumber()).to.equal(amount.toNumber());
        expect(ledger.ledger.mimingFee.toNumber()).to.equal(0);

        const vaultSolBalanceAfter = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceAfter).to.lessThanOrEqual(vaultSolBalanceBefore);

        const updatedLedgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [updatedLedgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(updatedLedgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.vaultExecuteTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                vault: vaultPda,
                recipient: newTransferProposal.transaction.transfer.to,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: updatedLedgerPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("AlreadyResolved");
                expect(err.error.errorMessage).to.equal("This proposal has already been processed and cannot be updated.");
            });
    });

    it("Executing should fail if the signer is not among required signers (UnauthorizedSigner).", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(31.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(10 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const multisigSigner of multisigTests.fourthSigners) {
            await program.methods.vaultSignTransferProposal()
                .accounts({
                    signer: multisigSigner.pubkey,
                    currentMultisig: multisigPda,
                    currentTransferProposal: transferProposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([multisigSigner.keypair])
                .rpc();

            signersArray.push(multisigSigner.pubkey);
        };

        const signedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(signedTransferProposal.transaction.transfer).to.not.be.null;
        expect(signedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(signedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(signedTransferProposal.transaction.teleport).to.be.undefined;
        expect(signedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(signedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(signedTransferProposal.status).to.have.property("pending");

        await connection.requestAirdrop(multisigTests.fourthSigners[0].pubkey, 5e9);
        await sleep(2000);

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.vaultExecuteTransferProposal()
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                vault: vaultPda,
                recipient: newTransferProposal.transaction.transfer.to,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("UnauthorizedSigner");
                expect(err.error.errorMessage).to.equal("The public key does not have signing permission for this transaction.");
            });
    });

    it("Executing should fail if not all required signers have signed (InsufficientSignatures).", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(36.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(10 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];

        await program.methods.vaultSignTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc();

        await program.methods.vaultSignTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[1].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[1].keypair])
            .rpc();

        signersArray.push(multisigTests.fourthSigners[0].pubkey);
        signersArray.push(multisigTests.fourthSigners[1].pubkey);

        const signedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(signedTransferProposal.transaction.transfer).to.not.be.null;
        expect(signedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(signedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(signedTransferProposal.transaction.teleport).to.be.undefined;
        expect(signedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(signedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(signedTransferProposal.status).to.have.property("pending");

        await connection.requestAirdrop(multisigTests.fourthSigners[0].pubkey, 5e9);
        await sleep(2000);

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.vaultExecuteTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                vault: vaultPda,
                recipient: newTransferProposal.transaction.transfer.to,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("InsufficientSignatures");
                expect(err.error.errorMessage).to.equal("The minimum required signatures have not been met.");
            });
    });

    it("Executing should fail if the vault balance is less than transfer amount (InsufficientSolBalance).", async () => {
        const signer = Keypair.generate();
        const recipient = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(recipient.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const vaultSolBalanceBefore = await connection.getBalance(vaultPda);
        expect(vaultSolBalanceBefore / LAMPORTS_PER_SOL).to.equal(41.01);

        const transferProposalIdentifier = await program.account.identifierAccount.fetch(transferProposalIdentifierPda);
        const [transferProposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("transfer_proposal"),
            new anchor.BN(transferProposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const amount = new anchor.BN(1000 * LAMPORTS_PER_SOL);
        const xodeAddress = "5CJ6JNcNx2vu4bgVBkeaAFwh4XwnCmjT6HK1MprzzePm7cTY";

        await program.methods.vaultCreateTransferProposal(recipient.publicKey, amount, xodeAddress)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                transferProposalIdentifier: transferProposalIdentifierPda,
                transferProposal: transferProposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(newTransferProposal.transaction.transfer).to.not.be.null;
        expect(newTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(newTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(newTransferProposal.transaction.teleport).to.be.undefined;
        expect(newTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(newTransferProposal.multisigSigners).to.deep.equal([]);
        expect(newTransferProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const multisigSigner of multisigTests.fourthSigners) {
            await program.methods.vaultSignTransferProposal()
                .accounts({
                    signer: multisigSigner.pubkey,
                    currentMultisig: multisigPda,
                    currentTransferProposal: transferProposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([multisigSigner.keypair])
                .rpc();

            signersArray.push(multisigSigner.pubkey);
        };

        const signedTransferProposal = await program.account.vaultTransferProposalAccount.fetch(transferProposalPda);
        expect(signedTransferProposal.transaction.transfer).to.not.be.null;
        expect(signedTransferProposal.transaction.transfer.to.equals(recipient.publicKey)).to.equal(true);
        expect(signedTransferProposal.transaction.transfer.amount.toNumber()).to.equal(amount.toNumber());
        expect(signedTransferProposal.transaction.teleport).to.be.undefined;
        expect(signedTransferProposal.multisigRequiredSigners).to.deep.equal(multisigMembers);
        expect(signedTransferProposal.multisigSigners).to.deep.equal(signersArray);
        expect(signedTransferProposal.status).to.have.property("pending");

        await connection.requestAirdrop(multisigTests.fourthSigners[0].pubkey, 5e9);
        await sleep(2000);

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.vaultExecuteTransferProposal()
            .accounts({
                signer: multisigTests.fourthSigners[0].pubkey,
                currentMultisig: multisigPda,
                currentTransferProposal: transferProposalPda,
                vault: vaultPda,
                recipient: newTransferProposal.transaction.transfer.to,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([multisigTests.fourthSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("InsufficientSolBalance");
                expect(err.error.errorMessage).to.equal("SOL balance is insufficient for this operation.");
            });
    });
});
