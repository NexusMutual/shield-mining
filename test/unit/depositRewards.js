const { ether, expectEvent } = require('@openzeppelin/test-helpers');
const { accounts } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');

const firstContract = '0x0000000000000000000000000000000000000001';

describe('depositRewards', function () {

  const [
    sponsor1,
    sponsor2,
    sponsor3,
    sponsor4,
    sponsor5,
    staker1
  ] = accounts;

  beforeEach(setup);

  it('should update the reward funds of a sponsor and emit RewardDeposit event', async function () {
    const { incentives, mockTokenA } = this;

    await mockTokenA.issue(sponsor1, ether('100'));

    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    const tx = await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });
    await expectEvent(tx, 'RewardDeposit', {
      stakedContract: firstContract,
      sponsor: sponsor1,
      tokenAddress: mockTokenA.address,
      amount: totalRewards,
    });

    const storedAmount = await incentives.getRewardAmount(firstContract, sponsor1, mockTokenA.address);
    assert.equal(storedAmount.toString(), totalRewards);
  });

  it('should update the reward funds for multiple sponsors for the same contract and emit RewardDeposit events,', async function () {
    const { incentives, mockTokenA } = this;

    const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4, sponsor5];
    for (const sponsor of sponsors) {
      await mockTokenA.issue(sponsor, ether('100'));
    }
    const totalRewards = ether('1');

    let multiplier = 1;
    for (const sponsor of sponsors) {
      const sponsorRewards = totalRewards.muln(multiplier++);
      await mockTokenA.approve(incentives.address, sponsorRewards, {
        from: sponsor,
      });
      const tx = await incentives.depositRewards(firstContract, mockTokenA.address, sponsorRewards, {
        from: sponsor,
      });
      await expectEvent(tx, 'RewardDeposit', {
        stakedContract: firstContract,
        sponsor: sponsor,
        tokenAddress: mockTokenA.address,
        amount: sponsorRewards,
      });
      const storedAmount = await incentives.getRewardAmount(firstContract, sponsor, mockTokenA.address);
      assert.equal(storedAmount.toString(), sponsorRewards);
    }
  });
});
