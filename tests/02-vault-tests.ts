import * as anchor from "@coral-xyz/anchor";
import { MimingSpokeSolana } from "../target/types/miming_spoke_solana";
import { SystemProgram, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { expect } from "chai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.mimingSpokeSolana as anchor.Program<MimingSpokeSolana>;
const connection = program.provider.connection;

const setupTestVariables = async () => {
    const teleporter = Keypair.generate();

    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
    );

    await connection.requestAirdrop(teleporter.publicKey, 5e9);
    await connection.requestAirdrop(vaultPda, 5e9);
    await sleep(2000);

    const mimingToken = await createMint(
        connection,
        teleporter,
        teleporter.publicKey,
        null,
        0
    );

    const teleporterMimingTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        teleporter,
        mimingToken,
        teleporter.publicKey
    );
    const teleporterMimingToken = teleporterMimingTokenAccount.address;

    const vaultMimingTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        teleporter,
        mimingToken,
        vaultPda,
        true
    );
    const vaultMimingToken = vaultMimingTokenAccount.address;

    return { teleporter, vaultPda, mimingToken, teleporterMimingToken, vaultMimingToken }
}

describe("02-vault-tests", () => {
    it("should teleport tokens and update the ledger if the user has sufficient balance for both SOL and MIMING", async () => {
        const variables = await setupTestVariables();

        const solBalanceBefore = await connection.getBalance(variables.teleporter.publicKey);

        await mintTo(
            connection,
            variables.teleporter,
            variables.mimingToken,
            variables.teleporterMimingToken,
            variables.teleporter,
            1000
        );

        const teleporterTokenBalanceBefore = await connection.getTokenAccountBalance(variables.teleporterMimingToken);
        expect(teleporterTokenBalanceBefore.value.amount).to.equals("1000")

        const amount = new anchor.BN(2 * LAMPORTS_PER_SOL);

        await program.methods
            .vaultTeleport(amount)
            .accounts({
                teleporter: variables.teleporter.publicKey,
                vault: variables.vaultPda,
                mimingToken: variables.mimingToken,
                teleporterMimingToken: variables.teleporterMimingToken,
                vaultMimingToken: variables.vaultMimingToken,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([variables.teleporter])
            .rpc();

        await sleep(2000);

        const solBalanceAfter = await connection.getBalance(variables.teleporter.publicKey);
        expect(solBalanceBefore - solBalanceAfter).to.be.lessThan(3 * LAMPORTS_PER_SOL);

        const teleporterTokenBalanceAfter = await connection.getTokenAccountBalance(variables.teleporterMimingToken);
        expect(teleporterTokenBalanceAfter.value.amount).to.equals("900")
    });

    it("should fail if the teleporter has insufficient SOL balance (InsufficientSolBalance)", async () => {
        const variables = await setupTestVariables();

        const solBalanceBefore = await connection.getBalance(variables.teleporter.publicKey);

        await mintTo(
            connection,
            variables.teleporter,
            variables.mimingToken,
            variables.teleporterMimingToken,
            variables.teleporter,
            1000
        );

        const teleporterTokenBalanceBefore = await connection.getTokenAccountBalance(variables.teleporterMimingToken);
        expect(teleporterTokenBalanceBefore.value.amount).to.equals("1000")

        const amount = new anchor.BN(10 * LAMPORTS_PER_SOL);

        await program.methods
            .vaultTeleport(amount)
            .accounts({
                teleporter: variables.teleporter.publicKey,
                vault: variables.vaultPda,
                mimingToken: variables.mimingToken,
                teleporterMimingToken: variables.teleporterMimingToken,
                vaultMimingToken: variables.vaultMimingToken,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([variables.teleporter])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("InsufficientSolBalance");
                expect(err.error.errorMessage).to.equal("Insufficient SOL balance.");
            });

        await sleep(2000);

        const solBalanceAfter = await connection.getBalance(variables.teleporter.publicKey);
        expect(solBalanceAfter).to.lessThanOrEqual(solBalanceBefore);

        const teleporterTokenBalanceAfter = await connection.getTokenAccountBalance(variables.teleporterMimingToken);
        expect(teleporterTokenBalanceAfter.value.amount).to.equals("1000")
    });

    it("should fail if the teleporter has insufficient MIMING balance (InsufficientMimingBalance)", async () => {
        const variables = await setupTestVariables();

        const solBalanceBefore = await connection.getBalance(variables.teleporter.publicKey);

        await mintTo(
            connection,
            variables.teleporter,
            variables.mimingToken,
            variables.teleporterMimingToken,
            variables.teleporter,
            50
        );

        const teleporterTokenBalanceBefore = await connection.getTokenAccountBalance(variables.teleporterMimingToken);
        expect(teleporterTokenBalanceBefore.value.amount).to.equals("50")

        const amount = new anchor.BN(2 * LAMPORTS_PER_SOL);

        await program.methods
            .vaultTeleport(amount)
            .accounts({
                teleporter: variables.teleporter.publicKey,
                vault: variables.vaultPda,
                mimingToken: variables.mimingToken,
                teleporterMimingToken: variables.teleporterMimingToken,
                vaultMimingToken: variables.vaultMimingToken,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([variables.teleporter])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("InsufficientMimingBalance");
                expect(err.error.errorMessage).to.equal("Insufficient MIMING token balance.");
            });

        await sleep(2000);

        const solBalanceAfter = await connection.getBalance(variables.teleporter.publicKey);
        expect(solBalanceBefore - solBalanceAfter).to.be.lessThan(3 * LAMPORTS_PER_SOL);

        const teleporterTokenBalanceAfter = await connection.getTokenAccountBalance(variables.teleporterMimingToken);
        expect(teleporterTokenBalanceAfter.value.amount).to.equals("50")
    });
});
