import * as anchor from "@coral-xyz/anchor";
import { MimingSpokeSolana } from "../target/types/miming_spoke_solana";
import { SystemProgram, Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.mimingSpokeSolana as anchor.Program<MimingSpokeSolana>;
const connection = program.provider.connection;

const [proposalIdentifierPda] = PublicKey.findProgramAddressSync([Buffer.from("proposal_identifier")], program.programId);
const [multisigPda] = PublicKey.findProgramAddressSync([Buffer.from("multisig")], program.programId);

const signer = Keypair.generate();
const target = Keypair.generate();

let firstSigners: { name: string; pubkey: PublicKey; keypair: Keypair; }[] = [];
let secondSigners: { name: string; pubkey: PublicKey; keypair: Keypair; }[] = [];
let thirdSigners: { name: string; pubkey: PublicKey; keypair: Keypair; }[] = [];
let fourthSigners: { name: string; pubkey: PublicKey; keypair: Keypair; }[] = [];

describe("01-multisig-tests", () => {
    it("should initialize multisig.", async () => {
        const signer = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        await program.methods.multisigInitialize()
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                multisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();
    });

    it("creating a proposal should succeed with valid signers and threshold.", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 5;

        const signer1 = Keypair.generate();
        const signer2 = Keypair.generate();
        const signer3 = Keypair.generate();
        const signer4 = Keypair.generate();
        const signer5 = Keypair.generate();

        const signers: { name: string; pubkey: PublicKey; }[] = [
            { name: "signer1", pubkey: signer1.publicKey },
            { name: "signer2", pubkey: signer2.publicKey },
            { name: "signer3", pubkey: signer3.publicKey },
            { name: "signer4", pubkey: signer4.publicKey },
            { name: "signer5", pubkey: signer5.publicKey },
        ]

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(5);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal([]);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        await program.methods.multisigSignProposal()
            .accounts({
                signer: signer.publicKey,
                currentProposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const signedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(signedProposal.data.name).to.equal(name);
        expect(signedProposal.data.threshold).equal(5);
        expect(signedProposal.data.signers).to.deep.equal(signers);
        expect(signedProposal.requiredSigners).to.deep.equal([]);
        expect(signedProposal.signers).to.deep.equal([signer.publicKey]);
        expect(signedProposal.status).to.have.property("pending");

        await program.methods.multisigApproveProposal()
            .accounts({
                signer: signer.publicKey,
                currentProposal: proposalPda,
                currentMultisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const approvedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(approvedProposal.data.name).to.equal(name);
        expect(approvedProposal.data.threshold).equal(5);
        expect(approvedProposal.data.signers).to.deep.equal(signers);
        expect(approvedProposal.requiredSigners).to.deep.equal([]);
        expect(approvedProposal.signers).to.deep.equal([signer.publicKey]);
        expect(approvedProposal.status).to.have.property("approved");

        const multisig = await program.account.multisigAccount.fetch(multisigPda);
        expect(multisig.name).to.equal(name);
        expect(multisig.threshold).equal(5);
        expect(multisig.signers).to.deep.equal(signers);

        const signerKeypairs = [signer1, signer2, signer3, signer4, signer5];
        firstSigners = signers.map((signer, index) => ({
            name: signer.name,
            pubkey: signer.pubkey,
            keypair: signerKeypairs[index]
        }));
    });

    it("creating a proposal should fail if threshold exceeds maximum allowed (ThresholdLimitReached).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 11;

        const signer1 = Keypair.generate();
        const signer2 = Keypair.generate();
        const signer3 = Keypair.generate();
        const signer4 = Keypair.generate();
        const signer5 = Keypair.generate();

        const signers: { name: string; pubkey: PublicKey; }[] = [
            { name: "signer1", pubkey: signer1.publicKey },
            { name: "signer2", pubkey: signer2.publicKey },
            { name: "signer3", pubkey: signer3.publicKey },
            { name: "signer4", pubkey: signer4.publicKey },
            { name: "signer5", pubkey: signer5.publicKey },
        ]

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("ThresholdLimitReached");
                expect(err.error.errorMessage).to.equal("The proposal has already reached the required number of approvals.");
            });
    });

    it("creating a proposal should fail if signer count exceeds maximum allowed (SignerLimitReached).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 5;
        const signers: { name: string; pubkey: PublicKey; }[] = Array.from({ length: 11 }, (_, i) => {
            const signer = Keypair.generate();
            return {
                name: `signer${i + 1}`,
                pubkey: signer.publicKey
            };
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("SignerLimitReached");
                expect(err.error.errorMessage).to.equal("The number of signers has reached the allowed maximum.");
            });
    });

    it("should sign a proposal if signer is valid and has not signed yet.", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 5;
        const signers: { name: string; pubkey: PublicKey; }[] = Array.from({ length: 5 }, (_, i) => {
            const signer = Keypair.generate();
            return {
                name: `signer${i + 1}`,
                pubkey: signer.publicKey
            };
        });

        const requiredSigners = firstSigners.map(signer => {
            return signer.pubkey
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(5);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const signer of firstSigners) {
            await program.methods.multisigSignProposal()
                .accounts({
                    signer: signer.pubkey,
                    currentProposal: proposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([signer.keypair])
                .rpc();

            signersArray.push(signer.pubkey);
        };

        const signedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(signedProposal.data.name).to.equal(name);
        expect(signedProposal.data.threshold).equal(5);
        expect(signedProposal.data.signers).to.deep.equal(signers);
        expect(signedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(signedProposal.signers).to.deep.equal(signersArray);
        expect(signedProposal.status).to.have.property("pending");
    });

    it("signing a proposal should fail if the proposal is already resolved (AlreadyResolved).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 5;

        const signer1 = Keypair.generate();
        const signer2 = Keypair.generate();
        const signer3 = Keypair.generate();
        const signer4 = Keypair.generate();
        const signer5 = Keypair.generate();

        const signers: { name: string; pubkey: PublicKey; }[] = [
            { name: "signer1", pubkey: signer1.publicKey },
            { name: "signer2", pubkey: signer2.publicKey },
            { name: "signer3", pubkey: signer3.publicKey },
            { name: "signer4", pubkey: signer4.publicKey },
            { name: "signer5", pubkey: signer5.publicKey },
        ]

        const requiredSigners = firstSigners.map(signer => {
            return signer.pubkey
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(5);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const signer of firstSigners) {
            await program.methods.multisigSignProposal()
                .accounts({
                    signer: signer.pubkey,
                    currentProposal: proposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([signer.keypair])
                .rpc();

            signersArray.push(signer.pubkey);
        };

        const signedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(signedProposal.data.name).to.equal(name);
        expect(signedProposal.data.threshold).equal(5);
        expect(signedProposal.data.signers).to.deep.equal(signers);
        expect(signedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(signedProposal.signers).to.deep.equal(signersArray);
        expect(signedProposal.status).to.have.property("pending");

        await program.methods.multisigApproveProposal()
            .accounts({
                signer: firstSigners[0].pubkey,
                currentProposal: proposalPda,
                currentMultisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([firstSigners[0].keypair])
            .rpc();

        const approvedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(approvedProposal.data.name).to.equal(name);
        expect(approvedProposal.data.threshold).equal(5);
        expect(approvedProposal.data.signers).to.deep.equal(signers);
        expect(approvedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(approvedProposal.signers).to.deep.equal(signersArray);
        expect(approvedProposal.status).to.have.property("approved");

        const multisig = await program.account.multisigAccount.fetch(multisigPda);
        expect(multisig.name).to.equal(name);
        expect(multisig.threshold).equal(5);
        expect(multisig.signers).to.deep.equal(signers);

        const signerKeypairs = [signer1, signer2, signer3, signer4, signer5];
        secondSigners = signers.map((signer, index) => ({
            name: signer.name,
            pubkey: signer.pubkey,
            keypair: signerKeypairs[index]
        }));

        await program.methods.multisigApproveProposal()
            .accounts({
                signer: firstSigners[0].pubkey,
                currentProposal: proposalPda,
                currentMultisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([firstSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("AlreadyResolved");
                expect(err.error.errorMessage).to.equal("This proposal has been finalized and cannot be changed.");
            });
    });

    it("signing a proposal should fail if the signer is not among required signers (UnauthorizedSigner).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 5;
        const signers: { name: string; pubkey: PublicKey; }[] = Array.from({ length: 5 }, (_, i) => {
            const signer = Keypair.generate();
            return {
                name: `signer${i + 1}`,
                pubkey: signer.publicKey
            };
        });

        const requiredSigners = secondSigners.map(signer => {
            return signer.pubkey
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(5);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        await program.methods.multisigSignProposal()
            .accounts({
                signer: signer.publicKey,
                currentProposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("UnauthorizedSigner");
                expect(err.error.errorMessage).to.equal("The public key is not authorized to sign this proposal.");
            });
    });

    it("signing a proposal should fail if the signer has already signed (DuplicateSignature).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 5;
        const signers: { name: string; pubkey: PublicKey; }[] = Array.from({ length: 5 }, (_, i) => {
            const signer = Keypair.generate();
            return {
                name: `signer${i + 1}`,
                pubkey: signer.publicKey
            };
        });

        const requiredSigners = secondSigners.map(signer => {
            return signer.pubkey
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(5);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const signer of secondSigners) {
            await program.methods.multisigSignProposal()
                .accounts({
                    signer: signer.pubkey,
                    currentProposal: proposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([signer.keypair])
                .rpc();

            signersArray.push(signer.pubkey);
        };

        const signedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(signedProposal.data.name).to.equal(name);
        expect(signedProposal.data.threshold).equal(5);
        expect(signedProposal.data.signers).to.deep.equal(signers);
        expect(signedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(signedProposal.signers).to.deep.equal(signersArray);
        expect(signedProposal.status).to.have.property("pending");

        await program.methods.multisigSignProposal()
            .accounts({
                signer: secondSigners[0].pubkey,
                currentProposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([secondSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("DuplicateSignature");
                expect(err.error.errorMessage).to.equal("This public key has already provided a signature.");
            });
    });

    it("should approve a proposal if all required signatures are present.", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 7;

        const signer1 = Keypair.generate();
        const signer2 = Keypair.generate();
        const signer3 = Keypair.generate();
        const signer4 = Keypair.generate();
        const signer5 = Keypair.generate();
        const signer6 = Keypair.generate();
        const signer7 = Keypair.generate();

        const signers: { name: string; pubkey: PublicKey; }[] = [
            { name: "signer1", pubkey: signer1.publicKey },
            { name: "signer2", pubkey: signer2.publicKey },
            { name: "signer3", pubkey: signer3.publicKey },
            { name: "signer4", pubkey: signer4.publicKey },
            { name: "signer5", pubkey: signer5.publicKey },
            { name: "signer6", pubkey: signer6.publicKey },
            { name: "signer7", pubkey: signer7.publicKey },
        ]

        const requiredSigners = secondSigners.map(signer => {
            return signer.pubkey
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(7);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const signer of secondSigners) {
            await program.methods.multisigSignProposal()
                .accounts({
                    signer: signer.pubkey,
                    currentProposal: proposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([signer.keypair])
                .rpc();

            signersArray.push(signer.pubkey);
        };

        const signedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(signedProposal.data.name).to.equal(name);
        expect(signedProposal.data.threshold).equal(7);
        expect(signedProposal.data.signers).to.deep.equal(signers);
        expect(signedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(signedProposal.signers).to.deep.equal(signersArray);
        expect(signedProposal.status).to.have.property("pending");

        await program.methods.multisigApproveProposal()
            .accounts({
                signer: secondSigners[0].pubkey,
                currentProposal: proposalPda,
                currentMultisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([secondSigners[0].keypair])
            .rpc();

        const approvedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(approvedProposal.data.name).to.equal(name);
        expect(approvedProposal.data.threshold).equal(7);
        expect(approvedProposal.data.signers).to.deep.equal(signers);
        expect(approvedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(approvedProposal.signers).to.deep.equal(signersArray);
        expect(approvedProposal.status).to.have.property("approved");

        const multisig = await program.account.multisigAccount.fetch(multisigPda);
        expect(multisig.name).to.equal(name);
        expect(multisig.threshold).equal(7);
        expect(multisig.signers).to.deep.equal(signers);

        const signerKeypairs = [signer1, signer2, signer3, signer4, signer5, signer6, signer7];
        thirdSigners = signers.map((signer, index) => ({
            name: signer.name,
            pubkey: signer.pubkey,
            keypair: signerKeypairs[index]
        }));
    });

    it("approving a proposal should fail if the proposal is already resolved (AlreadyResolved).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 4;

        const signer1 = Keypair.generate();
        const signer2 = Keypair.generate();
        const signer3 = Keypair.generate();
        const signer4 = Keypair.generate();

        const signers: { name: string; pubkey: PublicKey; }[] = [
            { name: "signer1", pubkey: signer1.publicKey },
            { name: "signer2", pubkey: signer2.publicKey },
            { name: "signer3", pubkey: signer3.publicKey },
            { name: "signer4", pubkey: signer4.publicKey },
        ]

        const requiredSigners = thirdSigners.map(signer => {
            return signer.pubkey
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(4);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const signer of thirdSigners) {
            await program.methods.multisigSignProposal()
                .accounts({
                    signer: signer.pubkey,
                    currentProposal: proposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([signer.keypair])
                .rpc();

            signersArray.push(signer.pubkey);
        };

        const signedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(signedProposal.data.name).to.equal(name);
        expect(signedProposal.data.threshold).equal(4);
        expect(signedProposal.data.signers).to.deep.equal(signers);
        expect(signedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(signedProposal.signers).to.deep.equal(signersArray);
        expect(signedProposal.status).to.have.property("pending");

        await program.methods.multisigApproveProposal()
            .accounts({
                signer: thirdSigners[0].pubkey,
                currentProposal: proposalPda,
                currentMultisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([thirdSigners[0].keypair])
            .rpc();

        const approvedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(approvedProposal.data.name).to.equal(name);
        expect(approvedProposal.data.threshold).equal(4);
        expect(approvedProposal.data.signers).to.deep.equal(signers);
        expect(approvedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(approvedProposal.signers).to.deep.equal(signersArray);
        expect(approvedProposal.status).to.have.property("approved");

        const multisig = await program.account.multisigAccount.fetch(multisigPda);
        expect(multisig.name).to.equal(name);
        expect(multisig.threshold).equal(4);
        expect(multisig.signers).to.deep.equal(signers);

        const signerKeypairs = [signer1, signer2, signer3, signer4];
        fourthSigners = signers.map((signer, index) => ({
            name: signer.name,
            pubkey: signer.pubkey,
            keypair: signerKeypairs[index]
        }));

        await program.methods.multisigApproveProposal()
            .accounts({
                signer: fourthSigners[0].pubkey,
                currentProposal: proposalPda,
                currentMultisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([fourthSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("AlreadyResolved");
                expect(err.error.errorMessage).to.equal("This proposal has been finalized and cannot be changed.");
            });
    });

    it("approving a proposal should fail if the signer did not sign the proposal (UnauthorizedSigner).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 4;

        const signer1 = Keypair.generate();
        const signer2 = Keypair.generate();
        const signer3 = Keypair.generate();
        const signer4 = Keypair.generate();

        const signers: { name: string; pubkey: PublicKey; }[] = [
            { name: "signer1", pubkey: signer1.publicKey },
            { name: "signer2", pubkey: signer2.publicKey },
            { name: "signer3", pubkey: signer3.publicKey },
            { name: "signer4", pubkey: signer4.publicKey },
        ]

        const requiredSigners = fourthSigners.map(signer => {
            return signer.pubkey
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(4);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        const signersArray: PublicKey[] = [];
        for (const signer of fourthSigners) {
            await program.methods.multisigSignProposal()
                .accounts({
                    signer: signer.pubkey,
                    currentProposal: proposalPda,
                    systemProgram: SystemProgram.programId
                } as any)
                .signers([signer.keypair])
                .rpc();

            signersArray.push(signer.pubkey);
        };

        const signedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(signedProposal.data.name).to.equal(name);
        expect(signedProposal.data.threshold).equal(4);
        expect(signedProposal.data.signers).to.deep.equal(signers);
        expect(signedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(signedProposal.signers).to.deep.equal(signersArray);
        expect(signedProposal.status).to.have.property("pending");

        await program.methods.multisigApproveProposal()
            .accounts({
                signer: signer.publicKey,
                currentProposal: proposalPda,
                currentMultisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("UnauthorizedSigner");
                expect(err.error.errorMessage).to.equal("The public key is not authorized to sign this proposal.");
            });
    });

    it("approving a proposal should fail if not all required signatures are collected (InsufficientSignatures).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const name = "Test";
        const threshold = 3;
        const signers: { name: string; pubkey: PublicKey; }[] = Array.from({ length: 3 }, (_, i) => {
            const signer = Keypair.generate();
            return {
                name: `signer${i + 1}`,
                pubkey: signer.publicKey
            };
        });

        const requiredSigners = fourthSigners.map(signer => {
            return signer.pubkey
        });

        const proposalIdentifier = await program.account.identifierAccount.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigCreateProposal(name, threshold, signers)
            .accounts({
                signer: signer.publicKey,
                currentMultisig: multisigPda,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const newProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(newProposal.data.name).to.equal(name);
        expect(newProposal.data.threshold).equal(3);
        expect(newProposal.data.signers).to.deep.equal(signers);
        expect(newProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(newProposal.signers).to.deep.equal([]);
        expect(newProposal.status).to.have.property("pending");

        await program.methods.multisigSignProposal()
            .accounts({
                signer: fourthSigners[0].pubkey,
                currentProposal: proposalPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([fourthSigners[0].keypair])
            .rpc();

        const signedProposal = await program.account.multisigProposalAccount.fetch(proposalPda);
        expect(signedProposal.data.name).to.equal(name);
        expect(signedProposal.data.threshold).equal(3);
        expect(signedProposal.data.signers).to.deep.equal(signers);
        expect(signedProposal.requiredSigners).to.deep.equal(requiredSigners);
        expect(signedProposal.signers).to.deep.equal([fourthSigners[0].pubkey]);
        expect(signedProposal.status).to.have.property("pending");

        await program.methods.multisigApproveProposal()
            .accounts({
                signer: fourthSigners[0].pubkey,
                currentProposal: proposalPda,
                currentMultisig: multisigPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([fourthSigners[0].keypair])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("InsufficientSignatures");
                expect(err.error.errorMessage).to.equal("Not enough signatures have been collected to proceed.");
            });
    });
});

export { fourthSigners };