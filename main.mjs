


(async () => {

  try {
    const quoteResponse = await (await fetch('https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=HCTVtt9A3Emicb7fRBhHAwDq98gepvUingTn5wGgpump&amount=1000000000&slippageBps=50')
    ).json();
    console.log({ quoteResponse })
    console.log(quoteResponse.routePlan)

  } catch (error) {
    console.log("error");
    
  }

})()