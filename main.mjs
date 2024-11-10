// import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
// import axios from 'axios';
// import { Wallet } from '@project-serum/anchor';
// import bs58 from 'bs58';

// import { configDotenv } from 'dotenv';
// configDotenv()
// // It is recommended that you use your own RPC endpoint.
// // This RPC endpoint is only for demonstration purposes so that this example will run.
// const connection = new Connection('https://api.mainnet-beta.solana.com');

// const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY)));

// async function main() {
//     const response =  (
//         await axios.get('https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=10000000&slippageBps=50'
//         )
//       );
//       const quoteResponse = response.data;
//       console.log(quoteResponse);

//       try {
//         const { data: { swapTransaction } } = await (
//             await axios.post('https://quote-api.jup.ag/v6/swap', {
//                 quoteResponse,
//                 userPublicKey: wallet.publicKey.toString(),
//             })
//         );

//         console.log("swapTransaction")
//         const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
//         var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
//         console.log(transaction);
          
//         transaction.sign([wallet.payer]);
//         const latestBlockHash = await connection.getLatestBlockhash();

//         // Execute the transaction
//         const rawTransaction = transaction.serialize()
//         const txid = await connection.sendRawTransaction(rawTransaction, {
//             skipPreflight: true,
//             maxRetries: 2
//         });
//         await connection.confirmTransaction({
//             blockhash: latestBlockHash.blockhash,
//             lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
//             signature: txid
//         });
//         console.log(`https://solscan.io/tx/${txid}`);
//       } catch(e) {
//         console.log(e)
//       }
      
// }

// main();


// import { createJupiterApiClient } from '@jup-ag/api';
// import { Wallet } from '@project-serum/anchor';
// import bs58  from 'bs58';
// import { Keypair } from '@solana/web3.js';
// // import { Wallet } from '@project-serum/anchor';

// const jupiterQuoteApi = createJupiterApiClient(); // config is optional
// const data = await jupiterQuoteApi.quoteGet({
//   inputMint: "So11111111111111111111111111111111111111112",
//   outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
//   amount: "100000000",
//   // platformFeeBps: 10,
//   // asLegacyTransaction: true, // legacy transaction, default is versoined transaction
// })

// console.log(data);


// async function getSwapObj(wallet, quote) {
//   // Get serialized transaction
//   const swapObj = await jupiterQuoteApi.swapPost({
//     swapRequest: {
//       quoteResponse: quote,
//       userPublicKey: wallet.publicKey.toBase58(),
//       dynamicComputeUnitLimit: true,
//       prioritizationFeeLamports: "auto",
//     },
//   });
//   return swapObj;
// }

// const w = new Wallet(Keypair.fromSecretKey(bs58.decode('')))
// // const swap = await getSwapObj(data)

// console.log(w.publicKey.toString());
