const { ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { accounts, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');
const BN = web3.utils.BN;

const firstContract = '0x0000000000000000000000000000000000000001';

const rewardRateScale = new BN('10').pow(new BN('18'));

function getUniqueRewardTuples(events) {
  const set = new Set(events.map(e => `${e.stakedContract}|${e.sponsor}|${e.tokenAddress}`));
  return  Array.from(set).map(s => {
     const chunks = s.split('|');
     return {
       stakedContract: chunks[0],
       sponsor: chunks[1],
       tokenAddress: chunks[2],
     }
  })
}

describe.only('claimReward', function () {
  this.timeout(5000);

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
    const rewardRate = rewardRateScale;
    await incentives.setRewardRate(firstContract, mockTokenA.address, rewardRate, {
      from: sponsor,
    });

    const staker1Stake = ether('1');
    await pooledStaking.setStakerContractStake(staker1, firstContract, staker1Stake);

    const tx = await incentives.claimReward(firstContract, sponsor, mockTokenA.address, {
      from: staker1,
    });
    const expectedRewardClaimedAmount = staker1Stake.mul(rewardRate).div(rewardRateScale);
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

  it('should revert when staker attempts to claim reward two times within 1 round', async function () {
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
    const rewardRate = rewardRateScale;
    await incentives.setRewardRate(firstContract, mockTokenA.address, rewardRate, {
      from: sponsor,
    });

    const staker1Stake = ether('1');
    await pooledStaking.setStakerContractStake(staker1, firstContract, staker1Stake);

    const tx = await incentives.claimReward(firstContract, sponsor, mockTokenA.address, {
      from: staker1,
    });
    await expectRevert(
      incentives.claimReward(firstContract, sponsor, mockTokenA.address, { from: staker1 }),
      'Already claimed this reward for this round'
    );
  });

  it('should send reward funds to claiming staker and emit RewardClaim event for multiple rounds', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsor = sponsor1;
    await mockTokenA.issue(sponsor, ether('100'));
    const totalRewards = ether('10');

    const roundCount = 5;
    for (let i =0; i < roundCount; i++) {
      await mockTokenA.approve(incentives.address, totalRewards, {
        from: sponsor,
      });
      await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
        from: sponsor,
      });
      const rewardRate = rewardRateScale;
      await incentives.setRewardRate(firstContract, mockTokenA.address, rewardRate, {
        from: sponsor,
      });

      const staker1Stake = ether('1');
      await pooledStaking.setStakerContractStake(staker1, firstContract, staker1Stake);

      const tx = await incentives.claimReward(firstContract, sponsor, mockTokenA.address, {
        from: staker1,
      });
      const expectedRewardClaimedAmount = staker1Stake.mul(rewardRate).div(rewardRateScale);
      await expectEvent(tx, 'RewardClaim', {
        stakedContract: firstContract,
        sponsor,
        tokenAddress: mockTokenA.address,
        amount: expectedRewardClaimedAmount.toString(),
        receiver: staker1,
        roundNumber: (i + 1).toString(),
      });
      const roundDuration = (await incentives.roundDuration()).addn(10);
      await time.increase(roundDuration);
    }
  });
});

describe('claimRewards', function () {
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
    const rewardRate = rewardRateScale;
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
    const expectedRewardClaimedAmount = staker1Stake.mul(rewardRate).div(rewardRateScale).muln(sponsors.length);
    const postRewardBalance = await mockTokenA.balanceOf(staker1);
    assert.equal(postRewardBalance.toString(), expectedRewardClaimedAmount.toString());
  });
});

describe('available sponsors and rewards flow', function () {
  const [
    sponsor1,
    sponsor2,
    sponsor3,
    sponsor4,
    sponsor5,
    staker1,
  ] = accounts;
  beforeEach(setup);

  it('should detect all available rewards for a user using RewardDeposit events and compute all withdrawable reward values', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4, sponsor5];

    let staker = staker1;
    const baseRewardFund = ether('10');
    let rewardRate;
    let multiplier = 1;
    const rewardRates = {};
    const rewardFunds = [];
    for (const sponsor of sponsors) {
      await mockTokenA.issue(sponsor, ether('100'));
      rewardRate = rewardRateScale.muln(multiplier);
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
      rewardRates[sponsor] = rewardRate;
    }

    const stakerStake = ether('1');
    await pooledStaking.setStakerContractStake(staker, firstContract, stakerStake);

    let contracts = await pooledStaking.stakerContractsArray(staker);
    contacts = [firstContract];

    const pastEvents = await incentives.getPastEvents('RewardDeposit', {
      fromBlock: 0,
      filter: {
        stakedContract: contracts,
      }
    });
    const tuples = getUniqueRewardTuples(pastEvents.map(e => e.args));
    for (const tuple of tuples) {
      const availableReward = await incentives.getAvailableStakerRewards(staker, tuple.stakedContract, tuple.sponsor, tuple.tokenAddress);
      const rate = rewardRates[tuple.sponsor];
      const expectedReward = stakerStake.mul(rate).div(rewardRateScale).toString();
      assert(availableReward.toString(), expectedReward);
    }

    await incentives.claimRewards(
      tuples.map(t => t.stakedContract),
      tuples.map(t => t.sponsor),
      tuples.map(t => t.tokenAddress), {
      from: staker,
    });
    const expectedRewardClaimedAmount =
      Object.values(rewardRates)
        .map(rewardRate => stakerStake.mul(rewardRate).div(rewardRateScale))
        .reduce((a, b) => a.add(b), new BN('0'));
    const postRewardBalance = await mockTokenA.balanceOf(staker);

    assert.equal(postRewardBalance.toString(), expectedRewardClaimedAmount.toString());
  });
});

