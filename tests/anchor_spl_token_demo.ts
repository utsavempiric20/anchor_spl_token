import * as anchor from "@project-serum/anchor";
import { AnchorSplTokenDemo } from "../target/types/anchor_spl_token_demo";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import "dotenv/config";

describe("anchor_spl_token_demo", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .AnchorSplTokenDemo as anchor.Program<AnchorSplTokenDemo>;

  const MPL_TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  const payer = program.provider.publicKey;
  const splToken = new anchor.web3.PublicKey(process.env.TOKEN_MINT_ADDRESS);
  const owner = Keypair.fromSecretKey(bs58.decode(process.env.OWNER));

  const [mint_pda, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("abc")],
    program.programId
  );
  const [metadataAddress, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint_pda.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
  let fromAta;
  it("Initialize", async () => {
    const info = await program.provider.connection.getAccountInfo(mint_pda);
    if (info) {
      return;
    }
    console.log("  Mint not found. Initializing Program...");

    const metadata_tx = await program.methods
      .createTokenWithMetadata()
      .accounts({
        metadata: metadataAddress,
        mint: mint_pda,
        payer: payer,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc();

    await provider.connection.confirmTransaction(metadata_tx, "finalized");
    const new_info = await program.provider.connection.getAccountInfo(mint_pda);
    assert(new_info, " Mint should be initialized.");
  });

  it("Mint Tokens", async () => {
    fromAta = await anchor.utils.token.associatedAddress({
      mint: mint_pda,
      owner: payer,
    });

    let initialBalance: number;
    try {
      const balance = await program.provider.connection.getTokenAccountBalance(
        fromAta
      );
      initialBalance = balance.value.uiAmount;
    } catch {
      initialBalance = 0;
    }

    const mintAmount = 10;
    const txHash = await program.methods
      .mintToken(new anchor.BN(mintAmount * 10 ** 9))
      .accounts({
        mint: mint_pda,
        destination: fromAta,
        payer: payer,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();
    await program.provider.connection.confirmTransaction(txHash);
    console.log("txHash minting : ", txHash);

    const postBalance = (
      await program.provider.connection.getTokenAccountBalance(fromAta)
    ).value.uiAmount;
    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Compare balances, it must be equal"
    );
  });

  it("Transfer token", async () => {
    const toWallet = anchor.web3.Keypair.generate();

    const toATA = await getAssociatedTokenAddress(
      mint_pda,
      toWallet.publicKey,
      false
    );
    const transfer_transaction = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        owner.publicKey,
        toATA,
        toWallet.publicKey,
        mint_pda
      )
    );
    await provider.sendAndConfirm(transfer_transaction, [owner]);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const destinationPreBalance = (
      await provider.connection.getTokenAccountBalance(toATA)
    ).value.amount;

    const decimals = 10 ** 9;
    const transferAmount = 5 * decimals;

    await program.methods
      .transferToken(new anchor.BN(transferAmount))
      .accounts({
        from: fromAta,
        to: toATA,
        authority: owner.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();

    const destinationPostBalance = (
      await provider.connection.getTokenAccountBalance(toATA)
    ).value.amount;

    assert.equal(
      transferAmount + parseInt(destinationPreBalance),
      parseInt(destinationPostBalance)
    );
  });
});
