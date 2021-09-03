/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { TokenHelper, TokenHelperInterface } from "../TokenHelper";

const _abi = [
  {
    inputs: [],
    name: "ETH",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const _bytecode =
  "0x6091610038600b82828239805160001a607314602b57634e487b7160e01b600052600060045260246000fd5b30600052607381538281f3fe730000000000000000000000000000000000000000301460806040526004361060335760003560e01c80638322fff2146038575b600080fd5b603f600081565b6040516001600160a01b03909116815260200160405180910390f3fea26469706673582212208c99cb8ce55f88fbbcef71e84e4b58b4645fb253c4f89d67a3fe89d2a6ef6c5b64736f6c63430008030033";

export class TokenHelper__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<TokenHelper> {
    return super.deploy(overrides || {}) as Promise<TokenHelper>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): TokenHelper {
    return super.attach(address) as TokenHelper;
  }
  connect(signer: Signer): TokenHelper__factory {
    return super.connect(signer) as TokenHelper__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): TokenHelperInterface {
    return new utils.Interface(_abi) as TokenHelperInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): TokenHelper {
    return new Contract(address, _abi, signerOrProvider) as TokenHelper;
  }
}