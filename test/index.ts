import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
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

class MintContext {
  nonce: number;
  contract: DApes;
  gatekeeper: SignerWithAddress;

  constructor(gatekeeper: SignerWithAddress, contract: DApes, startingNonce = 0) {
    this.nonce = 0;
    this.contract = contract;
    this.gatekeeper = gatekeeper;
  }

  connect(signer: SignerWithAddress) {
    this.contract = this.contract.connect(signer);
  }

  async mint(collection: number, sig?: string) {
    let address = await this.contract.signer.getAddress();
    sig = sig ?? await this.sign(collection, this.nonce, address); 
    return this.contract.mint(collection, this.nonce, sig).then((tx) => { this.nonce++; return tx });
  }

  
  async sign(collection:number, nonce:number, addr:string) {
    return await this.gatekeeper.signMessage(ethers.utils.arrayify(packKey(collection, nonce, addr)));
  }
}

describe("DApes", function () {

  let DApes: DApes__factory;
  let dapesContract: DApes;

  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let gatekeeper: SignerWithAddress;
  let addrs: SignerWithAddress[];
  let mintContext: MintContext;

  beforeEach(async function() {
    DApes = await ethers.getContractFactory("DApes");
    [owner, addr1, addr2, gatekeeper, ...addrs] = await ethers.getSigners();
    dapesContract = await upgrades.deployProxy(DApes, [gatekeeper.address, ""]) as DApes;
    mintContext = new MintContext(gatekeeper, dapesContract, 0);
  })

  it("Can mint with proper signed key", async function () {
    await dapesContract.addCollection(0, 10);
    let indices = await dapesContract.collections(0);
    expect(indices[0][0]).to.equal(0);
    expect(indices[1]).to.equal(10);
    mintContext.connect(addr1);
    await expect(mintContext.mint(0)).to.be.not.reverted;
  });

  it("Cannot be minted with stolen key", async function() {
    await dapesContract.addCollection(0, 10);
    mintContext.connect(addr2);
  
    const stolen_sig = await gatekeeper.signMessage(ethers.utils.arrayify(packKey(0, 0, addr1.address)));
    await expect(mintContext.mint(0, stolen_sig)).to.be.revertedWith("Invalid access key");  
  });

  it("Can mint with several keys", async function () {
    await dapesContract.addCollection(0, 10);

    mintContext.connect(addr1);
    
    await expect(mintContext.mint(0)).to.be.not.reverted;
    await expect(mintContext.mint(0)).to.be.not.reverted;
    
    mintContext.connect(addr2);

    let nonce = mintContext.nonce;
    await expect(dapesContract.connect(addr2).mint(0, nonce, await mintContext.sign(0, nonce, addr2.address))).to.be.not.reverted;
    await expect(dapesContract.connect(addr2).mint(0, nonce, await mintContext.sign(0, nonce, addr2.address))).to.be.revertedWith("Key already used");
    mintContext.nonce++;
    mintContext.connect(addr1);

    while (mintContext.nonce < 10) {
      await expect(mintContext.mint(0)).to.be.not.reverted;
    }
    await expect(mintContext.mint(0)).to.be.revertedWith("Minted out");

    expect(await dapesContract.totalSupply()).to.equal(mintContext.nonce);
  });

  it("Can mint from two collections at the same time", async () => {
    await dapesContract.addCollection(0, 5);
    await dapesContract.addCollection(5, 1000);

    mintContext.connect(addr1);
    
    await expect(mintContext.mint(0)).to.be.not.reverted;
    await expect(mintContext.mint(1)).to.be.not.reverted;
    
    expect(await dapesContract.balanceOf(addr1.address, 0)).to.equal(1);
    expect(await dapesContract.balanceOf(addr1.address, 5)).to.equal(1);
  });

  it("Can amend top collection", async () => {
    await expect(dapesContract.amendTopCollection(42)).to.be.revertedWith("No collection to amend");

    await dapesContract.addCollection(0, 1337);

    await expect(dapesContract.amendTopCollection(42)).to.be.not.reverted;

    mintContext.connect(addr1);
    for (let i = 0; i < 5; ++i) {
      await expect(mintContext.mint(0)).to.be.not.reverted;
    }

    expect(await dapesContract.totalSupply()).to.equal(5);

    mintContext.connect(owner);
    await expect(dapesContract.amendTopCollection(5)).to.be.not.reverted;

    mintContext.connect(addr1);
    await expect(mintContext.mint(0)).to.be.revertedWith("Minted out");

    mintContext.connect(owner);
    await expect(dapesContract.amendTopCollection(4)).to.be.revertedWith("End cuts existing supply");
  })

  it("Can add collections without overlap", async () => {
    await dapesContract.addCollection(0, 100);

    await expect(dapesContract.addCollection(200, 100)).to.be.revertedWith("Start should preceede end");
    await expect(dapesContract.addCollection(99, 102)).to.be.revertedWith("Collections shouldn't overlap");

    await dapesContract.addCollection(100, 200);
  })

  it("Can pause", async () => {
    await dapesContract.addCollection(0, 10);
    mintContext.connect(addr1);

    await mintContext.mint(0);

    await dapesContract.pause();

    await expect(mintContext.mint(0)).to.be.revertedWith("ERC1155Pausable: token transfer while paused");
    await dapesContract.amendTopCollection(2);

    await dapesContract.unpause();

    await mintContext.mint(0);
  })
});
