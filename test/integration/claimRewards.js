const { accounts, defaultSender, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, ether, time, expectEvent } = require('@openzeppelin/test-helpers');
const { exec } = require('child_process');
const { assert } = require('chai');
require('chai').should();

const { getQuoteValues, getValue } = require('./external');
const { hex, sleep } = require('../utils');
const setup = require('./setup');

const BN = web3.utils.BN;
const fee = ether('0.002');
const LOCK_REASON_CLAIM = hex('CLA');
const rewardRateScale = new BN('10').pow(new BN('18'));

function coverToCoverDetailsArray (cover) {
  return [cover.amount, cover.price, cover.priceNXM, cover.expireTime, cover.generationTime];
}

describe('burns', function () {

  this.timeout(10000000);
  const owner = defaultSender;
  const [
    member1,
    member2,
    member3,
    staker1,
    staker2,
    sponsor1,
    coverHolder,
  ] = accounts;

  const tokensLockedForVoting = ether('200');
  const validity = 360 * 24 * 60 * 60; // 360 days
  const UNLIMITED_ALLOWANCE = new BN('2')
    .pow(new BN('256'))
    .sub(new BN('1'));

  const initialMemberFunds = ether('2500');

  async function initMembers () {
    const { mr, mcr, pd, tk, tc, cd } = this;

    await mr.addMembersBeforeLaunch([], []);
    (await mr.launched()).should.be.equal(true);

    const minimumCapitalRequirementPercentage = await getValue(ether('2'), pd, mcr);
    await mcr.addMCRData(
      minimumCapitalRequirementPercentage,
      ether('100'),
      ether('2'),
      ['0x455448', '0x444149'],
      [100, 65407],
      20181011, {
        from: owner,
      },
    );
    (await pd.capReached()).toString().should.be.equal('1');

    this.allStakers = [staker1, staker2];
    const members = [member1, member2, member3];
    members.push(...this.allStakers);
    members.push(coverHolder);

    for (const member of members) {
      await mr.payJoiningFee(member, { from: member, value: fee });
      await mr.kycVerdict(member, true);
      await tk.approve(tc.address, UNLIMITED_ALLOWANCE, { from: member });
      await tk.transfer(member, initialMemberFunds);
    }

    const maxVotingTime = await cd.maxVotingTime();

    for (const member of members) {
      await tc.lock(LOCK_REASON_CLAIM, tokensLockedForVoting, validity, {
        from: member,
      });
    }

    this.allMembers = members;

    const currency = hex('ETH');
    const tokenPrice = await mcr.calculateTokenPrice(currency);
  }

  async function buyCover (cover, coverHolder) {
    const { qt, p1 } = this;
    const vrsData = await getQuoteValues(
      coverToCoverDetailsArray(cover),
      cover.currency,
      cover.period,
      cover.contractAddress,
      qt.address,
    );
    await p1.makeCoverBegin(
      cover.contractAddress,
      cover.currency,
      coverToCoverDetailsArray(cover),
      cover.period,
      vrsData[0],
      vrsData[1],
      vrsData[2],
      { from: coverHolder, value: cover.price },
    );
  }

  async function submitMemberVotes (voteValue, maxVotingMembers) {
    const { cd, td, cl } = this;
    const claimId = (await cd.actualClaimLength()) - 1;

    const initialCAVoteTokens = await cd.getCaClaimVotesToken(claimId);

    const baseMembers = [member1, member2, member3];
    const voters = maxVotingMembers ? baseMembers.slice(0, maxVotingMembers) : baseMembers;

    for (const member of voters) {
      await cl.submitCAVote(claimId, voteValue, { from: member });
    }

    const finalCAVoteTokens = await cd.getCaClaimVotesToken(claimId);
    const actualVoteTokensDiff = finalCAVoteTokens[1] - initialCAVoteTokens[1];
    const expectedVoteTokensDiff = tokensLockedForVoting * voters.length;
    actualVoteTokensDiff.should.be.equal(expectedVoteTokensDiff);

    const allVotes = await cd.getAllVotesForClaim(claimId);
    const expectedVotes = allVotes[1].length;
    expectedVotes.should.be.equal(voters.length);

    const isBooked = await td.isCATokensBooked(member1);
    isBooked.should.be.equal(true);
  }

  async function concludeClaimWithOraclize (now, expectedClaimStatusNumber) {
    const { cl, pd, cd, p1 } = this;

    const claimId = (await cd.actualClaimLength()) - 1;

    const minVotingTime = await cd.minVotingTime();
    const minTime = new BN(minVotingTime.toString()).add(
      new BN(now.toString()),
    );

    await time.increaseTo(
      new BN(minTime.toString()).add(new BN('2')),
    );

    (await cl.checkVoteClosing(claimId))
      .toString()
      .should.be.equal('1');

    const APIID = await pd.allAPIcall((await pd.getApilCallLength()) - 1);
    await p1.__callback(APIID, '');
    const newCStatus = await cd.getClaimStatusNumber(claimId);
    newCStatus[1].toString().should.be.equal(expectedClaimStatusNumber);

    (await cl.checkVoteClosing(claimId))
      .toString()
      .should.be.equal('-1');
  }

  describe('claim is accepted for contract whose staker that staked on multiple contracts', function () {

    before(setup);
    before(initMembers);

    const currency = hex('ETH');

    const cover = {
      amount: 1,
      price: '3362445813369838',
      priceNXM: '744892736679184',
      expireTime: '7972408607',
      generationTime: '7972408607001',
      currency,
      period: 61,
      contractAddress: '0xd0a6e6c54dbc68db5db3a091b171a77407ff7ccf',
    };

    const secondCoveredAddress = '0xd01236c54dbc68db5db3a091b171a77407ff7234';

    const rewardRate = rewardRateScale.muln(2);

    const stakeTokens = ether('40');
    const unstakeTokens = ether('20');

    it('sets up the arena', async function () {

      const { ps, tk, incentives, mockTokenA } = this;

      await mockTokenA.mint(sponsor1, ether('1000'));

      const totalRewards = ether('1000');
      await mockTokenA.approve(incentives.address, totalRewards, {
        from: sponsor1,
      });
      await incentives.depositRewards(cover.contractAddress, mockTokenA.address, totalRewards, {
        from: sponsor1,
      });
      await incentives.setRewardRate(cover.contractAddress, mockTokenA.address, rewardRate, {
        from: sponsor1,
      });

      await tk.approve(ps.address, stakeTokens, { from: staker1 });
      await ps.depositAndStake(
        stakeTokens, [cover.contractAddress, secondCoveredAddress], [stakeTokens, stakeTokens], { from: staker1 },
      );
    });

    it('allows staker to claim rewards proportionate to the stake', async function () {
      const { incentives, mockTokenA, ps } = this;
      await expectRevert(incentives.claimRewards([cover.contractAddress], [sponsor1], [mockTokenA.address], {
        from: staker1,
      }),
      'Rounds haven\'t started yet');
    });

    it('allows staker to claim rewards proportionate to the stake while no unstakes pending', async function () {
      const { incentives, mockTokenA, ps } = this;

      await time.increase(10);
      await incentives.claimRewards([cover.contractAddress], [sponsor1], [mockTokenA.address], {
        from: staker1,
      });

      const currentStake = await ps.stakerContractStake(staker1, cover.contractAddress);
      const expectedRewardAmount = currentStake.mul(rewardRate).div(rewardRateScale);
      const rewardTokenBalance = await mockTokenA.balanceOf(staker1);
      assert.equal(rewardTokenBalance.toString(), expectedRewardAmount.toString());
    });

    it('allows staker to claim rewards proportionate to the stake minus unstakes for a second round', async function () {
      const { incentives, mockTokenA, ps } = this;

      await ps.requestUnstake([cover.contractAddress, secondCoveredAddress], [unstakeTokens, unstakeTokens], 0, {
        from: staker1,
      });

      const rounDuration = await incentives.roundDuration();
      await time.increase(rounDuration);

      const rewardTokenBalancePreClaim = await mockTokenA.balanceOf(staker1);
      await incentives.claimRewards([cover.contractAddress], [sponsor1], [mockTokenA.address], {
        from: staker1,
      });

      const currentStake = await ps.stakerContractStake(staker1, cover.contractAddress);
      const pendingUnstake = await ps.stakerContractPendingUnstakeTotal(staker1, cover.contractAddress);
      const netStake = currentStake.sub(pendingUnstake);
      const expectedRewardAmount = netStake.mul(rewardRate).div(rewardRateScale);
      const rewardTokenBalancePostClaim = await mockTokenA.balanceOf(staker1);
      const rewardGain = rewardTokenBalancePostClaim.sub(rewardTokenBalancePreClaim);
      assert.equal(rewardGain.toString(), expectedRewardAmount.toString());
    });
  });
});
