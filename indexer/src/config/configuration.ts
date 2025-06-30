import { registerAs } from '@nestjs/config';
import Joi from 'joi';

import { AppConfig } from './models/configuration.types';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production').default('development'),
  PORT: Joi.number().default(3069),
  ALLOWED_ORIGINS: Joi.string().required(),
  BRIDGE_BLOCK_DELAY: Joi.number().default(10),

  // Features
  QUEUE: Joi.number().valid(0, 1).required(),
  BRIDGE: Joi.number().valid(0, 1).default(0),
  DISCORD: Joi.number().valid(0, 1).default(0),
  TWITTER: Joi.number().valid(0, 1).default(0),
  TELEGRAM: Joi.number().valid(0, 1).default(0),
  TX_POOL: Joi.number().valid(0, 1).default(0),
  MINT: Joi.number().valid(0, 1).default(0),

  // Supabase
  SUPABASE_URL: Joi.string().required(),
  SUPABASE_SERVICE_ROLE: Joi.string().required(),
  SUPABASE_URL_PROD: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  SUPABASE_SERVICE_ROLE_PROD: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // RPCs
  RPC_URL_L1: Joi.string().required(),
  RPC_URL_BACKUP_L1: Joi.string().optional(),

  RPC_URL_L2: Joi.string().required(),
  RPC_URL_BACKUP_L2: Joi.string().optional(),

  // Chain IDs
  CHAIN_ID_L1: Joi.number().valid(1, 11155111).required(),
  CHAIN_ID_L2: Joi.number().required(),

  // Contract Addresses
  MARKET_ADDRESS_L1: Joi.string().required(),
  MARKET_ADDRESS_L2: Joi.string().required(),

  BRIDGE_ADDRESS_L1: Joi.string().required(),
  BRIDGE_ADDRESS_L2: Joi.string().required(),

  POINTS_ADDRESS_L1: Joi.string().required(),
  POINTS_ADDRESS_L2: Joi.string().required(),

  AUCTION_HOUSE_ADDRESS_L1: Joi.string().required(),

  // Relayer
  RELAY_SIGNER_ADDRESS_L1: Joi.string().required(),
  RELAY_SIGNER_PK_L1: Joi.string().required(),

  RELAY_SIGNER_ADDRESS_L2: Joi.string().required(),
  RELAY_SIGNER_PK_L2: Joi.string().required(),

  // API Keys
  API_PRIVATE_KEY: Joi.string().required(),
  API_PUBLIC_KEY: Joi.string().required(),

  // Optional Notifications
  TELEGRAM_CHAT_ID: Joi.string().optional(),
  TELEGRAM_BOT_TOKEN: Joi.string().optional(),
  DISCORD_BOT_TOKEN: Joi.string().optional(),

  // Optional Twitter
  TWITTER_USERNAME: Joi.string().optional(),
  TWITTER_PASSWORD: Joi.string().optional(),
  TWITTER_TWO_FACTOR_SECRET: Joi.string().optional(),
});

export default registerAs('app', (): AppConfig => {
  const isProd = process.env.NODE_ENV === 'production';

  const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3069,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [],
    bridgeBlockDelay: Number(process.env.BRIDGE_BLOCK_DELAY) || 10,

    supabase: {
      url: isProd ? process.env.SUPABASE_URL_PROD : process.env.SUPABASE_URL,
      serviceRoleKey: isProd ? process.env.SUPABASE_SERVICE_ROLE_PROD : process.env.SUPABASE_SERVICE_ROLE,
    },

    features: {
      queue: Number(process.env.QUEUE) || 0,
      bridge: Number(process.env.BRIDGE) || 0,
      discord: Number(process.env.DISCORD) || 0,
      twitter: Number(process.env.TWITTER) || 0,
      telegram: Number(process.env.TELEGRAM) || 0,
      txPool: Number(process.env.TX_POOL) || 0,
      mint: Number(process.env.MINT) || 0,
    },

    chain: {
      chainIdL1: Number(process.env.CHAIN_ID_L1),
      chainIdL2: Number(process.env.CHAIN_ID_L2),
      contracts: {
        market: {
          l1: process.env.MARKET_ADDRESS_L1.toLowerCase() as `0x${string}`,
          l2: process.env.MARKET_ADDRESS_L2.toLowerCase() as `0x${string}`,
        },
        points: {
          l1: process.env.POINTS_ADDRESS_L1.toLowerCase() as `0x${string}`,
          l2: process.env.POINTS_ADDRESS_L2.toLowerCase() as `0x${string}`,
        },
        bridge: {
          l1: process.env.BRIDGE_ADDRESS_L1.toLowerCase() as `0x${string}`,
          l2: process.env.BRIDGE_ADDRESS_L2.toLowerCase() as `0x${string}`,
        },
        auctionHouse: {
          l1: process.env.AUCTION_HOUSE_ADDRESS_L1.toLowerCase() as `0x${string}`,
        },
      },
      rpc: {
        l1: {
          primary: process.env.RPC_URL_L1,
          backup: process.env.RPC_URL_BACKUP_L1,
        },
        l2: {
          primary: process.env.RPC_URL_L2,
          backup: process.env.RPC_URL_BACKUP_L2,
        },
      },
    },

    relay: {
      l1: {
        address: process.env.RELAY_SIGNER_ADDRESS_L1.toLowerCase() as `0x${string}`,
        privateKey: process.env.RELAY_SIGNER_PK_L1,
      },
      l2: {
        address: process.env.RELAY_SIGNER_ADDRESS_L2.toLowerCase() as `0x${string}`,
        privateKey: process.env.RELAY_SIGNER_PK_L2,
      },
    },

    notifications: {
      ...(process.env.TELEGRAM_BOT_TOKEN && {
        telegram: {
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          chatId: process.env.TELEGRAM_CHAT_ID,
        },
      }),
      ...(process.env.DISCORD_BOT_TOKEN && {
        discord: {
          botToken: process.env.DISCORD_BOT_TOKEN,
        },
      }),
      ...(process.env.TWITTER_USERNAME && {
        twitter: {
          username: process.env.TWITTER_USERNAME,
          password: process.env.TWITTER_PASSWORD,
          twoFactorSecret: process.env.TWITTER_TWO_FACTOR_SECRET,
        },
      }),
    },

    api: {
      publicKey: process.env.API_PUBLIC_KEY,
      privateKey: process.env.API_PRIVATE_KEY,
    },
  };

  // console.log(config);

  return config;
});
