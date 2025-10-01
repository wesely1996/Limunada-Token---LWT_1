const { ethers } = require("hardhat");
require("dotenv").config();

const LWT = (process.env.LWT || "").trim();
const SUBSCRIBER = (process.env.SUBSCRIBER || "").trim();

async function main() {
  if (!LWT) throw new Error("Set LWT address");
  if (!SUBSCRIBER) throw new Error("Set SUBSCRIBER in .env");
  const amount = BigInt(process.env.BUY_AMOUNT || 1000);

  // use the whitelisted token holder as signer
  const holder = await ethers.getSigner(SUBSCRIBER);
  const lwt = await ethers.getContractAt("LWT1", LWT, holder);

  // move time only if we're before unlock
  const unlock = Number(await lwt.unlockTime());
  const latest = await ethers.provider.getBlock("latest");
  const nowTs = Number(latest.timestamp);
  if (nowTs < unlock) {
    const target = Math.max(unlock + 1, nowTs + 1);
    await network.provider.send("evm_setNextBlockTimestamp", [target]);
    await network.provider.send("evm_mine");
    console.log(`Moved time to ${target} (unlock=${unlock})`);
  } else {
    await network.provider.send("evm_mine");
    console.log(`Already past unlock (now=${nowTs}, unlock=${unlock})`);
  }

  // redeem from the holder (must be whitelisted and have tokens)
  await (await lwt.redeem(amount)).wait();
  console.log(`Redeemed ${amount.toString()} LWT1 as ${SUBSCRIBER}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
