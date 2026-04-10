// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICLAWD {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BurnBoard {
    address public constant CLAWD = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant BURN_COST = 1000 * 10**18;
    uint256 public constant MAX_PAGE_SIZE = 50;

    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    modifier nonReentrant() {
        require(_status != _ENTERED, "reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    struct Message {
        address author;
        uint64 timestamp;
        string text;
    }

    Message[] public messages;

    event Posted(address indexed author, uint256 indexed index, string text);

    constructor() {
        _status = _NOT_ENTERED;
    }

    function post(string calldata text) external nonReentrant {
        require(bytes(text).length > 0 && bytes(text).length <= 280, "invalid length");
        // CEI: state first, external call last
        messages.push(Message(msg.sender, uint64(block.timestamp), text));
        emit Posted(msg.sender, messages.length - 1, text);
        require(ICLAWD(CLAWD).transferFrom(msg.sender, BURN_ADDRESS, BURN_COST), "burn failed");
    }

    function getMessageCount() external view returns (uint256) {
        return messages.length;
    }

    function getMessage(uint256 index) external view returns (Message memory) {
        return messages[index];
    }

    function getMessages(uint256 offset, uint256 limit) external view returns (Message[] memory) {
        if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
        uint256 total = messages.length;
        if (offset >= total) return new Message[](0);
        uint256 end = total - offset;
        uint256 start = end > limit ? end - limit : 0;
        uint256 count = end - start;
        Message[] memory result = new Message[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = messages[start + i];
        }
        return result;
    }
}
