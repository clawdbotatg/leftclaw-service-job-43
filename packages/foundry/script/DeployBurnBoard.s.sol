// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/BurnBoard.sol";

contract DeployBurnBoard is Script {
    function run() external {
        vm.startBroadcast();
        new BurnBoard();
        vm.stopBroadcast();
    }
}
