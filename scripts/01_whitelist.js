const { ethers } = require("hardhat");
require("dotenv").config();

const LWT = process.env.LWT || ""; // set if not using last deployment logs
const WHO = process.env.SUBSCRIBER || "";

async function main() {
  if (!LWT) throw new Error("Set LWT in env to LWT1 address");
  if (!WHO) throw new Error("Set SUBSCRIBER in env to whitelist");

  const lwt = await ethers.getContractAt("LWT1", LWT);
  const tx = await lwt.setWhitelisted(WHO, true);
  await tx.wait();
  console.log("Whitelisted:", WHO);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
