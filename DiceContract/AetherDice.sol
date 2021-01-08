pragma solidity >=0.4.23 <0.6.0;

contract AetherDice{
    mapping(address=>uint8)bets;
    uint256 result;

    function placeBet(uint256 userAddress, uint8 bet) external{
        require(bet>=1&&bet<=6,"have to be D6 result");
        bets[address(userAddress)] = bet;
    }
    function rollDice() external{
        result = generateRandomNum();
    }
    function getResult() public view returns(uint256){
        return result;
    }
    function generateRandomNum() private view
        returns (uint256)
    {
        uint256 rand = uint256(keccak256(abi.encodePacked(block.timestamp)));
        rand = rand % 6;
        return rand +1;
    }
}
