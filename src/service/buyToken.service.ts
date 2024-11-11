import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import axios from "axios";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";

// Define a function for buying tokens
export const buyTokenService = async (
  privateKey: string,
  tokenAddress: string,
  amount: number
) => {
  try {
    // Set up connection and wallet
    const connection = new Connection(process.env.HELIUS_RPC!, "confirmed");
    const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(privateKey)));

    // Step 1: Get a quote for swapping SOL to the target token
    console.log("Fetching quote...");
    const quoteResponse = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: process.env.SOL_ADDRESS, // SOL mint address
        outputMint: tokenAddress, // User-provided token address
        amount: amount, // Amount in lamports
        slippageBps: process.env.SLIPPAGE, // Slippage tolerance
      },
    });

    const quoteData = quoteResponse.data;
    if (!quoteData) {
      throw new Error("No quote data received.");
    }

    // Step 2: Prepare the swap transaction
    console.log("Preparing swap transaction...");
    const { swapTransaction } = await (
      await axios.post(
        "https://quote-api.jup.ag/v6/swap",
        {
          quoteResponse: quoteData,
          userPublicKey: wallet.publicKey.toString(),
          wrapAndUnwrapSol: true, // Automatically handle SOL wrapping/unwrapping
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
          // prioritizationFeeLamports: {
          //   autoMultiplier: 2,
          // },
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      )
    ).data;

    if (!swapTransaction) {
      throw new Error("No swap transaction data received.");
    }

    // Step 3: Deserialize the transaction
    console.log("Deserializing transaction...");
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Step 4: Refresh the blockhash and sign the transaction
    console.log("Refreshing blockhash and signing transaction...");
    const latestBlockHash = await connection.getLatestBlockhash();
    transaction.message.recentBlockhash = latestBlockHash.blockhash;
    transaction.sign([wallet.payer]);

    // Step 5: Send the transaction
    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 2,
    });
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txid,
    });

    console.log(`Transaction successful: https://solscan.io/tx/${txid}`);
    return `Transaction successful: https://solscan.io/tx/${txid}`;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error in buyTokenService:", error.message);
      if (
        error.message.includes("TransactionExpiredBlockheightExceededError")
      ) {
        console.warn("Transaction expired. Please try again.");
        return "Error: Transaction expired. Please try again.";
      }
      return `Error: ${error.message}`;
    } else {
      console.error("An unknown error occurred");
      return "An unknown error occurred";
    }
  }
};
