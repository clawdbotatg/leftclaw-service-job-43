// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/BurnBoard.sol";

/// @dev Returns false from every transferFrom call (simulates a token that reports failure)
contract ReturnFalseCLAWD {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

/// @dev Attempts to re-enter BurnBoard.post() from within transferFrom
contract ReentrantCLAWD {
    BurnBoard private immutable _board;

    constructor(BurnBoard board) {
        _board = board;
    }

    function transferFrom(address, address, uint256) external returns (bool) {
        _board.post("re");
        return true;
    }
}

contract BurnBoardTest is Test {
    BurnBoard public board;

    address constant CLAWD_ADDR = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;
    address constant BURN_ADDR = 0x000000000000000000000000000000000000dEaD;
    uint256 constant BURN_COST = 1000 * 10 ** 18;
    address constant USER = address(0xBEEF);

    // Mirror the event so vm.expectEmit can match it
    event Posted(address indexed author, uint256 indexed index, string text);

    function setUp() public {
        board = new BurnBoard();
    }

    /// @dev Mocks any transferFrom call at the hardcoded CLAWD address to return true
    function _mockTransferSuccess() internal {
        vm.mockCall(CLAWD_ADDR, abi.encodeWithSelector(ICLAWD.transferFrom.selector), abi.encode(true));
    }

    // ── length boundary ──────────────────────────────────────────────────────

    function test_RevertOnEmptyMessage() public {
        _mockTransferSuccess();
        vm.prank(USER);
        vm.expectRevert("invalid length");
        board.post("");
    }

    function test_RevertOn281ByteMessage() public {
        bytes memory b = new bytes(281);
        for (uint256 i; i < 281; i++) b[i] = 0x41; // 'A'
        _mockTransferSuccess();
        vm.prank(USER);
        vm.expectRevert("invalid length");
        board.post(string(b));
    }

    function test_Accept280ByteMessage() public {
        bytes memory b = new bytes(280);
        for (uint256 i; i < 280; i++) b[i] = 0x41;
        _mockTransferSuccess();
        vm.prank(USER);
        board.post(string(b));
        assertEq(board.getMessageCount(), 1);
    }

    // ── transferFrom return value / revert ───────────────────────────────────

    function test_RevertWhenTransferFromReturnsFalse() public {
        ReturnFalseCLAWD falseToken = new ReturnFalseCLAWD();
        vm.etch(CLAWD_ADDR, address(falseToken).code);
        vm.prank(USER);
        vm.expectRevert("burn failed");
        board.post("hello");
    }

    function test_RevertWhenTransferFromReverts() public {
        // Simulate insufficient allowance / balance by making the call revert
        vm.mockCallRevert(CLAWD_ADDR, abi.encodeWithSelector(ICLAWD.transferFrom.selector), "");
        vm.prank(USER);
        vm.expectRevert();
        board.post("hello");
    }

    // ── reentrancy ────────────────────────────────────────────────────────────

    function test_NonReentrant() public {
        // Etch a malicious token whose transferFrom calls back into board.post()
        ReentrantCLAWD reentrant = new ReentrantCLAWD(board);
        vm.etch(CLAWD_ADDR, address(reentrant).code);
        vm.prank(USER);
        vm.expectRevert("reentrant call");
        board.post("trigger reentrancy");
    }

    // ── event emission ────────────────────────────────────────────────────────

    function test_PostedEventEmitted() public {
        _mockTransferSuccess();
        vm.prank(USER);
        vm.expectEmit(true, true, false, true);
        emit Posted(USER, 0, "hello world");
        board.post("hello world");
    }

    // ── getMessages pagination ────────────────────────────────────────────────

    /// @dev Posts `n` messages from USER with mock transferFrom
    function _postN(uint256 n) internal {
        _mockTransferSuccess();
        for (uint256 i; i < n; i++) {
            vm.prank(USER);
            board.post(vm.toString(i));
        }
    }

    function test_GetMessages_OffsetZeroReturnsNewest() public {
        _postN(5);
        // offset=0, limit=5: end=5, start=0, returns messages[0..5)
        BurnBoard.Message[] memory msgs = board.getMessages(0, 5);
        assertEq(msgs.length, 5);
        assertEq(msgs[0].text, "0");
        assertEq(msgs[4].text, "4");
    }

    function test_GetMessages_OffsetEqualTotalReturnsEmpty() public {
        _postN(5);
        BurnBoard.Message[] memory msgs = board.getMessages(5, 5);
        assertEq(msgs.length, 0);
    }

    function test_GetMessages_OffsetBeyondTotalReturnsEmpty() public {
        _postN(5);
        BurnBoard.Message[] memory msgs = board.getMessages(100, 50);
        assertEq(msgs.length, 0);
    }

    function test_GetMessages_LimitCappedAtMaxPageSize() public {
        _postN(10);
        // Requesting limit=100 is capped to MAX_PAGE_SIZE=50; only 10 messages exist so get 10
        BurnBoard.Message[] memory msgs = board.getMessages(0, 100);
        assertEq(msgs.length, 10);
    }

    function test_GetMessages_PaginationNewestFirst() public {
        _postN(60); // messages "0".."59"

        // Page 1: offset=0, limit=50 — skips 0 from tail, returns messages[10..60) = "10".."59"
        BurnBoard.Message[] memory page1 = board.getMessages(0, 50);
        assertEq(page1.length, 50);
        assertEq(page1[0].text, "10");
        assertEq(page1[49].text, "59");

        // Page 2: offset=50, limit=50 — skips 50 from tail, returns messages[0..10) = "0".."9"
        BurnBoard.Message[] memory page2 = board.getMessages(50, 50);
        assertEq(page2.length, 10);
        assertEq(page2[0].text, "0");
        assertEq(page2[9].text, "9");
    }

    function test_GetMessages_ExactMaxPageSizeBoundary() public {
        _postN(50); // exactly MAX_PAGE_SIZE messages
        BurnBoard.Message[] memory msgs = board.getMessages(0, 50);
        assertEq(msgs.length, 50);
        assertEq(msgs[0].text, "0");
        assertEq(msgs[49].text, "49");
    }
}
