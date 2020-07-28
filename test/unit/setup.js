const { contract } = require('@openzeppelin/test-environment');
const { time } = require('@openzeppelin/test-helpers');
const MasterMock = contract.fromArtifact('MasterMock');
const PooledStakingMock = contract.fromArtifact('PooledStakingMock');
const CommunityStakingIncentives = contract.fromArtifact('CommunityStakingIncentives');
const MockTokenA = contract.fromArtifact('MockTokenA');
const MockTokenB = contract.fromArtifact('MockTokenB');
const MockTokenC = contract.fromArtifact('MockTokenC');
const { hex } = require('./utils');

async function setup () {

  const roundDuration = 7 * 24 * 60 * 60;
  const roundsStartTimeSecondsUntilStart = 10;

  const latest = (await time.latest()).toNumber();
  const roundsStartTime = latest + roundsStartTimeSecondsUntilStart;

  const master = await MasterMock.new();
  const pooledStaking = await PooledStakingMock.new();
  const incentives = await CommunityStakingIncentives.new(roundDuration, roundsStartTime, master.address);
  const mockTokenA = await MockTokenA.new();
  const mockTokenB = await MockTokenB.new();
  const mockTokenC = await MockTokenC.new();

  master.setLatestAddress(hex('PS'), pooledStaking.address);

  await time.increase(roundsStartTimeSecondsUntilStart);

  this.master = master;
  this.pooledStaking = pooledStaking;
  this.incentives = incentives;
  this.mockTokenA = mockTokenA;
  this.mockTokenB = mockTokenB;
  this.mockTokenC = mockTokenC;
  this.roundDuration = roundDuration;
  this.startTime = roundsStartTime;
}

module.exports = {
  setup,
};
