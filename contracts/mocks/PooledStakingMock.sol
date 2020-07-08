contract PooledStakingMock {

  mapping( address => mapping(address => uint)) stakerContractStakes;

  function setStakerContractStake(address staker, address contractAddress, uint stake) external {
    stakerContractStakes[staker][contractAddress] = stake;
  }
  function stakerContractStake(address staker, address contractAddress) external view returns (uint) {
    return stakerContractStakes[staker][contractAddress];
  }
}
