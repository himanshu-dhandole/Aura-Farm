// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./RiskNFT.sol";
import "./BasePool.sol";

contract AuraFarmer is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    RiskNFT public immutable riskNFT;
    BasePool public immutable lowRiskPool;
    BasePool public immutable medRiskPool;
    BasePool public immutable highRiskPool;

    mapping(address => uint256) public userLowShares;
    mapping(address => uint256) public userMedShares;
    mapping(address => uint256) public userHighShares;

    event NFTMinted(
        address indexed user,
        uint8 lowPct,
        uint8 medPct,
        uint8 highPct
    );
    event FundsAllocated(address indexed user, uint256 assets);
    event FundsWithdrawn(address indexed user, uint256 assets);

    constructor(
        IERC20 asset_,
        RiskNFT riskNFT_,
        BasePool low_,
        BasePool med_,
        BasePool high_
    ) ERC20("Aura Farmer Shares", "aUSDC") ERC4626(asset_) {
        riskNFT = riskNFT_;
        lowRiskPool = low_;
        medRiskPool = med_;
        highRiskPool = high_;
    }

    /*//////////////////////////////////////////////////////////////
                        ERC4626 OVERRIDES
    //////////////////////////////////////////////////////////////*/

    function totalAssets() public view override returns (uint256) {
        return
            lowRiskPool.convertToAssets(
                IERC20(address(lowRiskPool)).balanceOf(address(this))
            ) +
            medRiskPool.convertToAssets(
                IERC20(address(medRiskPool)).balanceOf(address(this))
            ) +
            highRiskPool.convertToAssets(
                IERC20(address(highRiskPool)).balanceOf(address(this))
            ) +
            IERC20(asset()).balanceOf(address(this));
    }

    function convertToShares(
        uint256 assets
    ) public view override returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? assets : (assets * supply) / totalAssets();
    }

    function convertToAssets(
        uint256 shares
    ) public view override returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    /*//////////////////////////////////////////////////////////////
                            NFT
    //////////////////////////////////////////////////////////////*/

    function mintNFT(uint8 l, uint8 m, uint8 h) external {
        riskNFT.mint(msg.sender, l, m, h);
        emit NFTMinted(msg.sender, l, m, h);
    }

    /*//////////////////////////////////////////////////////////////
                            DEPOSIT
    //////////////////////////////////////////////////////////////*/

    function deposit(
        uint256 assets,
        address receiver
    ) public override nonReentrant returns (uint256 shares) {
        require(assets > 0, "AuraFarmer: zero deposit");
        require(riskNFT.hasProfile(receiver), "AuraFarmer: no risk profile");

        RiskNFT.RiskProfile memory p = riskNFT.getRiskProfile(receiver);

        shares = convertToShares(assets);
        require(shares > 0, "zero shares");

        _mint(receiver, shares);
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);

        uint256 lowAmt = (assets * p.lowPct) / 100;
        uint256 medAmt = (assets * p.medPct) / 100;
        uint256 highAmt = assets - lowAmt - medAmt;

        _allocate(receiver, lowAmt, medAmt, highAmt);

        emit Deposit(msg.sender, receiver, assets, shares);
        emit FundsAllocated(receiver, assets);
    }

    function _allocate(
        address user,
        uint256 lowAmt,
        uint256 medAmt,
        uint256 highAmt
    ) internal {
        if (lowAmt > 0) {
            IERC20(asset()).forceApprove(address(lowRiskPool), lowAmt);
            userLowShares[user] += lowRiskPool.deposit(lowAmt, address(this));
        }
        if (medAmt > 0) {
            IERC20(asset()).forceApprove(address(medRiskPool), medAmt);
            userMedShares[user] += medRiskPool.deposit(medAmt, address(this));
        }
        if (highAmt > 0) {
            IERC20(asset()).forceApprove(address(highRiskPool), highAmt);
            userHighShares[user] += highRiskPool.deposit(
                highAmt,
                address(this)
            );
        }
    }

    /*//////////////////////////////////////////////////////////////
                        WITHDRAW / REDEEM
    //////////////////////////////////////////////////////////////*/

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 shares) {
        shares = convertToShares(assets);
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);

        _withdrawFromPools(owner, assets);
        IERC20(asset()).safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        emit FundsWithdrawn(owner, assets);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 assets) {
        require(shares > 0, "zero shares");

        assets = convertToAssets(shares);
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);

        _withdrawFromPools(owner, assets);
        IERC20(asset()).safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _withdrawFromPools(address user, uint256 assets) internal {
        uint256 total = _userTotalAssets(user);

        uint256 low = (assets * _userAssetsLow(user)) / total;
        uint256 med = (assets * _userAssetsMed(user)) / total;
        uint256 high = assets - low - med;

        _redeem(lowRiskPool, userLowShares, user, low);
        _redeem(medRiskPool, userMedShares, user, med);
        _redeem(highRiskPool, userHighShares, user, high);
    }

    function _redeem(
        BasePool pool,
        mapping(address => uint256) storage sharesMap,
        address user,
        uint256 assets
    ) internal {
        if (assets == 0) return;
        uint256 s = pool.previewWithdraw(assets);
        if (s > sharesMap[user]) s = sharesMap[user];
        sharesMap[user] -= s;
        pool.redeem(s, address(this), address(this));
    }

    /*//////////////////////////////////////////////////////////////
                        VIEWS (FOR TESTS)
    //////////////////////////////////////////////////////////////*/

    function getUserAllocation(
        address user
    )
        external
        view
        returns (uint256 lowAssets, uint256 medAssets, uint256 highAssets)
    {
        lowAssets = _userAssetsLow(user);
        medAssets = _userAssetsMed(user);
        highAssets = _userAssetsHigh(user);
    }

    function _userAssetsLow(address u) internal view returns (uint256) {
        return lowRiskPool.convertToAssets(userLowShares[u]);
    }

    function _userAssetsMed(address u) internal view returns (uint256) {
        return medRiskPool.convertToAssets(userMedShares[u]);
    }

    function _userAssetsHigh(address u) internal view returns (uint256) {
        return highRiskPool.convertToAssets(userHighShares[u]);
    }

    function userTotalAssets(address user) external view returns (uint256) {
        return _userTotalAssets(user);
    }

    function _userTotalAssets(address u) internal view returns (uint256) {
        return _userAssetsLow(u) + _userAssetsMed(u) + _userAssetsHigh(u);
    }
}
