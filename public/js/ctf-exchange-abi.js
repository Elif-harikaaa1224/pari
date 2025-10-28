// CTF Exchange Contract ABI
// Address: 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E (Polygon)

const CTF_EXCHANGE_ABI = [
    // fillOrder - основная функция для исполнения ордера
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "salt", "type": "uint256" },
                    { "internalType": "address", "name": "maker", "type": "address" },
                    { "internalType": "address", "name": "signer", "type": "address" },
                    { "internalType": "address", "name": "taker", "type": "address" },
                    { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
                    { "internalType": "uint256", "name": "makerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "takerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "expiration", "type": "uint256" },
                    { "internalType": "uint256", "name": "nonce", "type": "uint256" },
                    { "internalType": "uint256", "name": "feeRateBps", "type": "uint256" },
                    { "internalType": "uint8", "name": "side", "type": "uint8" },
                    { "internalType": "uint8", "name": "signatureType", "type": "uint8" }
                ],
                "internalType": "struct Order",
                "name": "order",
                "type": "tuple"
            },
            {
                "internalType": "bytes",
                "name": "signature",
                "type": "bytes"
            },
            {
                "internalType": "uint256",
                "name": "fillAmount",
                "type": "uint256"
            }
        ],
        "name": "fillOrder",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "makerFilledAmount",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    
    // matchOrders - сопоставление двух ордеров (buy + sell)
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "salt", "type": "uint256" },
                    { "internalType": "address", "name": "maker", "type": "address" },
                    { "internalType": "address", "name": "signer", "type": "address" },
                    { "internalType": "address", "name": "taker", "type": "address" },
                    { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
                    { "internalType": "uint256", "name": "makerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "takerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "expiration", "type": "uint256" },
                    { "internalType": "uint256", "name": "nonce", "type": "uint256" },
                    { "internalType": "uint256", "name": "feeRateBps", "type": "uint256" },
                    { "internalType": "uint8", "name": "side", "type": "uint8" },
                    { "internalType": "uint8", "name": "signatureType", "type": "uint8" }
                ],
                "internalType": "struct Order",
                "name": "takerOrder",
                "type": "tuple"
            },
            {
                "internalType": "bytes",
                "name": "takerSignature",
                "type": "bytes"
            },
            {
                "components": [
                    { "internalType": "uint256", "name": "salt", "type": "uint256" },
                    { "internalType": "address", "name": "maker", "type": "address" },
                    { "internalType": "address", "name": "signer", "type": "address" },
                    { "internalType": "address", "name": "taker", "type": "address" },
                    { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
                    { "internalType": "uint256", "name": "makerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "takerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "expiration", "type": "uint256" },
                    { "internalType": "uint256", "name": "nonce", "type": "uint256" },
                    { "internalType": "uint256", "name": "feeRateBps", "type": "uint256" },
                    { "internalType": "uint8", "name": "side", "type": "uint8" },
                    { "internalType": "uint8", "name": "signatureType", "type": "uint8" }
                ],
                "internalType": "struct Order",
                "name": "makerOrder",
                "type": "tuple"
            },
            {
                "internalType": "bytes",
                "name": "makerSignature",
                "type": "bytes"
            }
        ],
        "name": "matchOrders",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    
    // getOrderStatus - проверка статуса ордера
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "orderHash",
                "type": "bytes32"
            }
        ],
        "name": "getOrderStatus",
        "outputs": [
            {
                "components": [
                    { "internalType": "bool", "name": "isFilledOrCancelled", "type": "bool" },
                    { "internalType": "uint256", "name": "remaining", "type": "uint256" }
                ],
                "internalType": "struct OrderStatus",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    
    // hashOrder - получение хеша ордера для EIP-712
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "salt", "type": "uint256" },
                    { "internalType": "address", "name": "maker", "type": "address" },
                    { "internalType": "address", "name": "signer", "type": "address" },
                    { "internalType": "address", "name": "taker", "type": "address" },
                    { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
                    { "internalType": "uint256", "name": "makerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "takerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "expiration", "type": "uint256" },
                    { "internalType": "uint256", "name": "nonce", "type": "uint256" },
                    { "internalType": "uint256", "name": "feeRateBps", "type": "uint256" },
                    { "internalType": "uint8", "name": "side", "type": "uint8" },
                    { "internalType": "uint8", "name": "signatureType", "type": "uint8" }
                ],
                "internalType": "struct Order",
                "name": "order",
                "type": "tuple"
            }
        ],
        "name": "hashOrder",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    
    // cancelOrder - отмена ордера
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "salt", "type": "uint256" },
                    { "internalType": "address", "name": "maker", "type": "address" },
                    { "internalType": "address", "name": "signer", "type": "address" },
                    { "internalType": "address", "name": "taker", "type": "address" },
                    { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
                    { "internalType": "uint256", "name": "makerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "takerAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "expiration", "type": "uint256" },
                    { "internalType": "uint256", "name": "nonce", "type": "uint256" },
                    { "internalType": "uint256", "name": "feeRateBps", "type": "uint256" },
                    { "internalType": "uint8", "name": "side", "type": "uint8" },
                    { "internalType": "uint8", "name": "signatureType", "type": "uint8" }
                ],
                "internalType": "struct Order",
                "name": "order",
                "type": "tuple"
            }
        ],
        "name": "cancelOrder",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const CTF_EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
