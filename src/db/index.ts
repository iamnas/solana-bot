
import { PrismaClient } from "@prisma/client";
import { ThirdwebStorage } from "@thirdweb-dev/storage";


export const prisma = new PrismaClient();


export const thirdStorage = new ThirdwebStorage({
    secretKey: process.env.THIRDWED_STORAGE_KEY, // You can get one from dashboard settings
  });
  