// Configuration loaded from backend
let CONFIG = null;

// Load config from server
async function loadConfig() {
    if (CONFIG) return CONFIG;
    
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        CONFIG = data.data;
        return CONFIG;
    } catch (error) {
        console.error('Error loading config:', error);
        throw error;
    }
}

// PancakeSwap Router ABI (minimal for swaps)
const PANCAKE_ROUTER_ABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

// ERC20 ABI (minimal)
const ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
];

// Stargate Router ABI (minimal)
const STARGATE_ROUTER_ABI = [
    "function swap(uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address payable _refundAddress, uint256 _amountLD, uint256 _minAmountLD, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes calldata _to, bytes calldata _payload) external payable",
    "function quoteLayerZeroFee(uint16 _dstChainId, uint8 _functionType, bytes calldata _toAddress, bytes calldata _transferAndCallPayload, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams) external view returns (uint256, uint256)"
];

// Constants
const POLYGON_CHAIN_ID_STARGATE = 109; // Stargate chain ID for Polygon
const USDT_POOL_ID_BSC = 2; // Stargate USDT pool ID on BSC
const USDC_POOL_ID_POLYGON = 1; // Stargate USDC pool ID on Polygon