import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from "@solana/web3.js";
import axios from "axios";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";

// Define a function for buying tokens
export const buyTokenService = async (tokenAddress: string, amount: number) => {
  try {
    // console.log(process.env.HELIUS_RPC);

    const connection = new Connection(process.env.HELIUS_RPC!);

    const wallet = new Wallet(
      Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || ""))
    );

    // Step 1: Get a quote for swapping SOL to the target token
    const quoteResponse = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: process.env.SOL_ADDRESS, // SOL mint address
        outputMint: tokenAddress, // User-provided token address
        amount: amount, // 0.1 SOL in lamports
        slippageBps: process.env.SLIPPAGE, // 0.5% slippage tolerance
      },
    });

    const quoteData = quoteResponse.data;
    if (!quoteData) {
      throw new Error("No quote data received.");
    }

    // Step 2: Prepare the swap transaction
    const swapResponse = await axios.post(
      "https://quote-api.jup.ag/v6/swap",
      {
        quoteResponse: quoteData,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true, // Automatically handle SOL wrapping and unwrapping
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const { swapTransaction } = swapResponse.data;
    if (!swapTransaction) {
      throw new Error("No swap transaction data received.");
    }

    // console.log(swapTransaction);
    

    // Step 3: Deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Step 4: Sign the transaction
    transaction.sign([wallet.payer]);

    // get the latest block hash
    const latestBlockHash = await connection.getLatestBlockhash();

    
    // Step 5: Serialize and send the transaction
    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 2,
        });


    // Confirm transaction
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txid,
    });

    // console.log(`Transaction successful: https://solscan.io/tx/${txid}`);

    return `Transaction successful: https://solscan.io/tx/${txid}`;
  } catch (error) {
    console.error("Error in buyToken:", error);
    return `Error: Error in buyToken:`;
  }
};



