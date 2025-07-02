import dotenv from "dotenv";
import { ethers } from "ethers";
import { contractABI } from "./contract";

dotenv.config();

let provider_base: ethers.JsonRpcProvider,
  provider_sepolia: ethers.JsonRpcProvider,
  eoaSigner_base: ethers.Wallet,
  eoaSigner_sepolia: ethers.Wallet,
  relayer_base: ethers.Wallet,
  relayer_sepolia: ethers.Wallet,
  targetAddress_base: string,
  targetAddress_sepolia: string,
  usdcAddress_base: string,
  usdcAddress_sepolia: string,
  recipientAddress: string;

export async function initializeSigners() {
  // Check environment variables
  if (
    !process.env.EOA_PRIVATE_KEY ||
    !process.env.RELAYER_PRIVATE_KEY ||
    !process.env.DELEGATION_CONTRACT_ADDRESS_BASE ||
    !process.env.DELEGATION_CONTRACT_ADDRESS_SEPOLIA ||
    !process.env.BASE_RPC_URL ||
    !process.env.SEPOLIA_RPC_URL ||
    !process.env.USDC_ADDRESS_BASE||
    !process.env.USDC_ADDRESS_SEPOLIA||
    !process.env.RECIPIENT_ADDRESS
  ) {
    console.error("Please set your environmental variables in .env file.");
    process.exit(1);
  }

  const rpcURL_base = process.env.BASE_RPC_URL;
  const rpcURL_sepolia = process.env.SEPOLIA_RPC_URL;
  targetAddress_base = process.env.DELEGATION_CONTRACT_ADDRESS_BASE;
  targetAddress_sepolia = process.env.DELEGATION_CONTRACT_ADDRESS_SEPOLIA;
  usdcAddress_base = process.env.USDC_ADDRESS_BASE;
  usdcAddress_sepolia = process.env.USDC_ADDRESS_SEPOLIA;
  provider_base = new ethers.JsonRpcProvider(rpcURL_base);
  provider_sepolia = new ethers.JsonRpcProvider(rpcURL_sepolia);
  eoaSigner_base = new ethers.Wallet(process.env.EOA_PRIVATE_KEY, provider_base);
  eoaSigner_sepolia = new ethers.Wallet(process.env.EOA_PRIVATE_KEY, provider_sepolia);
  relayer_base = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider_base);
  relayer_sepolia = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider_sepolia);

  recipientAddress = process.env.RECIPIENT_ADDRESS;

  console.log("Unified Deposit Address (EOA to be upgraded):", eoaSigner_base.address);
  console.log("Whitelisted Relayer Address:", relayer_base.address);

  const eoaBalance_base = await provider_base.getBalance(eoaSigner_base.address);
  const relayerBalance_base = await provider_base.getBalance(relayer_base.address);
  console.log("UDA ETH Balance on Base:", ethers.formatEther(eoaBalance_base), "ETH");
  console.log(
    "Relayer ETH Balance on Base:",
    ethers.formatEther(relayerBalance_base),
    "ETH"
  );
  const eoaBalance_sepolia = await provider_sepolia.getBalance(eoaSigner_sepolia.address);
  const relayerBalance_sepolia = await provider_sepolia.getBalance(relayer_sepolia.address);
  console.log("UDA ETH Balance on Sepolia:", ethers.formatEther(eoaBalance_sepolia), "ETH");
  console.log(
    "Relayer ETH Balance on Sepolia:",
    ethers.formatEther(relayerBalance_sepolia),
    "ETH"
  );
}

export async function checkDelegationStatus() {
  console.log("\n=== CHECKING DELEGATION STATUS ===");
  try {
    const code_base = await provider_base.getCode(eoaSigner_base.address);
    const code_sepolia = await provider_sepolia.getCode(eoaSigner_sepolia.address);
    let result = {};
    // Check Base
    if (code_base === "0x") {
      console.log(`[❌ No EIP-7702 delegation found for ${eoaSigner_base.address} on Base`);
      result["base"] = null;
    } else if (code_base.startsWith("0xef0100")) {
      const delegatedAddress = "0x" + code_base.slice(8);
      console.log(`✅ Delegation found for ${eoaSigner_base.address} on Base`);
      console.log(`📍 Delegated to: ${delegatedAddress} on Base`);
      console.log(`📝 Full delegation code: ${code_base} on Base`);
      result["base"] = delegatedAddress;
    } else {
      console.log(`❓ Address has code but not EIP-7702 delegation: ${code_base}`);
      result["base"] = null;
    }
    // Check Sepolia
    if (code_sepolia === "0x") {
      console.log(`[❌ No EIP-7702 delegation found for ${eoaSigner_sepolia.address} on Sepolia`);
      result["sepolia"] = null;
    } else if (code_sepolia.startsWith("0xef0100")) {
      const delegatedAddress = "0x" + code_sepolia.slice(8);
      console.log(`✅ Delegation found for ${eoaSigner_sepolia.address} on Sepolia`);  
      console.log(`📍 Delegated to: ${delegatedAddress} on Sepolia`);
      console.log(`📝 Full delegation code: ${code_sepolia} on Sepolia`);
      result["sepolia"] = delegatedAddress;
    } else {
      console.log(`❓ Address has code but not EIP-7702 delegation: ${code_sepolia}`);
      result["sepolia"] = null;
    }
    return result;
  } catch (error) {
    console.error("Error checking delegation status:", error);
    return { base: null, sepolia: null };
  }
}

export function getDelegatedAddress(statusObj, network) {
  return statusObj[network] || null;
}

function getNetworkVars(network: 'base' | 'sepolia') {
  if (network === 'base') {
    return {
      eoaSigner: eoaSigner_base,
      relayer: relayer_base,
      provider: provider_base,
      targetAddress: targetAddress_base,
      usdcAddress: usdcAddress_base,
    };
  } else if (network === 'sepolia') {
    return {
      eoaSigner: eoaSigner_sepolia,
      relayer: relayer_sepolia,
      provider: provider_sepolia,
      targetAddress: targetAddress_sepolia,
      usdcAddress: usdcAddress_sepolia,
    };
  }
  throw new Error('Unsupported network: ' + network);
}
export { getNetworkVars };


async function createAuthorization(nonce: number, network: 'base' | 'sepolia') {
  const { eoaSigner, provider, targetAddress } = getNetworkVars(network);
  const auth = await eoaSigner.authorize({
    address: targetAddress, //Authorize the contract 
    nonce: nonce,
    chainId:   provider._network.chainId, 
  });
  console.log("Authorization created with nonce:", auth.nonce);
  return auth;
}

export async function sendDelegateTransaction(network: 'base' | 'sepolia') {
  const { eoaSigner } = getNetworkVars(network);
  console.log(`\n=== Sending Transaction to Authorize Relayer on ${network}`);
  const currentNonce = await eoaSigner.getNonce();
  console.log("Current nonce for EOA:", currentNonce);
  const auth = await createAuthorization(currentNonce + 1, network);
  const delegatedContract = new ethers.Contract(
    eoaSigner.address,
    contractABI,
    eoaSigner 
  );
  const tx = await delegatedContract["execute((address,uint256,bytes)[])"](
    [],
    {
      type: 4,
      authorizationList: [auth],
    }
  );
  console.log(`[${network}] Delegation transaction sent:`, tx.hash);
  const receipt = await tx.wait();
  console.log(`[${network}] Receipt for delegation transaction:`, receipt);
  return receipt;
}

async function createSignatureForCalls(calls: any[], contractNonce: number, network: 'base' | 'sepolia') {
  const { eoaSigner } = getNetworkVars(network);
  // Encode the calls for signature
  let encodedCalls = "0x";
  for (const call of calls) {
    const [to, value, data] = call;
    encodedCalls += ethers
      .solidityPacked(["address", "uint256", "bytes"], [to, value, data])
      .slice(2);
  }
  // Create the digest that needs to be signed
  const digest = ethers.keccak256(
    ethers.solidityPacked(["uint256", "bytes"], [contractNonce, encodedCalls])
  );
  // Sign the digest with the EOA's private key
  return await eoaSigner.signMessage(ethers.getBytes(digest));
}

export async function sendRelayTransaction(value, network: 'base' | 'sepolia') {
  const { eoaSigner, relayer, usdcAddress } = getNetworkVars(network);
  console.log(`\n=== Relay Transaction on ${network} ===`);
  // Prepare ERC20 transfer call data
  const erc20ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
  ];
  const erc20Interface = new ethers.Interface(erc20ABI);
  const calls = [
    [
      usdcAddress,
      0n,
      erc20Interface.encodeFunctionData("transfer", [
        recipientAddress,
        value, 
      ]),
    ],
  ];

  // Create contract instance 
  const delegatedContract = new ethers.Contract(
    eoaSigner.address,
    contractABI,
    relayer
  );
  const contractNonce = await delegatedContract.nonce();
  const signature = await createSignatureForCalls(calls, contractNonce, network);

  // Execute relay transaction
  const tx = await delegatedContract[
    "execute((address,uint256,bytes)[],bytes)"
  ](calls, signature, {});
  console.log(`[${network}] Relay transaction sent:`, tx.hash);
  const receipt = await tx.wait();
  console.log(`[${network}] Receipt for relay transaction:`, receipt);
  console.log(`[${network}] Relayed tx block:`, receipt.blockNumber);
  return receipt;
}

export async function revokeDelegation(network: 'base' | 'sepolia') {
  const { eoaSigner, provider } = getNetworkVars(network);
  console.log(`\n=== REVOKING DELEGATION on ${network} ===`);
  const currentNonce = await eoaSigner.getNonce();
  console.log(`[${network}] Current nonce for revocation:`, currentNonce);

  // Create authorization to revoke ie setting address to zero)
  const revokeAuth = await eoaSigner.authorize({
    address: ethers.ZeroAddress, 
    nonce: currentNonce + 1,
    chainId: provider._network.chainId,
  });

  console.log(`[${network}] Revocation authorization created`);
  const tx = await eoaSigner.sendTransaction({
    type: 4,
    to: eoaSigner.address,
    authorizationList: [revokeAuth],
  });
  console.log(`[${network}] Revocation transaction sent:`, tx.hash);

  const receipt = await tx.wait();
  console.log(`[${network}] Delegation revoked successfully!`);

  return receipt;
}

