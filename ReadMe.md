# LWT_1 — Limunada Token Demo (ERC‑20, KYC, 30‑day lock, redeem in stablecoin)

> **TL;DR**: LWT_1 is a demo **investment token** on EVM. Investors buy tokens using a stablecoin (e.g., USDC/DAI).  
> Transfers are **locked 30 days**. After unlock, holders can **redeem** at **cost + 50% of margin**.  
> RBAC + KYC whitelist enforced on buy/transfer/redeem. This project includes a ready‑to‑run Hardhat demo and a tiny web UI.

---

## What is LWT_1?

**LWT_1 (Limunada Token)** models a simple, time‑boxed financing round for producing and selling lemonade.  
It’s an **ERC‑20** token with extra guardrails:

- **KYC/Whitelist:** both sender & receiver must be whitelisted; `COMPLIANCE_ROLE` manages this.
- **Lock period:** all transfers blocked until **`unlockTime = startTime + 30 days`**.
- **Fixed redeem:** payout per token = `costPerToken + (salePricePerUnit - costPerToken)/2`.
- **Stablecoin settlement:** buy & redeem in an external ERC‑20 (the `currency`, e.g., USDC with 6 decimals).
- **RBAC:** `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `TREASURER_ROLE`, `PAUSER_ROLE`, `COMPLIANCE_ROLE`.
- **Safety:** `Pausable`, `ReentrancyGuard`, batch whitelist, explicit events.

### Economy per token

- **Buy:** pay `costPerToken` in stablecoin and mint `amount` LWT_1.
- **Issuer Treasury:** may **withdraw collected cost** to finance production; must **fund revenue** back before redeem.
- **Redeem (post‑unlock):** holder burns tokens and receives `payoutPerToken` in stablecoin.

```
profitSharePerToken = (salePricePerUnit - costPerToken)/2
payoutPerToken      = costPerToken + profitSharePerToken
```

---

## Contract Summary

- Language: **Solidity ^0.8.24**
- Libs: **OpenZeppelin v5** (`ERC20Burnable`, `AccessControl`, `Pausable`, `ReentrancyGuard`)
- Key params: `currency`, `currencyDecimals`, `startTime`, `unlockTime`, `subscriptionEnd`, `costPerToken`, `salePricePerUnit`
- Key funcs: `buy`, `redeem`, `treasurerWithdrawCollectedCost`, `treasurerFundRevenue`, `setWhitelisted`, `setWhitelistedBatch`, `pause/unpause`
- Transfer rules: **blocked before `unlockTime`** and **whitelist on both sides** thereafter.

---

## Prerequisites

- **Node.js 18+** and **npm**
- **MetaMask** (for interacting with the UI)
- For testnet: **RPC URL** (Alchemy/Infura/etc.) and **funded test wallet(s)**

Install deps:

```bash
npm install
```

---

## Environment Variables

Copy the template and adjust:

```bash
cp .env.example .env
```

`.env` fields you’ll use:

```
# Deployed addresses (filled after deploy)
LWT=0x...                                                  # LWT1 address
CURRENCY=0x...                                             # stablecoin (MockUSDC on local or real/mocked on testnet)

# Addresses for role actions (demo uses ADMIN if omitted)
ADMIN=0x...                                                # defaults to deployer
COMPLIANCE=0x...                                           # defaults to ADMIN
TREASURER=0x...                                            # defaults to ADMIN
SUBSCRIBER=0x...                                           # an investor address to whitelist/buy/redeem

# Token/economics (used by deploy & demo scripts)
LWT_NAME=Limunada Token
LWT_SYMBOL=LWT1
SUBSCRIPTION_HOURS=24
COST_PER_TOKEN=1000000                                     # if currency has 6 decimals → 1.000000
SALE_PER_UNIT=2000000                                      # → 2.000000
BUY_AMOUNT=1000                                            # buy 1,000 LWT1
REVENUE_FUND=100000000                                     # fund 100 USDC
WITHDRAW_COST=50000000                                     # withdraw 50 USDC
FAST_FORWARD_DAYS=31

# .env.example contains additional parameters that are not required for a local demo
```

> **Keys & Accounts (recommended for demo):**
>
> - **Admin wallet** (deployer): holds `DEFAULT_ADMIN_ROLE`, can also act as `COMPLIANCE`, `TREASURER`, `PAUSER` in the demo.
> - **Investor wallet** (subscriber): a separate address you’ll whitelist, approve, buy and redeem from.
> - On **local Hardhat node**: use the auto‑funded accounts (20 accounts with ETH).
> - On **testnet**: you may reuse the **same wallet** for all roles (simplest), and keep the investor in **MetaMask** for the UI flow.

---

## Local Quickstart

1. **Start node**

```bash
npx hardhat node
```

2. **Compile & Deploy** (new terminal)

```bash
npx hardhat compile
npm run deploy:local
```

The script prints addresses for **MockUSDC** and **LWT1** (copy them to `.env` & UI).

3. **Whitelist investor**

```bash
# set LWT and SUBSCRIBER in .env first
npm run whitelist:local
```

4. **Buy tokens (subscriber)**

```bash
npm run buy:local
```

5. **Treasury ops**

```bash
npm run fund:local
npm run withdrawCost:local   # optional; shows cost withdrawal track
```

6. **Fast‑forward time** (unlock)

```bash
npm run ff:local
```

7. **Redeem**

```bash
npm run redeem:local
```

8. **Run tests**

```bash
npm test
```

---

## Minimal Web UI

1. Open & edit `ui/index.html` and paste **LWT1** and **currency** addresses printed by deploy.
2. Serve locally and open in browser:

```bash
npx http-server ./ui -p 5173
```

3. In MetaMask, select **Localhost 8545**, connect, then:
   - **Approve** → **Buy** (during subscription window)
   - **Redeem** (after unlock)
   - If you whitelist two wallets, you can try an ERC‑20 transfer after unlock.

---
