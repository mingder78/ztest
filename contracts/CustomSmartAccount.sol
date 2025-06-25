// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract CustomSmartAccount {
    address public owner;
    uint256 public nonce;

    constructor(address _owner) {
        owner = _owner;
    }

    struct PackedUserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        bytes32 accountGasLimits; // packed callGasLimit + verificationGasLimit
        uint256 preVerificationGas;
        bytes32 gasFees; // packed maxFeePerGas + maxPriorityFeePerGas
        bytes paymasterAndData;
        bytes signature;
    }

    // Helper to unpack two uint128 from bytes32
    function unpack(bytes32 packed) internal pure returns (uint128, uint128) {
        uint128 a = uint128(uint256(packed) >> 128);
        uint128 b = uint128(uint256(packed));
        return (a, b);
    }

    // Example validateUserOp using the new struct
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 /*missingField*/
    ) external view returns (uint256 validationData) {
        if (userOp.sender != address(this)) {
            revert("sender");
        }
        if (userOp.nonce != nonce) {
            revert("nonce");
        }
        // تحقق التوقيع (ECDSA)
        address recovered = ECDSA.recover(userOpHash, userOp.signature);
        if (recovered != owner) {
            revert("sig");
        }
        return 0;
    }

    // Example execute function
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external {
        require(msg.sender == owner, "Only owner can execute");
        (bool success, ) = target.call{value: value}(data);
        require(success, "Call failed");
    }

    receive() external payable {}
}
