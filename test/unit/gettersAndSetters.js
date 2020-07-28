const { time, expectRevert } = require('@openzeppelin/test-helpers');
const { accounts, web3, contract } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');
const CommunityStakingIncentives = contract.fromArtifact('CommunityStakingIncentives');
const BN = web3.utils.BN;

const firstContract = '0x0000000000000000000000000000000000000001';

describe('getters and setters', function () {

  this.timeout(5000);
  const [
    sponsor1,
  ] = accounts;

  beforeEach(setup);

  it('gets correct values for constructor parameters', async function () {
    const { master, incentives, startTime, roundDuration } = this;

    assert.equal(await incentives.master(), master.address);
    assert.equal((await incentives.roundDuration()).toString(), roundDuration.toString());
    assert.equal((await incentives.roundsStartTime()).toString(), startTime.toString());
    assert.equal((await incentives.rewardRateScale()).toString(), 1e18.toString());
  });

  it('gets correct round number as time passes', async function () {
    const { incentives } = this;
    const roundDuration = await incentives.roundDuration();
    let expectedCurrentRoundNumber = 1;
    assert.equal((await incentives.getCurrentRound()).toString(), expectedCurrentRoundNumber.toString());

    const timeLeftUntilEndOfRound = new BN('100');
    const lessThan1Round = roundDuration.sub(timeLeftUntilEndOfRound);
    time.increase(lessThan1Round);
    assert.equal((await incentives.getCurrentRound()).toString(), expectedCurrentRoundNumber.toString());

    time.increase(timeLeftUntilEndOfRound);
    expectedCurrentRoundNumber++;
    assert.equal((await incentives.getCurrentRound()).toString(), expectedCurrentRoundNumber.toString());

    time.increase(roundDuration);
    expectedCurrentRoundNumber++;
    assert.equal((await incentives.getCurrentRound()).toString(), expectedCurrentRoundNumber.toString());
  });

  it('sets and gets reward rate', async function () {
    const { incentives, mockTokenA } = this;
    const rewardRateValue = new BN('12').pow(new BN('18'));
    await incentives.setRewardRate(firstContract, mockTokenA.address, rewardRateValue.toString(), { from: sponsor1 });
    const { rate } = await incentives.getRewardPool(firstContract, sponsor1, mockTokenA.address);
    assert.equal(rate.toString(), rewardRateValue.toString());
  });

  it('sets reward rate to 0', async function () {
    const { incentives, mockTokenA } = this;
    const rewardRateValue = new BN('0');
    await incentives.setRewardRate(firstContract, mockTokenA.address, rewardRateValue.toString(), { from: sponsor1 });
    const { rate } = await incentives.getRewardPool(firstContract, sponsor1, mockTokenA.address);
    assert.equal(rate.toString(), rewardRateValue.toString());
  });
});

describe('getters and setters before roundsStartTime', function () {
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

  it('reverts when getting current round', async function () {
    const { incentives } = this;
    await expectRevert(
      incentives.getCurrentRound(),
      `Rounds haven't started yet`,
    );
  });

  it('reverts when getting available staker rewards', async function () {
    const { incentives } = this;
    await expectRevert(
      incentives.getAvailableStakerRewards(staker1, firstContract, sponsor, tokenAddress),
      `Rounds haven't started yet`,
    );
  });
});
