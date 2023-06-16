
# High Performance Ethereum Indexer

Syncs events from Ethereum and indexes them for fast retrieval. This is useful and often essential for production Dapps.

* Support for 6 different persistence stores
* Includes "single-node friendly" stores such as flat-file JSON
* Comprehensive error retry logic when communicating with Ethereum node
* Maximum throughput via JSON RPC using batched parallel fetching

## Todo

- [x] Keep track of blockNumbers in persistence for fast-resume
- [x] Benchmark documentation
- [x] Support going forward syncing for Ethereum
- [x] NPM package
- [ ] Improved failsafes for data consistency
- [ ] Split up stores into separate dependencies

## Supported Indexing Stores and Benchmarks

The following indexing implementations have been benchmarked on an Ethereum blockchain section with a relatively large number of events (EtherDelta exchange blocks `4800000` - `5002718`) on a single 8-core 2017 Macbook Pro:

|Store Name         |Store ID       |Events Per Second |Blocks Per Second |
|-------------------|---------------|------------------|------------------|
|Local Memory       |`memory`       |4072.7/s          |464.5/s           |
|Redis              |`redis`        |2049.55/s         |235.25/s          |
|Local Flat File    |`file`         |1798.75/s         |201.75/s          |
|MongoDB            |`mongodb`      |795.5/s           |94.6/s            |
|Elasticsearch      |`elasticsearch`|452.25/s          |57.1/s            |
|LevelDB            |`level`        |207.35/s          |26.95/s           |

## Install Dependencies

```
yarn install
```

## Testing & Linting

```
yarn test
yarn lint
```

Integration tests (requires synced ethereum node at localhost:8545):

```
yarn test:integration
```

## Example: Sync trading and balance events from decentralized trading contract: EtherDelta

Contract address: https://etherscan.io/address/0x8d12a197cb00d4747a1fe03395095ce2a5cc6819

See `examples/etherdelta/sync.js`.

Define which events to index on which keys:

```javascript
const indexing = {
  events: {
    Withdraw: {
      keys: ['user'],
    },
    Trade: {
      keys: ['tokenGive', 'tokenGet', 'get', 'give'],
    },
  },
};
```

Then create a store:

```javascript
const store = new LevelStore(indexing, '/tmp/etherdelta.db');
```

Now boot up the indexer:

```javascript
const indexer = new Indexer(store, EtherdeltaABI, '0x8d12a197cb00d4747a1fe03395095ce2a5cc6819');
await indexer.syncAll({
  fromBlock: 4906764,
});
```

Once indexing is complete events can be retrieved as follows:

```javascript
const events = await store.get('Withdraw', 'user', '0x13d8d38421eb02973f3f923a71a27917bd483190');
```

## Directory Structure

* `package.json` - Configure dependencies
* `dist/*` - Files generated by babel
* `src` - All source code
* `src/*/__tests__` - Unit tests
* `integration/__tests__` - Integration tests
