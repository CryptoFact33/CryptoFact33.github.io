import {
  createPublicClient,
  http,
  formatUnits,
  getAddress,
  parseAbiItem,
  type Address,
  type Chain,
} from "viem";
import {
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  bsc,
  avalanche,
} from "viem/chains";
import { NETWORK_META } from "../config/networks";

/* ------------------------------------------------------------------ */
/*  Exported Types                                                     */
/* ------------------------------------------------------------------ */

export type AssetKind = "native" | "erc20" | "erc721" | "erc1155";

export interface DiscoveredAsset {
  kind: AssetKind;
  chainId: number;
  chainName: string;
  chainColor: string;
  contractAddress: Address | null;
  tokenId: string | null;
  symbol: string;
  name: string;
  decimals: number;
  rawBalance: string;
  formattedBalance: string;
  usdPrice: number | null;
  usdValue: number | null;
}

export interface ChainError {
  chainId: number;
  chainName: string;
  message: string;
}

export interface AssetManifest {
  owner: Address;
  discoveredAt: number;
  totalUsdValue: number;
  assets: DiscoveredAsset[];
  errors: ChainError[];
}

export interface DiscoveryOptions {
  lookbackBlocks?: number;
  includeNfts?: boolean;
  fetchPrices?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Chain Configuration                                                */
/* ------------------------------------------------------------------ */

interface ChainConfig {
  viemChain: Chain;
  rpcUrl: string;
  nativeSymbol: string;
  nativeName: string;
  coingeckoPlatform: string;
  coingeckoNativeId: string;
  logChunkSize: number;
  defaultLookback: number;
}

const CHAIN_CONFIGS: ChainConfig[] = [
  {
    viemChain: mainnet,
    rpcUrl: "https://eth.llamarpc.com",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    coingeckoPlatform: "ethereum",
    coingeckoNativeId: "ethereum",
    logChunkSize: 2_000,
    defaultLookback: 50_000,
  },
  {
    viemChain: arbitrum,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    coingeckoPlatform: "arbitrum-one",
    coingeckoNativeId: "ethereum",
    logChunkSize: 50_000,
    defaultLookback: 500_000,
  },
  {
    viemChain: base,
    rpcUrl: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    coingeckoPlatform: "base",
    coingeckoNativeId: "ethereum",
    logChunkSize: 10_000,
    defaultLookback: 500_000,
  },
  {
    viemChain: optimism,
    rpcUrl: "https://mainnet.optimism.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    coingeckoPlatform: "optimistic-ethereum",
    coingeckoNativeId: "ethereum",
    logChunkSize: 10_000,
    defaultLookback: 500_000,
  },
  {
    viemChain: polygon,
    rpcUrl: "https://polygon-rpc.com",
    nativeSymbol: "POL",
    nativeName: "POL",
    coingeckoPlatform: "polygon-pos",
    coingeckoNativeId: "matic-network",
    logChunkSize: 3_500,
    defaultLookback: 100_000,
  },
  {
    viemChain: bsc,
    rpcUrl: "https://bsc-dataseed.bnbchain.org",
    nativeSymbol: "BNB",
    nativeName: "BNB",
    coingeckoPlatform: "binance-smart-chain",
    coingeckoNativeId: "binancecoin",
    logChunkSize: 5_000,
    defaultLookback: 100_000,
  },
  {
    viemChain: avalanche,
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    nativeSymbol: "AVAX",
    nativeName: "Avalanche",
    coingeckoPlatform: "avalanche",
    coingeckoNativeId: "avalanche-2",
    logChunkSize: 2_048,
    defaultLookback: 100_000,
  },
];

/* ------------------------------------------------------------------ */
/*  ABI Fragments                                                      */
/* ------------------------------------------------------------------ */

const ERC20_ABI = [
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const ERC721_ABI = [
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
] as const;

const ERC1155_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "id" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Event Definitions                                                  */
/* ------------------------------------------------------------------ */

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

const transferSingleEvent = parseAbiItem(
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
);

const transferBatchEvent = parseAbiItem(
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MULTICALL_BATCH = 80;
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function chainMeta(chainId: number, fallbackName: string) {
  const meta = NETWORK_META[chainId];
  return {
    chainName: meta?.name ?? fallbackName,
    chainColor: meta?.color ?? "#888888",
  };
}

async function scanLogs<T>(
  fn: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: number,
): Promise<T[]> {
  const all: T[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const end =
      cursor + BigInt(chunkSize) - 1n > toBlock
        ? toBlock
        : cursor + BigInt(chunkSize) - 1n;
    try {
      all.push(...(await fn(cursor, end)));
    } catch {
      // Failed chunk (rate limit, timeout) — skip and continue
    }
    cursor = end + 1n;
  }
  return all;
}

/* ------------------------------------------------------------------ */
/*  Native Balance                                                     */
/* ------------------------------------------------------------------ */

async function fetchNativeBalance(
  client: ReturnType<typeof createPublicClient>,
  config: ChainConfig,
  owner: Address,
): Promise<DiscoveredAsset | null> {
  const balance = await client.getBalance({ address: owner });
  if (balance === 0n) return null;

  const { chainName, chainColor } = chainMeta(
    config.viemChain.id,
    config.viemChain.name,
  );
  return {
    kind: "native",
    chainId: config.viemChain.id,
    chainName,
    chainColor,
    contractAddress: null,
    tokenId: null,
    symbol: config.nativeSymbol,
    name: config.nativeName,
    decimals: 18,
    rawBalance: balance.toString(),
    formattedBalance: formatUnits(balance, 18),
    usdPrice: null,
    usdValue: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Transfer Log Scanning (shared ERC-20 + ERC-721)                    */
/* ------------------------------------------------------------------ */

interface TransferScanResult {
  erc20Contracts: Set<Address>;
  erc721Candidates: Map<string, { contract: Address; tokenId: bigint }>;
}

async function scanTransferLogs(
  client: ReturnType<typeof createPublicClient>,
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: number,
): Promise<TransferScanResult> {
  const logs = await scanLogs(
    (from, to) =>
      client.getLogs({
        event: transferEvent,
        args: { to: owner },
        fromBlock: from,
        toBlock: to,
      }),
    fromBlock,
    toBlock,
    chunkSize,
  );

  const erc20Contracts = new Set<Address>();
  const erc721Candidates = new Map<
    string,
    { contract: Address; tokenId: bigint }
  >();

  for (const log of logs) {
    const topics = log.topics as readonly `0x${string}`[];
    if (topics.length === 3) {
      erc20Contracts.add(getAddress(log.address));
    } else if (topics.length === 4) {
      const contract = getAddress(log.address);
      const tokenId = BigInt(topics[3]);
      erc721Candidates.set(`${contract}:${tokenId}`, { contract, tokenId });
    }
  }

  return { erc20Contracts, erc721Candidates };
}

/* ------------------------------------------------------------------ */
/*  ERC-20 Resolution                                                  */
/* ------------------------------------------------------------------ */

async function resolveErc20(
  client: ReturnType<typeof createPublicClient>,
  config: ChainConfig,
  owner: Address,
  contracts: Set<Address>,
): Promise<DiscoveredAsset[]> {
  if (contracts.size === 0) return [];

  const tokens = [...contracts];
  const { chainName, chainColor } = chainMeta(
    config.viemChain.id,
    config.viemChain.name,
  );
  const assets: DiscoveredAsset[] = [];

  for (let i = 0; i < tokens.length; i += MULTICALL_BATCH) {
    const batch = tokens.slice(i, i + MULTICALL_BATCH);
    const calls = batch.flatMap((addr) => [
      { address: addr, abi: ERC20_ABI, functionName: "symbol" as const },
      { address: addr, abi: ERC20_ABI, functionName: "name" as const },
      { address: addr, abi: ERC20_ABI, functionName: "decimals" as const },
      {
        address: addr,
        abi: ERC20_ABI,
        functionName: "balanceOf" as const,
        args: [owner] as const,
      },
    ]);

    const results = await client.multicall({
      contracts: calls,
      allowFailure: true,
    });

    for (let j = 0; j < batch.length; j++) {
      const idx = j * 4;
      const symRes = results[idx];
      const nameRes = results[idx + 1];
      const decRes = results[idx + 2];
      const balRes = results[idx + 3];

      if (balRes.status !== "success") continue;
      const balance = balRes.result as bigint;
      if (balance === 0n) continue;

      const symbol =
        symRes.status === "success" ? String(symRes.result) : "???";
      const name =
        nameRes.status === "success" ? String(nameRes.result) : "Unknown Token";
      const decimals =
        decRes.status === "success" ? Number(decRes.result) : 18;

      assets.push({
        kind: "erc20",
        chainId: config.viemChain.id,
        chainName,
        chainColor,
        contractAddress: batch[j],
        tokenId: null,
        symbol,
        name,
        decimals,
        rawBalance: balance.toString(),
        formattedBalance: formatUnits(balance, decimals),
        usdPrice: null,
        usdValue: null,
      });
    }
  }

  return assets;
}

/* ------------------------------------------------------------------ */
/*  ERC-721 Resolution                                                 */
/* ------------------------------------------------------------------ */

async function resolveErc721(
  client: ReturnType<typeof createPublicClient>,
  config: ChainConfig,
  owner: Address,
  candidates: Map<string, { contract: Address; tokenId: bigint }>,
): Promise<DiscoveredAsset[]> {
  if (candidates.size === 0) return [];

  const entries = [...candidates.values()];
  const { chainName, chainColor } = chainMeta(
    config.viemChain.id,
    config.viemChain.name,
  );
  const assets: DiscoveredAsset[] = [];

  for (let i = 0; i < entries.length; i += MULTICALL_BATCH) {
    const batch = entries.slice(i, i + MULTICALL_BATCH);
    const calls = batch.flatMap(({ contract, tokenId }) => [
      {
        address: contract,
        abi: ERC721_ABI,
        functionName: "ownerOf" as const,
        args: [tokenId] as const,
      },
      { address: contract, abi: ERC721_ABI, functionName: "name" as const },
      { address: contract, abi: ERC721_ABI, functionName: "symbol" as const },
    ]);

    const results = await client.multicall({
      contracts: calls,
      allowFailure: true,
    });

    for (let j = 0; j < batch.length; j++) {
      const idx = j * 3;
      const ownerRes = results[idx];
      const nameRes = results[idx + 1];
      const symRes = results[idx + 2];

      if (ownerRes.status !== "success") continue;
      const currentOwner = String(ownerRes.result).toLowerCase();
      if (currentOwner !== owner.toLowerCase()) continue;

      const name =
        nameRes.status === "success" ? String(nameRes.result) : "Unknown NFT";
      const symbol =
        symRes.status === "success" ? String(symRes.result) : "NFT";

      assets.push({
        kind: "erc721",
        chainId: config.viemChain.id,
        chainName,
        chainColor,
        contractAddress: batch[j].contract,
        tokenId: batch[j].tokenId.toString(),
        symbol,
        name,
        decimals: 0,
        rawBalance: "1",
        formattedBalance: "1",
        usdPrice: null,
        usdValue: null,
      });
    }
  }

  return assets;
}

/* ------------------------------------------------------------------ */
/*  ERC-1155 Discovery                                                 */
/* ------------------------------------------------------------------ */

async function discoverErc1155(
  client: ReturnType<typeof createPublicClient>,
  config: ChainConfig,
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<DiscoveredAsset[]> {
  const [singleLogs, batchLogs] = await Promise.all([
    scanLogs(
      (from, to) =>
        client.getLogs({
          event: transferSingleEvent,
          args: { to: owner },
          fromBlock: from,
          toBlock: to,
        }),
      fromBlock,
      toBlock,
      config.logChunkSize,
    ),
    scanLogs(
      (from, to) =>
        client.getLogs({
          event: transferBatchEvent,
          args: { to: owner },
          fromBlock: from,
          toBlock: to,
        }),
      fromBlock,
      toBlock,
      config.logChunkSize,
    ),
  ]);

  const candidates = new Map<
    string,
    { contract: Address; tokenId: bigint }
  >();

  for (const log of singleLogs) {
    const contract = getAddress(log.address);
    const id = log.args.id as bigint;
    candidates.set(`${contract}:${id}`, { contract, tokenId: id });
  }

  for (const log of batchLogs) {
    const contract = getAddress(log.address);
    const ids = log.args.ids as bigint[];
    for (const id of ids) {
      candidates.set(`${contract}:${id}`, { contract, tokenId: id });
    }
  }

  if (candidates.size === 0) return [];

  const entries = [...candidates.values()];
  const { chainName, chainColor } = chainMeta(
    config.viemChain.id,
    config.viemChain.name,
  );
  const assets: DiscoveredAsset[] = [];

  for (let i = 0; i < entries.length; i += MULTICALL_BATCH) {
    const batch = entries.slice(i, i + MULTICALL_BATCH);
    const calls = batch.map(({ contract, tokenId }) => ({
      address: contract,
      abi: ERC1155_ABI,
      functionName: "balanceOf" as const,
      args: [owner, tokenId] as const,
    }));

    const results = await client.multicall({
      contracts: calls,
      allowFailure: true,
    });

    for (let j = 0; j < batch.length; j++) {
      const res = results[j];
      if (res.status !== "success") continue;
      const balance = res.result as bigint;
      if (balance === 0n) continue;

      assets.push({
        kind: "erc1155",
        chainId: config.viemChain.id,
        chainName,
        chainColor,
        contractAddress: batch[j].contract,
        tokenId: batch[j].tokenId.toString(),
        symbol: "ERC1155",
        name: `ERC-1155 #${batch[j].tokenId}`,
        decimals: 0,
        rawBalance: balance.toString(),
        formattedBalance: balance.toString(),
        usdPrice: null,
        usdValue: null,
      });
    }
  }

  return assets;
}

/* ------------------------------------------------------------------ */
/*  USD Pricing (CoinGecko)                                            */
/* ------------------------------------------------------------------ */

async function fetchUsdPrices(
  assets: DiscoveredAsset[],
): Promise<void> {
  const nativeIds = new Set<string>();
  for (const cfg of CHAIN_CONFIGS) nativeIds.add(cfg.coingeckoNativeId);

  // Native token prices — one batch call
  try {
    const ids = [...nativeIds].join(",");
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd`,
    );
    if (res.ok) {
      const data: Record<string, { usd?: number }> = await res.json();
      for (const cfg of CHAIN_CONFIGS) {
        const price = data[cfg.coingeckoNativeId]?.usd;
        if (typeof price !== "number") continue;
        for (const asset of assets) {
          if (asset.kind === "native" && asset.chainId === cfg.viemChain.id) {
            asset.usdPrice = price;
            asset.usdValue = price * parseFloat(asset.formattedBalance);
          }
        }
      }
    }
  } catch {
    // Pricing is best-effort
  }

  // ERC-20 token prices — one call per chain
  const tokensByChain = new Map<number, Set<string>>();
  for (const asset of assets) {
    if (asset.kind !== "erc20" || !asset.contractAddress) continue;
    let set = tokensByChain.get(asset.chainId);
    if (!set) {
      set = new Set();
      tokensByChain.set(asset.chainId, set);
    }
    set.add(asset.contractAddress.toLowerCase());
  }

  for (const cfg of CHAIN_CONFIGS) {
    const addrs = tokensByChain.get(cfg.viemChain.id);
    if (!addrs || addrs.size === 0) continue;

    try {
      const list = [...addrs].join(",");
      const res = await fetch(
        `${COINGECKO_BASE}/simple/token_price/${cfg.coingeckoPlatform}?contract_addresses=${list}&vs_currencies=usd`,
      );
      if (!res.ok) continue;
      const data: Record<string, { usd?: number }> = await res.json();

      for (const asset of assets) {
        if (
          asset.kind !== "erc20" ||
          asset.chainId !== cfg.viemChain.id ||
          !asset.contractAddress
        )
          continue;
        const price = data[asset.contractAddress.toLowerCase()]?.usd;
        if (typeof price === "number") {
          asset.usdPrice = price;
          asset.usdValue = price * parseFloat(asset.formattedBalance);
        }
      }
    } catch {
      // Pricing is best-effort
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Per-Chain Orchestrator                                              */
/* ------------------------------------------------------------------ */

async function discoverChainAssets(
  config: ChainConfig,
  owner: Address,
  opts: Required<DiscoveryOptions>,
): Promise<DiscoveredAsset[]> {
  const client = createPublicClient({
    chain: config.viemChain,
    transport: http(config.rpcUrl),
    batch: { multicall: true },
  });

  const latestBlock = await client.getBlockNumber();
  const lookback = BigInt(
    opts.lookbackBlocks || config.defaultLookback,
  );
  const fromBlock = latestBlock > lookback ? latestBlock - lookback : 0n;

  // Native balance + Transfer log scan run in parallel
  const [nativeAsset, transferScan] = await Promise.all([
    fetchNativeBalance(client, config, owner),
    scanTransferLogs(client, owner, fromBlock, latestBlock, config.logChunkSize),
  ]);

  const assets: DiscoveredAsset[] = [];
  if (nativeAsset) assets.push(nativeAsset);

  // Resolve discovered contracts via multicall
  const tasks: Promise<DiscoveredAsset[]>[] = [
    resolveErc20(client, config, owner, transferScan.erc20Contracts),
  ];

  if (opts.includeNfts) {
    tasks.push(
      resolveErc721(client, config, owner, transferScan.erc721Candidates),
      discoverErc1155(client, config, owner, fromBlock, latestBlock),
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "fulfilled") {
      assets.push(...result.value);
    }
  }

  return assets;
}

/* ------------------------------------------------------------------ */
/*  Main Export                                                        */
/* ------------------------------------------------------------------ */

const DEFAULTS: Required<DiscoveryOptions> = {
  lookbackBlocks: 0,
  includeNfts: true,
  fetchPrices: true,
};

export async function discoverAssets(
  owner: Address,
  options?: DiscoveryOptions,
): Promise<AssetManifest> {
  const opts = { ...DEFAULTS, ...options };
  const checksummed = getAddress(owner);
  const errors: ChainError[] = [];

  const chainResults = await Promise.allSettled(
    CHAIN_CONFIGS.map((cfg) => discoverChainAssets(cfg, checksummed, opts)),
  );

  const allAssets: DiscoveredAsset[] = [];
  for (let i = 0; i < chainResults.length; i++) {
    const result = chainResults[i];
    const cfg = CHAIN_CONFIGS[i];
    if (result.status === "fulfilled") {
      allAssets.push(...result.value);
    } else {
      const { chainName } = chainMeta(cfg.viemChain.id, cfg.viemChain.name);
      errors.push({
        chainId: cfg.viemChain.id,
        chainName,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }

  if (opts.fetchPrices && allAssets.length > 0) {
    try {
      await fetchUsdPrices(allAssets);
    } catch {
      // Pricing failure is non-fatal
    }
  }

  allAssets.sort((a, b) => {
    if (a.usdValue != null && b.usdValue != null)
      return b.usdValue - a.usdValue;
    if (a.usdValue != null) return -1;
    if (b.usdValue != null) return 1;
    return 0;
  });

  return {
    owner: checksummed,
    discoveredAt: Date.now(),
    totalUsdValue: allAssets.reduce((sum, a) => sum + (a.usdValue ?? 0), 0),
    assets: allAssets,
    errors,
  };
}
