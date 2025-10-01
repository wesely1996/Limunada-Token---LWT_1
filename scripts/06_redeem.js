const { ethers } = require("hardhat");
require("dotenv").config();

const LWT = process.env.LWT || "";

async function main() {
  if (!LWT) throw new Error("Set LWT address");
  const amount = BigInt(process.env.BUY_AMOUNT || 1000);

  const [holder] = await ethers.getSigners();
  const lwt = await ethers.getContractAt("LWT1", LWT, holder);

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

  const tx = await lwt.redeem(amount);
  await tx.wait();
  console.log("Redeemed", amount.toString(), "LWT1");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
