
import Store from '../../src/stores/file.js';
import { Indexer } from '../../src/index.js';
import EtherdeltaABI from './abi.json' assert { type: "json" };

const sync = async () => {
  const indexing = {
    events: {
      Withdraw: {
      },
      Trade: {
        keys: [],
      }
    },
  };
  const store = new Store(indexing, './etherdelta.db');
  const indexer = new Indexer(store, EtherdeltaABI, '0x8d12a197cb00d4747a1fe03395095ce2a5cc6819', "https://eth.llamarpc.com");
  await indexer.syncAll({
    // fromBlock: 3154100,
    fromBlock: 4800000,
    batchSize: 5,
  });
};

sync().then(() => { }).catch((error) => { console.error('Fatal error', error); });
