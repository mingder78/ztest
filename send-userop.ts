import {
  createWalletClient,
  createPublicClient,
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  http,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';

const ENTRYPOINT_ADDRESS = '0x64e4476B8a75E66FA31c198b702a3C6784CEf29e'; // '0x0576a174D229E3cFA37253523E645A78A0C91B57';
const AA_ADDRESS = '0xf244D7d836E232E6CF337070be635245E6a67Da0';
const RECEIVER = '0x000000000000000000000000000000000000dEaD';
const OWNER_PRIVATE_KEY = import.meta.env.PRIVATE_KEY; // Replace with your AA owner private key

const owner = privateKeyToAccount(OWNER_PRIVATE_KEY);

const client = createWalletClient({
  account: owner,
  chain: sepolia,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Load ABIs from artifacts
const abstractAccountArtifact = JSON.parse(
  fs.readFileSync(
    path.resolve('./artifacts/contracts/AbstractAccount.sol/AbstractAccount.json'),
    'utf-8'
  )
);
const AA_ABI = abstractAccountArtifact.abi;

const entryPointArtifact = JSON.parse(
  fs.readFileSync(
    path.resolve('./artifacts/contracts/EntryPoint.sol/EntryPoint.json'),
    'utf-8'
  )
);
const ENTRYPOINT_ABI = entryPointArtifact.abi;

async function main() {
  // 1. Fetch the current nonce for the AA
  const nonce = await publicClient.readContract({
    address: ENTRYPOINT_ADDRESS,
    abi: ENTRYPOINT_ABI,
    functionName: 'getNonce',
    args: [AA_ADDRESS, 0n],
  });

  // 2. Encode the AA's execute() call data (send 0.001 ETH with empty calldata)
  const callData = encodeFunctionData({
    abi: AA_ABI,
    functionName: 'execute',
    args: [RECEIVER, 1_000_000_000_000_000n, '0x'], // 0.001 ETH
  });

  // 3. Build the unsigned UserOperation object (signature = '0x' placeholder)
  const userOp = {
    sender: AA_ADDRESS,
    nonce,
    initCode: '0x',
    callData,
    callGasLimit: 100_000n,
    verificationGasLimit: 100_000n,
    preVerificationGas: 30_000n,
    maxFeePerGas: 2_000_000_000n,         // 2 Gwei
    maxPriorityFeePerGas: 1_000_000_000n, // 1 Gwei
    paymasterAndData: '0x',
    signature: '0x',
  };

  // 4. Define the UserOperation tuple[] type exactly matching your Solidity struct
  const userOpAbiParam = [
    {
      name: 'ops',
      type: 'tuple[]',
      components: [
        { name: 'sender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'initCode', type: 'bytes' },
        { name: 'callData', type: 'bytes' },
        { name: 'callGasLimit', type: 'uint256' },
        { name: 'verificationGasLimit', type: 'uint256' },
        { name: 'preVerificationGas', type: 'uint256' },
        { name: 'maxFeePerGas', type: 'uint256' },
        { name: 'maxPriorityFeePerGas', type: 'uint256' },
        { name: 'paymasterAndData', type: 'bytes' },
        { name: 'signature', type: 'bytes' },
      ],
    },
  ];

  // 5. Encode and hash the UserOperation array with empty signature
  const encodedUserOp = encodeAbiParameters(userOpAbiParam, [[userOp]]);
  const userOpHash = keccak256(encodedUserOp);

  // 6. Sign the userOpHash with the owner's private key
  const sig = await owner.signMessage({ message: { raw: userOpHash } });

  // 7. Extract r,s,v from signature and encode to bytes for your AA recover()
  const r = `0x${sig.slice(2, 66)}`;
  const s = `0x${sig.slice(66, 130)}`;
  const v = parseInt(sig.slice(130, 132), 16);

  const finalSignature = encodeAbiParameters(
    [
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
    ],
    [r, s, v],
  );

  // 8. Construct the final UserOperation with real signature
  const signedUserOp = { ...userOp, signature: finalSignature };

  // 9. Send handleOps to EntryPoint with single UserOperation
  const txHash = await client.writeContract({
    address: ENTRYPOINT_ADDRESS,
    abi: ENTRYPOINT_ABI,
    functionName: 'handleOps',
    args: [[signedUserOp], owner.address],
  });

  console.log('handleOps tx sent:', txHash);
}

main().catch(console.error);

