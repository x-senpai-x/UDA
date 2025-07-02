import dotenv from "dotenv";
import { ethers } from "ethers";
import { initializeSigners, revokeDelegation, sendRelayTransaction, checkDelegationStatus, sendDelegateTransaction, getDelegatedAddress } from "./index";

dotenv.config();

const rpcURL_base = process.env.BASE_RPC_URL;
const rpcURL_sepolia = process.env.SEPOLIA_RPC_URL;
const targetAddress_base=process.env.DELEGATION_CONTRACT_ADDRESS_BASE;
const targetAddress_sepolia=process.env.DELEGATION_CONTRACT_ADDRESS_SEPOLIA;
const usdcAddress_base = process.env.USDC_ADDRESS_BASE!;
const usdcAddress_sepolia = process.env.USDC_ADDRESS_SEPOLIA!;

const eoaAddress = process.env.EOA_ADDRESS!;
const iface = new ethers.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ]);
const provider_base = new ethers.JsonRpcProvider(rpcURL_base);
const provider_sepolia = new ethers.JsonRpcProvider(rpcURL_sepolia);
const usdc_base = new ethers.Contract(usdcAddress_base, iface, provider_base);
const usdc_sepolia = new ethers.Contract(usdcAddress_sepolia, iface, provider_sepolia);

// Only Run once to setup delegation
async function ensureDelegation() {
  console.log("Checking if EIP-7702 delegation is already set for Unified Deposit Address on both Base and Ethereum ... ");
  await initializeSigners();
  const delegationStatus = await checkDelegationStatus();
  const delegated_base = getDelegatedAddress(delegationStatus, "base");
  const delegated_sepolia = getDelegatedAddress(delegationStatus, "sepolia");

  // Check Base
  if (!delegated_base) {
    console.log("Delegation not found on Base — setting EIP-7702 delegation via Batch Transaction");
    await sendDelegateTransaction('base');
  } else if (delegated_base.toLowerCase() !== targetAddress_base?.toLowerCase()) {
    console.log("Delegated contract address on Base is not the target implementation contract — resetting delegation ...");
    await revokeDelegation('base');
    await sendDelegateTransaction('base');
  } else {
    console.log("✅ EIP-7702 delegation already active for Unified Deposit Address on Base, no action needed.");
  }

  // Check Sepolia
  if (!delegated_sepolia) {
    console.log("Delegation not found on Sepolia — setting EIP-7702 delegation via Batch Transaction");
    await sendDelegateTransaction('sepolia');
  } else if (delegated_sepolia.toLowerCase() !== targetAddress_sepolia?.toLowerCase()) {
    console.log("Delegated contract address on Sepolia is not the target implementation contract — resetting delegation ...");
    await revokeDelegation('sepolia');
    await sendDelegateTransaction('sepolia');
  } else {
    console.log("✅ EIP-7702 delegation already active for Unified Deposit Address on Sepolia, no action needed.");
  }
}

//Watch USDC transfers and trigger relay
console.log(`Watching USDC transfers to Unified Deposit Address (${eoaAddress}) ...`);

const processEvent = async (from: string, value: ethers.BigNumberish, network: 'base' | 'sepolia') => {
  try {
    console.log(`[${network}] Watching USDC transfers to Unified Deposit Address (${eoaAddress}) on this chain...`);
    console.log(`[${network}] ${ethers.formatUnits(value, 6)} USDC received from ${from}, triggering relay to recipient address...`);
    const result = await sendRelayTransaction(value, network);
    console.log(`[${network}] USDC transfer complete`);
  } catch (error) {
    console.error(`[${network}] Relay error:`, error);
  }
};

// Listen for USDC transfers on both Base and Sepolia
usdc_base.on("Transfer", async (from, to, value) => {
  if (to.toLowerCase() === eoaAddress.toLowerCase()) {
    await processEvent(from, value, 'base');
  }
});

usdc_sepolia.on("Transfer", async (from, to, value) => {
  if (to.toLowerCase() === eoaAddress.toLowerCase()) {
    await processEvent(from, value, 'sepolia');
  }
});

provider_base.on("error", console.error);
provider_sepolia.on("error", console.error);

ensureDelegation().catch((e) => {
  console.error("Error during startup delegation setup:", e);
});



