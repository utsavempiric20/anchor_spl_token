import * as anchor from "@project-serum/anchor";
import { AnchorSplTokenDemo } from "../target/types/anchor_spl_token_demo";
import { assert } from "chai";
import { Keypair } from "@solana/web3.js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";

describe("anchor_spl_token_demo", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .AnchorSplTokenDemo as anchor.Program<AnchorSplTokenDemo>;

  const mywallet = provider.wallet.publicKey;
  const MPL_TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  const owner =
    "3AjTHF1BXXPwN2tfgAqbeuZFcGbKBNLAVX1N46pXxtKmMM9DPC6aaXEBi5WTg6h9RdaGHJcrHBZea4Hp8pCLZ3XC";
  const payer = Keypair.fromSecretKey(bs58.decode(owner));

  const metadata = {
    name: "Person Top Token",
    symbol: "PTT",
    uri: "https://raw.githubusercontent.com/utsavempiric20/spl-token-metadata/refs/heads/main/metadata.json",
    decimals: 9,
  };

  const [mint_pda, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    anchor.web3.SystemProgram.programId
  );
  const [metadataAddress, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint_pda.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );

  it("Initialize", async () => {
    console.log("mint_pda : ", mint_pda.toString());
    console.log("bump : ", bump);
    const info = await program.provider.connection.getAccountInfo(mint_pda);
    if (!info) {
      console.log("  Mint not found. Initializing Program...");
    }

    const metadata_tx = await program.methods
      .createTokenWithMetadata(metadata)
      .accounts({
        metadata: metadataAddress,
        mint: mint_pda,
        payer: mywallet,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();
    console.log("metadata_tx : ", metadata_tx);
    await provider.connection.confirmTransaction(metadata_tx, "finalized");
    const new_info = await program.provider.connection.getAccountInfo(mint_pda);
    console.log("new_info :", new_info);
    assert(new_info, " Mint should be initialized.");
  });

  it("Mint Tokens", async () => {
    const destination = await anchor.utils.token.associatedAddress({
      mint: mint_pda,
      owner: mywallet,
    });

    let initialBalance: number;
    try {
      const balance = await program.provider.connection.getTokenAccountBalance(
        destination
      );
      initialBalance = balance.value.uiAmount;
    } catch {
      initialBalance = 0;
    }
    console.log("destination  : ", destination);
    console.log("initialBalance  : ", initialBalance);

    const context = {
      mint: mint_pda,
      destination,
      payer: mywallet,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };
    console.log("context  : ", context);
    const mintAmount = 10;
    const txHash = await program.methods
      .mintToken(new anchor.BN(mintAmount * 10 ** 9))
      .accounts(context)
      .rpc();
    await program.provider.connection.confirmTransaction(txHash);
    console.log("txHash minting : ", txHash);

    const postBalance = (
      await program.provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;
    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Compare balances, it must be equal"
    );
  });

  // it("Transfer token", async () => {
  //   const toWallet = anchor.web3.Keypair.generate();

  //   const toATA = await getAssociatedTokenAddress(
  //     mintKey.publicKey,
  //     toWallet.publicKey
  //   );

  //   const transfer_transaction = new anchor.web3.Transaction().add(
  //     createAssociatedTokenAccountInstruction(
  //       mywallet,
  //       toATA,
  //       toWallet.publicKey,
  //       mintKey.publicKey
  //     )
  //   );
  //   await provider.sendAndConfirm(transfer_transaction, []);

  //   const transferAmount = new anchor.BN(5);
  //   await program.methods
  //     .transferToken(transferAmount)
  //     .accounts({
  //       from: associatedTokenAccount,
  //       to: toATA,
  //       authority: mywallet,
  //       tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //     })
  //     .rpc();

  //   const transfered = (
  //     await provider.connection.getParsedAccountInfo(associatedTokenAccount)
  //   ).value.data.parsed.info.tokenAmount.amount;
  //   console.log("mintKey : ", mintKey.publicKey.toString());
  //   console.log("mywallet : ", mywallet);
  //   console.log("toWallet : ", toWallet.publicKey.toString());
  //   console.log("from ATA : ", associatedTokenAccount.toString());
  //   console.log("to ATA : ", toATA.toString());
  //   console.log("transfered : ", transfered);

  //   assert.equal(transfered, transferAmount);
  // });
});
