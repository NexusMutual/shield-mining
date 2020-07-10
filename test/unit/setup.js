const { contract } = require('@openzeppelin/test-environment');
const MasterMock = contract.fromArtifact('MasterMock');
const PooledStakingMock = contract.fromArtifact('PooledStakingMock');
const CommunityStakingIncentives = contract.fromArtifact('CommunityStakingIncentives');
const MockTokenA = contract.fromArtifact('MockTokenA');
const MockTokenB = contract.fromArtifact('MockTokenB');
const { hex } = require('./utils');

async function setup () {

  const roundDuration = 7 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);

  const master = await MasterMock.new();
  const pooledStaking = await PooledStakingMock.new();
  const incentives = await CommunityStakingIncentives.new(roundDuration, now, master.address);
  const mockTokenA = await MockTokenA.new();
  const mockTokenB = await MockTokenB.new();

  master.setLatestAddress(hex('PS'), pooledStaking.address);

  this.master = master;
  this.pooledStaking = pooledStaking;
  this.incentives = incentives;
  this.mockTokenA = mockTokenA;
  this.mockTokenB = mockTokenB;
}

module.exports = {
  setup,
};
