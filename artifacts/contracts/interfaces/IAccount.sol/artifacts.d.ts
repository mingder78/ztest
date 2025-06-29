// This file was autogenerated by hardhat-viem, do not edit it.
// prettier-ignore
// tslint:disable
// eslint-disable

import "hardhat/types/artifacts";
import type { GetContractReturnType } from "@nomicfoundation/hardhat-viem/types";

import { IAccount$Type } from "./IAccount";

declare module "hardhat/types/artifacts" {
  interface ArtifactsMap {
    ["IAccount"]: IAccount$Type;
    ["contracts/interfaces/IAccount.sol:IAccount"]: IAccount$Type;
  }

  interface ContractTypesMap {
    ["IAccount"]: GetContractReturnType<IAccount$Type["abi"]>;
    ["contracts/interfaces/IAccount.sol:IAccount"]: GetContractReturnType<IAccount$Type["abi"]>;
  }
}
