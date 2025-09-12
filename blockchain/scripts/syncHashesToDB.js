const Web3 = require("web3");
const axios = require("axios");
const CertificateChain = require("./build/contracts/CertificateChain.json");

const rpcUrl = "https://eth-mainnet.g.alchemy.com/v2/Me81EGClT6z4K9YbAexMw"; //httpurl/apikey
// const rpcUrl = "http://127.0.0.1:7545"; // Or whichever network
const contractAddress = "0x..."; // Get from Aswathi
const web3 = new Web3(rpcUrl);

const contract = new web3.eth.Contract(CertificateChain.abi, contractAddress);

async function syncHashes() {
  // Assuming contract has a way to fetch all hashes (like allHashes() or events)
  const hashes = await contract.methods.allHashes().call(); // Or use events if not

  for (const hash of hashes) {
    try {
      await axios.post("http://localhost:5000/add-hash", { hash }); // backend URL
      console.log("Sent hash:", hash);
    } catch (err) {
      console.error("Error sending hash:", hash, err.message);
    }
  }
}

syncHashes();