import { Context, Markup, session, Telegraf } from "telegraf";
import "dotenv/config";
import {
  buyToken,
  createNewSolanaAddress,
  createNewWalletAddress,
  createSolanaToken,
  getBalance,
  getCustomFeeFromUser,
  getDepositSol,
  getWalletInfo,
  MIN_BALANCE,
  resetUserWallet,
  sendSettingMessage,
  setTransactionPriority,
  toggleSetting,
  welcomeMessage,
  withdrawAllSol,
  withdrawAllXSol,
  withdrawSol,
  withdrawXSol,
} from "./service";
import { prisma, thirdStorage } from "./db";
import { message } from "telegraf/filters";
import type { Update } from "telegraf/types";
import axios from "axios";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Setting, TX_PRIORITY } from "@prisma/client";

interface MyContext<U extends Update = Update> extends Context<U> {
  session: {
    state: string;
    tokenName: string;
    tokenSymbol: string;
    tokenSupply: string;
    withdrawAmount: string;
    messageIdToEdit: number;
  };
}

const bot = new Telegraf<MyContext>(process.env.BOT_TOKEN!,{handlerTimeout: 9_000_000});

const defalutSession = {
  state: "",
  tokenName: "",
  tokenSymbol: "",
  tokenSupply: "",
  withdrawAmount: "",
  messageIdToEdit: 0,
};

bot.use(
  session({
    defaultSession: () => defalutSession,
  })
);

const sendWelcomeMessage = async (ctx: Context) => {
  const userId = ctx?.from?.id!?.toString()!;

  let data = await prisma.user.findUnique({
    where: { userId },
  });

  if (!data) {
    const { publicKey, privateKey } = await createNewSolanaAddress();
    data = await prisma.user.create({
      data: {
        publicKey: publicKey,
        privateKey: privateKey,
        userId: userId,
        Setting: {
          create: {},
        },
      },
    });
  }

  const { message } = await welcomeMessage(userId);

  const button = Markup.inlineKeyboard([
    [
      Markup.button.callback("Buy", "buy"),
      // Markup.button.callback("Sell & Manage", "sell_manage"),
    ],
    // [
    //   Markup.button.callback("Help", "help"),
    //   Markup.button.callback("Refer Friends", "refer"),
    //   Markup.button.callback("Alerts", "alert"),
    // ],
    [
      Markup.button.callback("Create Wallet", "createwallet"),
      Markup.button.callback("Create Token", "crearetoken"),
    ],
    [
      Markup.button.callback("Wallet", "wallet"),
      Markup.button.callback("Settings", "settings"),
      // Markup.button.callback("Pin", "pin"),
      // Markup.button.callback("Refresh", "refresh"),
    ],
  ]);
  ctx.reply(message, { parse_mode: "Markdown", ...button });
};

bot.start((ctx) => sendWelcomeMessage(ctx));

bot.action("buy", (ctx) => {
  handleMyCallback(ctx, sendBuyToken);
});

bot.action("createwallet", (ctx) => {
  handleCallback(ctx, sendCreateNewSolanaAddress);
});

bot.action("settings", (ctx) => {
  handleCallback(ctx, sendSetting);
});

bot.action("wallet", (ctx) => {
  handleCallback(ctx, displayWalletInfo);
});

bot.action("crearetoken", async (ctx) => {
  const userId = ctx.from?.id?.toString();
  const userData = await prisma.user.findUnique({
    where: { userId },
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


  sendCreateSolanaToken(ctx);
  // handleCallback(ctx, sendCreateSolanaToken);
});

bot.action("close", (ctx) => ctx.deleteMessage());

bot.action("button", (ctx) => ctx.answerCbQuery());

bot.action("deposit_sol", (ctx) => {
  handleCallback(ctx, sendDepositSol);
});

bot.action("withdraw_all", (ctx) => {
  sendWithdrawSol(ctx);
});

bot.action("withdraw_x", (ctx) => {
  // Prompt the user for the amount to withdraw
  sendWithdrawXSol(ctx);
});

bot.action("reset_wallet", async (ctx) => {
  const message =
    `*Are you sure you want to reset your Wallet?*\n\n` +
    `*WARNING: This action is irreversible!* \n\n` +
    `The bot will generate a new wallet for you and discard your old one.`;

  const button = Markup.inlineKeyboard([
    [
      Markup.button.callback("Cancel", "cancel_reset"),
      Markup.button.callback("Confirm", "confirm_reset"),
    ],
  ]);
  await ctx.reply(message, { parse_mode: "Markdown", ...button });
  await ctx.answerCbQuery();
});

// Confirm reset action
bot.action("confirm_reset", async (ctx) => {
  // Perform the wallet reset logic here
  const newWallet = await resetUserWallet(ctx.from?.id?.toString());

  const message =
    `*Success:* Your new wallet is:\n\n` +
    `\`${newWallet}\`\n\n` +
    `You can now send SOL to this address to deposit into your new wallet. Press refresh to see your new wallet.`;

  const button = Markup.inlineKeyboard([
    [Markup.button.callback("Refresh", "refresh_wallet")],
  ]);

  await ctx.reply(message, { parse_mode: "Markdown", ...button });
  await ctx.answerCbQuery();
});

// Cancel reset action
bot.action("cancel_reset", (ctx) => {
  ctx.deleteMessage();
});

bot.action("export_key", (ctx) => {
  // Implement private key export functionality
});

// Handler for refreshing wallet info
bot.action("refresh_wallet", async (ctx) => {
  const { message, buttons } = await sendWalletInfo(ctx.from?.id?.toString()!);
  await ctx.editMessageText(message, { parse_mode: "Markdown", ...buttons });
  ctx.answerCbQuery(); // Acknowledge the callback query
});

bot.action("set_language", (ctx) =>
  ctx.answerCbQuery("Language setting coming soon!")
);

bot.action("set_min_pos_value", (ctx) =>
  ctx.answerCbQuery("Min Pos Value setting coming soon!")
);

bot.action("set_auto_buy_amount", (ctx) =>
  ctx.answerCbQuery("Auto Buy amount setting coming soon!")
);

bot.action("setup_2fa", (ctx) => ctx.answerCbQuery("Setting up 2FA..."));

bot.action("set_buy_left", (ctx) =>
  ctx.answerCbQuery("Setting Buy Left button amount...")
);

bot.action("set_buy_right", (ctx) =>
  ctx.answerCbQuery("Setting Buy Right button amount...")
);

bot.action("set_sell_left", (ctx) =>
  ctx.answerCbQuery("Setting Sell Left button amount...")
);

bot.action("set_sell_right", (ctx) =>
  ctx.answerCbQuery("Setting Sell Right button amount...")
);

bot.action("set_slippage_buy", (ctx) =>
  ctx.answerCbQuery("Setting Buy Slippage...")
);

bot.action("set_slippage_sell", (ctx) =>
  ctx.answerCbQuery("Setting Sell Slippage...")
);

bot.action("set_max_price_impact", (ctx) =>
  ctx.answerCbQuery("Setting Max Price Impact...")
);

bot.action("toggle_auto_buy", (ctx) =>
  toggleAndUpdateMessage(ctx, "autoBuyEnabled")
);
bot.action("toggle_swap_auto_approve", (ctx) =>
  toggleAndUpdateMessage(ctx, "swapAutoApprove")
);
bot.action("toggle_mev_protect", (ctx) =>
  toggleAndUpdateMessage(ctx, "mevMode")
);
bot.action("toggle_sell_protection", (ctx) =>
  toggleAndUpdateMessage(ctx, "sellProtection")
);

bot.action("set_priority_fee", async (ctx) => {
  const message = `Reply with your new Transaction Priority Setting for sells in SOL. \n\n Example: 0.0001 SOL`;
  const sendMessage = await ctx.reply(message);

  ctx.session.state = "awaiting_priority_fee";
  ctx.session.messageIdToEdit = sendMessage.message_id;

  ctx.answerCbQuery();
});

bot.action("set_priority", async (ctx) => {
  const userId = ctx.from.id.toString();
  const currentSetting = await prisma.setting.findUnique({
    where: { userId: userId },
    select: { transactionPriority: true },
  });

  let newPriority;
  if (!currentSetting) throw new Error("User setting not found");

  // Toggle between priorities
  switch (currentSetting.transactionPriority) {
    case "Medium":
      newPriority = "High";
      break;
    case "High":
      newPriority = "VaryHigh";
      break;
    case "VaryHigh":
      newPriority = "Medium";
      break;
    case "Custom":
      newPriority = "Medium";
      break;
    default:
      newPriority = "Medium";
  }

  await setTransactionPriority(userId, newPriority as TX_PRIORITY);
  const { message, button } = await sendSettingMessage(userId);
  await ctx.editMessageText(message, { parse_mode: "Markdown", ...button });
  ctx.answerCbQuery(`Transaction Priority set to ${newPriority}`);
});

bot.action("close_settings", (ctx) => ctx.answerCbQuery("Closing Settings..."));

bot.on(message("photo"), async (ctx) => {
  if (ctx.session.state === "awaiting_image") {
    try {
      // Get the highest resolution photo
      const photos = ctx.message.photo;
      const highestResPhoto = photos[photos.length - 1];
      const fileId = highestResPhoto.file_id;

      // Get the download link for the image
      const fileUrl = await ctx.telegram.getFileLink(fileId);

      // Download the image
      const response = await axios({
        url: fileUrl.href,
        method: "GET",
        responseType: "arraybuffer",
      });
      const imageBuffer = Buffer.from(response.data, "binary");

      const imageUpload = await thirdStorage.upload(imageBuffer);

      const imageUrl = thirdStorage.resolveScheme(imageUpload);

      const metaData = {
        name: ctx.session.tokenName,
        symbol: ctx.session.tokenSymbol,
        tokenSupply: ctx.session.tokenSupply,
        image: `https://ipfs.io/${imageUrl}`,
      };
      const metaDataUpload = await thirdStorage.upload(metaData);

      const metaDataUrl = thirdStorage.resolveScheme(metaDataUpload);

      const token = await createSolanaToken(
        ctx?.from?.id?.toString(),
        ctx.session.tokenName,
        ctx.session.tokenSymbol,
        9,
        Number(ctx.session.tokenSupply),
        metaDataUrl
      );

      // console.log(token);

      // Final confirmation message
      await ctx.reply(
        `🎉 *Token Created Successfully!*\n\n` +
          `📜 *Token Details:*\n` +
          `- *Name:* ${ctx.session.tokenName}\n` +
          `- *Symbol:* ${ctx.session.tokenSymbol}\n` +
          `- *Total Supply:* ${ctx.session.tokenSupply} tokens\n\n` +
          `🔗 *View Your Token on Solana Devnet:* [View on Solana Explorer](https://explorer.solana.com/address/${token}?cluster=devnet)\n\n` +
          `Thank you for creating with us! 🚀`,
        { parse_mode: "Markdown" }
      );

      // Here you could invoke a function to create the Solana token using the inputs and image
      ctx.session = defalutSession; // Clear session after process is complete
    } catch (error) {
      console.error("Error processing image:", error);
      await ctx.reply(
        "There was an error processing your image. Please try again."
      );
    }
  }
});

// Handle text messages to collect token details
bot.on(message("text"), async (ctx) => {
  const state = ctx.session.state;

  console.log(state);
  
  if (state === "awaiting_name") {
    ctx.session.tokenName = ctx.message.text;
    ctx.session.state = "awaiting_symbol";
    await ctx.reply("Got it! Now, please provide the token symbol.");
  } else if (state === "awaiting_symbol") {
    ctx.session.tokenSymbol = ctx.message.text;
    ctx.session.state = "awaiting_supply";
    await ctx.reply("Great! Lastly, please provide the initial supply.");
  } else if (state === "awaiting_supply") {
    ctx.session.tokenSupply = ctx.message.text;
    ctx.session.state = "awaiting_image";
    await ctx.reply("Now, please upload an image to represent your token.");
  } else if (state === "withdraw_sol") {
    const address = ctx.message.text;
    const { message } = await withdrawAllSol(address, ctx.from.id.toString());
    await ctx.reply(message, { parse_mode: "Markdown" });
    ctx.session = defalutSession;
  } else if (state === "awaiting_withdraw_amount") {
    const amountInput = ctx.message?.text;
    if (!amountInput) {
      return ctx.reply("Invalid input. Please enter a valid amount in SOL.");
    }
    ctx.session.withdrawAmount = ctx.message.text;
    ctx.session.state = "awaiting_withdraw_address";
    await ctx.reply("Now, Please enter your wallet address for withdraw");
  } else if (state === "awaiting_withdraw_address") {
    const address = ctx.message.text;
    const { message } = await withdrawAllXSol(
      address,
      ctx.session.withdrawAmount,
      ctx.from.id.toString()
    );
    await ctx.reply(message, { parse_mode: "Markdown" });
    ctx.session = defalutSession;
  } else if (state === "buy_token") {
    const tokenAddress = ctx.message.text;

    // Send a loading message
    const loadingMessage = await ctx.reply(
      "Processing your request, please wait..."
    );

    const userId = ctx.from.id.toString();

    try {
      // Call the buyToken function
      const { message } = await buyToken(userId,tokenAddress);

      // Update the loading message with the result
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMessage.message_id,
        undefined,
        message,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      // If there was an error, update the message with an error response
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMessage.message_id,
        undefined,
        "An error occurred while processing your request.",
        { parse_mode: "Markdown" }
      );
    }
    ctx.session = defalutSession;
  } else if (state === "awaiting_priority_fee") {
    const transactionFee = parseFloat(ctx.message.text);
    const userId = ctx.from.id.toString();

    if (isNaN(transactionFee) || transactionFee <= 0) {
      await ctx.reply("Please provide a valid transaction fee in SOL.");
      return;
    }

    await getCustomFeeFromUser(ctx.from.id.toString(), transactionFee);
    const { message, button } = await sendSettingMessage(userId);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      ctx.session.messageIdToEdit,
      undefined,
      message,
      { parse_mode: "Markdown", ...button }
    );
    ctx.session = defalutSession;

    await ctx.reply(`Priority Fee set to ${transactionFee} SOL.`)
  }
  ctx.session.state = "";
  ctx.session = defalutSession;

  // else {
  //   await ctx.reply(
  //     "Please use the /createtoken command to start creating a token."
  //   );
  // }
});

const sendCreateNewSolanaAddress = async (ctx: Context) => {
  const message = await createNewWalletAddress();
  const button = Markup.inlineKeyboard([
    [Markup.button.callback("Close", "close")],
  ]);
  ctx.reply(message, { parse_mode: "Markdown", ...button });
};

const sendWalletInfo = async (userId: string) => {
  const { message, address } = await getWalletInfo(userId);

  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.url(
        "View on Solscan",
        `https://solscan.io/account/${address}`
      ),
      Markup.button.callback("Close", "close"),
    ],
    [Markup.button.callback("Deposit SOL", "deposit_sol")],
    [
      Markup.button.callback("Withdraw all SOL", "withdraw_all"),
      Markup.button.callback("Withdraw X SOL", "withdraw_x"),
    ],
    [
      Markup.button.callback("Reset Wallet", "reset_wallet"),
      Markup.button.callback("Export Private Key", "export_key"),
    ],
    [Markup.button.callback("Refresh", "refresh_wallet")],
  ]);

  const updatedMessage = `${message}\n\n_Last updated: ${new Date().toLocaleTimeString()}_`;

  return { message: updatedMessage, buttons };
};

const sendCreateSolanaToken = async (ctx: MyContext) => {
  try {
    await ctx.answerCbQuery();
    ctx.session.state = "awaiting_name";
    await ctx.reply(
      "Let's create your Solana token! First, please provide the token name."
    );
  } catch (error) {
    console.error("Error in sendCreateSolanaToken:", error);
    await ctx.reply("An error occurred while trying to create your token.");
  }
};

// Use sendWalletInfo initially to send the message with wallet info
const displayWalletInfo = async (ctx: Context) => {
  const { message, buttons } = await sendWalletInfo(ctx.from?.id?.toString()!);
  ctx.reply(message, { parse_mode: "Markdown", ...buttons });
};

const sendDepositSol = async (ctx: Context) => {
  const { message } = await getDepositSol(ctx.from?.id?.toString()!);
  ctx.reply(message, { parse_mode: "Markdown" });
};

const sendWithdrawSol = async (ctx: MyContext) => {
  const { message } = await withdrawSol(ctx?.from?.id.toString()!);
  ctx.session.state = "withdraw_sol";
  ctx.reply(message, { parse_mode: "Markdown" });
  ctx.answerCbQuery();
};

const sendWithdrawXSol = async (ctx: MyContext) => {
  const { message } = await withdrawXSol(ctx?.from?.id.toString()!);
  ctx.session.state = "awaiting_withdraw_amount";
  ctx.reply(message, { parse_mode: "Markdown" });
  ctx.answerCbQuery();
};

const sendBuyToken = async (ctx: MyContext) => {
  const message = `*Buy Token:* \n` + `To buy a token enter token address`;

  const button = Markup.inlineKeyboard([
    Markup.button.callback("Close", "close"),
  ]);

  ctx.session.state = "buy_token";
  ctx.reply(message, { parse_mode: "Markdown", ...button });
};

const sendSetting = async (ctx: Context) => {
  const { message, button } = await sendSettingMessage(
    ctx.from?.id.toString()!
  );
  ctx.reply(message, { parse_mode: "Markdown", ...button });
};

const handleCallback = (ctx: Context, callback: (ctx: Context) => void) => {
  callback(ctx);
  ctx.answerCbQuery();
};

const handleMyCallback = (
  ctx: MyContext,
  callback: (ctx: MyContext) => void
) => {
  callback(ctx);
  ctx.answerCbQuery();
};

const toggleAndUpdateMessage = async (
  ctx: Context,
  settingKey: keyof Setting
) => {
  await toggleSetting(ctx?.from?.id.toString()!, settingKey);
  const { message, button } = await sendSettingMessage(
    ctx.from?.id.toString()!
  );
  await ctx.editMessageText(message, { parse_mode: "Markdown", ...button });
  ctx.answerCbQuery(`Toggling ${settingKey.replace(/_/g, " ")}`);
};

bot.launch().then(() => console.log("Bot started"));

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
