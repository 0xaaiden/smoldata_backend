import Eth from "ethjs";
import EthQuery from "ethjs-query";
import EthAbi from "ethjs-abi";
import Web3 from "web3";
import logger from "./logger.js";
import BigNumber from "bignumber.js";

const sleep = (timeout) =>
  new Promise((accept) => setTimeout(() => accept(), timeout));

const chunk = (arr, len) => {
  const chunks = [];
  let i = 0;
  const n = arr.length;
  while (i < n) {
    chunks.push(arr.slice(i, (i += len)));
  }
  return chunks;
};

const normalizeEvent = (event) => {
  const normalizedEvent = Object.assign({}, event);
  if (typeof normalizeEvent.blockNumber === "number") {
    normalizeEvent.blockNumber = new BigNumber(normalizeEvent.blockNumber);
  }
  if (typeof normalizeEvent.transactionIndex === "number") {
    normalizeEvent.transactionIndex = new BigNumber(
      normalizeEvent.transactionIndex
    );
  }
  if (typeof normalizeEvent.logIndex === "number") {
    normalizeEvent.logIndex = new BigNumber(normalizeEvent.logIndex);
  }
  return normalizedEvent;
};

export default class Ethereum {
  constructor(abi, contractAddress, readProviderUrl = "http://127.0.0.1:8545") {
    this.readProviderUrl = readProviderUrl;
    this.contractAddress = contractAddress;
    this.readEth = new Eth(new Eth.HttpProvider(readProviderUrl));
    this.readContract = this.readEth.contract(abi).at(contractAddress);
    this.readEthQuery = new EthQuery(new Eth.HttpProvider(readProviderUrl));
    this.readWeb3 = new Web3(new Web3.providers.HttpProvider(readProviderUrl));
    const EtherdeltaContract = this.readWeb3.eth.contract(abi);
    this.readWeb3Contract = EtherdeltaContract.at(contractAddress);
    this.logDecoder = EthAbi.logDecoder(abi);
  }
  async getEventsForBlock(startBlock, endBlock, numRetries = 0) {
    const params = {
      address: this.contractAddress,
      fromBlock: startBlock,
      toBlock: endBlock,
    };
    try {
      await sleep(1); // To prevent race condition in XHR2 lib below
      const result = await this.readEthQuery.getLogs(params);
      const decodedResults = this.logDecoder(result);
      for (let i = 0; result.length > i; i += 1) {
        result[i].args = Object.assign({}, decodedResults[i]);
        result[i].event = result[i].args._eventName;
      }
      return result;
    } catch (error) {
      if (numRetries < 10) {
        logger.log(
          "warn",
          `Warning, error happened while contacting RPC, retrying (attempt ${numRetries}), error:\n ${error}`
        );
        await sleep(11000);
        return this.getEventsForBlock(startBlock, endBlock, numRetries + 1);
      }
      throw error;
    }
  }
  readNewEvents(fromBlock, fn) {
    const options = { fromBlock, toBlock: "latest" };
    const filter = this.readWeb3Contract.allEvents({}, options);
    filter.watch((error, event) => {
      const normalizedEvent = normalizeEvent(event);
      if (error) {
        logger.log(
          "warn",
          `Got error while reading realtime events from contract: ${error.message}`
        );
      } else {
        fn(normalizedEvent).then(() => {});
      }
    });
  }
  async clientStatus() {
    const syncing = await this.readEthQuery.syncing();
    const blockNumber = await this.readEthQuery.blockNumber();
    return {
      syncing,
      blockNumber,
    };
  }
  async readAllEvents(fromBlock, toBlock, { skipBlocks, batchSize }, fn) {
    const jobs = [];
    if (skipBlocks) {
      logger.log(
        "info",
        `Skipping blocks ${skipBlocks.min} to ${skipBlocks.max} (already synced)`
      );
    }
    let startBlock = fromBlock;
    let blockNumber = fromBlock;

    while (blockNumber < toBlock) {
      if (
        skipBlocks &&
        blockNumber >= skipBlocks.min &&
        blockNumber <= skipBlocks.max
      ) {
        // logger.log('info', `Skipping block ${blockNumber}, already synced`);
        // Nothing
      } else {
        jobs.push({
          total: toBlock - fromBlock,
          current: blockNumber - fromBlock,
          startBlock,
          endBlock: blockNumber,
          blockNumber,
        });
        startBlock = blockNumber + 1;
      }
      blockNumber += 2000;
    }
    if (blockNumber > toBlock) {
      jobs.push({
        total: toBlock - fromBlock,
        current: toBlock - fromBlock,
        startBlock,
        endBlock: toBlock,
        blockNumber: toBlock,
      });
    }

    const batches = chunk(jobs, batchSize || 1);
    for (const batch of batches) {
      const promises = batch.map((job) =>
        this.getEventsForBlock(job.startBlock, job.endBlock)
      );
      const results = await Promise.all(promises);
      let i = 0;
      for (const result of results) {
        await fn(result, batch[i]);
        i += 1;
      }
    }
  }
}
