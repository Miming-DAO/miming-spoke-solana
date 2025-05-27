// import * as anchor from "@coral-xyz/anchor";
// import { MimingSpokeSolana } from "../target/types/miming_spoke_solana";
// import { SystemProgram, Keypair, PublicKey } from "@solana/web3.js";
// import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
// import { expect } from "chai";

// const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// const provider = anchor.AnchorProvider.env();
// anchor.setProvider(provider);
// const program = anchor.workspace.mimingSpokeSolana as anchor.Program<MimingSpokeSolana>;
// const connection = program.provider.connection;

// const setupTestVariables = async () => {
//     const staker = Keypair.generate();

//     await connection.requestAirdrop(staker.publicKey, 2e9);
//     await sleep(2000);

//     const token = await createMint(
//         connection,
//         staker,
//         staker.publicKey,
//         staker.publicKey,
//         0
//     );

//     const stakerTokenAccount = await getOrCreateAssociatedTokenAccount(
//         connection,
//         staker,
//         token,
//         staker.publicKey
//     );
//     const stakerToken = stakerTokenAccount.address;

//     const [stakingConfigPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("miming_staking_config")],
//         program.programId
//     );

//     const [stakingRegistryPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("miming_staking_registry"), staker.publicKey.toBuffer()],
//         program.programId
//     );

//     return { staker, token, stakerToken, stakingConfigPda, stakingRegistryPda }
// }

// describe("03-staking-tests", () => {
//     /* 
//       ***************
//       FREEZING TOKENS
//       ***************
//     */
//     describe("staking_freeze", () => {
//         it("should freeze tokens with sufficient balance", async () => {
//             const variables = await setupTestVariables();

//             await mintTo(
//                 connection,
//                 variables.staker,
//                 variables.token,
//                 variables.stakerToken,
//                 variables.staker,
//                 1000
//             );

//             const stakerTokenBalanceBefore = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceBefore.value.amount).to.equals("1000")

//             await program.methods
//                 .stakingFreeze("12345")
//                 .accounts({
//                     staker: variables.staker.publicKey,
//                     token: variables.token,
//                     stakerToken: variables.stakerToken,
//                     stakingConfig: variables.stakingConfigPda,
//                     stakingRegistry: variables.stakingRegistryPda,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                     systemProgram: SystemProgram.programId,
//                 } as any)
//                 .signers([variables.staker])
//                 .rpc()

//             const stakerTokenBalanceAfter = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceAfter.value.amount).to.equals("1000")

//             const stakerTokenInfo = await getAccount(connection, variables.stakerToken);
//             const isFrozen = stakerTokenInfo.isFrozen;

//             expect(isFrozen).to.be.true;

//             const stakingRegistry = await program.account.stakingRegistry.fetch(variables.stakingRegistryPda)
//             expect(stakingRegistry.referenceId).to.equals("12345")
//         });

//         it("should fail if the staker has an insufficient balance (InsufficientStakingBalance)", async () => {
//             const variables = await setupTestVariables();

//             await mintTo(
//                 connection,
//                 variables.staker,
//                 variables.token,
//                 variables.stakerToken,
//                 variables.staker,
//                 0
//             );

//             const stakerTokenBalanceBefore = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceBefore.value.amount).to.equals("0")

//             await program.methods
//                 .stakingFreeze("12345")
//                 .accounts({
//                     staker: variables.staker.publicKey,
//                     token: variables.token,
//                     stakerToken: variables.stakerToken,
//                     freezeAuthority: variables.staker.publicKey,
//                     stakingConfig: variables.stakingConfigPda,
//                     stakingRegistry: variables.stakingRegistryPda,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                     systemProgram: SystemProgram.programId,
//                 } as any)
//                 .signers([variables.staker])
//                 .rpc().catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("InsufficientStakingBalance");
//                     expect(err.error.errorMessage).to.equal("Insufficient token balance to stake.");
//                 });

//             const stakerTokenInfo = await getAccount(connection, variables.stakerToken);
//             expect(stakerTokenInfo.isFrozen).to.be.false;

//             let stakingRegistry;
//             try {
//                 stakingRegistry = await program.account.stakingRegistry.fetch(variables.stakingRegistryPda);
//             } catch (err) {
//                 stakingRegistry = null;
//             }
//             expect(stakingRegistry).to.be.null;
//         });
//     });

//     /* 
//       **************
//       THAWING TOKENS
//       **************
//     */
//     describe("staking_thaw", () => {
//         it("should thaw tokens after they've been frozen", async () => {
//             const variables = await setupTestVariables();

//             await mintTo(
//                 connection,
//                 variables.staker,
//                 variables.token,
//                 variables.stakerToken,
//                 variables.staker,
//                 1000
//             );

//             const stakerTokenBalanceBefore = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceBefore.value.amount).to.equals("1000")

//             await program.methods
//                 .stakingFreeze("12345")
//                 .accounts({
//                     staker: variables.staker.publicKey,
//                     token: variables.token,
//                     stakerToken: variables.stakerToken,
//                     freezeAuthority: variables.staker.publicKey,
//                     stakingConfig: variables.stakingConfigPda,
//                     stakingRegistry: variables.stakingRegistryPda,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                     systemProgram: SystemProgram.programId,
//                 } as any)
//                 .signers([variables.staker])
//                 .rpc()

//             const stakerTokenBalanceAfterFreezing = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceAfterFreezing.value.amount).to.equals("1000")

//             const stakerTokenInfoAfterFreezing = await getAccount(connection, variables.stakerToken);
//             expect(stakerTokenInfoAfterFreezing.isFrozen).to.be.true;

//             await program.methods
//                 .stakingThaw()
//                 .accounts({
//                     staker: variables.staker.publicKey,
//                     token: variables.token,
//                     stakerToken: variables.stakerToken,
//                     freezeAuthority: variables.staker.publicKey,
//                     stakingConfig: variables.stakingConfigPda,
//                     stakingRegistry: variables.stakingRegistryPda,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                     systemProgram: SystemProgram.programId,
//                 } as any)
//                 .signers([variables.staker])
//                 .rpc()

//             const stakerTokenBalanceAfterThawing = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceAfterThawing.value.amount).to.equals("1000")

//             const stakerTokenInfoAfterThawing = await getAccount(connection, variables.stakerToken);
//             expect(stakerTokenInfoAfterThawing.isFrozen).to.be.false;

//             const stakingRegistry = await program.account.stakingRegistry.fetch(variables.stakingRegistryPda)
//             expect(stakingRegistry.referenceId).to.equals("")
//         });

//         it("should update the registry after the tokens are thawed and then frozen again.", async () => {
//             const variables = await setupTestVariables();

//             await mintTo(
//                 connection,
//                 variables.staker,
//                 variables.token,
//                 variables.stakerToken,
//                 variables.staker,
//                 1000
//             );

//             const stakerTokenBalanceBefore = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceBefore.value.amount).to.equals("1000")

//             await program.methods
//                 .stakingFreeze("12345")
//                 .accounts({
//                     staker: variables.staker.publicKey,
//                     token: variables.token,
//                     stakerToken: variables.stakerToken,
//                     freezeAuthority: variables.staker.publicKey,
//                     stakingConfig: variables.stakingConfigPda,
//                     stakingRegistry: variables.stakingRegistryPda,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                     systemProgram: SystemProgram.programId,
//                 } as any)
//                 .signers([variables.staker])
//                 .rpc()

//             const stakerTokenBalanceAfterFreezing = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceAfterFreezing.value.amount).to.equals("1000")

//             const stakerTokenInfoAfterFreezing = await getAccount(connection, variables.stakerToken);
//             expect(stakerTokenInfoAfterFreezing.isFrozen).to.be.true;

//             await program.methods
//                 .stakingThaw()
//                 .accounts({
//                     staker: variables.staker.publicKey,
//                     token: variables.token,
//                     stakerToken: variables.stakerToken,
//                     freezeAuthority: variables.staker.publicKey,
//                     stakingConfig: variables.stakingConfigPda,
//                     stakingRegistry: variables.stakingRegistryPda,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                     systemProgram: SystemProgram.programId,
//                 } as any)
//                 .signers([variables.staker])
//                 .rpc()

//             const stakerTokenBalanceAfterThawing = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceAfterThawing.value.amount).to.equals("1000")

//             const stakerTokenInfoAfterThawing = await getAccount(connection, variables.stakerToken);
//             expect(stakerTokenInfoAfterThawing.isFrozen).to.be.false;

//             const stakingRegistry = await program.account.stakingRegistry.fetch(variables.stakingRegistryPda)
//             expect(stakingRegistry.referenceId).to.equals("")

//             const stakerTokenBalanceAfterThawed = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceAfterThawed.value.amount).to.equals("1000")

//             await program.methods
//                 .stakingFreeze("12345")
//                 .accounts({
//                     staker: variables.staker.publicKey,
//                     token: variables.token,
//                     stakerToken: variables.stakerToken,
//                     stakingConfig: variables.stakingConfigPda,
//                     stakingRegistry: variables.stakingRegistryPda,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                     systemProgram: SystemProgram.programId,
//                 } as any)
//                 .signers([variables.staker])
//                 .rpc()

//             const stakerTokenBalanceAfterFrozen = await connection.getTokenAccountBalance(variables.stakerToken);
//             expect(stakerTokenBalanceAfterFrozen.value.amount).to.equals("1000")

//             const stakerTokenInfo = await getAccount(connection, variables.stakerToken);
//             const isFrozen = stakerTokenInfo.isFrozen;

//             expect(isFrozen).to.be.true;

//             const updatedStakingRegistry = await program.account.stakingRegistry.fetch(variables.stakingRegistryPda)
//             expect(updatedStakingRegistry.referenceId).to.equals("12345")
//         });
//     });
// });
