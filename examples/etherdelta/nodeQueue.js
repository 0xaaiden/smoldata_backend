let priority = 0;

export const nodeQueue = [
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
  "https://infura.io/",
  "https://eth-mainnet.public.blastapi.io",
  "https://ethereum.publicnode.com",
  "https://cloudflare-eth.com/",
  "https://nodes.mewapi.io/rpc/eth",
  "https://eth-mainnet.nodereal.io/v1/1659dfb40aa24bbb8153a677b98064d7",
];

export function getNextNode() {
  const node = nodeQueue[priority];
  priority = (priority + 1) % nodeQueue.length;
  return node;
}
