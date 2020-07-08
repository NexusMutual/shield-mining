const { contract } = require('@openzeppelin/test-environment');
const MasterMock = contract.fromArtifact('MasterMock');
const PooledStakingMock = contract.fromArtifact('PooledStakingMock');
const CommunityStakingIncentives = contract.fromArtifact('CommunityStakingIncentives');
const MockTokenA = contract.fromArtifact('MockTokenA');

async function setup () {

  const roundDuration = 7 * 24 * 60 * 60;
  const now = Date.now();

  const master = await MasterMock.new();
  const pooledStaking = await PooledStakingMock.new();
  const incentives = await CommunityStakingIncentives.new(roundDuration, now, master.address);
  const mockTokenA = await MockTokenA.new();

  this.master = master;
  this.pooledStaking = pooledStaking;
  this.incentives = incentives;
  this.mockTokenA = mockTokenA;
}

module.exports = {
  setup,
};
