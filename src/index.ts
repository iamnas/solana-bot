import { Context, Markup, session, Telegraf } from "telegraf";
import "dotenv/config";
import {
  createNewSolanaAddress,
  createNewWalletAddress,
  createSolanaToken,
  getBalance,
  MIN_BALANCE,
} from "./service";
import { prisma, thirdStorage } from "./db";

import { message } from "telegraf/filters";

import type { Update } from "telegraf/types";
import axios from "axios";
import fs from "fs";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

interface MyContext<U extends Update = Update> extends Context<U> {
  session: {
    state: string;
    tokenName: string;
    tokenSymbol: string;
    tokenSupply: string;
  };
}

const bot = new Telegraf<MyContext>(process.env.BOT_TOKEN!);

const defalutSession = {
  state: "",
  tokenName: "",
  tokenSymbol: "",
  tokenSupply: "",
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
      },
    });
  }

  ctx.replyWithMarkdownV2(
    `*Welcome to BonkBot* \n` +
      `Solana's fastest bot to trade any coin \\(SPL token\\), built by the BonkBot community\\!\n\n` +
      `You currently have no SOL in your wallet\\. To start trading, deposit SOL to your BonkBot wallet address:\n\n` +
      `\`${data.publicKey}\` \n\n` +
      `Once done tap refresh and your balance will appear here\\.\n\n` +
      `To buy a token, enter a ticker, token address, or a URL from pump\\.fun or Birdeye\\.\n\n` +
      `For more info on your wallet and to retrieve your private key, tap the wallet button below\\. ` +
      `We guarantee the safety of user funds on BonkBot, but if you expose your private key your funds will not be safe\\.`,
    Markup.inlineKeyboard([
      [
        // Markup.button.callback("Buy", "buy"),
        // Markup.button.callback("Sell & Manage", "sell_manage"),
      ],
      // [
      //   Markup.button.callback("Help", "help"),
      //   Markup.button.callback("Refer Friends", "refer"),
      //   Markup.button.callback("Alerts", "alert"),
      // ],
      [
        Markup.button.callback("Wallet", "wallet"),
        Markup.button.callback("Create Token", "crearetoken"),
        // Markup.button.callback("Settings", "settings"),
      ],
      [
        // Markup.button.callback("Pin", "pin"),
        // Markup.button.callback("Refresh", "refresh"),
      ],
    ])
  );
};

bot.start((ctx) => sendWelcomeMessage(ctx));

bot.action("wallet", (ctx) => {
  handleCallback(ctx, sendCreateNewSolanaAddress);
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
        image: `https://ipfs.io/${imageUrl}` ,
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
  } else {
    await ctx.reply(
      "Please use the /createtoken command to start creating a token."
    );
  }
});

bot.launch().then(() => console.log("Bot started"));

const handleCallback = (ctx: Context, callback: (ctx: Context) => void) => {
  callback(ctx);
  ctx.answerCbQuery();
};

const sendCreateNewSolanaAddress = async (ctx: Context) => {
  const message = await createNewWalletAddress();
  ctx.reply(message, { parse_mode: "Markdown" });
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

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
