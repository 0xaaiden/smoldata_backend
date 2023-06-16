import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import serviceAccount from './indexsc-80164-firebase-adminsdk-316pn-04b930921d.json' assert { type: "json" };
import { getStorage } from 'firebase-admin/storage';
import { Worker, workerData } from 'worker_threads';
import chalk from 'chalk';
import path from 'path';

const MAX_WORKERS = 4;
const workerPool = [];
const messageQueue = [];

const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://indexsc-80164-default-rtdb.firebaseio.com",
  storageBucket: "indexsc-80164.appspot.com",

});

const db = getDatabase(app);

const processNextMessageInQueue = () => {
  if (messageQueue.length > 0 && workerPool.length < MAX_WORKERS) {
    const { message, messageKey } = messageQueue.shift();
    console.log(chalk.bgYellowBright('Processing message from queue'), messageKey);
    startWorker();
    const worker = workerPool[workerPool.length - 1];
    worker.postMessage({ message, messageKey });
  }
};

const startWorker = () => {
  const worker = new Worker(path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'worker.js'
  ), {
    workerData,
  });
  const workerId = worker.threadId;
  console.log(chalk.green(`Starting worker ${worker.threadId}`));

  worker.on('message', (result) => {
    console.log(chalk.green('✔'), chalk.bgYellowBright(`Message returned from worker ${workerId}`), result);
    workerPool.splice(workerPool.indexOf(worker), 1);
    // update firestore database

    processNextMessageInQueue();
  });
  worker.on('error', (error) => {
    console.error(chalk.red('✖'), chalk.bgRedBright(`Error in worker ${workerId}`), error);
    workerPool.splice(workerPool.indexOf(worker), 1);
    processNextMessageInQueue();
  });
  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(chalk.red('✖'), chalk.bgRedBright(`Worker ${workerId} stopped with exit code ${code}`));
    }
    workerPool.splice(workerPool.indexOf(worker), 1);
    processNextMessageInQueue();
  });
  workerPool.push(worker);
};



const startListener = () => {
  const messagesRef = db.ref('messages');
  messagesRef.on('child_added', async (snapshot) => {
    const message = snapshot.val();

    if (message.status === 'pending') {
      const messageKey = snapshot.key; // Get the key of the message
      console.log(chalk.bgYellowBright('Processing message'), messageKey);
      if (workerPool.length < MAX_WORKERS) {
        startWorker();

        // Update message status to processing
        // await snapshot.ref.update({ status: 'processing' });
        const worker = workerPool[workerPool.length - 1];
        worker.postMessage({ message, messageKey });

      } else {
        console.log(chalk.bgYellowBright('Worker pool is full, adding message to queue'));
        messageQueue.push({ message, messageKey });
      }
    }
  });
};

startListener();