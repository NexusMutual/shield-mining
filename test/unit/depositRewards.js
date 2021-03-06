const { ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { accounts, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { setup } = require('./setup');
const BN = web3.utils.BN;

const firstContract = '0x0000000000000000000000000000000000000001';

describe('depositRewards', function () {

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

  it('should update the reward funds of a sponsor, transfer tokens to contract, and emit Deposited event', async function () {
    const { incentives, mockTokenA } = this;

    await mockTokenA.mint(sponsor1, ether('100'));

    const totalRewards = ether('1');
    await mockTokenA.approve(incentives.address, totalRewards, {
      from: sponsor1,
    });
    const tx = await incentives.depositRewards(firstContract, mockTokenA.address, totalRewards, {
      from: sponsor1,
    });
    await expectEvent(tx, 'Deposited', {
      stakedContract: firstContract,
      sponsor: sponsor1,
      tokenAddress: mockTokenA.address,
      amount: totalRewards,
    });

    const { amount: storedAmount } = await incentives.getRewardPool(firstContract, sponsor1, mockTokenA.address);
    assert.equal(storedAmount.toString(), totalRewards);

    const incentivesTokenABalance = await mockTokenA.balanceOf(incentives.address);
    assert.equal(incentivesTokenABalance.toString(), totalRewards.toString());
  });

  it('should update reward funds for multiple sponsors for the same contract, transfer funds, and emit Deposited events,', async function () {
    const { incentives, mockTokenA } = this;

    const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4, sponsor5];
    for (const sponsor of sponsors) {
      await mockTokenA.mint(sponsor, ether('100'));
    }
    const baseRewards = ether('1');

    let totalRewards = new BN('0');
    let multiplier = 1;
    for (const sponsor of sponsors) {
      const sponsorRewards = baseRewards.muln(multiplier++);
      totalRewards = totalRewards.add(sponsorRewards);
      await mockTokenA.approve(incentives.address, sponsorRewards, {
        from: sponsor,
      });
      const tx = await incentives.depositRewards(firstContract, mockTokenA.address, sponsorRewards, {
        from: sponsor,
      });
      await expectEvent(tx, 'Deposited', {
        stakedContract: firstContract,
        sponsor: sponsor,
        tokenAddress: mockTokenA.address,
        amount: sponsorRewards,
      });
      const { amount: storedAmount } = await incentives.getRewardPool(firstContract, sponsor, mockTokenA.address);
      assert.equal(storedAmount.toString(), sponsorRewards);
    }
    const incentivesTokenABalance = await mockTokenA.balanceOf(incentives.address);
    assert.equal(incentivesTokenABalance.toString(), totalRewards.toString());
  });

  it('should update reward funds for multiple sponsors and multiple tokens, transfer funds and emit Deposited events',
    async function () {
      const { incentives, mockTokenA, mockTokenB, mockTokenC } = this;

      const sponsors = [sponsor1, sponsor2, sponsor3, sponsor4, sponsor5];
      const tokens = [mockTokenA, mockTokenB, mockTokenC];
      for (const sponsor of sponsors) {
        for (const token of tokens) {
          await token.mint(sponsor, ether('100'));
        }
      }
      const baseRewards = ether('1');

      const totalRewards = {};
      let multiplier = 1;
      for (let sponsorIndex = 0; sponsorIndex < sponsors.length; sponsorIndex++) {
        const sponsor = sponsors[sponsorIndex];
        let sponsorRewards = baseRewards.muln(multiplier++);
        let tokenMultiplier = 0.1;
        for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
          const token = tokens[tokenIndex];
          sponsorRewards = sponsorRewards.muln(1 + tokenMultiplier);

          if (!totalRewards[token.address]) {
            totalRewards[token.address] = new BN('0');
          }
          totalRewards[token.address] = totalRewards[token.address].add(sponsorRewards);
          tokenMultiplier += 0.1;
          await token.approve(incentives.address, sponsorRewards, {
            from: sponsor,
          });
          const tx = await incentives.depositRewards(firstContract, token.address, sponsorRewards, {
            from: sponsor,
          });
          await expectEvent(tx, 'Deposited', {
            stakedContract: firstContract,
            sponsor: sponsor,
            tokenAddress: token.address,
            amount: sponsorRewards,
          });
          const { amount: storedAmount } = await incentives.getRewardPool(firstContract, sponsor, token.address);
          assert.equal(storedAmount.toString(), sponsorRewards.toString(), `Failed for sponsor ${sponsorIndex} and token ${tokenIndex}`);
        }
      }

      for (const token of tokens) {
        const incentivesTokenABalance = await token.balanceOf(incentives.address);
        assert.equal(incentivesTokenABalance.toString(), totalRewards[token.address].toString());
      }
    });

  it('should revert when sponsor does not have enough funds', async function () {
    const { incentives, mockTokenA } = this;

    const minted = ether('1');
    await mockTokenA.mint(sponsor1, minted);
    const desiredRewards = minted.addn(1);
    await mockTokenA.approve(incentives.address, minted, {
      from: sponsor1,
    });
    await expectRevert(
      incentives.depositRewards(firstContract, mockTokenA.address, desiredRewards, { from: sponsor1 }),
      'ERC20: transfer amount exceeds balance.',
    );
  });

  it('should revert when the token address does not exist', async function () {
    const { incentives, mockTokenA } = this;

    const minted = ether('1');
    await mockTokenA.mint(sponsor1, minted);
    await mockTokenA.approve(incentives.address, minted, {
      from: sponsor1,
    });
    const nonExistantToken = '0x0000000000000000000000000000000000000666';
    await expectRevert(
      incentives.depositRewards(firstContract, nonExistantToken, minted, { from: sponsor1 }),
      'revert',
    );
  });
});

describe('depositRewardsAndSetRate', function () {

  this.timeout(5000);
  const [
    sponsor1,
  ] = accounts;

  beforeEach(setup);
  it('should update the reward funds of a sponsor, transfer tokens to contract, and emit Deposited event, and change rate',
    async function () {
      const { incentives, mockTokenA } = this;

      await mockTokenA.mint(sponsor1, ether('100'));

      const totalRewards = ether('1');
      await mockTokenA.approve(incentives.address, totalRewards, {
        from: sponsor1,
      });
      const rewardRate = new BN('1e8');
      const tx = await incentives.depositRewardsAndSetRate(firstContract, mockTokenA.address, totalRewards, rewardRate, {
        from: sponsor1,
      });
      await expectEvent(tx, 'Deposited', {
        stakedContract: firstContract,
        sponsor: sponsor1,
        tokenAddress: mockTokenA.address,
        amount: totalRewards,
      });

      const { rate } = await incentives.getRewardPool(firstContract, sponsor1, mockTokenA.address);
      assert.equal(rate.toString(), rewardRate.toString());
    });
});
