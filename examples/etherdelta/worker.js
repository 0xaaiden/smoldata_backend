import { parentPort, workerData } from "worker_threads";
import Store from "../../src/stores/file.js";
import { Indexer } from "../../src/index.js";
import chalk from "chalk";
import EtherdeltaABI from "./abi.json" assert { type: "json" };
import db from "./firebase.js";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { bucket, firestore } from "./firebase.js";
import axios from "axios";
const processMessage = async (message, messageRef, firestoreMessageRef) => {
  const messageKey = messageRef.key; // Get the key of the message
  // console.log("message content is ", message)
  // get abi from message
  // get address from message
  const abi = JSON.parse(message.abi);
  const address = message.address;
  // get endData and startData and convert them to block numbers
  const endData = message.endDate;
  const startData = message.startDate;

  const endTimestamp = new Date(endData).getTime() / 1000;
  const startTimestamp = new Date(startData).getTime() / 1000;
  console.log(
    `endTimestamp is ${endTimestamp} and startTimestamp is ${startTimestamp}`
  );
  const endBlock = await axios
    .get(`https://coins.llama.fi/block/ethereum/${endTimestamp}`)
    .then((response) => {
      const endBlock = response.data.height;
      console.log(`Closest block number to ${endData}: ${endBlock}`);
      return response.data.height;
    })
    .catch((error) => console.error(error.response.data));

  const startBlock = await axios
    .get(`https://coins.llama.fi/block/ethereum/${startTimestamp}`)
    .then((response) => {
      const startBlock = response.data.height;
      console.log(`Closest block number to ${startData}: ${startBlock}`);
      return response.data.height;
    })
    .catch((error) => console.error(error.response.data));

  // create store
  const IndexingABI = Object.entries(message.events).reduce(
    (acc, [eventName, fields]) => {
      acc.events[eventName] = { keys: fields };
      return acc;
    },
    { events: {} }
  );

  const getNextNode = workerData.getNextNode;

  const store = new Store(IndexingABI, `./tmp/task-index-${messageKey}-db`);
  const indexer = new Indexer(store, abi, address, getNextNode);
  // register listener for syncProgress events to track progress in firestore meta field
  indexer.onSyncProgress((progress) => {
    console.log(chalk.yellow("⌛"), `Sync progress: ${progress}%`);
    messageRef.update({ meta: { progress } });

    firestoreMessageRef.update({ meta: { progress } });
  });

  await indexer.syncAll({
    // fromBlock: 3154100,
    fromBlock: startBlock,
    toBlock: endBlock,
    batchSize: 5,
  });

  // zip folder, upload to storage and update entry
  const archive = archiver("zip", { zlib: { level: 9 } });
  const output = fs.createWriteStream(
    path.join(path.resolve(), `/tmp/${messageKey}.zip`)
  );
  archive.pipe(output);
  archive.directory(
    path.join(path.resolve() + `/tmp/task-index-${messageKey}-db`),
    false
  );
  await archive.finalize();

  const file = bucket.file(`${messageKey}.zip`);
  await bucket.upload(path.join(path.resolve(), `/tmp/${messageKey}.zip`), {
    destination: `${messageKey}.zip`,
    gzip: true,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  const fileURL = await file.getSignedUrl({
    action: "read",
    expires: "03-09-2491",
  });
  const url = fileURL[0];
  // get file size
  const fileSize = fs.statSync(
    path.join(path.resolve(), `/tmp/${messageKey}.zip`)
  ).size;

  console.log(chalk.green("✔"), "Upload complete:", url);

  await messageRef.update({ url });

  await messageRef.update({ status: "completed" });

  // update firestore entry
  await firestoreMessageRef.update({ url, fileSize });
  await firestoreMessageRef.update({ status: "completed" });

  // delete folder
  fs.rmdirSync(path.join(path.resolve() + `/tmp/task-index-${messageKey}-db`), {
    recursive: true,
  });
  fs.unlinkSync(path.join(path.resolve(), `/tmp/${messageKey}.zip`));

  // await message.ref.update({ status: 'pending' });
};

parentPort.on("message", async ({ message, messageKey }) => {
  console.log(chalk.bgBlueBright("Worker received message"), messageKey);
  const messageRef = db.ref(`messages/${messageKey}`);
  const firestoreMessageRef = firestore.collection("contracts").doc(messageKey);
  // console.log("messageRef", messageRef)
  try {
    await processMessage(message, messageRef, firestoreMessageRef);
    console.log(
      chalk.green("✔"),
      chalk.bgBlueBright("Message received and ready to be posted"),
      messageKey
    );
    parentPort.postMessage({ success: true });
    process.exit(0);
  } catch (error) {
    console.error(chalk.red("✖"), error);
    parentPort.postMessage({ success: false, error: error.message });
    process.exit(1);
  }
});
