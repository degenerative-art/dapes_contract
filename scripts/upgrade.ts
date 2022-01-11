// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";

async function main() {
  if (!process.env.DEPLOYED_ADDR) {
    console.log("Please set DEPLOYED_ADDR before calling this script");
    return 1;
  }

  const DApes = await ethers.getContractFactory("DApes");
  const dapes = await upgrades.upgradeProxy(process.env.DEPLOYED_ADDR, DApes, { kind: "uups" });

  console.log(`DApes upgraded at: ${dapes.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
