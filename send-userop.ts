import {
  createPublicClient,
  keccak256,
  http,
} from 'viem';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ethers } from "ethers";
import entrypointAbi from "./artifacts/contracts/EntryPoint.sol/EntryPoint.json";
import { solidityPacked } from 'ethers';

dotenv.config();

const ENTRYPOINT_ADDRESS = '0x64e4476B8a75E66FA31c198b702a3C6784CEf29e';
const AA_ADDRESS = '0x44823A9E651dceD2F13DC67B3d41Ea02E19387bd';
const RECEIVER = '0x000000000000000000000000000000000000dEaD';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

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

// main().catch(console.error);

// --------- تجربة handleOps باستخدام ethers.js فقط ---------
// احرص أن يكون لديك ethers مثبت: bun add ethers
// واستخدم RPC URL الصحيح

// Helper to ensure 32-byte hex string for bytes32
function toBytes32Hex(val: string | Uint8Array): `0x${string}` {
  const hex = typeof val === 'string' ? val : ethers.hexlify(val);
  return ('0x' + hex.replace(/^0x/, '').padStart(64, '0')) as `0x${string}`;
}

async function handleOpsWithEthers() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL!);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, entrypointAbi.abi, signer);

  // إعداد القيم المطلوبة
  const callGasLimit = 300_000n;
  const verificationGasLimit = 300_000n;
  const maxFeePerGas = 2_000_000_000n;
  const maxPriorityFeePerGas = 1_000_000_000n;

  // طباعة الأنواع للتأكد
  console.log('typeof callGasLimit:', typeof callGasLimit);
  console.log('typeof verificationGasLimit:', typeof verificationGasLimit);
  console.log('typeof maxFeePerGas:', typeof maxFeePerGas);
  console.log('typeof maxPriorityFeePerGas:', typeof maxPriorityFeePerGas);

  // بناء accountGasLimits وgasFees (packed) باستخدام ethers
  const accountGasLimits = solidityPacked(['uint128','uint128'], [callGasLimit, verificationGasLimit]);
  const gasFees = solidityPacked(['uint128','uint128'], [maxFeePerGas, maxPriorityFeePerGas]);

  // احصل على nonce من العقد الذكي مباشرة
  const nonceOnChain = await provider.call({
    to: AA_ADDRESS,
    data: new ethers.Interface([
      "function nonce() view returns (uint256)"
    ]).encodeFunctionData("nonce", [])
  });
  const nonce = ethers.toBigInt(nonceOnChain);
  console.log('Nonce on chain:', nonce);

  // بناء callData أبسط (execute بدون تحويل ولا بيانات)
  const callData = new ethers.Interface(AA_ABI).encodeFunctionData('execute', [RECEIVER, 0n, '0x']);
  console.log('callData:', callData);

  // بناء userOp مطابق للـ ABI الجديد
  const userOp = {
    sender: AA_ADDRESS,
    nonce: nonce,
    initCode: '0x',
    callData,
    accountGasLimits,
    preVerificationGas: 100_000n,
    gasFees,
    paymasterAndData: '0x',
    signature: '0x',
  };
  console.log('UserOp Struct (before signature):', userOp);

  // طباعة typeof لكل حقل قبل encode
  console.log('typeof accountGasLimits:', typeof userOp.accountGasLimits);
  console.log('typeof gasFees:', typeof userOp.gasFees);
  console.log('typeof signature:', typeof userOp.signature);

  // عند التكويد، مرر accountGasLimits وgasFees وsignature كـ Bytes
  const encodedUserOp = (new ethers.AbiCoder()).encode([
    'tuple(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)'
  ], [{
    ...userOp,
    accountGasLimits: ethers.getBytes(userOp.accountGasLimits),
    gasFees: ethers.getBytes(userOp.gasFees),
    signature: ethers.getBytes(userOp.signature),
  }]);

  // استخدم getUserOpHash من العقد بدل keccak256
  const userOpHash = await entryPoint.getUserOpHash({
    sender: userOp.sender,
    nonce: userOp.nonce,
    initCode: userOp.initCode,
    callData: userOp.callData,
    accountGasLimits: userOp.accountGasLimits,
    preVerificationGas: userOp.preVerificationGas,
    gasFees: userOp.gasFees,
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  });
  console.log('userOpHash (from contract):', userOpHash);

  // قراءة owner من العقد الذكي
  const ownerFromContract = await provider.call({
    to: AA_ADDRESS,
    data: new ethers.Interface([
      "function owner() view returns (address)"
    ]).encodeFunctionData("owner", [])
  });
  const ownerAddress = ethers.getAddress("0x" + ownerFromContract.slice(-40));
  console.log('Owner from contract:', ownerAddress);
  console.log('Signer address:', signer.address);
  console.log('userOpHash:', userOpHash);

  // التوقيع الصحيح على digest مباشرة
  const { r, s, v } = signer.signingKey.sign(userOpHash);
  console.log('Signature parts:', { r, s, v });

  const rHex = toBytes32Hex(r);
  const sHex = toBytes32Hex(s);
  // بناء finalSignature كـ packed (r + s + v)
  const finalSignature = ethers.concat([
    ethers.getBytes(rHex),
    ethers.getBytes(sHex),
    Uint8Array.from([v])
  ]);
  console.log('finalSignature:', ethers.hexlify(finalSignature));

  // بناء signedUserOp النهائي
  const signedUserOp = {
    ...userOp,
    signature: finalSignature,
  };
  console.log('Signed UserOp:', signedUserOp);

  if (!entryPoint.handleOps) {
    throw new Error('entryPoint.handleOps is undefined');
  }

  // تحقق من صحة التوقيع عبر isValidSignature قبل estimateGas
  const isValidSigData = new ethers.Interface([
    "function isValidSignature(bytes32,bytes) view returns (bytes4)"
  ]).encodeFunctionData("isValidSignature", [userOpHash, finalSignature]);
  const isValidSigResult = await provider.call({
    to: AA_ADDRESS,
    data: isValidSigData
  });
  console.log('isValidSignature result:', isValidSigResult);

  // جرب estimateGas أولاً
  try {
    const gas = await entryPoint.handleOps.estimateGas([signedUserOp], signer.address);
    console.log('Estimated Gas:', gas.toString());
  } catch (err: any) {
    console.error('EstimateGas Error:', err);
    if (err.data) {
      const revertData = err.data;
      console.error('Revert data:', revertData);
      // حاول فكها كـ string
      if (revertData.length > 138) { // 4 bytes selector + 32 offset + 32 len + ...
        const reasonHex = revertData.slice(138);
        try {
          const reason = Buffer.from(reasonHex, 'hex').toString('utf8');
          console.error('Decoded revert reason:', reason);
        } catch (e) {
          console.error('Could not decode revert reason as utf8 string.');
        }
      } else {
        // اطبع السلكتور
        const selector = revertData.slice(0, 10);
        console.error('Revert selector:', selector);
      }
    }
    return;
  }

  // اطبع رصيد الحساب الذكي قبل أي شيء
  const aaBalance = await provider.getBalance(AA_ADDRESS);
  console.log('AA_ADDRESS balance:', ethers.formatEther(aaBalance), 'ETH');
  if (aaBalance < 0.01 * 1e18) {
    console.error('رصيد الحساب الذكي منخفض جدًا. أرسل بعض ETH إلى الحساب ثم أعد المحاولة.');
    return;
  }

  // أرسل العملية
  try {
    const tx = await entryPoint.handleOps([signedUserOp], signer.address);
    console.log('handleOps tx sent (ethers.js):', tx.hash);
    await tx.wait();
    console.log('Transaction confirmed!');
  } catch (err) {
    console.error('Send Error:', err);
  }
}
handleOpsWithEthers();
// --------- نهاية سكريبت ethers.js ---------
