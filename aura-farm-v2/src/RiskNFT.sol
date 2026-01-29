// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface IERC5192 {
    /// @notice Emitted when the locking status is changed to locked.
    /// @dev If a token is minted and the status is locked, this event should be emitted.
    /// @param tokenId The identifier for a token.
    event Locked(uint256 tokenId);

    /// @notice Emitted when the locking status is changed to unlocked.
    /// @dev If a token is minted and the status is unlocked, this event should be emitted.
    /// @param tokenId The identifier for a token.
    event Unlocked(uint256 tokenId);

    /// @notice Returns the locking status of an Soulbound Token
    /// @dev SBTs assigned to zero address are considered invalid, and queries
    /// about them do throw.
    /// @param tokenId The identifier for an SBT.
    function locked(uint256 tokenId) external view returns (bool);
}

contract RiskNFT is ERC721, IERC5192 {
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

    constructor() ERC721("Aura Risk Profile", "AURA-RISK") {}

    function mint(
        uint8 lowPct,
        uint8 medPct,
        uint8 highPct
    ) external returns (uint256) {
        require(_ownerToTokenId[msg.sender] == 0, "RiskNFT: user already has NFT");
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

        _ownerToTokenId[msg.sender] = tokenId;
        _safeMint(msg.sender, tokenId);

        emit Locked(tokenId); // ERC-5192: Emit Locked event on mint
        emit RiskProfileMinted(msg.sender, tokenId, lowPct, medPct, highPct);

        return tokenId;
    }

    function updateRiskProfile(
        uint8 lowPct,
        uint8 medPct,
        uint8 highPct
    ) external {
        uint256 tokenId = _ownerToTokenId[msg.sender];
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

        emit RiskProfileUpdated(msg.sender, tokenId, lowPct, medPct, highPct);
    }

    function getRiskProfile(address user) external view returns (RiskProfile memory) {
        uint256 tokenId = _ownerToTokenId[user];
        require(tokenId != 0, "RiskNFT: user has no NFT");
        return _riskProfiles[tokenId];
    }


    function getMyRiskProfile() external view returns (RiskProfile memory) {
        uint256 tokenId = _ownerToTokenId[msg.sender];
        require(tokenId != 0, "RiskNFT: you have no NFT");
        return _riskProfiles[tokenId];
    }

    function hasProfile(address user) external view returns (bool) {
        return _ownerToTokenId[user] != 0;
    }

    function getTokenId(address user) external view returns (uint256) {
        return _ownerToTokenId[user];
    }

    function locked(uint256 tokenId) external view override returns (bool) {
        require(_ownerOf(tokenId) != address(0), "RiskNFT: invalid token ID");
        return true; // All tokens are permanently locked
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        require(
            from == address(0) || to == address(0),
            "RiskNFT: token is soulbound and cannot be transferred"
        );

        // 🔥 FIX: Clear mapping on burn to allow user to remint
        if (to == address(0) && from != address(0)) {
            delete _ownerToTokenId[from];
        }

        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert("RiskNFT: token is soulbound and cannot be approved");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("RiskNFT: token is soulbound and cannot be approved");
    }

    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override 
        returns (bool) 
    {
        return interfaceId == type(IERC5192).interfaceId || 
               super.supportsInterface(interfaceId);
    }
}
