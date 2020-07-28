const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const CommunityStakingIncentives = contract.fromArtifact('CommunityStakingIncentives');

const masterAddress = '0x0000000000000000000000000000000000000001';

describe('constructor', function () {
  this.timeout(5000);

  it('should initialize roundDuration and roundsStartTime correctly', async function () {
    const latest = (await time.latest()).toNumber();
    const roundsStartTime = latest + 10;
    const roundDuration = 14 * 24 * 60 * 60;
    const incentives = await CommunityStakingIncentives.new(roundDuration, roundsStartTime, masterAddress);
    const storedMasterAddress = await incentives.master();
    const storedRoundDuration = await incentives.roundDuration();
    const storedRoundsStartTime = await incentives.roundsStartTime();
    assert.equal(storedMasterAddress, masterAddress);
    assert.equal(storedRoundDuration.toString(), roundDuration.toString());
    assert.equal(storedRoundsStartTime.toString(), storedRoundsStartTime.toString());
  });

  it('should fail initialize when roundStartTime is in the past', async function () {
    const latest = (await time.latest()).toNumber();
    const roundsStartTime = latest - 10;
    const roundDuration = 7 * 24 * 60 * 60;
    await expectRevert(
      CommunityStakingIncentives.new(roundDuration, roundsStartTime, masterAddress),
      '_roundsStartTime needs to be in the future',
    );
  });

  it('should fail initialize when roundDuration is 0', async function () {
    const latest = (await time.latest()).toNumber();
    const roundsStartTime = latest + 10;
    const roundDuration = 0;
    await expectRevert(
      CommunityStakingIncentives.new(roundDuration, roundsStartTime, masterAddress),
      '_roundDuration needs to be greater than 0',
    );
  });
});
