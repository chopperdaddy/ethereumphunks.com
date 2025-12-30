const dotenv = require('dotenv');

// Load the Supabase env
dotenv.config();

// Load environment files
const loadEnvFile = (filename) => {
  const result = dotenv.config({ path: filename });
  return result.error ? {} : result.parsed;
};

const supabaseConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
  SUPABASE_URL_PROD: process.env.SUPABASE_URL_PROD,
  SUPABASE_SERVICE_ROLE_PROD: process.env.SUPABASE_SERVICE_ROLE_PROD,
};

module.exports = {
  apps: [
    {
      name: "mainnet",
      script: "dist/mainnet/main.js",
      env: {
        ...supabaseConfig,
        ...loadEnvFile('.env.mainnet'),
      },
    },
    {
      name: "sepolia",
      script: "dist/sepolia/main.js",
      env: {
        ...supabaseConfig,
        ...loadEnvFile('.env.sepolia'),
      },
    },
  ],
};
