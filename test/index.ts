import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DApes, DApes__factory } from "../typechain";

function padZeros(s: string, width: number) {
  const padSize = width - s.length;
  if (padSize === 0) {
    return s;
  } else {
    return "0".repeat(padSize) + s;
  }
}

function packKey(collection: number, nonce: number, address: string) {
  return "0x" + padZeros(collection.toString(16), 64) + padZeros(nonce.toString(16), 64) + padZeros(address.slice(2), 40);
}

describe("DApes", function () {
  let DApes: DApes__factory;
  let dapesContract: DApes;

  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let gatekeeper: SignerWithAddress;
  let addrs: SignerWithAddress[];
  beforeEach(async function() {
    DApes = await ethers.getContractFactory("DApes");
    [owner, addr1, addr2, gatekeeper, ...addrs] = await ethers.getSigners();
    dapesContract = await DApes.deploy(gatekeeper.address);
  })

  async function sign(collection:number, nonce:number, addr:string) {
    return await gatekeeper.signMessage(ethers.utils.arrayify(packKey(collection, nonce, addr)));
  }

  it("Can mint with proper signed key", async function () {
    await dapesContract.addCollection(0, 10);
    let indices = await dapesContract.collectionIndices(0);
    expect(indices[0][0]).to.equal(0);
    expect(indices[1]).to.equal(10);

    await expect(dapesContract.connect(addr1).mint(0, 0, await gatekeeper.signMessage(ethers.utils.arrayify(packKey(0, 0, addr1.address)))))
      .to.be.not.reverted;
  });

  it("Cannot be minted with stolen key", async function() {
    await dapesContract.addCollection(0, 10);
  
    const stolen_sig = await gatekeeper.signMessage(ethers.utils.arrayify(packKey(0, 0, addr1.address)));
    await expect(dapesContract.connect(addr2).mint(0, 0, stolen_sig)).to.be.revertedWith("Invalid access key");  
  });

  it("Can mint with several keys", async function () {
    await dapesContract.addCollection(0, 10);
    
    let nonce = 0;
    await expect(dapesContract.connect(addr1).mint(0, nonce, await gatekeeper.signMessage(ethers.utils.arrayify(packKey(0, nonce, addr1.address))))).to.be.not.reverted;
    nonce++;
    await expect(dapesContract.connect(addr1).mint(0, nonce, await gatekeeper.signMessage(ethers.utils.arrayify(packKey(0, nonce, addr1.address))))).to.be.not.reverted;
    nonce++
    
    await expect(dapesContract.connect(addr2).mint(0, nonce, await gatekeeper.signMessage(ethers.utils.arrayify(packKey(0, nonce, addr2.address))))).to.be.not.reverted;
    await expect(dapesContract.connect(addr2).mint(0, nonce, await gatekeeper.signMessage(ethers.utils.arrayify(packKey(0, nonce, addr2.address))))).to.be.revertedWith("Key already used");

    while (nonce < 9) {
      await expect(dapesContract.connect(addr1).mint(0, nonce, await gatekeeper.signMessage(ethers.utils.arrayify(packKey(0, nonce, addr1.address))))).to.be.not.reverted;
      nonce++;
    }
    await expect(dapesContract.connect(addr1).mint(0, nonce, await sign(0, nonce, addr1.address))).to.be.revertedWith("Minted out");
    expect(await dapesContract.totalSupply()).to.equal(10);
  });

  it("Can mint from two collections at the same time", async () => {
    await dapesContract.addCollection(0, 5);
    await dapesContract.addCollection(1000, 10002);

    let nonce = 0;
    let dapes1 = dapesContract.connect(addr1);
    await expect(dapes1.mint(0, nonce, await sign(0, nonce, addr1.address))).to.be.not.reverted;
    nonce++;
    await expect(dapes1.mint(1, nonce, await sign(1, nonce, addr1.address))).to.be.not.reverted;
    nonce++;
    expect(await dapesContract.tokenOfOwnerByIndex(addr1.address, 0)).to.equal(0);
    expect(await dapesContract.tokenOfOwnerByIndex(addr1.address, 1)).to.equal(1000);
  });

  it("Shouldn't allow collections overlap", async () => {
    await dapesContract.addCollection(0, 10);
    await expect(dapesContract.addCollection(9, 20)).to.be.reverted;
    await expect(dapesContract.addCollection(10, 20)).to.be.not.reverted;
  })
});
