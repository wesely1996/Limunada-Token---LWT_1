require("dotenv").config();

async function main() {
  const days = Number(process.env.FAST_FORWARD_DAYS || 31);
  const seconds = days * 24 * 3600;
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
  console.log(`Fast-forwarded ${days} days`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
