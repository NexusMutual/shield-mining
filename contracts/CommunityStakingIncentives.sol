/*
    Copyright (C) 2020 NexusMutual.io

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see http://www.gnu.org/licenses/
*/

pragma solidity ^0.6.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPooledStaking.sol";
import "./interfaces/INXMMaster.sol";

contract CommunityStakingIncentives is ReentrancyGuard {
  using SafeMath for uint;

  INXMMaster public master;
  uint public roundDuration;
  uint public roundsStartTime;
  uint public constant rewardRateScale = 1e18;

  constructor(uint _roundDuration, uint _roundsStartTime, address masterAddress) public {
    roundDuration = _roundDuration;
    roundsStartTime = _roundsStartTime;
    master = INXMMaster(masterAddress);
  }

  struct Reward {
    uint rewardRate;
    uint amount;
    mapping(address => uint) lastRoundClaimed;
  }

  struct StakingRewardPool {
    address stakedContract;
    // ERC20 token address => Reward
    mapping (address => Reward) rewards;
  }

  // stakedContractAddress => sponsorAddress => riskRewardPool
  mapping (address => mapping (address => StakingRewardPool)) stakingRewardPools;

  event RewardDeposit (
    address indexed stakedContract,
    address indexed sponsor,
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
    address receiver,
    uint roundNumber
  );

  /**
  * @dev Claims reward as a NexusMutual staker.
  * @param stakedContract contract the staker has a stake on.
  * @param stakedContract contract the staker has a stake on.
  * @param sponsor Sponsor providing the reward funds.
  * @param tokenAddress address of the ERC20 token of the reward funds.
  * @return rewardAmount amount rewarded
  */
  function claimReward(
    address stakedContract,
    address sponsor,
    address tokenAddress
  ) public nonReentrant returns (uint rewardAmount) {
    uint currentRound = getCurrentRound();
    uint lastRoundClaimed = stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].lastRoundClaimed[msg.sender];
    require(currentRound > lastRoundClaimed, "Already claimed this reward for this round");

    IPooledStaking pooledStaking = IPooledStaking(master.getLatestAddress("PS"));
    rewardAmount = pooledStaking.stakerContractStake(msg.sender, stakedContract)
      .mul(stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].rewardRate).div(rewardRateScale);
    uint rewardsAvailable = stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].amount;
    if (rewardAmount > rewardsAvailable) {
      rewardAmount = rewardsAvailable;
    }
    require(rewardAmount > 0, "rewardAmount needs to be greater than 0");

    stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].lastRoundClaimed[msg.sender] = currentRound;
    stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].amount = rewardsAvailable - rewardAmount;

    IERC20 erc20 = IERC20(tokenAddress);
    require(erc20.transfer(msg.sender, rewardAmount), "Transfer failed");
    emit RewardClaim(stakedContract, sponsor, tokenAddress, rewardAmount, msg.sender, currentRound);
  }

  /**
  * @dev set the reward ratio as a sponsor for a particular contract and ERC20 token.
  * @param stakedContract Contract the staker has a stake on.
  * @param tokenAddress Address of the ERC20 token of the reward funds.
  * @param rate Rate between the NXM stake and the reward amount. (Scaled by 1e18)
  */
  function setRewardRate(address stakedContract, address tokenAddress, uint rate) external {
    require(rate != 0, "Rate is 0");
    stakingRewardPools[stakedContract][msg.sender].rewards[tokenAddress].rewardRate = rate;
  }

  /**
  * @dev Add rewards as a sponsor for a particular contract.
  * @param stakedContract Contract the staker has a stake on.
  * @param tokenAddress Address of the ERC20 token of the reward funds.
  * @param amount Amount of rewards to be deposited.
  */
  function depositRewards(address stakedContract, address tokenAddress, uint amount) external {
    IERC20 erc20 = IERC20(tokenAddress);

    require(erc20.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    uint currentAmount = stakingRewardPools[stakedContract][msg.sender].rewards[tokenAddress].amount;
    stakingRewardPools[stakedContract][msg.sender].rewards[tokenAddress].amount = currentAmount.add(amount);
    emit RewardDeposit(stakedContract, msg.sender, tokenAddress, amount);
  }

  /**
  * @dev Calls claimReward for each separate (risk, sponsor, token) tuple specified.
  * @param stakedContracts Contracts the staker has a stake on.
  * @param sponsors Sponsors to claim rewards from.
  * @param tokenAddresses Addresses of the ERC20 token of the reward funds.
  * @return tokensRewarded Tokens rewarded by each sponsor.
  */
  function claimRewards(
    address[] calldata stakedContracts,
    address[] calldata sponsors,
    address[] calldata tokenAddresses
  ) external returns (uint[] memory tokensRewarded) {

    require(stakedContracts.length == sponsors.length, "stakedContracts.length != sponsors.length");
    require(stakedContracts.length == tokenAddresses.length, "stakedContracts.length != tokenAddresses.length");

    tokensRewarded = new uint[](stakedContracts.length);
    for (uint i = 0; i < stakedContracts.length; i++) {
      tokensRewarded[i] = claimReward(stakedContracts[i], sponsors[i], tokenAddresses[i]);
    }
    return tokensRewarded;
  }

  /**
  * @dev Retract reward funds as a Sponsor for a particular risk.
  * @param stakedContract Contract the staker has a stake on.
  * @param tokenAddress Address of the ERC20 token of the reward funds.
  * @param amount Amount of reward funds to be retracted.
  */
  function retractRewards(address stakedContract, address tokenAddress, uint amount) external nonReentrant {
    IERC20 erc20 = IERC20(tokenAddress);
    uint currentAmount = stakingRewardPools[stakedContract][msg.sender].rewards[tokenAddress].amount;
    require(currentAmount >= amount, "Not enough tokens to withdraw");

    stakingRewardPools[stakedContract][msg.sender].rewards[tokenAddress].amount = currentAmount.sub(amount);
    require(erc20.transfer(msg.sender, amount), "Transfer failed");
    emit RewardRetraction(stakedContract, msg.sender, tokenAddress, amount);
  }

  function getAvailableStakerRewards(
    address staker,
    address stakedContract,
    address sponsor,
    address tokenAddress
  ) external view returns (uint rewardAmount) {
    uint currentRound = getCurrentRound();
    uint lastRoundClaimed = stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].lastRoundClaimed[msg.sender];
    if (lastRoundClaimed >= currentRound) {
      return 0;
    }
    IPooledStaking pooledStaking = IPooledStaking(master.getLatestAddress("PS"));
    uint stake = pooledStaking.stakerContractStake(staker, stakedContract);
    rewardAmount = stake.mul(stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].rewardRate).div(rewardRateScale);
    uint rewardsAvailable = stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].amount;
    if (rewardAmount > rewardsAvailable) {
      rewardAmount = rewardsAvailable;
    }
  }

  function getRewardAmount(
    address stakedContract,
    address sponsor,
    address tokenAddress
  ) external view returns (uint rewardAmount) {
    return stakingRewardPools[stakedContract][sponsor].rewards[tokenAddress].amount;
  }

  function getCurrentRound() public view returns (uint) {
    return (now - roundsStartTime) / roundDuration + 1;
  }
}
