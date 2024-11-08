import {
  clusterApiUrl,
  sendAndConfirmTransaction,
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

import {
  ExtensionType,
  createInitializeMintInstruction,
  mintTo,
  createAccount,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
  LENGTH_SIZE,
  createInitializeMetadataPointerInstruction,
} from "@solana/spl-token";

import { createInitializeTransferFeeConfigInstruction } from "@solana/spl-token";

import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";

import bs58 from "bs58";

const extensions = [
  ExtensionType.TransferFeeConfig,
  ExtensionType.MetadataPointer,
];

export const createNewToken = async (
  payer: PublicKey,
  secretKey: string,
  name: string,
  symbol: string,
  decimals: number,
  totalSupply: number,
  metaData:string
) => {

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const payerKeypair = Keypair.fromSecretKey(bs58.decode(secretKey));

  // const decimals = 9;
  const feeBasisPoints = 0;//50;
  const maxFee = BigInt(0);

  const mintKeypair = Keypair.generate();

  const metadata: TokenMetadata = {
    mint: mintKeypair.publicKey,
    name: name,
    symbol: symbol,
    uri: metaData,
    additionalMetadata: [["description", "Only Possible On Solana"]],
  };

  const mintLen = getMintLen(extensions);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

  const mintLamports = await connection.getMinimumBalanceForRentExemption(
    mintLen + metadataLen
  );

  const mintTransaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mintKeypair.publicKey,
      payer,
      payer,
      feeBasisPoints,
      maxFee,
      TOKEN_2022_PROGRAM_ID
    ),

    createInitializeMetadataPointerInstruction(
      mintKeypair.publicKey,
      payer,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer,
      null,
      TOKEN_2022_PROGRAM_ID
    ),

    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mintKeypair.publicKey,
      metadata: metadata.mint,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      mintAuthority: payer,
      updateAuthority: payer,
    })
  );

  await sendAndConfirmTransaction(
    connection,
    mintTransaction,
    [payerKeypair, mintKeypair],
    undefined
  );

  // console.log("Mint created: ", mintKeypair.publicKey.toBase58());

  const mintAmount = totalSupply*LAMPORTS_PER_SOL; //BigInt(1_000_000_000_);

  const associatedTokenAddress = await createAccount(
    connection,
    payerKeypair,
    mintKeypair.publicKey,
    payer,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // console.log("Source account: ", associatedTokenAddress.toBase58());

  await mintTo(
    connection,
    payerKeypair,
    mintKeypair.publicKey,
    associatedTokenAddress,
    payer,
    mintAmount,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );


  return {
    token:mintKeypair.publicKey.toBase58(),
  }
  // console.log("Minted!");
};
