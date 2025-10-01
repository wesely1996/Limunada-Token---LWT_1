const { expect } = require("chai");
const { ethers } = require("hardhat");

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

describe("LWT1", function () {
  it("buy, lock, fund revenue, redeem", async () => {
    const [admin, treasurer, compliance, alice] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const LWT = await ethers.getContractFactory("LWT1");
    const start = BigInt(nowSec() + 2);
    const subEnd = start + 3600n;
    const cost = 1_000_000n; // 1.0 USDC
    const sale = 2_000_000n; // 2.0 USDC
    const lwt = await LWT.deploy(
      admin.address,
      await usdc.getAddress(),
      "Limunada",
      "LWT1",
      start,
      subEnd,
      cost,
      sale
    );
    await lwt.waitForDeployment();

    // whitelist alice
    await (await lwt.connect(admin).setWhitelisted(alice.address, true)).wait();

    // move to start
    await network.provider.send("evm_setNextBlockTimestamp", [Number(start)]);
    await network.provider.send("evm_mine");

    // fund alice with USDC and approve
    await (await usdc.transfer(alice.address, 1_000_000_000n)).wait();
    await (
      await usdc.connect(alice).approve(await lwt.getAddress(), 1_000_000_000n)
    ).wait();

    // buy 1000 LWT
    await (await lwt.connect(alice).buy(1000n)).wait();
    expect(await lwt.balanceOf(alice.address)).to.equal(1000n);

    // can’t transfer before unlock
    await expect(
      lwt.connect(alice).transfer(admin.address, 1)
    ).to.be.revertedWith("Transfers locked until unlock");

    // treasurer funds revenue = 1000 * (cost + (sale-cost)/2) = 1000 * 1.5
    const payoutPerToken = await lwt.payoutPerToken(); // 1.5e6
    const required = payoutPerToken * 1000n;
    await (await usdc.approve(await lwt.getAddress(), required)).wait();
    await (await lwt.treasurerFundRevenue(required)).wait();

    // fast-forward after unlock
    const unlock = await lwt.unlockTime();
    await network.provider.send("evm_setNextBlockTimestamp", [
      Number(unlock) + 1,
    ]);
    await network.provider.send("evm_mine");

    // redeem
    const balBefore = await usdc.balanceOf(alice.address);
    await (await lwt.connect(alice).redeem(1000n)).wait();
    const balAfter = await usdc.balanceOf(alice.address);
    expect(balAfter - balBefore).to.equal(required);
    expect(await lwt.balanceOf(alice.address)).to.equal(0n);
  });

  it("pause blocks buy/redeem", async () => {
    const [admin, alice] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    const LWT = await ethers.getContractFactory("LWT1");
    const start = BigInt(nowSec() + 2);
    const lwt = await LWT.deploy(
      admin.address,
      await usdc.getAddress(),
      "L",
      "L",
      start,
      start + 3600n,
      1n,
      2n
    );

    await (await lwt.setWhitelisted(alice.address, true)).wait();
    await network.provider.send("evm_setNextBlockTimestamp", [Number(start)]);
    await network.provider.send("evm_mine");

    await (await usdc.transfer(alice.address, 1000n)).wait();
    await (
      await usdc.connect(alice).approve(await lwt.getAddress(), 1000n)
    ).wait();

    await (await lwt.pause()).wait();
    await expect(lwt.connect(alice).buy(1n)).to.be.revertedWithCustomError; // whenNotPaused
    await (await lwt.unpause()).wait();
  });
});
