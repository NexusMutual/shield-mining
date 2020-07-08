pragma solidity ^0.6.10;

interface IPooledStaking {
  function stakerContractStake(address staker, address contractAddress) external view returns (uint);
}
