import type { Address } from "viem";

export interface TokenEntry {
  address: Address;
  symbol: string;
  decimals: number;
  category: "stable" | "native-wrapped" | "blue-chip" | "lsd";
}

export const NATIVE_SYMBOLS: Record<number, string> = {
  1: "ETH",
  42161: "ETH",
  8453: "ETH",
  10: "ETH",
  137: "POL",
  56: "BNB",
  43114: "AVAX",
};

export const NATIVE_DECIMALS = 18;

// ── Ethereum Mainnet (1) ────────────────────────────────────────────
const ETH_TOKENS: TokenEntry[] = [
  // Stablecoins
  { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6, category: "stable" },
  { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6, category: "stable" },
  { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18, category: "stable" },
  { address: "0x853d955aCEf822Db058eb8505911ED77F175b99e", symbol: "FRAX", decimals: 18, category: "stable" },
  { address: "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0", symbol: "LUSD", decimals: 18, category: "stable" },
  { address: "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", symbol: "crvUSD", decimals: 18, category: "stable" },
  // Wrapped native
  { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18, category: "native-wrapped" },
  // Blue chips
  { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8, category: "blue-chip" },
  { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", decimals: 18, category: "blue-chip" },
  { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", decimals: 18, category: "blue-chip" },
  { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE", decimals: 18, category: "blue-chip" },
  // LSDs
  { address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", symbol: "wstETH", decimals: 18, category: "lsd" },
  { address: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", symbol: "cbETH", decimals: 18, category: "lsd" },
  { address: "0xae78736Cd615f374D3085123A210448E74Fc6393", symbol: "rETH", decimals: 18, category: "lsd" },
];

// ── Arbitrum (42161) ────────────────────────────────────────────────
const ARB_TOKENS: TokenEntry[] = [
  // Stablecoins
  { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6, category: "stable" },
  { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6, category: "stable" },
  { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18, category: "stable" },
  { address: "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F", symbol: "FRAX", decimals: 18, category: "stable" },
  // Wrapped native
  { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18, category: "native-wrapped" },
  // Blue chips
  { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8, category: "blue-chip" },
  { address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", symbol: "LINK", decimals: 18, category: "blue-chip" },
  { address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", symbol: "UNI", decimals: 18, category: "blue-chip" },
  { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB", decimals: 18, category: "blue-chip" },
  // LSDs
  { address: "0x5979D7b546E38E9Ab8049525bA682b15187B5085", symbol: "wstETH", decimals: 18, category: "lsd" },
  { address: "0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8", symbol: "rETH", decimals: 18, category: "lsd" },
];

// ── Base (8453) ─────────────────────────────────────────────────────
const BASE_TOKENS: TokenEntry[] = [
  // Stablecoins
  { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, category: "stable" },
  { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18, category: "stable" },
  // Wrapped native
  { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, category: "native-wrapped" },
  // Blue chips
  { address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", symbol: "LINK", decimals: 18, category: "blue-chip" },
  // LSDs
  { address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", symbol: "wstETH", decimals: 18, category: "lsd" },
  { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol: "cbETH", decimals: 18, category: "lsd" },
];

// ── Optimism (10) ───────────────────────────────────────────────────
const OP_TOKENS: TokenEntry[] = [
  // Stablecoins
  { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6, category: "stable" },
  { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", decimals: 6, category: "stable" },
  { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18, category: "stable" },
  // Wrapped native
  { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, category: "native-wrapped" },
  // Blue chips
  { address: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6", symbol: "LINK", decimals: 18, category: "blue-chip" },
  { address: "0x4200000000000000000000000000000000000042", symbol: "OP", decimals: 18, category: "blue-chip" },
  // LSDs
  { address: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb", symbol: "wstETH", decimals: 18, category: "lsd" },
  { address: "0x9Bcef72be871e61ED4fBbc7630889beE758eb81D", symbol: "rETH", decimals: 18, category: "lsd" },
];

// ── Polygon (137) ───────────────────────────────────────────────────
const POLYGON_TOKENS: TokenEntry[] = [
  // Stablecoins
  { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6, category: "stable" },
  { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6, category: "stable" },
  { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", decimals: 18, category: "stable" },
  // Wrapped native
  { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WPOL", decimals: 18, category: "native-wrapped" },
  { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18, category: "native-wrapped" },
  // Blue chips
  { address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", symbol: "WBTC", decimals: 8, category: "blue-chip" },
  { address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", symbol: "LINK", decimals: 18, category: "blue-chip" },
  { address: "0xb33EaAd8d922B1083446DC23f610c2567fB5180f", symbol: "UNI", decimals: 18, category: "blue-chip" },
  { address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B", symbol: "AAVE", decimals: 18, category: "blue-chip" },
  // LSDs
  { address: "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD", symbol: "wstETH", decimals: 18, category: "lsd" },
];

// ── BNB Chain (56) ──────────────────────────────────────────────────
const BNB_TOKENS: TokenEntry[] = [
  // Stablecoins
  { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18, category: "stable" },
  { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18, category: "stable" },
  { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", symbol: "DAI", decimals: 18, category: "stable" },
  // Wrapped native
  { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18, category: "native-wrapped" },
  { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH", decimals: 18, category: "native-wrapped" },
  // Blue chips
  { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", symbol: "BTCB", decimals: 18, category: "blue-chip" },
  { address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", symbol: "LINK", decimals: 18, category: "blue-chip" },
  { address: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1", symbol: "UNI", decimals: 18, category: "blue-chip" },
];

// ── Avalanche (43114) ───────────────────────────────────────────────
const AVAX_TOKENS: TokenEntry[] = [
  // Stablecoins
  { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC", decimals: 6, category: "stable" },
  { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", symbol: "USDT", decimals: 6, category: "stable" },
  { address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", symbol: "DAI.e", decimals: 18, category: "stable" },
  // Wrapped native
  { address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", symbol: "WAVAX", decimals: 18, category: "native-wrapped" },
  { address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", symbol: "WETH.e", decimals: 18, category: "native-wrapped" },
  // Blue chips
  { address: "0x50b7545627a5162F82A992c33b87aDc75187B218", symbol: "WBTC.e", decimals: 8, category: "blue-chip" },
  { address: "0x5947BB275c521040051D82396571570b62B15360", symbol: "LINK.e", decimals: 18, category: "blue-chip" },
];

// ── Registry ────────────────────────────────────────────────────────

export const ELIGIBLE_TOKENS: Record<number, TokenEntry[]> = {
  1: ETH_TOKENS,
  42161: ARB_TOKENS,
  8453: BASE_TOKENS,
  10: OP_TOKENS,
  137: POLYGON_TOKENS,
  56: BNB_TOKENS,
  43114: AVAX_TOKENS,
};

export function getEligibleTokens(chainId: number): TokenEntry[] {
  return ELIGIBLE_TOKENS[chainId] ?? [];
}
