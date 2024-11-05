import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import { prisma } from "../db";
import { createNewToken } from "./createToken.service";

export const MIN_BALANCE = 5e8;

export const createNewSolanaAddress = async () => {
  // try {
  const newKeyPair = Keypair.generate();
  const pubkey = new PublicKey(newKeyPair.publicKey);
  const privateKey = bs58.encode(newKeyPair.secretKey);

  return {
    publicKey: pubkey.toString(),
    privateKey,
  };
};

export const createNewWalletAddress = async () => {
  try {
    const newKeyPair = Keypair.generate();
    const pubkey = new PublicKey(newKeyPair.publicKey);
    const privateKey = bs58.encode(newKeyPair.secretKey);

    const message =
      `\n*🔑 Public Key:* \`${pubkey}\` \n\n` +
      `*🔒 Private Key:* \`${privateKey}\`\n\n` +
      `⚠️ *Warning:* Keep your private key secure and do not share it with anyone. If someone has access to your private key, they can control your funds.`;

    return message;
  } catch (error) {
    console.log(error);
    return "Something went wrong, please try again later.";
  }
};

export const createSolanaToken = async (userId: string,name:string,symbol:string,decimals:number,totalSupply:number,metaData:string) => {
  try {
    const userData = await prisma.user.findUnique({
      where: { userId: userId },
    });

    if (!userData) return `User not found`;

    const userBalance = await getBalance(userData.publicKey);

    if (userBalance < MIN_BALANCE) {
      return `You need to deposit at least ${
        MIN_BALANCE / LAMPORTS_PER_SOL
      } SOL on your wallet for this function to work \`${
        userData.publicKey
      }\` (click to copy)`;
    }


    const {token} = await createNewToken(new PublicKey(userData.publicKey), userData.privateKey,name,symbol,decimals,totalSupply,metaData);

    return token;
    
  } catch (error) {
    console.log(error);
    return "Something went wrong, please try again later.";
  }
};

export const getBalance = (pubkey: string) => {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const userBalance = connection.getBalance(new PublicKey(pubkey));

  return userBalance;
};
