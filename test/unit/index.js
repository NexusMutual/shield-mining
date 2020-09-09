describe('CommunityStakingIncentives unit tests', function () {

  this.timeout(5000);
  this.slow(2000);
  require('./constructor');
  require('./gettersAndSetters');
  require('./depositRewards');
  require('./withdrawRewards');
  require('./claimRewards');

});
