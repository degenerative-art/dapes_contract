//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract DApes is ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;

    struct CollectionIndices {
        Counters.Counter next;
        uint256 end;
    }
    
    string private baseURIprefix;
    address public gatekeeper;
    mapping(bytes32 => bool) public usedKeys;
    CollectionIndices[] public collectionIndices;

    constructor(address aGatekeeper) ERC721("DApes", "DAPES") {
        gatekeeper = aGatekeeper;
    }

    function setGatekeeper(address aGatekeeper) public onlyOwner {
        gatekeeper = aGatekeeper;
    }

    function addCollection(uint256 start, uint256 end) public onlyOwner {
        require(collectionIndices.length == 0 || collectionIndices[collectionIndices.length - 1].end <= start, "Collections shouldn't overlap");
        collectionIndices.push(CollectionIndices({ next: Counters.Counter(start), end: end }));
    }

    function keyHash(uint256 collection, uint256 nonce, address addr) public pure returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(abi.encodePacked(collection, nonce, addr));
    }

    function mint(uint256 collection, uint256 nonce, bytes memory signature) public {
        bytes32 kh = keyHash(collection, nonce, msg.sender);
        require(ECDSA.recover(kh, signature) == gatekeeper, "Invalid access key");
        require(!usedKeys[kh], "Key already used");
        require(collectionIndices[collection].next.current() < collectionIndices[collection].end, "Minted out");

        usedKeys[kh] = true;
        _safeMint(msg.sender, collectionIndices[collection].next.current());
        collectionIndices[collection].next.increment();
    }

    function setBaseURI(string calldata newURI) public onlyOwner {
        baseURIprefix = newURI;
    }

    function _baseURI() override internal view returns(string memory) {
        return baseURIprefix;
    }
}