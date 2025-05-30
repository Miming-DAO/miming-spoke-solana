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
const [signatureIdentifierPda] = PublicKey.findProgramAddressSync([Buffer.from("signature_identifier")], program.programId);
const [memberIdentifierPda] = PublicKey.findProgramAddressSync([Buffer.from("member_identifier")], program.programId);

describe("01-multisig-tests", () => {
    const signer = Keypair.generate();
    const target = Keypair.generate();

    let firstMember: anchor.web3.Keypair;
    let secondMember: anchor.web3.Keypair;

    it("should initialize the identifiers.", async () => {
        const signer = Keypair.generate();

        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        await program.methods.initMultisigIdentifiers()
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                signatureIdentifier: signatureIdentifierPda,
                memberIdentifier: memberIdentifierPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();
    });

    it("should create, sign, and approve a 'register member' proposal.", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const name = "Test";
        const actionType = { registerMember: {} };
        const pubkey = target.publicKey;

        await program.methods.multisigCreateProposal(name, actionType, pubkey, null)
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                verifyTargetMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(proposal.name).to.equal(name);
        expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(actionType)[0]);
        expect(proposal.pubkey.equals(pubkey)).to.be.true;
        expect(proposal.status).to.have.property("pending");

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigSignProposal(proposal.id, null)
            .accounts({
                signer: signer.publicKey,
                signatureIdentifier: signatureIdentifierPda,
                signature: signaturePda,
                currentProposal: proposalPda,
                memberIdentifier: memberIdentifierPda,
                verifySignerMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const signature = await program.account.multisigSignature.fetch(signaturePda);
        expect(signature.proposalId.toNumber()).to.equal(proposal.id.toNumber());
        expect(signature.noRequiredSigners.toNumber()).equal(0)
        expect(signature.noSignatures.toNumber()).equal(0)
        expect(signature.pubkey.equals(signer.publicKey)).to.be.true;

        const memberIdentifier = await program.account.multisigIdentifier.fetch(memberIdentifierPda);
        const [memberPda] = PublicKey.findProgramAddressSync([
            Buffer.from("member"),
            new anchor.BN(memberIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigApproveProposal(proposal.id, signature.id)
            .accounts({
                signer: signer.publicKey,
                memberIdentifier: memberIdentifierPda,
                member: memberPda,
                currentProposal: proposalPda,
                verifySignerSignature: signaturePda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const member = await program.account.multisigMember.fetch(memberPda);
        expect(member.proposalId.toNumber()).to.equal(proposal.id.toNumber());
        expect(member.name).to.equal(proposal.name);
        expect(member.pubkey.equals(proposal.pubkey)).to.be.true;

        const updatedProposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(updatedProposal.status).to.have.property("approved");

        firstMember = target;
    });

    it("signing a proposal should fail if the proposal is not found (ProposalNotFound).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id.subn(1)).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const proposal = await program.account.multisigProposal.fetch(proposalPda);

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigSignProposal(proposal.id.addn(5), null)
            .accounts({
                signer: signer.publicKey,
                signatureIdentifier: signatureIdentifierPda,
                signature: signaturePda,
                currentProposal: proposalPda,
                memberIdentifier: memberIdentifierPda,
                verifySignerMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("ProposalNotFound");
                expect(err.error.errorMessage).to.equal("The specified proposal does not exist or is invalid.");
            });
    });

    it("signing a proposal should fail if the proposal status is not Pending (ProposalAlreadyResolved).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id.subn(1)).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const proposal = await program.account.multisigProposal.fetch(proposalPda);

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigSignProposal(proposal.id, null)
            .accounts({
                signer: signer.publicKey,
                signatureIdentifier: signatureIdentifierPda,
                signature: signaturePda,
                currentProposal: proposalPda,
                memberIdentifier: memberIdentifierPda,
                verifySignerMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("ProposalAlreadyResolved");
                expect(err.error.errorMessage).to.equal("Only pending proposals can be signed.");
            });
    });

    it("signing a proposal should fail if verify_signer_member_id is not provided (MissingVerifyMemberId).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);
        await connection.requestAirdrop(firstMember.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const name = "Test";
        const actionType = { registerMember: {} };
        const pubkey = target.publicKey;

        await program.methods.multisigCreateProposal(name, actionType, pubkey, null)
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                verifyTargetMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(proposal.name).to.equal(name);
        expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(actionType)[0]);
        expect(proposal.pubkey.equals(pubkey)).to.be.true;
        expect(proposal.status).to.have.property("pending");

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        await program.methods.multisigSignProposal(proposal.id, null)
            .accounts({
                signer: firstMember.publicKey,
                signatureIdentifier: signatureIdentifierPda,
                signature: signaturePda,
                currentProposal: proposalPda,
                memberIdentifier: memberIdentifierPda,
                verifySignerMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([firstMember])
            .rpc()
            .catch((err: any) => {
                expect(err).to.have.property("error");
                expect(err.error.errorCode?.code).to.equal("MissingVerifyMemberId");
                expect(err.error.errorMessage).to.equal("Missing 'verify_member_id' in the request.");
            });
    });

    it("signing a proposal should fail if the verifySignerMember PDA is not provided (MissingVerifyMemberPDA).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);
        await connection.requestAirdrop(firstMember.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const name = "Test";
        const actionType = { registerMember: {} };
        const pubkey = target.publicKey;

        await program.methods.multisigCreateProposal(name, actionType, pubkey, null)
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                verifyTargetMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(proposal.name).to.equal(name);
        expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(actionType)[0]);
        expect(proposal.pubkey.equals(pubkey)).to.be.true;
        expect(proposal.status).to.have.property("pending");

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const memberIdentifier = await program.account.multisigIdentifier.fetch(memberIdentifierPda);
        for (let i = 0; i < memberIdentifier.id.toNumber(); i++) {
            const [verifySignerMemberPda] = PublicKey.findProgramAddressSync([
                Buffer.from("member"),
                new anchor.BN(i).toArrayLike(Buffer, 'le', 8)
            ], program.programId);

            const member = await program.account.multisigMember.fetch(verifySignerMemberPda);
            if (member.pubkey.equals(firstMember.publicKey)) {
                await program.methods.multisigSignProposal(proposal.id, member.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        signatureIdentifier: signatureIdentifierPda,
                        signature: signaturePda,
                        currentProposal: proposalPda,
                        memberIdentifier: memberIdentifierPda,
                        verifySignerMember: null,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc()
                    .catch((err: any) => {
                        expect(err).to.have.property("error");
                        expect(err.error.errorCode?.code).to.equal("MissingVerifyMemberPDA");
                        expect(err.error.errorMessage).to.equal("Verify member PDA could not be derived from 'verify_member_id'.");
                    });

                break;
            }
        }
    });

    it("signing a proposal should fail if the signer is not a member (UnauthorizedMember).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);
        await connection.requestAirdrop(firstMember.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const name = "Test";
        const actionType = { registerMember: {} };
        const pubkey = target.publicKey;

        await program.methods.multisigCreateProposal(name, actionType, pubkey, null)
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                verifyTargetMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(proposal.name).to.equal(name);
        expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(actionType)[0]);
        expect(proposal.pubkey.equals(pubkey)).to.be.true;
        expect(proposal.status).to.have.property("pending");

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const memberIdentifier = await program.account.multisigIdentifier.fetch(memberIdentifierPda);
        for (let i = 0; i < memberIdentifier.id.toNumber(); i++) {
            const [verifySignerMemberPda] = PublicKey.findProgramAddressSync([
                Buffer.from("member"),
                new anchor.BN(i).toArrayLike(Buffer, 'le', 8)
            ], program.programId);

            const member = await program.account.multisigMember.fetch(verifySignerMemberPda);
            if (member.pubkey.equals(firstMember.publicKey)) {
                await program.methods.multisigSignProposal(proposal.id, member.id)
                    .accounts({
                        signer: signer.publicKey,
                        signatureIdentifier: signatureIdentifierPda,
                        signature: signaturePda,
                        currentProposal: proposalPda,
                        memberIdentifier: memberIdentifierPda,
                        verifySignerMember: verifySignerMemberPda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([signer])
                    .rpc()
                    .catch((err: any) => {
                        expect(err).to.have.property("error");
                        expect(err.error.errorCode?.code).to.equal("UnauthorizedMember");
                        expect(err.error.errorMessage).to.equal("The given public key is not a recognized multisig member.");
                    });

                break;
            }
        }
    });

    it("approving a proposal should fail if the proposal is not found (ProposalNotFound).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);
        await connection.requestAirdrop(firstMember.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const name = "Test";
        const actionType = { registerMember: {} };
        const pubkey = target.publicKey;

        await program.methods.multisigCreateProposal(name, actionType, pubkey, null)
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                verifyTargetMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(proposal.name).to.equal(name);
        expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(actionType)[0]);
        expect(proposal.pubkey.equals(pubkey)).to.be.true;
        expect(proposal.status).to.have.property("pending");

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const memberIdentifier = await program.account.multisigIdentifier.fetch(memberIdentifierPda);
        for (let i = 0; i < memberIdentifier.id.toNumber(); i++) {
            const [verifySignerMemberPda] = PublicKey.findProgramAddressSync([
                Buffer.from("member"),
                new anchor.BN(i).toArrayLike(Buffer, 'le', 8)
            ], program.programId);

            const member = await program.account.multisigMember.fetch(verifySignerMemberPda);
            if (member.pubkey.equals(firstMember.publicKey)) {
                await program.methods.multisigSignProposal(proposal.id, member.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        signatureIdentifier: signatureIdentifierPda,
                        signature: signaturePda,
                        currentProposal: proposalPda,
                        memberIdentifier: memberIdentifierPda,
                        verifySignerMember: verifySignerMemberPda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc();

                const signature = await program.account.multisigSignature.fetch(signaturePda);
                expect(signature.proposalId.toNumber()).to.equal(proposal.id.toNumber());
                expect(signature.noRequiredSigners.toNumber()).equal(1)
                expect(signature.noSignatures.toNumber()).equal(1)
                expect(signature.pubkey.equals(firstMember.publicKey)).to.be.true;

                const [memberPda] = PublicKey.findProgramAddressSync([
                    Buffer.from("member"),
                    new anchor.BN(memberIdentifier.id).toArrayLike(Buffer, 'le', 8)
                ], program.programId);

                await program.methods.multisigApproveProposal(proposal.id.addn(5678), signature.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        memberIdentifier: memberIdentifierPda,
                        member: memberPda,
                        currentProposal: proposalPda,
                        verifySignerSignature: signaturePda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc()
                    .catch((err: any) => {
                        expect(err).to.have.property("error");
                        expect(err.error.errorCode?.code).to.equal("ProposalNotFound");
                        expect(err.error.errorMessage).to.equal("The specified proposal does not exist or is invalid.");
                    });

                break;
            }
        }
    });

    it("approving a proposal should fail if the proposal status is not Pending (CannotApproveResolvedProposal).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);
        await connection.requestAirdrop(firstMember.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const name = "Test";
        const actionType = { registerMember: {} };
        const pubkey = target.publicKey;

        await program.methods.multisigCreateProposal(name, actionType, pubkey, null)
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                verifyTargetMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(proposal.name).to.equal(name);
        expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(actionType)[0]);
        expect(proposal.pubkey.equals(pubkey)).to.be.true;
        expect(proposal.status).to.have.property("pending");

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const memberIdentifier = await program.account.multisigIdentifier.fetch(memberIdentifierPda);
        for (let i = 0; i < memberIdentifier.id.toNumber(); i++) {
            const [verifySignerMemberPda] = PublicKey.findProgramAddressSync([
                Buffer.from("member"),
                new anchor.BN(i).toArrayLike(Buffer, 'le', 8)
            ], program.programId);

            const member = await program.account.multisigMember.fetch(verifySignerMemberPda);
            if (member.pubkey.equals(firstMember.publicKey)) {
                await program.methods.multisigSignProposal(proposal.id, member.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        signatureIdentifier: signatureIdentifierPda,
                        signature: signaturePda,
                        currentProposal: proposalPda,
                        memberIdentifier: memberIdentifierPda,
                        verifySignerMember: verifySignerMemberPda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc();

                const signature = await program.account.multisigSignature.fetch(signaturePda);
                expect(signature.proposalId.toNumber()).to.equal(proposal.id.toNumber());
                expect(signature.noRequiredSigners.toNumber()).equal(1)
                expect(signature.noSignatures.toNumber()).equal(1)
                expect(signature.pubkey.equals(firstMember.publicKey)).to.be.true;

                const [memberPda] = PublicKey.findProgramAddressSync([
                    Buffer.from("member"),
                    new anchor.BN(memberIdentifier.id).toArrayLike(Buffer, 'le', 8)
                ], program.programId);

                await program.methods.multisigApproveProposal(proposal.id, signature.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        memberIdentifier: memberIdentifierPda,
                        member: memberPda,
                        currentProposal: proposalPda,
                        verifySignerSignature: signaturePda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc()

                secondMember = target

                const updatedMemberIdentifier = await program.account.multisigIdentifier.fetch(memberIdentifierPda);
                const [updatedMemberPda] = PublicKey.findProgramAddressSync([
                    Buffer.from("member"),
                    new anchor.BN(updatedMemberIdentifier.id).toArrayLike(Buffer, 'le', 8)
                ], program.programId);

                await program.methods.multisigApproveProposal(proposal.id, signature.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        memberIdentifier: memberIdentifierPda,
                        member: updatedMemberPda,
                        currentProposal: proposalPda,
                        verifySignerSignature: signaturePda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc()
                    .catch((err: any) => {
                        expect(err).to.have.property("error");
                        expect(err.error.errorCode?.code).to.equal("CannotApproveResolvedProposal");
                        expect(err.error.errorMessage).to.equal("Only pending proposals can be approved.");
                    });

                break;
            }
        }
    });

    it("approving a proposal should fail if the signature is invalid (InvalidSignature).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);
        await connection.requestAirdrop(firstMember.publicKey, 10e9);
        await connection.requestAirdrop(secondMember.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const name = "Test";
        const actionType = { registerMember: {} };
        const pubkey = target.publicKey;

        await program.methods.multisigCreateProposal(name, actionType, pubkey, null)
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                verifyTargetMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(proposal.name).to.equal(name);
        expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(actionType)[0]);
        expect(proposal.pubkey.equals(pubkey)).to.be.true;
        expect(proposal.status).to.have.property("pending");

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const memberIdentifier = await program.account.multisigIdentifier.fetch(memberIdentifierPda);
        for (let i = 0; i < memberIdentifier.id.toNumber(); i++) {
            const [verifySignerMemberPda] = PublicKey.findProgramAddressSync([
                Buffer.from("member"),
                new anchor.BN(i).toArrayLike(Buffer, 'le', 8)
            ], program.programId);

            const member = await program.account.multisigMember.fetch(verifySignerMemberPda);
            if (member.pubkey.equals(firstMember.publicKey)) {
                await program.methods.multisigSignProposal(proposal.id, member.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        signatureIdentifier: signatureIdentifierPda,
                        signature: signaturePda,
                        currentProposal: proposalPda,
                        memberIdentifier: memberIdentifierPda,
                        verifySignerMember: verifySignerMemberPda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc();

                const signature = await program.account.multisigSignature.fetch(signaturePda);
                expect(signature.proposalId.toNumber()).to.equal(proposal.id.toNumber());
                expect(signature.noRequiredSigners.toNumber()).equal(2)
                expect(signature.noSignatures.toNumber()).equal(1)
                expect(signature.pubkey.equals(firstMember.publicKey)).to.be.true;

                const [memberPda] = PublicKey.findProgramAddressSync([
                    Buffer.from("member"),
                    new anchor.BN(memberIdentifier.id).toArrayLike(Buffer, 'le', 8)
                ], program.programId);

                await program.methods.multisigApproveProposal(proposal.id, signature.id.addn(798))
                    .accounts({
                        signer: firstMember.publicKey,
                        memberIdentifier: memberIdentifierPda,
                        member: memberPda,
                        currentProposal: proposalPda,
                        verifySignerSignature: signaturePda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc()
                    .catch((err: any) => {
                        expect(err).to.have.property("error");
                        expect(err.error.errorCode?.code).to.equal("InvalidSignature");
                        expect(err.error.errorMessage).to.equal("The provided signature is invalid or corrupted.");
                    });

                break;
            }
        }
    });

    it("approving a proposal should fail if the required signatures are incomplete (SignaturesIncomplete).", async () => {
        await connection.requestAirdrop(signer.publicKey, 10e9);
        await connection.requestAirdrop(target.publicKey, 10e9);
        await connection.requestAirdrop(firstMember.publicKey, 10e9);
        await connection.requestAirdrop(secondMember.publicKey, 10e9);

        await sleep(2000);

        const proposalIdentifier = await program.account.multisigIdentifier.fetch(proposalIdentifierPda);
        const [proposalPda] = PublicKey.findProgramAddressSync([
            Buffer.from("proposal"),
            new anchor.BN(proposalIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const name = "Test";
        const actionType = { registerMember: {} };
        const pubkey = target.publicKey;

        await program.methods.multisigCreateProposal(name, actionType, pubkey, null)
            .accounts({
                signer: signer.publicKey,
                proposalIdentifier: proposalIdentifierPda,
                proposal: proposalPda,
                verifyTargetMember: null,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();

        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        expect(proposal.name).to.equal(name);
        expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(actionType)[0]);
        expect(proposal.pubkey.equals(pubkey)).to.be.true;
        expect(proposal.status).to.have.property("pending");

        const signatureIdentifier = await program.account.multisigIdentifier.fetch(signatureIdentifierPda);
        const [signaturePda] = PublicKey.findProgramAddressSync([
            Buffer.from("signature"),
            new anchor.BN(signatureIdentifier.id).toArrayLike(Buffer, 'le', 8)
        ], program.programId);

        const memberIdentifier = await program.account.multisigIdentifier.fetch(memberIdentifierPda);
        for (let i = 0; i < memberIdentifier.id.toNumber(); i++) {
            const [verifySignerMemberPda] = PublicKey.findProgramAddressSync([
                Buffer.from("member"),
                new anchor.BN(i).toArrayLike(Buffer, 'le', 8)
            ], program.programId);

            const member = await program.account.multisigMember.fetch(verifySignerMemberPda);
            if (member.pubkey.equals(firstMember.publicKey)) {
                await program.methods.multisigSignProposal(proposal.id, member.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        signatureIdentifier: signatureIdentifierPda,
                        signature: signaturePda,
                        currentProposal: proposalPda,
                        memberIdentifier: memberIdentifierPda,
                        verifySignerMember: verifySignerMemberPda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc();

                const signature = await program.account.multisigSignature.fetch(signaturePda);
                expect(signature.proposalId.toNumber()).to.equal(proposal.id.toNumber());
                expect(signature.noRequiredSigners.toNumber()).equal(2)
                expect(signature.noSignatures.toNumber()).equal(1)
                expect(signature.pubkey.equals(firstMember.publicKey)).to.be.true;

                const [memberPda] = PublicKey.findProgramAddressSync([
                    Buffer.from("member"),
                    new anchor.BN(memberIdentifier.id).toArrayLike(Buffer, 'le', 8)
                ], program.programId);

                await program.methods.multisigApproveProposal(proposal.id, signature.id)
                    .accounts({
                        signer: firstMember.publicKey,
                        memberIdentifier: memberIdentifierPda,
                        member: memberPda,
                        currentProposal: proposalPda,
                        verifySignerSignature: signaturePda,
                        systemProgram: SystemProgram.programId
                    } as any)
                    .signers([firstMember])
                    .rpc()
                    .catch((err: any) => {
                        expect(err).to.have.property("error");
                        expect(err.error.errorCode?.code).to.equal("SignaturesIncomplete");
                        expect(err.error.errorMessage).to.equal("Proposal cannot proceed; required signatures are incomplete.");
                    });

                break;
            }
        }
    });
});