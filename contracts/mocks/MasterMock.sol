import "../interfaces/INXMMaster.sol";

contract MasterMock is INXMMaster {

  mapping(bytes2 => address payable) contractAddresses;

  function setLatestAddress(bytes2 contractName, address payable contractAddress) public {
    contractAddresses[contractName] = contractAddress;
  }

  function getLatestAddress(bytes2 contractName) public override view returns (address payable) {
    return contractAddresses[contractName];
  }
}
