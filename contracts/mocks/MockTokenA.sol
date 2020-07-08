import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockTokenA is ERC20("MockTokenA", "MTA") {
  function issue(address account, uint256 amount) external {
    _mint(account, amount);
  }
}
