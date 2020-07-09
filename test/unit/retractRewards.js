const { ether, expectEvent } = require('@openzeppelin/test-helpers');
const { accounts } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');

const firstContract = '0x0000000000000000000000000000000000000001';

describe('retractRewards', function () {

  const [
    sponsor1,
  ] = accounts;

  beforeEach(setup);

  it('should update the reward funds of a sponsor and emit RewardRetraction event', async function () {
    const { incentives, mockTokenA } = this;

    await mockTokenA.issue(sponsor1, ether('100'));
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });

    const rewardsToRetract = totalRewards.divn(2);
    const tx = await incentives.retractRewards(firstContract, mockTokenA.address, rewardsToRetract, {
      from: sponsor1,
    });

    await expectEvent(tx, 'RewardRetraction', {
      stakedContract: firstContract,
      sponsor: sponsor1,
      tokenAddress: mockTokenA.address,
      amount: rewardsToRetract.toString(),
    });

    const expectedRewardsLeft = totalRewards.sub(rewardsToRetract);
    const storedAmount = await incentives.getRewardAmount(firstContract, sponsor1, mockTokenA.address);
    assert.equal(storedAmount.toString(), expectedRewardsLeft.toString());
  });
});
