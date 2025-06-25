import dotenv from "dotenv";
import { ethers } from "ethers";
import { initializeSigners, revokeDelegation, sendRelayTransaction, checkDelegationStatus, sendDelegateTransaction} from "./index";

dotenv.config();

// const rpcURL = process.env.BASE_RPC_URL;//change this for a different testnet
const rpcURL = process.env.SEPOLIA_RPC_URL;//change this for a different testnet
// const targetAddress=process.env.DELEGATION_CONTRACT_ADDRESS_BASE;//change this for different testnet
const targetAddress=process.env.DELEGATION_CONTRACT_ADDRESS_SEPOLIA;//change this for different testnet
// const usdcAddress = process.env.USDC_ADDRESS_BASE!;
const usdcAddress = process.env.USDC_ADDRESS_SEPOLIA!;

const eoaAddress = process.env.EOA_ADDRESS!;
const iface = new ethers.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ]);
const provider = new ethers.JsonRpcProvider(rpcURL);
const usdc = new ethers.Contract(usdcAddress, iface, provider);

// Only Run once to setup delegation
async function ensureDelegation() {
  console.log("Checking if EIP-7702 delegation is already set for Unified Deposit Address...");

  await initializeSigners();

  const delegated = await checkDelegationStatus();

  if (!delegated) {
    console.log("Delegation not found — setting EIP-7702 delegation via Batch Transaction");
    await sendDelegateTransaction();
  } 
  else if (delegated.toLowerCase()!=targetAddress?.toLowerCase()){
    console.log("Delegated contract address is not the target implementation contract — resetting delegation ...");
    await revokeDelegation(); // or revokeDelegatione
    await sendDelegateTransaction();
  }
  else  {
    console.log(" ✅ EIP-7702 delegation already active for Unified Deposit Address, no action needed.");
  }
}

//Watch USDC transfers and trigger relay
console.log(`Watching USDC transfers to Unified Deposit Address (${eoaAddress}) on this chain...`);

const processEvent = async (from: string,value: ethers.BigNumberish) => {
  try {
    console.log(`Watching USDC transfers to Unified Deposit Address (${eoaAddress}) on this chain...`);

    console.log(`${ethers.formatUnits(value, 6)} USDC received from ${from}, triggering relay to recipient address...`);

    const result = await sendRelayTransaction(value);
    console.log("USDC transfer complete");
  } catch (error) {
    console.error("❌ Relay error:", error);
  }
};

usdc.on("Transfer", async (from, to,value) => {
  if (to.toLowerCase() === eoaAddress.toLowerCase()) {
    await processEvent(from,value);
  }
});

provider.on("error", console.error);

ensureDelegation().catch((e) => {
  console.error("Error during startup delegation setup:", e);
});



