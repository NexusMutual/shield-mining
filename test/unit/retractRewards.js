const { ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { accounts } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');

const firstContract = '0x0000000000000000000000000000000000000001';

describe('retractRewards', function () {

  const [
    sponsor1,
  ] = accounts;

  beforeEach(setup);

  it('should update the reward funds of a sponsor. transfer the the funds, and emit RewardRetraction event', async function () {
    const { incentives, mockTokenA } = this;

    const issued = ether('100');
    await mockTokenA.issue(sponsor1, issued);
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
    const { amount: storedAmount } = await incentives.getReward(firstContract, sponsor1, mockTokenA.address);
    assert.equal(storedAmount.toString(), expectedRewardsLeft.toString());

    const postRetractionIncentivesBalance = await mockTokenA.balanceOf(incentives.address);
    assert.equal(postRetractionIncentivesBalance.toString(), expectedRewardsLeft);

    const postRetractionSponsorBalance = await mockTokenA.balanceOf(sponsor1);
    const newExpectedSponsorBalance = issued.sub(expectedRewardsLeft);
    assert.equal(postRetractionSponsorBalance.toString(), newExpectedSponsorBalance.toString());
  });

  it('should update the reward funds of a sponsor, transfer funds when all funds are retracted', async function () {
    const { incentives, mockTokenA } = this;

    const issued = ether('100');
    await mockTokenA.issue(sponsor1, issued);
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });

    const tx = await incentives.retractRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });

    await expectEvent(tx, 'RewardRetraction', {
      stakedContract: firstContract,
      sponsor: sponsor1,
      tokenAddress: mockTokenA.address,
      amount: totalRewards.toString(),
    });
    const { amount: storedAmount } = await incentives.getReward(firstContract, sponsor1, mockTokenA.address);
    assert.equal(storedAmount.toString(), '0');
    const postRetractionIncentivesBalance = await mockTokenA.balanceOf(incentives.address);
    assert.equal(postRetractionIncentivesBalance.toString(), '0');
    const postRetractionSponsorBalance = await mockTokenA.balanceOf(sponsor1);
    assert.equal(postRetractionSponsorBalance.toString(), issued.toString());
  });

  it('should revert when requested amount is higher than available funds', async function () {
    const { incentives, mockTokenA } = this;

    const issued = ether('100');
    await mockTokenA.issue(sponsor1, issued);
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });

    const rewardsToRetract = totalRewards.addn(2);
    await expectRevert(
      incentives.retractRewards(firstContract, mockTokenA.address, rewardsToRetract, { from: sponsor1 }),
      'Not enough tokens to withdraw',
    );
  });

  it('should revert when the token address does not exist', async function () {
    const { incentives, mockTokenA } = this;
    const issued = ether('100');
    await mockTokenA.issue(sponsor1, issued);
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });
    const nonExistantToken = '0x0000000000000000000000000000000000000666';
    await expectRevert(
      incentives.retractRewards(firstContract, nonExistantToken, '10', { from: sponsor1 }),
      'revert',
    );
  });
});
