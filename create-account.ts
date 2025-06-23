import { createWalletClient, http, parseAbi, getContract, encodeFunctionData } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toHex } from 'viem';

const salt = toHex(0n, { size: 32 }); // OK ✅ - results in "0x000000...0000"

const FACTORY_ADDRESS = import.meta.env.FACTORY_ADDRESS;
const ENTRYPOINT_ADDRESS = '0x0576a174D229E3cFA37253523E645A78A0C91B57'; // Sepolia 4337 EntryPoint

const FACTORY_ABI = parseAbi([
  'function getAddress(address owner, bytes32 salt) public view returns (address)',
  'function createAccount(address owner, bytes32 salt) public returns (address)',
]);

const PRIVATE_KEY = import.meta.env.PRIVATE_KEY; // 🔐 Make sure to secure this!

const main = async () => {
  const ownerAccount = privateKeyToAccount(PRIVATE_KEY);

  const client = createWalletClient({
    account: ownerAccount,
    chain: sepolia,
    transport: http(),
  });

  const factory = getContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    client,
  });


  // Optional: Get counterfactual address first
  const predictedAddress = await factory.read.getAddress([ownerAccount.address, salt]);
  console.log('Predicted Account Address:', predictedAddress);

  // Create the Abstract Account
  const hash = await factory.write.createAccount([ownerAccount.address, salt]);
  console.log('Account creation tx hash:', hash);
};

main().catch(console.error);

