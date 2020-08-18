const { ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { accounts } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');

const firstContract = '0x0000000000000000000000000000000000000001';

describe('withdrawRewards', function () {

  const [
    sponsor1,
  ] = accounts;

  beforeEach(setup);

  it('should update the reward funds of a sponsor. transfer the the funds, and emit Withdrawn event', async function () {
    const { incentives, mockTokenA } = this;

    const minted = ether('100');
    await mockTokenA.mint(sponsor1, minted);
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });

    const rewardsToWithdraw = totalRewards.divn(2);
    const tx = await incentives.withdrawRewards(firstContract, mockTokenA.address, rewardsToWithdraw, {
      from: sponsor1,
    });

    await expectEvent(tx, 'Withdrawn', {
      stakedContract: firstContract,
      sponsor: sponsor1,
      tokenAddress: mockTokenA.address,
      amount: rewardsToWithdraw.toString(),
    });

    const expectedRewardsLeft = totalRewards.sub(rewardsToWithdraw);
    const { amount: storedAmount } = await incentives.getRewardPool(firstContract, sponsor1, mockTokenA.address);
    assert.equal(storedAmount.toString(), expectedRewardsLeft.toString());

    const postWithdrawalIncentivesBalance = await mockTokenA.balanceOf(incentives.address);
    assert.equal(postWithdrawalIncentivesBalance.toString(), expectedRewardsLeft);

    const postWithdrawalSponsorBalance = await mockTokenA.balanceOf(sponsor1);
    const newExpectedSponsorBalance = minted.sub(expectedRewardsLeft);
    assert.equal(postWithdrawalSponsorBalance.toString(), newExpectedSponsorBalance.toString());
  });

  it('should update the reward funds of a sponsor, transfer funds when all funds are withdrawn', async function () {
    const { incentives, mockTokenA } = this;

    const minted = ether('100');
    await mockTokenA.mint(sponsor1, minted);
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });

    const tx = await incentives.withdrawRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });

    await expectEvent(tx, 'Withdrawn', {
      stakedContract: firstContract,
      sponsor: sponsor1,
      tokenAddress: mockTokenA.address,
      amount: totalRewards.toString(),
    });
    const { amount: storedAmount } = await incentives.getRewardPool(firstContract, sponsor1, mockTokenA.address);
    assert.equal(storedAmount.toString(), '0');
    const postWithdrawalIncentivesBalance = await mockTokenA.balanceOf(incentives.address);
    assert.equal(postWithdrawalIncentivesBalance.toString(), '0');
    const postWithdrawalSponsorBalance = await mockTokenA.balanceOf(sponsor1);
    assert.equal(postWithdrawalSponsorBalance.toString(), minted.toString());
  });

  it('should revert when requested amount is higher than available funds', async function () {
    const { incentives, mockTokenA } = this;

    const minted = ether('100');
    await mockTokenA.mint(sponsor1, minted);
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });

    const rewardsToWithdraw = totalRewards.addn(2);
    await expectRevert(
      incentives.withdrawRewards(firstContract, mockTokenA.address, rewardsToWithdraw, { from: sponsor1 }),
      'Not enough tokens to withdraw',
    );
  });

  it('should revert when reward rate is different from 0', async function () {
    const { incentives, mockTokenA } = this;

    const minted = ether('100');
    await mockTokenA.mint(sponsor1, minted);
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.setRewardRate(firstContract, mockTokenA.address, ether('1'), {
      from: sponsor1,
    });

    const rewardsToWithdraw = totalRewards;
    await expectRevert(
      incentives.withdrawRewards(firstContract, mockTokenA.address, rewardsToWithdraw, { from: sponsor1 }),
      'Reward rate is not 0',
    );
  });

  it('should revert when the token address does not exist', async function () {
    const { incentives, mockTokenA } = this;
    const minted = ether('100');
    await mockTokenA.mint(sponsor1, minted);
    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });
    const nonExistantToken = '0x0000000000000000000000000000000000000666';
    await expectRevert(
      incentives.withdrawRewards(firstContract, nonExistantToken, '10', { from: sponsor1 }),
      'revert',
    );
  });
});
