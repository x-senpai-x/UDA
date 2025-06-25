// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "../lib/forge-std/src/Script.sol"; 
import {UnifiedDepositRelay} from "../src/UnifiedDepositRelay.sol";

contract DeployUnifiedDepositRelay is Script {
    UnifiedDepositRelay public unifiedDepositRelay;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();
        unifiedDepositRelay = new UnifiedDepositRelay();
        vm.stopBroadcast();
    }
}
