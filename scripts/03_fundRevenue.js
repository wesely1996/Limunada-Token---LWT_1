const { ethers } = require("hardhat");
require("dotenv").config();

const LWT = process.env.LWT || "";

async function main() {
  if (!LWT) throw new Error("Set LWT address");
  const amt = BigInt(process.env.REVENUE_FUND || 100_000_000); // 100 USDC

  const [treasurer] = await ethers.getSigners();
  const lwt = await ethers.getContractAt("LWT1", LWT, treasurer);
  const currencyAddr = await lwt.currency();
  const currency = await ethers.getContractAt(
    "IERC20",
    currencyAddr,
    treasurer
  );

  await (await currency.approve(LWT, amt)).wait();
  await (await lwt.treasurerFundRevenue(amt)).wait();

  console.log("Funded revenue:", amt.toString());
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
