// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract VirtualUSDT is ERC20, Ownable {
    uint256 public constant AIRDROP_AMOUNT = 10_000e18;

    // Track which addresses have already claimed their limited mint
    mapping(address => bool) public hasClaimed;

    constructor () ERC20("virtual USDT", "VUSDT") Ownable(msg.sender) {}

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    // Allow each address to mint 10,000 VUSDT only once
    function airdrop() public {
        require(!hasClaimed[msg.sender], "Already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, AIRDROP_AMOUNT);
    }

    // burn vUSDT
    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }
}