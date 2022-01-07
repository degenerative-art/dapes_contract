//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract DApes is ERC1155, Ownable {
    using Counters for Counters.Counter;

    struct Collection {
        Counters.Counter nextID;
        uint256 maxSupply;
    }
    
    Counters.Counter private _supply;
    uint256 public constant MAX_COLLECTION_SIZE = 256_000; 
    address public gatekeeper;

    mapping(bytes32 => bool) public usedKeys;
    
    Collection[] public collections;

    constructor(address aGatekeeper, string memory uri) ERC1155(uri) {
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

    function mint(uint256 collectionID, uint256 nonce, bytes memory signature) public {
        bytes32 kh = keyHash(collectionID, nonce, msg.sender);
        require(ECDSA.recover(kh, signature) == gatekeeper, "Invalid access key");
        require(!usedKeys[kh], "Key already used");
        require(collections[collectionID].nextID.current() < collections[collectionID].maxSupply, "Minted out");
        
        usedKeys[kh] = true;
        _mint(msg.sender, tokenID(collectionID, collections[collectionID].nextID.current()), 1, "");
        collections[collectionID].nextID.increment();
        _supply.increment();
    }

    function totalSupply() public view returns (uint256) {
        return _supply.current();
    }

    function setURI(string calldata newURI) public onlyOwner {
        _setURI(newURI);
    }
}