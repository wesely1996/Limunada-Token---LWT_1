const { ethers } = require("hardhat");
require("dotenv").config();

const LWT = process.env.LWT || "";
const CURRENCY = process.env.CURRENCY || "";
const SUBSCRIBER = process.env.SUBSCRIBER || "";

async function main() {
  if (!LWT) throw new Error("Set LWT address");
  if (!SUBSCRIBER) throw new Error("Set SUBSCRIBER address in .env");
  const amount = BigInt(process.env.BUY_AMOUNT || 1000);

  const lwt = await ethers.getContractAt("LWT1", LWT);
  const currencyAddr = CURRENCY || (await lwt.currency());
  const currency = await ethers.getContractAt("IERC20", currencyAddr);

  const costPerToken = await lwt.costPerToken();
  const total = costPerToken * amount;

  // Use SUBSCRIBER as signer
  const subSigner = await ethers.getSigner(SUBSCRIBER);

  // Give subscriber lots of USDC on local:
  if (hre.network.name.startsWith("local")) {
    const [deployer] = await ethers.getSigners();
    try {
      const mock = await ethers.getContractAt(
        "MockUSDC",
        currencyAddr,
        deployer
      );
      await (await mock.transfer(SUBSCRIBER, total * 10n)).wait();
    } catch {}
  }

  await (await currency.connect(subSigner).approve(LWT, total)).wait();
  await (await lwt.connect(subSigner).buy(amount)).wait();

  console.log(
    "Subscriber",
    SUBSCRIBER,
    "bought",
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
