// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("MockUSDC", "USDC") {
        _mint(msg.sender, 1_000_000_000 * 10**6); // 1B USDC to deployer
    }
    function decimals() public pure override returns (uint8) { return 6; }
}