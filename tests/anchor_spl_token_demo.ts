import * as anchor from "@project-serum/anchor";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorSplTokenDemo } from "../target/types/anchor_spl_token_demo";
import { assert } from "chai";

describe("anchor_spl_token_demo", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .AnchorSplTokenDemo as anchor.Program<AnchorSplTokenDemo>;

  let associatedTokenAccount: any;
  const mywallet = provider.wallet.publicKey;
  const mintKey = anchor.web3.Keypair.generate();
  it("Mint token", async () => {
    const lamports =
      await program.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE
      );

    associatedTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      mywallet
    );

    const mint_transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: mywallet,
        newAccountPubkey: mintKey.publicKey,
        lamports: lamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),

      createInitializeMintInstruction(mintKey.publicKey, 0, mywallet, mywallet),
      createAssociatedTokenAccountInstruction(
        mywallet,
        associatedTokenAccount,
        mywallet,
        mintKey.publicKey
      )
    );

    await provider.sendAndConfirm(mint_transaction, [mintKey]);

    const mintedAmount = new anchor.BN(10);
    await program.methods
      .mintToken(mintedAmount)
      .accounts({
        mint: mintKey.publicKey,
        tokenAccount: associatedTokenAccount,
        authority: mywallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const minted = (
      await program.provider.connection.getParsedAccountInfo(
        associatedTokenAccount
      )
    ).value.data.parsed.info.tokenAmount.amount;

    console.log("mintKey : ", mintKey.publicKey.toString());
    console.log("mywallet : ", mywallet);
    console.log("from ATA : ", associatedTokenAccount.toString());
    console.log("minted : ", minted);

    assert.equal(minted, mintedAmount);
  });

  it("Transfer token", async () => {
    const toWallet = anchor.web3.Keypair.generate();

    const toATA = await getAssociatedTokenAddress(
      mintKey.publicKey,
      toWallet.publicKey
    );

    const transfer_transaction = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        mywallet,
        toATA,
        toWallet.publicKey,
        mintKey.publicKey
      )
    );
    await provider.sendAndConfirm(transfer_transaction, []);

    const transferAmount = new anchor.BN(5);
    await program.methods
      .transferToken(transferAmount)
      .accounts({
        from: associatedTokenAccount,
        to: toATA,
        authority: mywallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const transfered = (
      await provider.connection.getParsedAccountInfo(associatedTokenAccount)
    ).value.data.parsed.info.tokenAmount.amount;
    console.log("mintKey : ", mintKey.publicKey.toString());
    console.log("mywallet : ", mywallet);
    console.log("toWallet : ", toWallet.publicKey.toString());
    console.log("from ATA : ", associatedTokenAccount.toString());
    console.log("to ATA : ", toATA.toString());
    console.log("transfered : ", transfered);

    assert.equal(transfered, transferAmount);
  });
});
