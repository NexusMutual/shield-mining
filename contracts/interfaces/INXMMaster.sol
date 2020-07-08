pragma solidity ^0.6.10;

interface INXMMaster {
  function getLatestAddress(bytes2 _contractName) external view returns (address payable contractAddress);
}
