const { ethers } = require("hardhat");
require("dotenv").config();

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

async function main() {
  const [deployer, ...rest] = await ethers.getSigners();
  const ADMIN = process.env.ADMIN || deployer.address;
  const COMPLIANCE = process.env.COMPLIANCE || ADMIN;
  const TREASURER = process.env.TREASURER || ADMIN;

  const subscriptionHours = Number(process.env.SUBSCRIPTION_HOURS || 24);
  const startTime = BigInt(nowSec() + 60); // start in 60s
  const subscriptionEnd = startTime + BigInt(subscriptionHours * 3600);

  // Deploy currency (local-only; on Sepolia set CURRENCY in .env and skip this)
  let currency;
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    const Mock = await ethers.getContractFactory("MockUSDC");
    currency = await Mock.deploy();
    await currency.waitForDeployment();
    console.log("MockUSDC:", await currency.getAddress());
  } else {
    const addr = process.env.CURRENCY;
    if (!addr) throw new Error("Set CURRENCY in .env for testnet");
    currency = await ethers.getContractAt("IERC20", addr);
    console.log("Currency (IERC20):", addr);
  }

  const LWT1 = await ethers.getContractFactory("LWT1");
  const lwt = await LWT1.deploy(
    ADMIN,
    (await currency.getAddress) ? await currency.getAddress() : currency.target,
    process.env.LWT_NAME || "Limunada Token",
    process.env.LWT_SYMBOL || "LWT1",
    startTime,
    subscriptionEnd,
    BigInt(process.env.COST_PER_TOKEN || 1_000_000), // 1.0 USDC
    BigInt(process.env.SALE_PER_UNIT || 2_000_000) // 2.0 USDC
  );
  await lwt.waitForDeployment();

  const lwtAddr = await lwt.getAddress();
  const curAddr = hre.network.name.startsWith("local")
    ? await currency.getAddress()
    : process.env.CURRENCY;

  console.log("LWT1:", lwtAddr);
  console.log(
    "Admin:",
    ADMIN,
    "Compliance:",
    COMPLIANCE,
    "Treasurer:",
    TREASURER
  );
  console.log(
    "Start:",
    startTime.toString(),
    "Unlock:",
    (startTime + BigInt(30 * 24 * 3600)).toString()
  );
  console.log("SubscriptionEnd:", subscriptionEnd.toString());

  // No extra role grants needed (constructor grants to _admin), but if ADMIN != deployer,
  // you might want to grant again as a demo (optional).
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
