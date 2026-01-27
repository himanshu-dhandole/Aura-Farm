// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RiskNFT
 * @notice Soulbound NFT that defines user's risk allocation profile
 * @dev Non-transferable NFT that stores risk percentages for Low/Medium/High risk pools
 */
contract RiskNFT is ERC721, Ownable {
    struct RiskProfile {
        uint8 lowPct;  // Percentage for low risk pool (0-100)
        uint8 medPct;  // Percentage for medium risk pool (0-100)
        uint8 highPct; // Percentage for high risk pool (0-100)
    }

    uint256 private _tokenIdCounter;
    mapping(uint256 => RiskProfile) private _riskProfiles;
    mapping(address => uint256) private _ownerToTokenId;

    event RiskProfileMinted(
        address indexed owner,
        uint256 tokenId,
        uint8 lowPct,
        uint8 medPct,
        uint8 highPct
    );

    event RiskProfileUpdated(
        address indexed owner,
        uint256 tokenId,
        uint8 lowPct,
        uint8 medPct,
        uint8 highPct
    );

    constructor() ERC721("Aura Risk Profile", "AURA-RISK") Ownable(msg.sender) {}

    /**
     * @notice Mint a risk profile NFT
     * @param to Address to mint the NFT to
     * @param lowPct Percentage allocation for low risk pool
     * @param medPct Percentage allocation for medium risk pool
     * @param highPct Percentage allocation for high risk pool
     */
    function mint(
        address to,
        uint8 lowPct,
        uint8 medPct,
        uint8 highPct
    ) external onlyOwner returns (uint256) {
        require(to != address(0), "RiskNFT: mint to zero address");
        require(_ownerToTokenId[to] == 0, "RiskNFT: user already has NFT");
        require(
            lowPct + medPct + highPct == 100,
            "RiskNFT: percentages must sum to 100"
        );

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _riskProfiles[tokenId] = RiskProfile({
            lowPct: lowPct,
            medPct: medPct,
            highPct: highPct
        });

        _ownerToTokenId[to] = tokenId;
        _safeMint(to, tokenId);

        emit RiskProfileMinted(to, tokenId, lowPct, medPct, highPct);

        return tokenId;
    }

    /**
     * @notice Update an existing risk profile
     * @param user Address of the NFT owner
     * @param lowPct New percentage allocation for low risk pool
     * @param medPct New percentage allocation for medium risk pool
     * @param highPct New percentage allocation for high risk pool
     */
    function updateRiskProfile(
        address user,
        uint8 lowPct,
        uint8 medPct,
        uint8 highPct
    ) external onlyOwner {
        uint256 tokenId = _ownerToTokenId[user];
        require(tokenId != 0, "RiskNFT: user has no NFT");
        require(
            lowPct + medPct + highPct == 100,
            "RiskNFT: percentages must sum to 100"
        );

        _riskProfiles[tokenId] = RiskProfile({
            lowPct: lowPct,
            medPct: medPct,
            highPct: highPct
        });

        emit RiskProfileUpdated(user, tokenId, lowPct, medPct, highPct);
    }

    /**
     * @notice Get user's risk profile
     * @param user Address to query
     * @return RiskProfile struct with allocation percentages
     */
    function getRiskProfile(address user) external view returns (RiskProfile memory) {
        uint256 tokenId = _ownerToTokenId[user];
        require(tokenId != 0, "RiskNFT: user has no NFT");
        return _riskProfiles[tokenId];
    }

    /**
     * @notice Check if user has a risk profile NFT
     * @param user Address to check
     * @return bool True if user has NFT
     */
    function hasProfile(address user) external view returns (bool) {
        return _ownerToTokenId[user] != 0;
    }

    /**
     * @notice Get token ID for a user
     * @param user Address to query
     * @return uint256 Token ID (0 if no NFT)
     */
    function getTokenId(address user) external view returns (uint256) {
        return _ownerToTokenId[user];
    }

    /**
     * @notice Override to make token soulbound (non-transferable)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0)) and burning (to == address(0))
        // But prevent transfers (from != address(0) && to != address(0))
        require(
            from == address(0) || to == address(0),
            "RiskNFT: token is soulbound"
        );

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Disabled - token is soulbound
     */
    function approve(address, uint256) public pure override {
        revert("RiskNFT: token is soulbound");
    }

    /**
     * @notice Disabled - token is soulbound
     */
    function setApprovalForAll(address, bool) public pure override {
        revert("RiskNFT: token is soulbound");
    }
}
