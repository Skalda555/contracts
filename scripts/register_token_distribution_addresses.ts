import * as fs from 'fs';
import * as BigNumber from 'bignumber.js';
import * as yargs from 'yargs';
import * as Web3 from 'web3';
import * as _ from 'lodash';
import * as Confirm from 'prompt-confirm';
import contract = require('truffle-contract');
import promisify = require('es6-promisify');
import * as TokenDistributionWithRegistryArtifactsJSON from '../build/contracts/TokenDistributionWithRegistry.json';

export interface TxOpts {
    from: string;
    gas?: number;
}

interface TokenDistributionWithRegistry extends ContractInstance {
    changeRegistrationStatuses: {
        (addresses: string[], isregistered: boolean, txOpts: TxOpts): Promise<void>;
        estimateGas: (addresses: string[], isregistered: boolean, txOpts: TxOpts) => Promise<number>;
    };
    registered: {
        call: (address: string) => Promise<boolean>;
    };
    owner: {
        call: () => Promise<string>;
    };
}

interface BatchConfig {
    size: number;
    gasUsage: number;
}

const log = (...args: any[]) => {
    // tslint:disable-next-line:no-console
    console.log(...args);
};

const getRandomAddress = () => {
    return '0x' +
            Math.random().toString(16).substr(2, 8) +
            Math.random().toString(16).substr(2, 8) +
            Math.random().toString(16).substr(2, 8) +
            Math.random().toString(16).substr(2, 8) +
            Math.random().toString(16).substr(2, 8);
};

const getRandomAddresses = (n: number) => _.times(n, getRandomAddress);

class RegistrationManager {
    private tokenDistributionWithRegistry: TokenDistributionWithRegistry;
    private registeringAddress: string;
    private gasPrice: number;
    constructor(tokenDistributionWithRegistry: TokenDistributionWithRegistry,
                registeringAddress: string,
                gasPrice: number) {
        this.tokenDistributionWithRegistry = tokenDistributionWithRegistry;
        this.registeringAddress = registeringAddress;
        this.gasPrice = gasPrice;
    }
    public async getGasUsageByBatchSize(batchSize: number) {
        const isRegistered = true;
        const addresses = getRandomAddresses(batchSize);
        const txOpts = {from: this.registeringAddress};
        try {
            const gasUsage = await this.tokenDistributionWithRegistry.changeRegistrationStatuses.estimateGas(
               addresses, isRegistered, txOpts);
            return gasUsage;
        } catch (e) {
            // This happens when gas usage would be bigger than block gas limit
            return Infinity;
        }
    }
    // Binary searches for the biggest batch size bellow the gasLimit
    public async getBatchConfigByGasLimit(gasLimit: number): Promise<BatchConfig> {
        const singleRegistrationGasUsage = await this.getGasUsageByBatchSize(1);
        if (gasLimit < singleRegistrationGasUsage) {
            throw new Error('Your gas limit is not enough to register a single address');
        }
        let amountWeCanRegister = 1;
        let amountWeCanNotRegister = 400; // Approx 9kk gas
        let gasUsage = singleRegistrationGasUsage;
        while (amountWeCanNotRegister - amountWeCanRegister > 1) {
            const testAmount = Math.floor((amountWeCanRegister + amountWeCanNotRegister) / 2);
            const gas = await this.getGasUsageByBatchSize(testAmount);
            if (gas <= gasLimit) {
                amountWeCanRegister = testAmount;
                gasUsage = gas;
            } else {
                amountWeCanNotRegister = testAmount;
            }
        }
        return {size: amountWeCanRegister, gasUsage};
    }
    public async registerBatchOfAdresses(batch: string[], gas: number): Promise<void> {
        const isRegistered = true;
        const txOpts = {from: this.registeringAddress, gas, gasPrice: this.gasPrice};
        await this.tokenDistributionWithRegistry.changeRegistrationStatuses(batch, isRegistered, txOpts);
    }
    public async registerAddressesInBatches(batches: string[][], gas: number): Promise<void> {
        for (const [index, batch] of batches.entries()) {
            log(`Registered batches: ${index}/${batches.length} ✅`);
            await this.registerBatchOfAdresses(batch, gas);
        }
        log('Registration succeeded ✅');
    };
    public async isRegistered(address: string): Promise<boolean> {
        const isRegistered = await this.tokenDistributionWithRegistry.registered.call(address);
        return isRegistered;
    }
    public async getUnregisteredAddresses(addresses: string[]): Promise<string[]> {
        const unregisteredAddresses = [];
        for (const [index, address] of addresses.entries()) {
            const isRegistered = await this.isRegistered(address);
            const registrationStatus = isRegistered ? '🔴' : '⚪';
            log(`Registration status: ${index}/${addresses.length} ${address} ${registrationStatus}`);
            if (!isRegistered) {
                unregisteredAddresses.push(address);
            }
        }
        return unregisteredAddresses;
    }
};

(async () => {
    const args = yargs
        .option('node_url', {
          type: 'string',
          default: 'http://localhost:8545',
        })
        .option('gas_price', {
          type: 'number',
          default: 21000000000,
          description: 'Gas price in wei',
        })
        .option('gas_limit', {
          type: 'number',
          default: 1000000,
          describe: 'Max gas limit for every batch/transaction',
        })
        .option('batch_size', {
          type: 'number',
          description: 'If batch size is undefined - uses gas_limit to determine batch size',
        })
        .option('file_path', {
          type: 'string',
          demand: true,
          description: 'Should be a JSON array of addresses',
        })
        .argv;

    const NODE_URL = args.node_url;
    log(`Using node: ${NODE_URL}`);
    const provider = new Web3.providers.HttpProvider(NODE_URL);
    const tokenDistributionWithRegistryArtifacts = TokenDistributionWithRegistryArtifactsJSON as any as Artifact;
    const contractFactory = contract(tokenDistributionWithRegistryArtifacts);
    contractFactory.setProvider(provider);
    const tokenDistributionWithRegistry = await contractFactory.deployed() as TokenDistributionWithRegistry;

    const registeringAddress = await tokenDistributionWithRegistry.owner.call();
    const registrationManager = new RegistrationManager(
        tokenDistributionWithRegistry, registeringAddress, args.gas_price);
    let batchConfig;
    if (!_.isUndefined(args.batch_size)) {
        const batchSize = Number(args.batch_size);
        const gasUsage = await registrationManager.getGasUsageByBatchSize(batchSize);
        batchConfig = {
            size: batchSize,
            gasUsage,
        };
    } else {
        log('Calculating the batch size');
        batchConfig = await registrationManager.getBatchConfigByGasLimit(args.gas_limit);
    }
    log(`Batch size: ${batchConfig.size}. Gas per batch ${batchConfig.gasUsage}`);
    const addresses = JSON.parse(fs.readFileSync(args.file_path).toString());
    log(`Number of addresses: ${addresses.length}`);

    const filteringPrompt = new Confirm('Would you like to filter out the addresses that are already registered?');
    const shouldFilter = await filteringPrompt.run();
    let unregisteredAddresses: string[] = [];
    if (shouldFilter) {
        unregisteredAddresses = await registrationManager.getUnregisteredAddresses(addresses);
    } else {
        unregisteredAddresses = addresses;
    }
    log(`Number of unregistered addresses: ${unregisteredAddresses.length}`);
    // The last chunk might be smaller than others
    const batches = _.chunk(unregisteredAddresses, batchConfig.size);
    log(`Number of batches/transactions: ${batches.length}`);

    const prompt = new Confirm('Would you like to start registering addresses?');
    const shouldRun = await prompt.run();
    if (!shouldRun) {
        return;
    }
    await registrationManager.registerAddressesInBatches(batches, batchConfig.gasUsage);
})().catch(log);
