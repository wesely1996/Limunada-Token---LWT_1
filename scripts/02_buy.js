const { ethers } = require("hardhat");
require("dotenv").config();

const LWT = process.env.LWT || "";
const CURRENCY = process.env.CURRENCY || "";
const SUBSCRIBER_PK = process.env.PRIVATE_KEY || "";

async function main() {
  if (!LWT) throw new Error("Set LWT address");
  const amount = BigInt(process.env.BUY_AMOUNT || 1000);

  const [deployer, ...rest] = await ethers.getSigners();
  const signer = deployer;

  const lwt = await ethers.getContractAt("LWT1", LWT, signer);
  const currencyAddr = CURRENCY || (await (await lwt.currency()).toString());
  const currency = await ethers.getContractAt("IERC20", currencyAddr, signer);

  const costPerToken = await lwt.costPerToken();
  const total = costPerToken * amount;

  // Give subscriber lots of USDC on local:
  if (hre.network.name.startsWith("local")) {
    // mint from deployer only if MockUSDC
    try {
      const mock = await ethers.getContractAt("MockUSDC", currencyAddr, signer);
      await (await mock.transfer(signer.address, total * 10n)).wait();
    } catch {}
  }

  await (await currency.approve(LWT, total)).wait();
  await (await lwt.buy(amount)).wait();

  console.log(
    "Bought",
    amount.toString(),
    "LWT1 for",
    total.toString(),
    "currency units."
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
