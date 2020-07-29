const { ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { accounts, web3, contract } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');
const CommunityStakingIncentives = contract.fromArtifact('CommunityStakingIncentives');
const BN = web3.utils.BN;

const firstContract = '0x0000000000000000000000000000000000000001';
const rewardRateScale = new BN('10').pow(new BN('18'));

function getUniqueRewardTuples (events) {
  const set = new Set(events.map(e => `${e.stakedContract}|${e.sponsor}|${e.tokenAddress}`));
  return Array.from(set).map(s => {
    const chunks = s.split('|');
    return {
      stakedContract: chunks[0],
      sponsor: chunks[1],
      tokenAddress: chunks[2],
    };
  });
}

describe('claimRewards', function () {
  this.timeout(5000);

  const [
    sponsor1,
    sponsor2,
    sponsor3,
    sponsor4,
    sponsor5,
    staker1,
  ] = accounts;

  beforeEach(setup);

  it('should send reward funds to claiming staker and emit Claimed event', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsor = sponsor1;

    await mockTokenA.mint(sponsor, ether('100'));

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

    const staker1Stake = ether('4');
    const staker1PendingUnstake = ether('3');
    const staker1NetStake = staker1Stake.sub(staker1PendingUnstake);
    await pooledStaking.setStakerContractStake(staker1, firstContract, staker1NetStake);

    const tokensClaimed = await incentives.claimRewards.call([firstContract], [sponsor], [mockTokenA.address], {
      from: staker1,
    });
    const tx = await incentives.claimRewards([firstContract], [sponsor], [mockTokenA.address], {
      from: staker1,
    });
    const expectedRewardClaimedAmount = staker1NetStake.mul(rewardRate).div(rewardRateScale);
    await expectEvent(tx, 'Claimed', {
      stakedContract: firstContract,
      sponsor,
      tokenAddress: mockTokenA.address,
      amount: expectedRewardClaimedAmount.toString(),
      receiver: staker1,
      roundNumber: '1',
    });
    assert.equal(tokensClaimed.length, 1);
    assert.equal(tokensClaimed[0].toString(), expectedRewardClaimedAmount.toString());

    const postRewardBalance = await mockTokenA.balanceOf(staker1);
    assert.equal(postRewardBalance.toString(), expectedRewardClaimedAmount.toString());
  });

  it('should revert when staker attempts to claim reward two times within 1 round', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsor = sponsor1;

    await mockTokenA.mint(sponsor, ether('100'));

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

    const staker1Stake = ether('4');
    const staker1PendingUnstake = ether('3');
    const staker1NetStake = staker1Stake.sub(staker1PendingUnstake);
    await pooledStaking.setStakerContractStake(staker1, firstContract, staker1NetStake);

    await incentives.claimRewards([firstContract], [sponsor], [mockTokenA.address], {
      from: staker1,
    });
    await expectRevert(
      incentives.claimRewards([firstContract], [sponsor], [mockTokenA.address], { from: staker1 }),
      'Already claimed this reward for this round',
    );
  });

  it('should send reward funds to claiming staker and emit Claimed event for multiple rounds', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsor = sponsor1;
    await mockTokenA.mint(sponsor, ether('100'));
    const totalRewards = ether('10');

    const roundCount = 5;
    for (let i = 0; i < roundCount; i++) {
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

      const staker1Stake = ether('4');
      const staker1PendingUnstake = ether('3');
      const staker1NetStake = staker1Stake.sub(staker1PendingUnstake);
      await pooledStaking.setStakerContractStake(staker1, firstContract, staker1NetStake);

      const tokensClaimed = await incentives.claimRewards.call([firstContract], [sponsor], [mockTokenA.address], {
        from: staker1,
      });
      const tx = await incentives.claimRewards([firstContract], [sponsor], [mockTokenA.address], {
        from: staker1,
      });
      const expectedRewardClaimedAmount = staker1NetStake.mul(rewardRate).div(rewardRateScale);
      const expectedRoundNumber = (i + 1).toString();
      await expectEvent(tx, 'Claimed', {
        stakedContract: firstContract,
        sponsor,
        tokenAddress: mockTokenA.address,
        amount: expectedRewardClaimedAmount.toString(),
        receiver: staker1,
        roundNumber: expectedRoundNumber,
      });
      assert.equal(tokensClaimed.length, 1);
      assert.equal(tokensClaimed[0].toString(), expectedRewardClaimedAmount.toString());
      const lastRoundClaimed = await incentives.getLastRoundClaimed(firstContract, sponsor, mockTokenA.address, staker1);
      assert.equal(lastRoundClaimed.toString(), expectedRoundNumber.toString());

      const roundDuration = (await incentives.roundDuration()).addn(10);
      await time.increase(roundDuration);
    }
  });

  it('should send reward funds to claiming staker for multiple sponsors at the same time', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4, sponsor5];

    const baseRewardFund = ether('10');
    const rewardRate = rewardRateScale;
    let multiplier = 1;
    const rewardFunds = [];
    for (const sponsor of sponsors) {
      await mockTokenA.mint(sponsor, ether('100'));
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

    const staker1Stake = ether('4');
    const staker1PendingUnstake = ether('3');
    const staker1NetStake = staker1Stake.sub(staker1PendingUnstake);
    await pooledStaking.setStakerContractStake(staker1, firstContract, staker1NetStake);

    const stakedContracts = new Array(sponsors.length).fill(firstContract);
    const tokenAddresses = new Array(sponsors.length).fill(mockTokenA.address);

    const tokensClaimed = await incentives.claimRewards.call(stakedContracts, sponsors, tokenAddresses, {
      from: staker1,
    });
    await incentives.claimRewards(stakedContracts, sponsors, tokenAddresses, {
      from: staker1,
    });
    const totalClaimed = tokensClaimed.reduce((a, b) => a.add(b), new BN('0'));
    const expectedRewardClaimedAmount = staker1NetStake.mul(rewardRate).div(rewardRateScale).muln(sponsors.length);
    const postRewardBalance = await mockTokenA.balanceOf(staker1);
    assert.equal(postRewardBalance.toString(), expectedRewardClaimedAmount.toString());
    assert.equal(totalClaimed.toString(), expectedRewardClaimedAmount.toString());
  });
});

describe('claimRewards before roundsStartTime', function () {
  this.timeout(5000);

  const [
    sponsor,
    staker1,
  ] = accounts;
  const masterAddress = '0x0000000000000000000000000000000000000001';
  const tokenAddress = '0x0000000000000000000000000000000000000002';

  beforeEach(async function () {
    const latest = (await time.latest()).toNumber();
    const roundsStartTime = latest + 10;
    const roundDuration = 14 * 24 * 60 * 60;
    const incentives = await CommunityStakingIncentives.new(roundDuration, roundsStartTime, masterAddress);
    this.incentives = incentives;
  });

  it('reverts if staker attempts to claim rewards', async function () {
    const { incentives } = this;
    await expectRevert(
      incentives.claimRewards([firstContract], [sponsor], [tokenAddress], { from: staker1 }),
      `Rounds haven't started yet`,
    );
  });
});

describe('detecting all available sponsors from Deposited and claiming all available rewards', function () {
  const [
    sponsor1,
    sponsor2,
    sponsor3,
    sponsor4,
    sponsor5,
    staker1,
  ] = accounts;
  beforeEach(setup);

  it('should detect all available rewards for a user using Deposited events and compute all withdrawable reward values', async function () {
    const { incentives, mockTokenA, pooledStaking } = this;

    const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4, sponsor5];

    const staker = staker1;
    const baseRewardFund = ether('10');
    let rewardRate;
    let multiplier = 1;
    const rewardRates = {};
    const rewardFunds = [];
    for (const sponsor of sponsors) {
      await mockTokenA.mint(sponsor, ether('100'));
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

    const stakerStake = ether('6');
    const stakerPendingUnstake = ether('5');
    const stakerNetStake = stakerStake.sub(stakerPendingUnstake);
    await pooledStaking.setStakerContractStake(staker, firstContract, stakerNetStake);

    const contracts = await pooledStaking.stakerContractsArray(staker);

    const pastEvents = await incentives.getPastEvents('Deposited', {
      fromBlock: 0,
      filter: {
        stakedContract: contracts,
      },
    });
    const tuples = getUniqueRewardTuples(pastEvents.map(e => e.args));
    for (const tuple of tuples) {
      const availableReward = await incentives.getAvailableStakerRewards(staker, tuple.stakedContract, tuple.sponsor, tuple.tokenAddress);
      const rate = rewardRates[tuple.sponsor];
      const expectedReward = stakerNetStake.mul(rate).div(rewardRateScale).toString();
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
        .map(rewardRate => stakerNetStake.mul(rewardRate).div(rewardRateScale))
        .reduce((a, b) => a.add(b), new BN('0'));
    const postRewardBalance = await mockTokenA.balanceOf(staker);

    assert.equal(postRewardBalance.toString(), expectedRewardClaimedAmount.toString());
  });
});
