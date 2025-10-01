// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * LWT_1 (Limunada Token) — investment ERC-20 with:
 * - KYC/whitelist (COMPLIANCE_ROLE manages allowed addresses),
 * - 30-day transfer lock (no transfers until unlockTime),
 * - fixed redeem payout = costPerToken + 50% of margin,
 * - deposits/payouts in a stablecoin (currency, e.g. USDC/DAI),
 * - RBAC: DEFAULT_ADMIN_ROLE, MINTER_ROLE, TREASURER_ROLE, PAUSER_ROLE, COMPLIANCE_ROLE,
 * - pause/unpause, batch whitelist, reentrancy protection.
 *
 * Pre-production: audit, legal compliance, full test coverage.
 */

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // OZ v5 path
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract LWT1 is ERC20Burnable, Pausable, AccessControl, ReentrancyGuard {
    // ===== Roles =====
    bytes32 public constant MINTER_ROLE     = keccak256("MINTER_ROLE");     // extra minting flows (not used by demo)
    bytes32 public constant TREASURER_ROLE  = keccak256("TREASURER_ROLE");  // withdraw cost, fund revenue
    bytes32 public constant PAUSER_ROLE     = keccak256("PAUSER_ROLE");     // pause/unpause
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE"); // whitelist mgmt

    // ===== External currency for deposits/payouts (e.g. USDC/DAI) =====
    IERC20 public immutable currency;
    uint8  public immutable currencyDecimals;

    // ===== Investment timing =====
    uint256 public immutable startTime;   // cycle start
    uint256 public immutable unlockTime;  // startTime + 30 days
    uint256 public subscriptionEnd;       // last moment to buy (must be <= unlockTime)

    // ===== Economics =====
    uint256 public costPerToken;       // denominated in currency's decimals
    uint256 public salePricePerUnit;   // denominated in currency's decimals

    // Amount of collected production cost (tracked for controlled withdrawals)
    uint256 public totalCollectedCost;

    // ===== Compliance (KYC whitelist) =====
    mapping(address => bool) public isWhitelisted;

    // ===== Events =====
    event Purchased(address indexed investor, uint256 amount, uint256 paid);
    event Redeemed(address indexed investor, uint256 amount, uint256 payout);
    event OwnerWithdrawCost(uint256 amount);
    event OwnerFundedRevenue(uint256 amount);
    event EconomicsUpdated(uint256 costPerToken, uint256 salePricePerUnit);
    event WhitelistUpdated(address indexed account, bool allowed);
    event WhitelistBatchUpdated(uint256 count, bool allowed);

    // ===== Constructor =====
    constructor(
        address _admin,
        address _currency,
        string memory _name,
        string memory _symbol,
        uint256 _startTime,
        uint256 _subscriptionEnd,
        uint256 _costPerToken,
        uint256 _salePricePerUnit
    ) ERC20(_name, _symbol) {
        require(_admin != address(0), "admin=0");
        require(_currency != address(0), "currency=0");
        require(_startTime >= block.timestamp, "start in past");
        require(_salePricePerUnit >= _costPerToken, "sale < cost");

        // Timing: subscription must end on/before unlock (maturity)
        uint256 _unlock = _startTime + 30 days;
        require(_subscriptionEnd >= _startTime, "bad subscriptionEnd < start");
        require(_subscriptionEnd <= _unlock, "subscriptionEnd > unlock");

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(TREASURER_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
        _grantRole(COMPLIANCE_ROLE, _admin);

        currency = IERC20(_currency);
        currencyDecimals = IERC20Metadata(_currency).decimals();

        startTime = _startTime;
        unlockTime = _unlock;
        subscriptionEnd = _subscriptionEnd;

        costPerToken = _costPerToken;
        salePricePerUnit = _salePricePerUnit;
    }

    // ===== Transfer constraints (lock + whitelist) =====
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        // Allow mint (from=0) and burn (to=0) without extra checks.
        if (from != address(0) && to != address(0)) {
            // 1) Lock until maturity
            require(block.timestamp >= unlockTime, "Transfers locked until unlock");

            // 2) KYC/whitelist on both sides
            require(isWhitelisted[from] && isWhitelisted[to], "KYC required");
        }
        super._update(from, to, value);
    }

    // ===== Economics =====
    function profitSharePerToken() public view returns (uint256) {
        // 50% of margin: (sale - cost)/2
        return (salePricePerUnit - costPerToken) / 2;
    }

    function payoutPerToken() public view returns (uint256) {
        // redeem payout = cost + 50% of margin
        return costPerToken + profitSharePerToken();
    }

    // Admin may update economics until startTime
    function adminUpdateEconomics(uint256 _cost, uint256 _sale)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(block.timestamp < startTime, "Cycle started");
        require(_sale >= _cost, "sale < cost");
        costPerToken = _cost;
        salePricePerUnit = _sale;
        emit EconomicsUpdated(_cost, _sale);
    }

    // Optional: adjust subscriptionEnd (e.g., extend presale), but never beyond unlock
    function adminSetSubscriptionEnd(uint256 _subscriptionEnd)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_subscriptionEnd >= startTime, "bad subscriptionEnd < start");
        require(_subscriptionEnd <= unlockTime, "subscriptionEnd > unlock");
        subscriptionEnd = _subscriptionEnd;
    }

    // ===== Buy (subscription) =====
    /**
     * @dev Buying mints LWT_1 after transferring "cost" in the stablecoin.
     *      Investor must approve this contract to spend currency beforehand.
     */
    function buy(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyWhitelisted(msg.sender)
    {
        require(amount > 0, "amount=0");
        require(block.timestamp >= startTime, "Not started");
        require(block.timestamp <= subscriptionEnd, "Subscription ended");

        uint256 totalCost = amount * costPerToken;
        require(currency.transferFrom(msg.sender, address(this), totalCost), "transferFrom failed");

        totalCollectedCost += totalCost;
        _mint(msg.sender, amount);

        emit Purchased(msg.sender, amount, totalCost);
    }

    // ===== Treasury ops (off-chain business) =====

    /// @notice Withdraw collected production cost to fund the batch.
    function treasurerWithdrawCollectedCost(uint256 amount)
        external
        nonReentrant
        onlyRole(TREASURER_ROLE)
    {
        require(amount <= totalCollectedCost, "exceeds collected cost");
        totalCollectedCost -= amount;
        require(currency.transfer(msg.sender, amount), "transfer failed");
        emit OwnerWithdrawCost(amount);
    }

    /// @notice Return revenue to the contract to enable redemptions.
    function treasurerFundRevenue(uint256 amount)
        external
        nonReentrant
        onlyRole(TREASURER_ROLE)
    {
        require(amount > 0, "amount=0");
        require(currency.transferFrom(msg.sender, address(this), amount), "fund transfer failed");
        emit OwnerFundedRevenue(amount);
    }

    // ===== Redeem =====
    function redeem(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyWhitelisted(msg.sender)
    {
        require(block.timestamp >= unlockTime, "Not unlocked");
        require(amount > 0, "amount=0");
        require(balanceOf(msg.sender) >= amount, "insufficient LWT_1");

        uint256 perToken = payoutPerToken();
        uint256 totalPayout = amount * perToken;

        require(currency.balanceOf(address(this)) >= totalPayout, "insufficient contract funds");

        _burn(msg.sender, amount);
        require(currency.transfer(msg.sender, totalPayout), "payout transfer failed");

        emit Redeemed(msg.sender, amount, totalPayout);
    }

    // ===== Compliance / Whitelist =====
    modifier onlyWhitelisted(address account) {
        require(isWhitelisted[account], "Not whitelisted");
        _;
    }

    function setWhitelisted(address account, bool allowed)
        external
        onlyRole(COMPLIANCE_ROLE)
    {
        isWhitelisted[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }

    function setWhitelistedBatch(address[] calldata accounts, bool allowed)
        external
        onlyRole(COMPLIANCE_ROLE)
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            isWhitelisted[accounts[i]] = allowed;
        }
        emit WhitelistBatchUpdated(accounts.length, allowed);
    }

    // ===== Pause =====
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
