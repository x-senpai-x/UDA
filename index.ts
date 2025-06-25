import dotenv from "dotenv";
import { ethers } from "ethers";
import { contractABI } from "./contract";

dotenv.config();

// Global variables for reusability
let provider: ethers.JsonRpcProvider,
  eoaSigner: ethers.Wallet,
  relayer: ethers.Wallet,
  targetAddress: string,
  usdcAddress: string,
  recipientAddress: string;

export async function initializeSigners() {
  // Check environment variables
  if (
    !process.env.EOA_PRIVATE_KEY ||
    !process.env.RELAYER_PRIVATE_KEY ||
    // !process.env.DELEGATION_CONTRACT_ADDRESS_BASE ||
    !process.env.DELEGATION_CONTRACT_ADDRESS_SEPOLIA ||
    // !process.env.BASE_RPC_URL ||
    !process.env.SEPOLIA_RPC_URL ||
    // !process.env.USDC_ADDRESS_BASE||
    !process.env.USDC_ADDRESS_SEPOLIA||
    !process.env.RECIPIENT_ADDRESS
  ) {
    console.error("Please set your environmental variables in .env file.");
    process.exit(1);
  }

  //Just uncomment the desired Network 
//   const rpcURL = process.env.BASE_RPC_URL;
  const rpcURL = process.env.SEPOLIA_RPC_URL;
//   targetAddress = process.env.DELEGATION_CONTRACT_ADDRESS_BASE;
  targetAddress = process.env.DELEGATION_CONTRACT_ADDRESS_SEPOLIA;
//   usdcAddress = process.env.USDC_ADDRESS_BASE;
  usdcAddress = process.env.USDC_ADDRESS_SEPOLIA;

  provider = new ethers.JsonRpcProvider(rpcURL);
  eoaSigner = new ethers.Wallet(process.env.EOA_PRIVATE_KEY, provider);
  relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
  recipientAddress =process.env.RECIPIENT_ADDRESS;

  console.log("Unified Deposit Address (EOA to be upgraded):", eoaSigner.address);
  console.log("Whitelisted Relayer Address:", relayer.address);

  const eoaBalance = await provider.getBalance(eoaSigner.address);
  const relayerBalance = await provider.getBalance(relayer.address);
  console.log("UDA ETH Balance:", ethers.formatEther(eoaBalance), "ETH");
  console.log(
    "Relayer ETH Balance:",
    ethers.formatEther(relayerBalance),
    "ETH"
  );
}

export async function checkDelegationStatus(address = eoaSigner.address) {
  console.log("\n=== CHECKING DELEGATION STATUS ===");

  try {
    const code = await provider.getCode(address);

    if (code === "0x") {
      console.log(`[❌ No EIP-7702 delegation found for ${address}`);
      return null;
    }
    if (code.startsWith("0xef0100")) {
      const delegatedAddress = "0x" + code.slice(8); // Remove 0xef0100 (8 chars)
      console.log(`✅ Delegation found for ${address}`);
      console.log(`📍 Delegated to: ${delegatedAddress}`);
      console.log(`📝 Full delegation code: ${code}`);
      return delegatedAddress;
    } else {
      console.log(`❓ Address has code but not EIP-7702 delegation: ${code}`);
      return null;
    }
  } catch (error) {
    console.error("Error checking delegation status:", error);
    return null;
  }
}

async function createAuthorization(nonce: number) {
  const auth = await eoaSigner.authorize({
    address: targetAddress, //Authorize the contract 
    nonce: nonce,
    chainId:   provider._network.chainId, 
  });
  console.log("Authorization created with nonce:", auth.nonce);
  return auth;
}

export async function sendDelegateTransaction() {
  console.log("\n=== Sending Batched Transaction to Authorize Relayer");
  const currentNonce = await eoaSigner.getNonce();
  console.log("Current nonce for EOA:", currentNonce);
  // Create authorization with incremented nonce for same-wallet transactions
  const auth = await createAuthorization(currentNonce + 1);
  // Prepare calls 
  const calls = [
    // to address, value, data
    [ethers.ZeroAddress, ethers.parseEther("0"), "0x"],
    [recipientAddress, ethers.parseEther("0"), "0x"],
  ];

  // Create contract instance and execute
  const delegatedContract = new ethers.Contract(
    eoaSigner.address,
    contractABI,
    eoaSigner
  );
  const tx = await delegatedContract["execute((address,uint256,bytes)[])"](
    calls,
    {
      type: 4,
      authorizationList: [auth],
    }
  );
  console.log("Delegation transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Receipt for delegation transaction:", receipt);
  return receipt;
}

async function createSignatureForCalls(calls: any[], contractNonce: number) {
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

export async function sendRelayTransaction(value) {
  console.log("\n=== Relay Transaction ===");
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
    [recipientAddress, ethers.parseEther("0"), "0x"],
  ];

  // Create contract instance 
  const delegatedContract = new ethers.Contract(
    eoaSigner.address,
    contractABI,
    relayer
  );
  const contractNonce = await delegatedContract.nonce();
  const signature = await createSignatureForCalls(calls, contractNonce);

  // Execute relay transaction
  const tx = await delegatedContract[
    "execute((address,uint256,bytes)[],bytes)"
  ](calls, signature, {
  });
  console.log("Relay transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log(" Receipt for relay transaction:", receipt);
  console.log("Relayed tx block:", receipt.blockNumber);
  return receipt;
}

export async function revokeDelegation() {
  console.log("\n=== REVOKING DELEGATION ===");

  const currentNonce = await eoaSigner.getNonce();
  console.log("Current nonce for revocation:", currentNonce);

  // Create authorization to revoke ie setting address to zero)
  const revokeAuth = await eoaSigner.authorize({
    address: ethers.ZeroAddress, 
    nonce: currentNonce + 1,
    chainId: provider._network.chainId,
  });

  console.log("Revocation authorization created");
  const tx = await eoaSigner.sendTransaction({
    type: 4,
    to: eoaSigner.address,
    authorizationList: [revokeAuth],
  });
  console.log("Revocation transaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("Delegation revoked successfully!");

  return receipt;
}

