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

import { buyTokenService } from "./buyToken.service";
import { Markup } from "telegraf";
import { Setting, TX_PRIORITY } from "@prisma/client";

export const MIN_BALANCE = 5e8;

export const createNewSolanaAddress = async () => {
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

export const buyToken = async (userId: string, address: string) => {
  if (!isValidAddress(address)) {
    return { message: `Given address is not valid provide valid address` };
  }

  const userData = await prisma.user.findUnique({
    where: { userId },
    select: { Setting: true, publicKey: true, privateKey: true },
  });

  if (!userData || !userData?.Setting || !userData?.Setting?.autoBuyAmount) {
    return { message: `User not found` };
  }
  const userBalance = (await getBalance(userData.publicKey)) / LAMPORTS_PER_SOL;

  if (userBalance < userData?.Setting?.autoBuyAmount) {
    return {
      message: `Insufficient balance , please deposit minimum ${userData?.Setting?.autoBuyAmount} Sol to ${userData.publicKey} `,
    };
  }

  const amountLamports = userData?.Setting?.autoBuyAmount * LAMPORTS_PER_SOL;

  const message = await buyTokenService(
    userData.privateKey,
    address,
    amountLamports
  );

  return {
    message: message,
  };
};

export const sendSettingMessage = async (userId: string) => {
  const userData = await prisma.setting.findUnique({
    where: { userId: userId },
  });

  const message =
    ` *Settings:* \n\n` +
    `*GENERAL SETTINGS* \n` +
    `*Language*: Shows the current language. Tap to switch between available languages. \n` +
    `*Minimum Position Value*: Minimum position value to show in portfolio. Will hide tokens below this threshhold. Tap to edit.\n\n` +
    `*AUTO BUY* \n` +
    `Immediately buy when pasting token address. Tap to toggle.\n\n` +
    `*BUTTONS CONFIG* \n` +
    `Customize your buy and sell buttons for buy token and manage position. Tap to edit. \n\n` +
    `*SLIPPAGE CONFIG* \n` +
    `Customize your slippage settings for buys and sells. Tap to edit.\n` +
    `Max Price Impact is to protect against trades in extremely illiquid pools. \n\n` +
    `*MEV PROTECT* \n` +
    `MEV Protect accelerates your transactions and protect against frontruns to make sure you get the best price possible.\n` +
    `*Turbo*: BONKbot will use MEV Protect, but if unprotected sending is faster it will use that instead.\n` +
    `*Secure*: Transactions are guaranteed to be protected. This is the ultra secure option, but may be slower. \n\n` +
    `*TRANSACTION PRIORITY* \n` +
    `Increase your Transaction Priority to improve transaction speed. Select preset or tap to edit. \n\n` +
    `*SELL PROTECTION* \n` +
    `100% sell commands require an additional confirmation step. Tap to toggle. \n\n` +
    `*SECURITY CONFIG* \n` +
    `*Set Up Two-Factor Authentication*: Launches Mini App to secure your BONKbot with 2FA.\n` +
    `*Enable/Disable Swap Auto-Approve*: Having Auto-Approve disabled means each token must first be whitelisted for trading via 2FA authorization.`;

  const button = Markup.inlineKeyboard([
    // GENERAL SETTINGS
    [Markup.button.callback("--- GENERAL SETTING ---", "button")],
    [
      Markup.button.callback(
        `🌍 Language: ${userData?.language || "English"}`,
        "set_language"
      ),
      Markup.button.callback(
        `Min Pos Value: $${userData?.minPosValue || "0.001"}`,
        "set_min_pos_value"
      ),
    ],

    // AUTO BUY Section
    [Markup.button.callback("--- AUTO BUY ---", "button")],
    [
      Markup.button.callback(
        userData?.autoBuyEnabled ? "🟢 Enabled" : "🔴 Disabled",
        "toggle_auto_buy"
      ),
      Markup.button.callback(
        `🔸 ${userData?.autoBuyAmount || "1.0"} SOL`,
        "set_auto_buy_amount"
      ),
    ],

    // SECURITY CONFIG Section
    [Markup.button.callback("--- SECURITY CONFIG ---", "button")],
    [
      Markup.button.callback(
        userData?.twoFactorEnabled ? "🟢 2FA Enabled" : "✅ Set Up 2FA",
        "setup_2fa"
      ),
    ],
    [
      Markup.button.callback(
        userData?.swapAutoApprove
          ? "🟢 Swap Auto-Approve Enabled"
          : "🔴 Swap Auto-Approve Disabled",
        "toggle_swap_auto_approve"
      ),
    ],

    // BUY BUTTONS CONFIG
    [Markup.button.callback("--- BUY BUTTONS CONFIG ---", "button")],
    [
      Markup.button.callback(
        `Left: ${userData?.buyLeftButtonAmount || "1.0"} SOL`,
        "set_buy_left"
      ),
      Markup.button.callback(
        `Right: ${userData?.buyRightButtonAmount || "5.0"} SOL`,
        "set_buy_right"
      ),
    ],

    // SELL BUTTONS CONFIG
    [Markup.button.callback("--- SELL BUTTONS CONFIG ---", "button")],
    [
      Markup.button.callback(
        `Left: ${userData?.sellLeftButtonPercentage || "25"}%`,
        "set_sell_left"
      ),
      Markup.button.callback(
        `Right: ${userData?.sellRightButtonPercentage || "100"}%`,
        "set_sell_right"
      ),
    ],

    // SLIPPAGE CONFIG
    [Markup.button.callback("--- SLIPPAGE CONFIG ---", "button")],
    [
      Markup.button.callback(
        `Buy: ${userData?.buySlippagePercentage || "10"}%`,
        "set_slippage_buy"
      ),
      Markup.button.callback(
        `Sell: ${userData?.sellSlippagePercentage || "10"}%`,
        "set_slippage_sell"
      ),
    ],
    [
      Markup.button.callback(
        `Max Price Impact: ${userData?.maxPriceImpact || "25"}%`,
        "set_max_price_impact"
      ),
    ],

    // MEV PROTECT
    [Markup.button.callback("--- MEV PROTECT ---", "button")],
    [Markup.button.callback(`⚡ ${userData?.mevMode}`, "toggle_mev_protect")],

    // TRANSACTION PRIORITY
    [Markup.button.callback("--- TRANSACTION PRIORITY ---", "button")],
    [
      Markup.button.callback(
        `⏫ ${userData?.transactionPriority || "Medium"}`,
        "set_priority"
      ),
      Markup.button.callback(
        `🔸 ${userData?.transactionFee.toFixed(5) || "0.001"} SOL`,
        "set_priority_fee"
      ),
    ],

    // SELL PROTECTION
    [Markup.button.callback("--- SELL PROTECTION ---", "button")],
    [
      Markup.button.callback(
        userData?.sellProtection ? "🟢 Enabled" : "🔴 Disabled",
        "toggle_sell_protection"
      ),
    ],

    // Close Button
    [Markup.button.callback("Close", "close")],
  ]);

  return { message, button };
};

export const toggleSetting = async (
  userId: string,
  settingKey: keyof Setting
) => {
  const currentSetting = await prisma.setting.findUnique({
    where: { userId: userId },
    select: { [settingKey]: true }, // Dynamically select the setting
  });

  if (!currentSetting || !(settingKey in currentSetting)) {
    throw new Error("User setting not found or invalid setting key");
  }

  const currentValue = currentSetting[settingKey];

  // Handle boolean fields
  if (typeof currentValue === "boolean") {
    return prisma.setting.update({
      where: { userId: userId },
      data: { [settingKey]: !currentValue },
    });
  }

  // Handle enum-like fields (e.g., MEVMODE)
  if (settingKey === "mevMode" && typeof currentValue === "string") {
    const newValue = currentValue === "Turbo" ? "Secure" : "Turbo";
    return prisma.setting.update({
      where: { userId: userId },
      data: { [settingKey]: newValue },
    });
  }

  throw new Error("Unsupported setting type for toggling");
};

export const setTransactionPriority = async (
  userId: string,
  priority: TX_PRIORITY
) => {
  let transactionFee;

  switch (priority) {
    case "High":
      transactionFee = 0.005;
      break;
    case "VaryHigh":
      transactionFee = 0.01;
      break;
    case "Medium":
      transactionFee = 0.001;
      break;
    default:
      throw new Error("Invalid priority level");
  }

  return prisma.setting.update({
    where: { userId: userId },
    data: {
      transactionPriority: priority,
      transactionFee: transactionFee,
    },
  });
};

export const getCustomFeeFromUser = async (
  userId: string,
  transactionFee: number
) => {
  const currentSetting = await prisma.setting.findUnique({
    where: { userId: userId },
    select: { transactionPriority: true },
  });

  if (!currentSetting) throw new Error("User setting not found");

  return prisma.setting.update({
    where: { userId: userId },
    data: {
      transactionPriority: "Custom",
      transactionFee: transactionFee,
    },
  });
};

export const resetUserWallet = async (userId: string) => {
  const message = await createNewSolanaAddress();
  return message.publicKey;
};

export const welcomeMessage = async (userId: string) => {
  const data = await prisma.user.findUnique({
    where: { userId: userId },
  });

  if (!data) return { message: `User not found` };

  const welcome = `*Welcome to BonkBot* \n\n`;

  const balance = (await getBalance(data.publicKey)) / LAMPORTS_PER_SOL;

  if (balance > 0) {
    const welcomeMessage =
      welcome +
      `You currently have a balance of ${balance?.toFixed(
        4
      )} SOL, but no open positions.\n\n` +
      `To get started trading, you can open a position by buying a token.\n\n` +
      `To buy a token just enter a token address or paste a Birdeye link, and you will see a Buy dashboard pop up where you can choose how much you want to buy.\n\n` +
      `Advanced traders can enable Auto Buy in their settings. When enabled, BONKbot will instantly buy any token you enter with a fixed amount that you set. This is disabled by default. \n\n` +
      `*Wallet:* \n` +
      `\`${data.publicKey}\` \n\n`;
    return { message: welcomeMessage };
  }

  const message =
    welcome +
    `Solana's fastest bot to trade any coin \(SPL token\), built by the BonkBot community\!\n\n` +
    `You currently have no SOL in your wallet. To start trading, deposit SOL to your BonkBot wallet address:\n\n` +
    `\`${data.publicKey}\` \n\n` +
    `Once done tap refresh and your balance will appear here.\n\n` +
    `To buy a token, enter a ticker, token address, or a URL from pump.fun or Birdeye.\n\n` +
    `For more info on your wallet and to retrieve your private key, tap the wallet button below. ` +
    `We guarantee the safety of user funds on BonkBot, but if you expose your private key your funds will not be safe.`;

  return { message };
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
