const { ethers } = require("hardhat");
require("dotenv").config();

const LWT = process.env.LWT || "";
const ACTION = process.env.ACTION || "pause"; // "pause" / "unpause"

async function main() {
  if (!LWT) throw new Error("Set LWT address");
  const [pauser] = await ethers.getSigners();
  const lwt = await ethers.getContractAt("LWT1", LWT, pauser);
  if (ACTION === "pause") {
    await (await lwt.pause()).wait();
    console.log("Paused");
  } else {
    await (await lwt.unpause()).wait();
    console.log("Unpaused");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
