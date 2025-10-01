const { ethers } = require("hardhat");
require("dotenv").config();

const LWT = process.env.LWT || "";

async function main() {
  if (!LWT) throw new Error("Set LWT address");
  const amt = BigInt(process.env.WITHDRAW_COST || 50_000_000);

  const [treasurer] = await ethers.getSigners();
  const lwt = await ethers.getContractAt("LWT1", LWT, treasurer);
  await (await lwt.treasurerWithdrawCollectedCost(amt)).wait();
  console.log("Withdrawn cost:", amt.toString());
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
