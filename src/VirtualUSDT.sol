// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VirtualUSDT
 * @notice Mock USDT for testing - Allows strategies to mint for yield simulation
 */
contract VirtualUSDT is ERC20, Ownable {
    uint256 public constant AIRDROP_AMOUNT = 10_000e18;

    mapping(address => bool) public hasClaimed;
    mapping(address => bool) public canMint; // Strategies can mint for yield

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    constructor () ERC20("virtual USDT", "VUSDT") Ownable(msg.sender) {}

    /**
     * @notice Mint tokens - Owner or authorized minters only
     */
    function mint(address _to, uint256 _amount) public {
        require(msg.sender == owner() || canMint[msg.sender], "Not authorized to mint");
        _mint(_to, _amount);
    }
    
    /**
     * @notice Allow a strategy to mint tokens (for yield generation)
     */
    function addMinter(address _minter) external onlyOwner {
        canMint[_minter] = true;
        emit MinterAdded(_minter);
    }
    
    /**
     * @notice Remove minting permission
     */
    function removeMinter(address _minter) external onlyOwner {
        canMint[_minter] = false;
        emit MinterRemoved(_minter);
    }

    /**
     * @notice One-time airdrop for users
     */
    function airdrop() public {
        require(!hasClaimed[msg.sender], "Already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, AIRDROP_AMOUNT);
    }

    /**
     * @notice Burn tokens
     */
    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }
}
