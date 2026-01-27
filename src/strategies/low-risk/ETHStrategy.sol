// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ETHStrategy
 * @notice Low Risk Strategy - Simulates ETH staking
 * @dev Conservative APY: 3-6%
 */
contract ETHStrategy is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public vault;
    uint256 public lastHarvest;
    uint256 public totalHarvested;

    uint256 public baseAPY = 450; // 4.5% base APY
    uint256 public lastYieldUpdate;
    uint256 public accumulatedYield;
    uint256 public lastRandomFactor = 100;

    event Harvested(uint256 amount, uint256 timestamp);
    event YieldGenerated(uint256 amount);
    event VaultUpdated(address indexed oldVault, address indexed newVault);

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }

    constructor(
        IERC20 _asset
    ) ERC4626(_asset) ERC20("ETH Strategy Shares", "sETH") Ownable(msg.sender) {
        lastYieldUpdate = block.timestamp;
    }

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault");
        address oldVault = vault;
        vault = _vault;
        emit VaultUpdated(oldVault, _vault);
    }

    function _generateYield() internal {
        uint256 timeElapsed = block.timestamp - lastYieldUpdate;
        if (timeElapsed == 0) return;

        uint256 baseAssets = IERC20(asset()).balanceOf(address(this)) + accumulatedYield;
        if (baseAssets == 0) {
            lastYieldUpdate = block.timestamp;
            return;
        }

        uint256 baseYield = (baseAssets * baseAPY * timeElapsed) / (365 days * 10000);

        uint256 randomSeed = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    address(this),
                    baseYield
                )
            )
        );
        uint256 randomFactor = (randomSeed % 20) + 95; // 95-115
        lastRandomFactor = randomFactor;

        uint256 yieldAmount = (baseYield * randomFactor) / 100;
        accumulatedYield += yieldAmount;
        lastYieldUpdate = block.timestamp;

        emit YieldGenerated(yieldAmount);
    }

    function deposit(
        uint256 assets,
        address receiver
    ) public virtual override onlyVault nonReentrant returns (uint256) {
        _generateYield();
        return super.deposit(assets, receiver);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address /* owner */
    ) public virtual override onlyVault nonReentrant returns (uint256) {
        _generateYield();

        uint256 balance = IERC20(asset()).balanceOf(address(this));
        uint256 withdrawn = assets > balance ? balance : assets;

        if (withdrawn > 0) {
            IERC20(asset()).safeTransfer(receiver, withdrawn);
        }

        return withdrawn;
    }

    function totalAssets() public view virtual override returns (uint256) {
        uint256 baseAssets = IERC20(asset()).balanceOf(address(this)) + accumulatedYield;
        uint256 timeElapsed = block.timestamp - lastYieldUpdate;
        uint256 pendingYield = 0;

        if (timeElapsed > 0 && baseAssets > 0) {
            uint256 baseYield = (baseAssets * baseAPY * timeElapsed) / (365 days * 10000);
            pendingYield = (baseYield * lastRandomFactor) / 100;
        }

        return baseAssets + pendingYield;
    }

    function balanceOf() external view returns (uint256) {
        return totalAssets();
    }

    function harvest() external onlyVault nonReentrant returns (uint256) {
        _generateYield();
        uint256 harvestedAmount = accumulatedYield;

        if (harvestedAmount > 0) {
            totalHarvested += harvestedAmount;
            accumulatedYield = 0;
            lastHarvest = block.timestamp;
            emit Harvested(harvestedAmount, block.timestamp);
        }

        return harvestedAmount;
    }

    function estimatedAPY() external view returns (uint256) {
        return (baseAPY * lastRandomFactor) / 100;
    }

    function withdrawAll() external onlyVault nonReentrant returns (uint256) {
        _generateYield();
        uint256 total = IERC20(asset()).balanceOf(address(this));

        if (total > 0) {
            IERC20(asset()).safeTransfer(vault, total);
        }

        return total;
    }
}
