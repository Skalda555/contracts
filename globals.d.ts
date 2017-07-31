declare module 'bn.js';
declare module 'ethereumjs-abi';
declare module 'prompt-confirm';

import * as Web3 from 'web3';

// HACK: In order to merge the bignumber declaration added by chai-bignumber to the chai Assertion
// interface we must use `namespace` as the Chai definitelyTyped definition does. Since we otherwise
// disallow `namespace`, we disable tslint for the following.
/* tslint:disable */
declare namespace Chai {
    interface NumberComparer {
        (value: number|BigNumber.BigNumber, message?: string): Assertion;
    }
    interface NumericComparison {
        greaterThan: NumberComparer;
    }
    interface Assertion {
        bignumber: Assertion;
    }
}

declare module '*.json' {
    const json: any;
    /* tslint:disable */
    export default json;
    /* tslint:enable */
}

// Truffle injects the following into the global scope
declare var web3: any; // TODO: figure out how to use Web3 definition from within global.d.ts instead of `any`
declare var artifacts: any;
declare var contract: any;
declare var before: any;
declare var beforeEach: any;
declare var describe: any;
declare var it: any;

declare module 'ethereumjs-util' {
  function bufferToHex(value: Buffer): string;
  function ecrecover(msgHash: Buffer, v: number, r: Buffer, s: Buffer): Buffer;
  function fromRpcSig(sig: string): {v: number, r: Buffer, s: Buffer};
  function hashPersonalMessage(hash: Buffer): Buffer;
  function isHexString(value: any): boolean;
  function pubToAddress(pubKey: Buffer, sanitize?: boolean): Buffer;
  function setLength(a: Buffer, length: number): Buffer;
  function setLengthLeft(a: Buffer, length: number): Buffer;
  function sha3(a: Buffer|string|number, bits?: number): Buffer;
  function toBuffer(value: any): Buffer;
  function isValidAddress(address: string): boolean;

  export = {
            bufferToHex,
            ecrecover,
            fromRpcSig,
            hashPersonalMessage,
            isHexString,
            pubToAddress,
            setLength,
            setLengthLeft,
            sha3,
            toBuffer,
            isValidAddress,
          };
}

// es6-promisify declarations
declare function promisify(original: any, settings?: any): ((...arg: any[]) => Promise<any>);
declare module 'es6-promisify' {
    export = promisify;
}

// truffle-contract declarations
declare interface ContractInstance {
    address: string;
}
declare interface ContractFactory {
    setProvider: (providerObj: Web3.Provider) => void;
    deployed: () => ContractInstance;
    at: (address: string) => ContractInstance;
}
declare interface Artifact {
    abi: any;
    networks: {[networkId: number]: any};
}
declare module 'truffle-contract' {
    function contract(artifacts: Artifact): ContractFactory;
    export = contract;
}
