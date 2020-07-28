describe('CommunityStakingIncentives unit tests', function () {

  this.timeout(5000);
  this.slow(2000);

  require('./depositRewards');
  require('./withdrawRewards');
  require('./claimRewards');
  require('./gettersAndSetters');
  require('./constructor');
});
