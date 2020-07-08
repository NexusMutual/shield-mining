pragma solidity ^0.6.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPooledStaking.sol";

contract CommunityStakingIncentives {

  IPooledStaking public pooledStaking;
  uint public roundLength;
  uint public startTime;

  constructor(uint roundLength, uint startTime) public {
    roundLength = roundLength;
    startTime = startTime;
  }

  struct BonusReward {
    uint rewardRate;
    uint amount;
    mapping(address => uint) lastRoundClaimed;
  }

  struct RiskRewardPool {
    address riskContract;
    // risk -> ( ERC20 token address -> amount)
    mapping (address => BonusReward) bonusRewards;
  }

  mapping (address => mapping (address => RiskRewardPool)) riskRewardPools;

  event RewardDeposit (
    address riskContract,
    address sponsor,
    address tokenAddress,
    uint amount
  );

  event RewardRetraction (
    address riskContract,
    address sponsor,
    address tokenAddress,
    uint amount
  );

  event RewardClaim (
    address riskContract,
    address sponsor,
    address tokenAddress,
    uint amount,
    address receiver
  );

  function claimReward(address riskContract, address sponsor, address tokenAddress) public returns (uint nxmRewarded) {
    uint currentRound = (now - startTime) / roundLength + 1;
    uint lastRoundClaimed = riskRewardPools[riskContract][sponsor].bonusRewards[tokenAddress].lastRoundClaimed[msg.sender];
    require(currentRound > lastRoundClaimed, "Already claimed for this round");

    uint rewardAmount = pooledStaking.stakerContractStake(msg.sender, riskContract)
      * riskRewardPools[riskContract][sponsor].bonusRewards[tokenAddress].rewardRate;

    uint rewardsAvailable = riskRewardPools[riskContract][sponsor].bonusRewards[tokenAddress].amount;

    if (rewardAmount > rewardsAvailable) {
      rewardAmount = rewardsAvailable;
    }

    riskRewardPools[riskContract][sponsor].bonusRewards[tokenAddress].lastRoundClaimed[msg.sender] = currentRound;
    riskRewardPools[riskContract][sponsor].bonusRewards[tokenAddress].amount -= rewardAmount;

    IERC20 erc20 = IERC20(tokenAddress);
    erc20.transfer(msg.sender, rewardAmount);
    emit RewardClaim(riskContract, sponsor, tokenAddress, rewardAmount, msg.sender);
  }

  function setRatio(address riskContract, address tokenAddress, uint rate) external {
    require(rate != 0, "Rate is 0");
    riskRewardPools[riskContract][msg.sender].bonusRewards[tokenAddress].rewardRate = rate;
  }

  function depositRewards(address riskContract, address tokenAddress, uint amount) external {
    IERC20 erc20 = IERC20(tokenAddress);

    erc20.transfer(address(this), amount);
    riskRewardPools[riskContract][msg.sender].bonusRewards[tokenAddress].amount += amount;
    emit RewardDeposit(riskContract, msg.sender, tokenAddress, amount);
  }

  function claimRewards(address[] calldata riskContracts,  address[] calldata sponsors, address[] calldata tokenAddresses) external returns (uint nxmRewarded) {
    require(riskContracts.length == sponsors.length, "riskContracts.length != sponsors.length");
    require(riskContracts.length == tokenAddresses.length, "riskContracts.length != tokenAddresses.length");
    uint totalNXMRewarded = 0;
    for (uint i = 0; i < riskContracts.length; i++) {
      totalNXMRewarded += claimReward(riskContracts[i], sponsors[i], tokenAddresses[i]);
    }
    return totalNXMRewarded;
  }

  function retractRewards(address riskContract, address tokenAddress, uint amount) external {
    IERC20 erc20 = IERC20(tokenAddress);

    erc20.transfer(msg.sender, amount);
    riskRewardPools[riskContract][msg.sender].bonusRewards[tokenAddress].amount -= amount;
    emit RewardRetraction(riskContract, msg.sender, tokenAddress, amount);
  }
}
