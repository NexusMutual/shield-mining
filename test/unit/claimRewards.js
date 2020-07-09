const { ether, expectEvent } = require('@openzeppelin/test-helpers');
const { accounts, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');
const BN = web3.utils.BN;

const firstContract = '0x0000000000000000000000000000000000000001';

describe('claimReward', function () {

  const [
    sponsor1,
    staker1,
  ] = accounts;

  beforeEach(setup);

  it('should send reward funds to claiming staker and emit RewardClaim event', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsor = sponsor1;

    await mockTokenA.issue(sponsor, ether('100'));

    const totalRewards = ether('10');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor,
    });
    const rewardRate = 1;
    await incentives.setRewardRate(firstContract, mockTokenA.address, rewardRate, {
      from: sponsor,
    });

    const staker1Stake = ether('1');
    await pooledStaking.setStakerContractStake(staker1, firstContract, staker1Stake);

    const tx = await incentives.claimReward(firstContract, sponsor, mockTokenA.address, {
      from: staker1,
    });
    const expectedRewardClaimedAmount = staker1Stake.muln(rewardRate);
    await expectEvent(tx, 'RewardClaim', {
      stakedContract: firstContract,
      sponsor,
      tokenAddress: mockTokenA.address,
      amount: expectedRewardClaimedAmount.toString(),
      receiver: staker1,
      roundNumber: '1',
    });

    const postRewardBalance = await mockTokenA.balanceOf(staker1);
    assert.equal(postRewardBalance.toString(), expectedRewardClaimedAmount.toString());
  });
});

describe.only('claimRewards', function () {

  const [
    sponsor1,
    sponsor2,
    sponsor3,
    sponsor4,
    sponsor5,
    staker1,
  ] = accounts;
  beforeEach(setup);

  it('should send reward funds to claiming staker and emit RewardClaim event', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4, sponsor5];

    const baseRewardFund = ether('10');
    const rewardRate = 1;
    let multiplier = 1;
    const rewardFunds = [];
    for (const sponsor of sponsors) {
      await mockTokenA.issue(sponsor, ether('100'));
      const totalRewards = baseRewardFund.muln(multiplier++);
      rewardFunds.push(totalRewards);
      await mockTokenA.approve(incentives.address, totalRewards, {
        from: sponsor,
      });
      await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
        from: sponsor,
      });
      await incentives.setRewardRate(firstContract, mockTokenA.address, rewardRate, {
        from: sponsor,
      });
    }

    const staker1Stake = ether('1');
    await pooledStaking.setStakerContractStake(staker1, firstContract, staker1Stake);

    const stakedContracts = new Array(sponsors.length).fill(firstContract);
    const tokenAddresses = new Array(sponsors.length).fill(mockTokenA.address);

    const tx = await incentives.claimRewards(stakedContracts, sponsors, tokenAddresses, {
      from: staker1,
    });
    const expectedRewardClaimedAmount = staker1Stake.muln(rewardRate).muln(sponsors.length);
    const postRewardBalance = await mockTokenA.balanceOf(staker1);
    assert.equal(postRewardBalance.toString(), expectedRewardClaimedAmount.toString());
  });
});
