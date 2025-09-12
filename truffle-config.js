module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",    // Localhost
      port: 7545,           // Ganache GUI default
      network_id: "*",      // Match any network id
      gas: 6721975,         // Optional, Ganache default
      gasPrice: 20000000000 // Optional
    }
  },

  // Mocha settings
  mocha: {
    // timeout: 100000
  },

  // Compiler configuration
  compilers: {
    solc: {
      version: "0.8.20", // Exact version
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

  // Truffle DB disabled
  db: {
    enabled: false
  }
};
