import * as anchor from "@coral-xyz/anchor";
import { MimingSpokeSolana } from "../target/types/miming_spoke_solana";
import { SystemProgram, Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.mimingSpokeSolana as anchor.Program<MimingSpokeSolana>;
const connection = program.provider.connection;

const [mimingProposalCounterPda] = PublicKey.findProgramAddressSync([Buffer.from("miming_proposal_counter")], program.programId);
const [mimingSignatureCounterPda] = PublicKey.findProgramAddressSync([Buffer.from("miming_signature_counter")], program.programId);
const [mimingMemberCounterPda] = PublicKey.findProgramAddressSync([Buffer.from("miming_member_counter")], program.programId);

const setupTestKeypairs = async () => {
    const signer = Keypair.generate();
    const target = Keypair.generate();

    await connection.requestAirdrop(signer.publicKey, 2e9);
    await connection.requestAirdrop(target.publicKey, 2e9);

    await sleep(2000);

    return { signer, target }
}

const createProposal = async (
    signer: anchor.web3.Keypair,
    params: {
        name: string;
        actionType: { registerMember: {} } | { unregisterMember: {} };
        targetPublicKey: anchor.web3.PublicKey;
    }
): Promise<string> => {
    let uuid = "";

    try {
        await program.methods.initMultisigCounters()
            .accounts({
                signer: signer.publicKey,
                proposalCounter: mimingProposalCounterPda,
                signatureCounter: mimingSignatureCounterPda,
                memberCounter: mimingMemberCounterPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();
    } catch (err: any) {
        throw err;
    }

    const proposalCounterAccount = await program.account.multisigProposalCounter.fetch(mimingProposalCounterPda);
    const memberCounterAccount = await program.account.multisigMemberCounter.fetch(mimingMemberCounterPda);

    console.log("New Multisig Proposal Counter:", proposalCounterAccount);
    console.log("New Multisig Member Counter:", memberCounterAccount);

    const [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("miming_multisig_proposal"), proposalCounterAccount.count.toArrayLike(Buffer, "le", 8)],
        program.programId
    );

    const [memberPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("miming_multisig_member"), memberCounterAccount.count.toArrayLike(Buffer, "le", 8)],
        program.programId
    );

    try {
        await program.methods.multisigCreateProposal(params.name, params.actionType, params.targetPublicKey)
            .accounts({
                signer: signer.publicKey,
                proposalCounter: mimingProposalCounterPda,
                proposal: proposalPda,
                memberCounter: mimingMemberCounterPda,
                member: memberPda,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();
    } catch (err: any) {
        throw err;
    }

    const multisigProposal1 = await program.account.multisigProposal.fetch(proposalPda);
    console.log("Multisig Proposal 1:", multisigProposal1);
    console.log("");

    // ********************************************************

    const proposalCounterAccount2 = await program.account.multisigProposalCounter.fetch(mimingProposalCounterPda);
    const memberCounterAccount2 = await program.account.multisigMemberCounter.fetch(mimingMemberCounterPda);

    console.log("New Multisig Proposal Counter 2:", proposalCounterAccount2);
    console.log("New Multisig Member Counter 2:", memberCounterAccount2);

    const [proposalPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("miming_multisig_proposal"), proposalCounterAccount2.count.toArrayLike(Buffer, "le", 8)],
        program.programId
    );

    const [memberPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("miming_multisig_member"), memberCounterAccount2.count.toArrayLike(Buffer, "le", 8)],
        program.programId
    );

    try {
        await program.methods.multisigCreateProposal(params.name, params.actionType, params.targetPublicKey)
            .accounts({
                signer: signer.publicKey,
                proposalCounter: mimingProposalCounterPda,
                proposal: proposalPda2,
                memberCounter: mimingMemberCounterPda,
                member: memberPda2,
                systemProgram: SystemProgram.programId
            } as any)
            .signers([signer])
            .rpc();
    } catch (err: any) {
        throw err;
    }

    const multisigProposal2 = await program.account.multisigProposal.fetch(proposalPda2);
    console.log("Multisig Proposal 2:", multisigProposal2);

    console.log(proposalCounterAccount2.count.toNumber());

    for (let i = 0; i <= proposalCounterAccount2.count.toNumber(); i++) {
        const [proposalPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("miming_multisig_proposal"), Buffer.from(new anchor.BN(i).toArray('le', 8))],
            program.programId
        );
        const proposal = await program.account.multisigProposal.fetch(proposalPda);
        console.log(`Proposal ${i + 1}:`, proposal);
    }

    // const proposals = multisigRegistry.proposals;
    // const proposal = proposals.length > 0 ? proposals[proposals.length - 1] : null;

    // if (proposal) {
    //     uuid = proposal.uuid;

    //     expect(proposal.name).to.equal(params.name);
    //     expect(Object.keys(proposal.actionType)[0]).to.equal(Object.keys(params.actionType)[0]);
    //     expect(proposal.targetPubkey.equals(params.targetPublicKey)).to.be.true;

    //     if (params.expectations.expectedSigners.length > 0) {
    //         expect(proposal.requiredSigners).to.be.an("array").that.is.not.empty;

    //         for (let i = 0; i < params.expectations.expectedSigners.length; i++) {
    //             let expectedSigner = params.expectations.expectedSigners[i];

    //             const memberFound = proposal.requiredSigners.find(
    //                 signer => signer.name === expectedSigner.name && signer.pubkey.equals(expectedSigner.keypair.publicKey)
    //             );
    //             expect(memberFound, "Required signer was not found in the proposal").to.not.be.undefined;
    //         }
    //     } else {
    //         expect(proposal.requiredSigners).to.be.an("array").that.is.empty;
    //     }

    //     expect(proposal.signatures).to.be.an("array").that.is.empty;
    //     expect(proposal.status).to.have.property("pending");
    // }

    return uuid
}

// const signProposal = async (
//     signer: anchor.web3.Keypair,
//     params: {
//         uuid: string;
//         expectations: {
//             name: string;
//             actionType: string;
//             targetPublicKey: anchor.web3.PublicKey;
//             expectedSigners: {
//                 name: string,
//                 keypair: anchor.web3.Keypair;
//             }[] | [],
//             expectedSignatures: anchor.web3.PublicKey[] | []
//         }
//     }): Promise<void> => {
//     try {
//         await program.methods.multisigSignProposal(params.uuid)
//             .accounts({
//                 signer: signer.publicKey,
//                 multisig_registry: multisigRegistryPDA,
//             } as any)
//             .signers([signer])
//             .rpc();
//     } catch (err: any) {
//         throw err;
//     }

//     const multisigRegistry = await program.account.multisigRegistry.fetch(multisigRegistryPDA)

//     const proposal = multisigRegistry.proposals.find(d => d.uuid === params.uuid);
//     if (proposal) {
//         expect(proposal.uuid).to.equal(params.uuid)

//         expect(proposal.name).to.equal(params.expectations.name)
//         expect(proposal.actionType).to.have.property(params.expectations.actionType)
//         expect(proposal.targetPubkey.equals(params.expectations.targetPublicKey)).to.be.true;

//         if (params.expectations.expectedSigners.length > 0) {
//             expect(proposal.requiredSigners).to.be.an("array").that.is.not.empty;

//             for (let i = 0; i < params.expectations.expectedSigners.length; i++) {
//                 let expectedSigner = params.expectations.expectedSigners[i];

//                 const memberFound = proposal.requiredSigners.find(
//                     signer => signer.name === expectedSigner.name && signer.pubkey.equals(expectedSigner.keypair.publicKey)
//                 );
//                 expect(memberFound, "Required signer was not found in the proposal").to.not.be.undefined;
//             }
//         } else {
//             expect(proposal.requiredSigners).to.be.an("array").that.is.empty;
//         }

//         if (params.expectations.expectedSignatures.length > 0) {
//             expect(proposal.signatures).to.be.an("array").that.is.not.empty;
//             for (let i = 0; i < params.expectations.expectedSignatures.length; i++) {
//                 let expectedSignature = params.expectations.expectedSignatures[i];

//                 const signatureFound = proposal.signatures.find(
//                     signature => signature.equals(expectedSignature)
//                 );
//                 expect(signatureFound, "Signer was not found in the proposal signatures").to.not.be.undefined;
//             }
//         } else {
//             expect(proposal.signatures).to.be.an("array").that.is.empty;
//         }

//         expect(proposal.status).to.have.property("pending");
//     }
// }

// const approveProposal = async (signer: anchor.web3.Keypair,
//     params: {
//         uuid: string;
//         expectations: {
//             name: string;
//             actionType: string;
//             targetPublicKey: anchor.web3.PublicKey;
//             expectedSigners: {
//                 name: string,
//                 keypair: anchor.web3.Keypair;
//             }[] | [],
//             expectedSignatures: anchor.web3.PublicKey[] | []
//         }
//     }): Promise<void> => {
//     try {
//         await program.methods.multisigApproveProposal(params.uuid)
//             .accounts({
//                 signer: signer.publicKey,
//                 multisig_registry: multisigRegistryPDA,
//             } as any)
//             .signers([signer])
//             .rpc();
//     } catch (err: any) {
//         throw err;
//     }

//     const multisigRegistry = await program.account.multisigRegistry.fetch(multisigRegistryPDA)

//     const proposal = multisigRegistry.proposals.find(d => d.uuid === params.uuid);
//     if (proposal) {
//         expect(proposal.uuid).to.equal(params.uuid)

//         expect(proposal.name).to.equal(params.expectations.name)
//         expect(proposal.actionType).to.have.property(params.expectations.actionType)
//         expect(proposal.targetPubkey.equals(params.expectations.targetPublicKey)).to.be.true;

//         if (params.expectations.expectedSigners.length > 0) {
//             expect(proposal.requiredSigners).to.be.an("array").that.is.not.empty;

//             for (let i = 0; i < params.expectations.expectedSigners.length; i++) {
//                 let expectedSigner = params.expectations.expectedSigners[i];

//                 const memberFound = proposal.requiredSigners.find(
//                     signer => signer.name === expectedSigner.name && signer.pubkey.equals(expectedSigner.keypair.publicKey)
//                 );
//                 expect(memberFound, "Required signer was not found in the proposal").to.not.be.undefined;
//             }
//         } else {
//             expect(proposal.requiredSigners).to.be.an("array").that.is.empty;
//         }

//         if (params.expectations.expectedSignatures.length > 0) {
//             expect(proposal.signatures).to.be.an("array").that.is.not.empty;
//             for (let i = 0; i < params.expectations.expectedSignatures.length; i++) {
//                 let expectedSignature = params.expectations.expectedSignatures[i];

//                 const signatureFound = proposal.signatures.find(
//                     signature => signature.equals(expectedSignature)
//                 );
//                 expect(signatureFound, "Signer was not found in the proposal signatures").to.not.be.undefined;
//             }
//         } else {
//             expect(proposal.signatures).to.be.an("array").that.is.empty;
//         }

//         expect(proposal.status).to.have.property("approved");
//     }

//     const members = multisigRegistry.members;

//     if (params.expectations.actionType === "registerMember") {
//         expect(members).to.be.an("array").that.is.not.empty;

//         const member = members.find(d => d.pubkey.equals(params.expectations.targetPublicKey));
//         expect(member.name).to.equal(params.expectations.name)
//         expect(member.pubkey.equals(params.expectations.targetPublicKey)).to.be.true;
//     }

//     if (params.expectations.actionType === "unregisterMember") {
//         const removedMember = members.filter(d => d.pubkey.equals(params.expectations.targetPublicKey))
//         expect(removedMember.length).to.equal(0)
//     }
// }

describe("01-multisig-tests", () => {
    it("should initialize the multisig registry", async () => {
        const keypairs = await setupTestKeypairs();
        await createProposal(keypairs.signer, {
            name: "Test Proposal 1",
            actionType: { registerMember: {} },
            targetPublicKey: keypairs.target.publicKey
        });
    });
});

// describe("01-multisig-tests", () => {
//     let firstMemberSigner: anchor.web3.Keypair;
//     let secondMemberSigner: anchor.web3.Keypair;
//     let thirdMemberSigner: anchor.web3.Keypair;
//     let fourthMemberSigner: anchor.web3.Keypair;

//     /* 
//       *****************
//       PROPOSAL CREATION
//       *****************
//     */
//     describe("Proposal Creation", () => {
//         describe("create_proposal (RegisterMember)", () => {
//             it("should create a register proposal when the target is not a member.", async () => {
//                 const keypairs = await setupTestKeypairs();
//                 const uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 1",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: []
//                     }
//                 })
//             });

//             it("should fail if the target is already registered (AlreadyRegistered).", async () => {
//                 const keypairs = await setupTestKeypairs();
//                 firstMemberSigner = keypairs.target;

//                 const uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 2",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [],
//                     }
//                 });

//                 await signProposal(keypairs.signer, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 2",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [],
//                         expectedSignatures: [keypairs.signer.publicKey]
//                     }
//                 });

//                 await approveProposal(keypairs.signer, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 2",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [],
//                         expectedSignatures: [keypairs.signer.publicKey]
//                     }
//                 });

//                 await createProposal(keypairs.signer, {
//                     name: "Test Proposal 2",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [],
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("AlreadyRegistered");
//                     expect(err.error.errorMessage).to.equal("This public key is already registered.");
//                 });
//             });
//         });

//         describe("create_proposal (UnegisterMember)", () => {
//             it("should create an unregister proposal when the target is a member.", async () => {
//                 const keypairs = await setupTestKeypairs();

//                 const firstUuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 3",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                     }
//                 });

//                 await signProposal(firstMemberSigner, {
//                     uuid: firstUuid,
//                     expectations: {
//                         name: "Test Proposal 3",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 });

//                 await approveProposal(firstMemberSigner, {
//                     uuid: firstUuid,
//                     expectations: {
//                         name: "Test Proposal 3",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 });

//                 await createProposal(keypairs.signer, {
//                     name: "Test Proposal 3",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("AlreadyRegistered");
//                     expect(err.error.errorMessage).to.equal("This public key is already registered.");
//                 });

//                 const secondUuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 4 - To remove member: Test Proposal 3",
//                     actionType: { unregisterMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                     }
//                 });

//                 await signProposal(firstMemberSigner, {
//                     uuid: secondUuid,
//                     expectations: {
//                         name: "Test Proposal 4 - To remove member: Test Proposal 3",
//                         actionType: "unregisterMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 });

//                 await approveProposal(firstMemberSigner, {
//                     uuid: secondUuid,
//                     expectations: {
//                         name: "Test Proposal 4 - To remove member: Test Proposal 3",
//                         actionType: "unregisterMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 });
//             });

//             it("should fail if the target is not registered (NotRegistered).", async () => {
//                 const keypairs = await setupTestKeypairs();

//                 await createProposal(keypairs.signer, {
//                     name: "Test Proposal 5",
//                     actionType: { unregisterMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [],
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("NotRegistered");
//                     expect(err.error.errorMessage).to.equal("This public key is not registered.");
//                 });
//             });
//         });
//     });

//     /*
//       **************** 
//       PROPOSAL SIGNING
//       ****************
//     */
//     describe("Proposal Signing", () => {
//         describe("sign_proposal", () => {
//             it("should allow a valid member to sign a pending proposal.", async () => {
//                 const keypairs = await setupTestKeypairs();

//                 const uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 6",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                     }
//                 });

//                 await signProposal(firstMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 6",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 });
//             });

//             it("should fail if the signer is not a member (NotAMember).", async () => {
//                 const keypairs = await setupTestKeypairs();

//                 const uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 7",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                     }
//                 });

//                 await signProposal(keypairs.signer, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 7",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("NotAMember");
//                     expect(err.error.errorMessage).to.equal("You are not a member of this multisig.");
//                 });
//             });

//             it("should fail if proposal is not found (ProposalNotFound).", async () => {
//                 const keypairs = await setupTestKeypairs();
//                 const uuid = "123xyz";

//                 await signProposal(firstMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 8",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("ProposalNotFound");
//                     expect(err.error.errorMessage).to.equal("Proposal not found.");
//                 });
//             });

//             it("should fail if signer already signed (AlreadySigned).", async () => {
//                 const keypairs = await setupTestKeypairs();

//                 const uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 9",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                     }
//                 });

//                 await signProposal(firstMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 9",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 });

//                 await signProposal(firstMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 9",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("AlreadySigned");
//                     expect(err.error.errorMessage).to.equal("This signer has already signed.");
//                 });
//             });

//             it("should fail if proposal status is not Pending (AlreadyProcessed).", async () => {
//                 const keypairs = await setupTestKeypairs();
//                 secondMemberSigner = keypairs.target

//                 let uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 10",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                     }
//                 });

//                 await signProposal(firstMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 10",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 });

//                 await approveProposal(firstMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 10",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 });

//                 await signProposal(firstMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 10",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [{
//                             name: "Test Proposal 2",
//                             keypair: firstMemberSigner
//                         }],
//                         expectedSignatures: [firstMemberSigner.publicKey]
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("AlreadyProcessed");
//                     expect(err.error.errorMessage).to.equal("Proposal has already been approved or rejected.");
//                 });
//             });

//             it("should fail if signer is not a required signer (NotARequiredSigner).", async () => {
//                 const keypairs = await setupTestKeypairs();
//                 thirdMemberSigner = keypairs.target

//                 const expectedSigners = [
//                     {
//                         name: "Test Proposal 2",
//                         keypair: firstMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 10",
//                         keypair: secondMemberSigner
//                     },
//                 ]

//                 const firstUuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 11",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: expectedSigners,
//                     }
//                 });

//                 const firstExpectedSignatures: anchor.web3.PublicKey[] = [];
//                 for (const expectedSigner of expectedSigners) {
//                     firstExpectedSignatures.push(expectedSigner.keypair.publicKey)

//                     await signProposal(expectedSigner.keypair, {
//                         uuid: firstUuid,
//                         expectations: {
//                             name: "Test Proposal 11",
//                             actionType: "registerMember",
//                             targetPublicKey: keypairs.target.publicKey,
//                             expectedSigners: expectedSigners,
//                             expectedSignatures: firstExpectedSignatures
//                         }
//                     });
//                 }

//                 let secondUuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 12",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: expectedSigners,
//                     }
//                 });

//                 const secondExpectedSignatures: anchor.web3.PublicKey[] = [];
//                 for (const expectedSigner of expectedSigners) {
//                     secondExpectedSignatures.push(expectedSigner.keypair.publicKey)

//                     await signProposal(expectedSigner.keypair, {
//                         uuid: secondUuid,
//                         expectations: {
//                             name: "Test Proposal 12",
//                             actionType: "registerMember",
//                             targetPublicKey: keypairs.target.publicKey,
//                             expectedSigners: expectedSigners,
//                             expectedSignatures: secondExpectedSignatures
//                         }
//                     });
//                 }

//                 await approveProposal(secondMemberSigner, {
//                     uuid: secondUuid,
//                     expectations: {
//                         name: "Test Proposal 12",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: expectedSigners,
//                         expectedSignatures: [
//                             firstMemberSigner.publicKey,
//                             secondMemberSigner.publicKey,
//                         ]
//                     }
//                 });

//                 const expectedSignersWithThirdMember = [
//                     {
//                         name: "Test Proposal 2",
//                         keypair: firstMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 10",
//                         keypair: secondMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 12",
//                         keypair: thirdMemberSigner
//                     },
//                 ]

//                 await signProposal(thirdMemberSigner, {
//                     uuid: firstUuid,
//                     expectations: {
//                         name: "Test Proposal 11",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: expectedSignersWithThirdMember,
//                         expectedSignatures: [
//                             firstMemberSigner.publicKey,
//                             secondMemberSigner.publicKey,
//                             thirdMemberSigner.publicKey,
//                         ]
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("NotARequiredSigner");
//                     expect(err.error.errorMessage).to.equal("You are not listed as a required signer.");
//                 });
//             });
//         });
//     });

//     /*
//       ***************** 
//       PROPOSAL APPROVAL
//       *****************
//     */
//     describe("Proposal Approval", () => {
//         describe("approve_proposal", () => {
//             it("should approve proposal if all required signatures are present.", async () => {
//                 const keypairs = await setupTestKeypairs();
//                 fourthMemberSigner = keypairs.target

//                 const expectedSigners = [
//                     {
//                         name: "Test Proposal 2",
//                         keypair: firstMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 10",
//                         keypair: secondMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 12",
//                         keypair: thirdMemberSigner
//                     },
//                 ]

//                 let uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 13",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: expectedSigners,
//                     }
//                 });

//                 const expectedSignatures: anchor.web3.PublicKey[] = [];
//                 for (const expectedSigner of expectedSigners) {
//                     expectedSignatures.push(expectedSigner.keypair.publicKey)

//                     await signProposal(expectedSigner.keypair, {
//                         uuid: uuid,
//                         expectations: {
//                             name: "Test Proposal 13",
//                             actionType: "registerMember",
//                             targetPublicKey: keypairs.target.publicKey,
//                             expectedSigners: expectedSigners,
//                             expectedSignatures: expectedSignatures
//                         }
//                     });
//                 }

//                 await approveProposal(secondMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 13",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: expectedSigners,
//                         expectedSignatures: [
//                             firstMemberSigner.publicKey,
//                             secondMemberSigner.publicKey,
//                         ]
//                     }
//                 });
//             });

//             it("should fail if signer is not a member (NotAMember).", async () => {
//                 const keypairs = await setupTestKeypairs();

//                 const expectedSigners = [
//                     {
//                         name: "Test Proposal 2",
//                         keypair: firstMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 10",
//                         keypair: secondMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 12",
//                         keypair: thirdMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 13",
//                         keypair: fourthMemberSigner
//                     },
//                 ]

//                 let uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 14",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: expectedSigners,
//                     }
//                 });

//                 const expectedSignatures: anchor.web3.PublicKey[] = [];
//                 for (const expectedSigner of expectedSigners) {
//                     expectedSignatures.push(expectedSigner.keypair.publicKey)

//                     await signProposal(expectedSigner.keypair, {
//                         uuid: uuid,
//                         expectations: {
//                             name: "Test Proposal 14",
//                             actionType: "registerMember",
//                             targetPublicKey: keypairs.target.publicKey,
//                             expectedSigners: expectedSigners,
//                             expectedSignatures: expectedSignatures
//                         }
//                     });
//                 }

//                 await approveProposal(keypairs.signer, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 14",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: [],
//                         expectedSignatures: []
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("NotAMember");
//                     expect(err.error.errorMessage).to.equal("You are not a member of this multisig.");
//                 });
//             });

//             it("should fail if proposal not found (ProposalNotFound).", async () => {
//                 const keypairs = await setupTestKeypairs();
//                 const uuid = "123xyz";

//                 const expectedSigners = [
//                     {
//                         name: "Test Proposal 2",
//                         keypair: firstMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 10",
//                         keypair: secondMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 12",
//                         keypair: thirdMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 13",
//                         keypair: fourthMemberSigner
//                     },
//                 ]

//                 await approveProposal(secondMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 15",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: expectedSigners,
//                         expectedSignatures: []
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("ProposalNotFound");
//                     expect(err.error.errorMessage).to.equal("Proposal not found.");
//                 });
//             });

//             it("should fail if proposal already processed (AlreadyProcessed).", async () => {
//                 const keypairs = await setupTestKeypairs();

//                 const expectedSigners = [
//                     {
//                         name: "Test Proposal 2",
//                         keypair: firstMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 10",
//                         keypair: secondMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 12",
//                         keypair: thirdMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 13",
//                         keypair: fourthMemberSigner
//                     },
//                 ]

//                 let uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 16",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: expectedSigners,
//                     }
//                 });

//                 const expectedSignatures: anchor.web3.PublicKey[] = [];
//                 for (const expectedSigner of expectedSigners) {
//                     expectedSignatures.push(expectedSigner.keypair.publicKey)

//                     await signProposal(expectedSigner.keypair, {
//                         uuid: uuid,
//                         expectations: {
//                             name: "Test Proposal 16",
//                             actionType: "registerMember",
//                             targetPublicKey: keypairs.target.publicKey,
//                             expectedSigners: expectedSigners,
//                             expectedSignatures: expectedSignatures
//                         }
//                     });
//                 }

//                 await approveProposal(thirdMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 16",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: expectedSigners,
//                         expectedSignatures: [
//                             firstMemberSigner.publicKey,
//                             secondMemberSigner.publicKey,
//                             thirdMemberSigner.publicKey
//                         ]
//                     }
//                 });

//                 await approveProposal(thirdMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 16",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: expectedSigners,
//                         expectedSignatures: [
//                             firstMemberSigner.publicKey,
//                             secondMemberSigner.publicKey,
//                             thirdMemberSigner.publicKey
//                         ]
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("AlreadyProcessed");
//                     expect(err.error.errorMessage).to.equal("Proposal has already been approved or rejected.");
//                 });
//             });

//             it("should fail if not all required signatures are collected (IncompleteSignatures).", async () => {
//                 const keypairs = await setupTestKeypairs();

//                 const expectedSigners = [
//                     {
//                         name: "Test Proposal 2",
//                         keypair: firstMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 10",
//                         keypair: secondMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 12",
//                         keypair: thirdMemberSigner
//                     },
//                     {
//                         name: "Test Proposal 13",
//                         keypair: fourthMemberSigner
//                     },
//                 ]

//                 let uuid = await createProposal(keypairs.signer, {
//                     name: "Test Proposal 17",
//                     actionType: { registerMember: {} },
//                     targetPublicKey: keypairs.target.publicKey,
//                     expectations: {
//                         expectedSigners: expectedSigners,
//                     }
//                 });

//                 await signProposal(firstMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 17",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: expectedSigners,
//                         expectedSignatures: [
//                             firstMemberSigner.publicKey,
//                         ]
//                     }
//                 });

//                 await approveProposal(thirdMemberSigner, {
//                     uuid: uuid,
//                     expectations: {
//                         name: "Test Proposal 17",
//                         actionType: "registerMember",
//                         targetPublicKey: keypairs.target.publicKey,
//                         expectedSigners: expectedSigners,
//                         expectedSignatures: [
//                             firstMemberSigner.publicKey,
//                             secondMemberSigner.publicKey,
//                             thirdMemberSigner.publicKey
//                         ]
//                     }
//                 }).catch((err: any) => {
//                     expect(err).to.have.property("error");
//                     expect(err.error.errorCode?.code).to.equal("IncompleteSignatures");
//                     expect(err.error.errorMessage).to.equal("Not all required signatures are present.");
//                 });
//             });
//         });
//     });
// });
