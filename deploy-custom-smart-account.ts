import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL!);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  // ABI و Bytecode لعقد CustomSmartAccount
  const abi = [
    "constructor(address _owner)",
    "function owner() view returns (address)",
    "function nonce() view returns (uint256)",
    "function validateUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32,uint256) view returns (uint256)",
    "function execute(address,uint256,bytes)",
    "receive() external payable"
  ];
  const bytecode = require("./artifacts/contracts/CustomSmartAccount.sol/CustomSmartAccount.json").bytecode;

  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(signer.address);
  await contract.waitForDeployment();
  console.log("CustomSmartAccount deployed at:", await contract.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 