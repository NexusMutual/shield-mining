pragma solidity ^0.6.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPooledStaking.sol";

contract CommunityStakingIncentives {

  IPooledStaking public pooledStaking;
  uint public roundDuration;
  uint public startTime;

  constructor(uint roundDuration, uint startTime) public {
    roundDuration = roundDuration;
    startTime = startTime;
  }

  struct Reward {
    uint rewardRate;
    uint amount;
    mapping(address => uint) lastRoundClaimed;
  }

  struct StakingRewardPool {
    address stakedContract;
    // risk -> ( ERC20 token address -> amount)
    mapping (address => Reward) rewards;
  }

  mapping (address => mapping (address => StakingRewardPool)) stakingRewardPools;

  event RewardDeposit (
    address stakedContract,
    address sponsor,
    address tokenAddress,
    uint amount
  );

  event RewardRetraction (
    address stakedContract,
    address sponsor,
    address tokenAddress,
    uint amount
  );

  event RewardClaim (
    address stakedContract,
    address sponsor,
    address tokenAddress,
    uint amount,
    address receiver
  );

  /**
  * @dev Claims reward as a NexusMutual staker.
  * @param riskContract contract the staker has a stake on.
  * @param sponsor Sponsor providing the reward funds.
  * @param tokenAddress address of the ERC20 token of the reward funds.
  * @return rewardAmount amount rewarded
  */
  function claimReward(address stakedContract, address sponsor, address tokenAddress) public returns (uint rewardAmount) {
    uint currentRound = (now - startTime) / roundDuration + 1;
    uint lastRoundClaimed = stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].lastRoundClaimed[msg.sender];
    require(currentRound > lastRoundClaimed, "Already claimed for this round");

    rewardAmount = pooledStaking.stakerContractStake(msg.sender, stakedContract)
      * stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].rewardRate;

    uint rewardsAvailable = stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].amount;

    if (rewardAmount > rewardsAvailable) {
      rewardAmount = rewardsAvailable;
    }

    stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].lastRoundClaimed[msg.sender] = currentRound;
    stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].amount -= rewardAmount;

    IERC20 erc20 = IERC20(tokenAddress);
    erc20.transfer(msg.sender, rewardAmount);
    emit RewardClaim(stakedContract, sponsor, tokenAddress, rewardAmount, msg.sender);
  }

  /**
  * @dev set the reward ratio as a sponsor for a particular contract and ERC20 token.
  * @param riskContract Contract the staker has a stake on.
  * @param tokenAddress Address of the ERC20 token of the reward funds.
  * @param rate Rate between the NXM stake and the reward amount.
  */
  function setRatio(address stakedContract, address tokenAddress, uint rate) external {
    require(rate != 0, "Rate is 0");
    stakingRewardPools[stakedContract][msg.sender].rewards[tokenAddress].rewardRate = rate;
  }

  /**
  * @dev Add rewards as a sponsor for a particular contract.
  * @param riskContract Contract the staker has a stake on.
  * @param tokenAddress Address of the ERC20 token of the reward funds.
  * @param amount Amount of rewards to be deposited.
  */
  function depositRewards(address stakedContract, address tokenAddress, uint amount) external {
    IERC20 erc20 = IERC20(tokenAddress);

    erc20.transfer(address(this), amount);
    stakingRewardPools[stakedContract][msg.sender].rewards[tokenAddress].amount += amount;
    emit RewardDeposit(stakedContract, msg.sender, tokenAddress, amount);
  }

  /**
  * @dev Calls claimReward for each separate (risk, sponsor, token) tuple specified
  */
  function claimRewards(
    address[] calldata stakedContracts,
    address[] calldata sponsors,
    address[] calldata tokenAddresses
  ) external returns (uint[] memory tokensRewarded) {

    require(stakedContracts.length == sponsors.length, "riskContracts.length != sponsors.length");
    require(stakedContracts.length == tokenAddresses.length, "riskContracts.length != tokenAddresses.length");

    tokensRewarded = new uint[](stakedContracts.length);
    for (uint i = 0; i < stakedContracts.length; i++) {
      tokensRewarded[i] = claimReward(stakedContracts[i], sponsors[i], tokenAddresses[i]);
    }
    return tokensRewarded;
  }

  /**
  * @dev Retract reward funds as a Sponsor for a particular risk.
  * @param riskContract Contract the staker has a stake on.
  * @param tokenAddress Address of the ERC20 token of the reward funds.
  * @param amount Amount of reward funds to be retracted.
  */
  function retractRewards(address stakedContract, address tokenAddress, uint amount) external {
    IERC20 erc20 = IERC20(tokenAddress);

    erc20.transfer(msg.sender, amount);
    stakingRewardPools[stakedContract][msg.sender].rewards[tokenAddress].amount -= amount;
    emit RewardRetraction(stakedContract, msg.sender, tokenAddress, amount);
  }
}
