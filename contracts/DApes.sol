//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";

contract DApes is ERC1155Upgradeable, OwnableUpgradeable {
    using Counters for Counters.Counter;
    using BitMaps for BitMaps.BitMap;

    struct Collection {
        Counters.Counter nextID;
        uint256 maxSupply;
    }
    
    Counters.Counter private _supply;
    uint256 public constant MAX_COLLECTION_SIZE = 256_000; 
    address public gatekeeper;

    BitMaps.BitMap private _usedNonces;

    Collection[] public collections;

    function initialize(address aGatekeeper, string memory uri) public initializer {
        __ERC1155_init(uri);
        __Ownable_init_unchained();

        gatekeeper = aGatekeeper;
        _supply = Counters.Counter(0);
    }

    function setGatekeeper(address aGatekeeper) public onlyOwner {
        gatekeeper = aGatekeeper;
    }

    function addCollection(uint256 maxSupply) public onlyOwner {
        require(maxSupply <= MAX_COLLECTION_SIZE, "Collection is too large");
        collections.push(Collection({ nextID: Counters.Counter(0), maxSupply: maxSupply }));
    }

    function keyHash(uint256 collection, uint256 nonce, address addr) public pure returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(abi.encodePacked(collection, nonce, addr));
    }

    function tokenID(uint256 collectionID, uint256 relativeTokenID) public view returns (uint256) {
        require(collectionID < collections.length, "Collection doesn't exist");
        return collectionID << 128 + relativeTokenID;
    }

    function isKeyUsed(uint256 nonce) public view returns(bool) {
        return !_usedNonces.get(nonce);
    }

    function mint(uint256 collectionID, uint256 nonce, bytes memory signature) public {
        bytes32 kh = keyHash(collectionID, nonce, msg.sender);
        require(ECDSA.recover(kh, signature) == gatekeeper, "Invalid access key");
        require(isKeyUsed(nonce), "Key already used");
        uint256 newID = collections[collectionID].nextID.current();
        require(newID < collections[collectionID].maxSupply, "Minted out");
        
        _usedNonces.set(nonce);
        collections[collectionID].nextID.increment();
        _supply.increment();
        _mint(msg.sender, tokenID(collectionID, newID), 1, "");
    }

    function totalSupply() public view returns (uint256) {
        return _supply.current();
    }

    function setURI(string calldata newURI) public onlyOwner {
        _setURI(newURI);
    }

    function name() external pure returns (string memory) {
        return "DApes";
    }

    function symbol() external pure returns (string memory) {
        return "DAPES";
    }
}