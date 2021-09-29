/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  FixedPriceSale,
  FixedPriceSaleInterface,
} from "../FixedPriceSale";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "canBid",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "proxy",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "params",
        type: "bytes",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "bidPrice",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "canClaim",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b50610296806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063610e2d3b1461003b578063e9b3838f14610062575b600080fd5b61004e61004936600461012e565b61007e565b604051901515815260200160405180910390f35b61004e61007036600461012e565b600098975050505050505050565b600080878060200190518101906100959190610232565b9050600081116100e25760405162461bcd60e51b815260206004820152601460248201527353484f59553a20494e56414c49445f505249434560601b604482015260640160405180910390fd5b6001600160a01b038a161515806100f95750884211155b801561010457508086145b9a9950505050505050505050565b80356001600160a01b038116811461012957600080fd5b919050565b600080600080600080600080610100898b03121561014a578384fd5b61015389610112565b975060208901359650604089013567ffffffffffffffff80821115610176578586fd5b818b0191508b601f830112610189578586fd5b81358181111561019b5761019b61024a565b604051601f8201601f19908116603f011681019083821181831017156101c3576101c361024a565b816040528281528e60208487010111156101db578889fd5b8260208601602083013791820160200188905250975061020091505060608a01610112565b94506080890135935061021560a08a01610112565b925060c0890135915060e089013590509295985092959890939650565b600060208284031215610243578081fd5b5051919050565b634e487b7160e01b600052604160045260246000fdfea2646970667358221220c1fe2f7324bc1250b94031a7fdf3a3eae5cfdc4362b0785646936665491f95b564736f6c63430008030033";

export class FixedPriceSale__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<FixedPriceSale> {
    return super.deploy(overrides || {}) as Promise<FixedPriceSale>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): FixedPriceSale {
    return super.attach(address) as FixedPriceSale;
  }
  connect(signer: Signer): FixedPriceSale__factory {
    return super.connect(signer) as FixedPriceSale__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): FixedPriceSaleInterface {
    return new utils.Interface(_abi) as FixedPriceSaleInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): FixedPriceSale {
    return new Contract(address, _abi, signerOrProvider) as FixedPriceSale;
  }
}
