module.exports = {
  apps: [
    {
      name: "goerli",
      script: "dist/goerli/main.js",
      env: {
        NODE_ENV: "dev",
        CHAIN_ID: "5",
        PORT: "3001",
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
