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
import { Keypair } from "@solana/web3.js";

describe("anchor_spl_token_demo", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .AnchorSplTokenDemo as anchor.Program<AnchorSplTokenDemo>;

  let associatedTokenAccount: any;
  const mywallet = provider.wallet.publicKey;

  const metadataAccount = new anchor.web3.Keypair();
  const mintKey = new anchor.web3.Keypair();
  const metaDataProgram = new anchor.web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );
  let userAccount = new anchor.web3.Keypair();

  const payer = Keypair.fromSecretKey(
    Buffer.from([
      108, 109, 44, 141, 214, 56, 235, 115, 59, 49, 56, 122, 91, 102, 67, 183,
      31, 84, 154, 251, 58, 125, 23, 130, 71, 48, 219, 159, 206, 3, 222, 18,
      243, 210, 23, 15, 64, 43, 70, 154, 151, 46, 195, 26, 117, 5, 158, 240, 84,
      76, 166, 173, 118, 165, 130, 192, 25, 225, 127, 47, 119, 122, 78, 111,
    ])
  );
  const name = "Person Top Token";
  const symbol = "PTT";
  const uri =
    "https://raw.githubusercontent.com/utsavempiric20/spl-token-metadata/refs/heads/main/metadata.json";
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

    console.log("metadataAccount : ", metadataAccount.publicKey.toString());
    console.log("metadata Program : ", metaDataProgram.toString());
    console.log("useraccount : ", userAccount.publicKey.toString());

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

    const [metadata_pda, _bump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          metaDataProgram.toBuffer(),
          mintKey.publicKey.toBuffer(),
        ],
        metaDataProgram
      );
    console.log("metadatPda : ", metadata_pda.toString());

    const metadata_tx = await program.methods
      .createTokenWithMetadata(name, symbol, uri)
      .accounts({
        metadataAccount: metadata_pda,
        mint: mintKey.publicKey,
        payer: mywallet,
        metadataProgram: metaDataProgram,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([payer])
      .rpc();
    console.log("metadata_tx : ", metadata_tx);

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
