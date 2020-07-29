/*
    Copyright (C) 2020 NexusMutual.io

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see http://www.gnu.org/licenses/
*/

pragma solidity ^0.6.10;

contract PooledStakingMock {

  mapping(address => mapping(address => uint)) stakerContractStakes;
  mapping(address => mapping(address => uint)) stakerContractPendingUnstakeTotals;

  mapping (address => address[]) stakerContracts;

  function setStakerContractStake(address staker, address contractAddress, uint stake) external {
    if (stakerContractStakes[staker][contractAddress] == 0) {
      stakerContracts[staker].push(contractAddress);
    }
    stakerContractStakes[staker][contractAddress] = stake;
  }

  function stakerContractsArray(address staker) external view returns (address[] memory)  {
    return stakerContracts[staker];
  }

  function stakerContractStake(address staker, address contractAddress) external view returns (uint) {
    return stakerContractStakes[staker][contractAddress];
  }

  function stakerContractPendingUnstakeTotal(address staker, address contractAddress) external view returns (uint) {
    return stakerContractPendingUnstakeTotals[staker][contractAddress];
  }

  function setStakerContractPendingUnstakeTotal(address staker, address contractAddress, uint unstakeTotal) external  {
    stakerContractPendingUnstakeTotals[staker][contractAddress] = unstakeTotal;
  }
}
