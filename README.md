# Unified Deposit Address 

This project demonstrates a unified deposit address system using EIP-7702, enabling an externally-owned account (EOA) to be upgraded to a smart contract wallet. The system automatically forwards USDC deposits to the EOA on multiple testnets to a specified recipient address, with backend services handling event listening and forwarding logic.

## Project Structure

- `contract/` — Smart contract source code, deployment scripts, and configuration
- `index.ts`, `listener.ts`, `contract.ts` — Backend services for event listening and USDC forwarding

## How It Works

1. **Smart Contract**: Implements logic to allow a whitelisted relayer to forward USDC from the unified deposit address to a recipient. The contract is upgradeable via EIP-7702, allowing an EOA to become a smart contract wallet.
2. **Unified Deposit Address**: An EOA is created and then upgraded to a smart contract wallet using EIP-7702, maintaining the same address.
3. **Backend Services**: Listen for USDC transfers to the unified deposit address on supported testnets. When a deposit is detected, the backend triggers the contract to forward the funds to the recipient.

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- Foundry (for Solidity development and deployment)
- Access to Ethereum testnets (e.g., Sepolia, Base Goerli)
- USDC test tokens on the relevant testnets

## Setup

1. **Clone the Repository**
   ```sh
   git clone https://github.com/x-senpai-x/UDA.git
   cd UDA
   ```

2. **Install Dependencies**
   ```sh
   npm install
   # or
   yarn install
   ```

3. **Configure Environment Variables**
   - Copy the example env file and fill in your values:
     ```sh
     cp .env.example .env
     ```
   - Set RPC URLs, private keys, contract addresses, and recipient address as needed.

4. **Compile and Deploy Contracts**
   - Deploy to your chosen testnets using Foundry:
     ```sh
     cd contract
     forge script script/DeployUnifiedDepositRelay.s.sol --rpc-url <RPC_URL> --broadcast 
     ```
   - Note the deployed contract addresses for backend configuration.

5. **Run the Backend Services**
   - From the project root:
     ```sh
     brew install tsx
     tsx listener.ts 
     ```
   - The backend will listen for USDC transfers to the unified deposit address and forward them automatically.

## Usage

- Send USDC to the unified deposit address on any supported testnet.
- The backend will detect the deposit and trigger the contract to forward the funds to the recipient address.
- Check logs for transaction status and errors.

## Supported Networks & Contract Addresses

This backend currently works for **Sepolia** and **Base** testnets. To use only one network, simply comment out the undesired testnet configuration in your environment or backend code, and run the service for the desired network.

### Deployed Contract Addresses

- **Delegation Contract (Sepolia):** `0x6ae533335E06c32f628bB312cc0BF2A62F8b1453`
- **Delegation Contract (Base):** `0x16EB2E744C22F26c09b49eDA8027281EADDEA17d`
- **USDC (Sepolia):** `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238`
- **USDC (Base):** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

