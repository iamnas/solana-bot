import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { prisma } from "../db";
import { createNewToken } from "./createToken.service";
import { message } from "telegraf/filters";
import { buyTokenService } from "./buyToken.service";

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

export const createSolanaToken = async (
  userId: string,
  name: string,
  symbol: string,
  decimals: number,
  totalSupply: number,
  metaData: string
) => {
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

    const { token } = await createNewToken(
      new PublicKey(userData.publicKey),
      userData.privateKey,
      name,
      symbol,
      decimals,
      totalSupply,
      metaData
    );

    return token;
  } catch (error) {
    console.log(error);
    return "Something went wrong, please try again later.";
  }
};

export const getWalletInfo = async (userId: string) => {
  try {
    const userData = await prisma.user.findUnique({
      where: { userId: userId },
    });

    if (!userData) return { message: `User not found`, address: "" };

    const userBalance = await getBalance(userData.publicKey);

    // if (userBalance < MIN_BALANCE) {
    //   return `You need to deposit at least ${
    //     MIN_BALANCE / LAMPORTS_PER_SOL
    //   } SOL on your wallet for this function to work \`${
    //     userData.publicKey
    //   }\` (click to copy)`;
    // }

    const message =
      `*Your Wallet:* \n\n` +
      `Address: \`${userData.publicKey}\` \n` +
      `Balance: *${(userBalance / LAMPORTS_PER_SOL).toFixed(9)}* SOL \n\n` +
      `Tap to copy the address and send SOL to deposit.`;
    return { message, address: userData.publicKey };
  } catch (error) {
    // console.log(error);
    return {
      message: "Something went wrong, please try again later.",
      address: "",
    };
  }
};

export const getDepositSol = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: {
      userId: userId,
    },
  });
  if (!userData) return { message: `User not found` };

  const message =
    `To deposit send SOL to below address: \n\n` +
    ` \`${userData.publicKey}\` `;

  return { message };
};

export const withdrawSol = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: {
      userId: userId,
    },
  });
  if (!userData) return { message: `User not found` };

  const userBalance = await getBalance(userData.publicKey);

  if (userBalance / LAMPORTS_PER_SOL == 0) {
    return { message: `Not enough SOL to withdraw` };
  }

  const message = `Please enter your wallet address for withdraw`;

  return { message };
};

export const withdrawXSol = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: {
      userId: userId,
    },
  });
  if (!userData) return { message: `User not found` };

  const userBalance = await getBalance(userData.publicKey);

  if (userBalance / LAMPORTS_PER_SOL == 0) {
    return { message: `Not enough SOL to withdraw` };
  }

  const message = `Please enter the amount of SOL you want to withdraw:`;

  return { message };
};

export const withdrawAllSol = async (address: string, userId: string) => {
  try {
    if (!isValidAddress(address)) {
      return { message: `Given address is not valid provide valid address` };
    }

    const userData = await prisma.user.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!userData) return { message: `User not found` };

    const balance = await getBalance(userData.publicKey);

    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const payerKeypair = Keypair.fromSecretKey(
      bs58.decode(userData.privateKey)
    );

    const transactionFee = 5000; // 0.000005 SOL fee buffer
    const amountToSend = balance - transactionFee;

    let transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(userData.publicKey),
        toPubkey: new PublicKey(address),
        lamports: amountToSend,
      })
    );

    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payerKeypair]
    );

    return {
      message: `Transaction successful! View it on Solana Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
    };
  } catch (error) {
    console.log(error);

    return { message: `Something went wrong please try again latet` };
  }
};

export const withdrawAllXSol = async (
  address: string,
  amount: string,
  userId: string
) => {
  try {
    if (!isValidAddress(address)) {
      return { message: `Given address is not valid provide valid address` };
    }

    const userData = await prisma.user.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!userData) return { message: `User not found` };

    const amountLamports = Number(amount) * LAMPORTS_PER_SOL;

    const balance = await getBalance(userData.publicKey);

    if (amountLamports > balance) {
      return { message: `Insufficient balance to withdraw this amount.` };
    }

    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const payerKeypair = Keypair.fromSecretKey(
      bs58.decode(userData.privateKey)
    );

    const transactionFee = 5000; // 0.000005 SOL fee buffer
    const amountToSend = amountLamports - transactionFee;

    let transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(userData.publicKey),
        toPubkey: new PublicKey(address),
        lamports: amountToSend,
      })
    );

    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payerKeypair]
    );

    return {
      message: `Transaction successful! View it on Solana Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
    };
  } catch (error) {
    console.log(error);

    return { message: `Something went wrong please try again latet` };
  }
};

export const buyToken = async (address: string, amount: string) => {
  if (!isValidAddress(address)) {
    return { message: `Given address is not valid provide valid address` };
  }

  const amountLamports = Number(amount) * LAMPORTS_PER_SOL;
  const message = await buyTokenService(address, amountLamports);

  return {
    message: message,
  };
};

export const getBalance = (pubkey: string) => {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const userBalance = connection.getBalance(new PublicKey(pubkey));

  return userBalance;
};

export const isValidAddress = (walletAddress: string): boolean => {
  try {
    const address = new PublicKey(walletAddress);
    return PublicKey.isOnCurve(address);
  } catch (e) {
    return false;
  }
};
