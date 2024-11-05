import { ThirdwebStorage } from "@thirdweb-dev/storage";

import fs from "fs";

const storage = new ThirdwebStorage({
  secretKey: process.env.THIRDWED_STORAGE_KEY, // You can get one from dashboard settings
});


(async () => {
  const upload = await storage.upload(fs.readFileSync('./hello.json'));
  console.log('Uploading',storage.resolveScheme(upload));
  
})()