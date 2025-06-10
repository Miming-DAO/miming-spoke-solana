import * as anchor from "@coral-xyz/anchor";
import { MimingSpokeSolana } from "../target/types/miming_spoke_solana";
import { SystemProgram, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.mimingSpokeSolana as anchor.Program<MimingSpokeSolana>;
const connection = program.provider.connection;

const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], program.programId);
const [ledgerIdentifierPda] = PublicKey.findProgramAddressSync([Buffer.from("ledger_identifier")], program.programId);

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
    });

    it("should teleport tokens and update the ledger if the user has sufficient SOL balance.", async () => {
        const signer = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 5e9);
        await connection.requestAirdrop(vaultPda, 5e9);

        await sleep(2000);

        const solBalanceBefore = await connection.getBalance(signer.publicKey);

        const amount = new anchor.BN(2 * LAMPORTS_PER_SOL);

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods
            .vaultTeleport(amount) // 2 * LAMPORTS_PER_SOL
            .accounts({
                signer: signer.publicKey,
                vault: vaultPda,
                ledgerIdentifier: ledgerIdentifierPda,
                ledger: ledgerPda,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([signer])
            .rpc();

        // const ledger = await program.account.vaultLedgerAccount.fetch(ledgerPda);
        // console.log(ledger);
        // console.log((ledger.ledger.amount.toNumber() / LAMPORTS_PER_SOL).toString());
        // console.log((ledger.ledger.mimingFee.toNumber() / LAMPORTS_PER_SOL).toString());

        await sleep(2000);

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

        const ledgerIdentifier = await program.account.identifierAccount.fetch(ledgerIdentifierPda);
        const [ledgerPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ledger"),
            new anchor.BN(ledgerIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods
            .vaultTeleport(amount)
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

        await sleep(2000);

        const solBalanceAfter = await connection.getBalance(signer.publicKey);
        expect(solBalanceAfter).to.lessThanOrEqual(solBalanceBefore);
    });
});
