module.exports = {
  apps: [
    {
      name: "sepolia",
      script: "dist/sepolia/main.js",
      env: {
        NODE_ENV: "dev",
        CHAIN_ID: "11155111",
        PORT: "3003",
      },
    },
    {
      name: "mainnet",
      script: "dist/mainnet/main.js",
      env: {
        NODE_ENV: "prod",
        CHAIN_ID: "1",
        PORT: "3002",
      },
    }
  ],
};
