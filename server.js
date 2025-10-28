require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const polymarketService = require('./polymarket-service');
const { ClobClient } = require('@polymarket/clob-client');

const app = express();
const PORT = process.env.PORT || 3000;
const axios = require('axios');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve ethers.js from node_modules
app.use('/libs', express.static(path.join(__dirname, 'node_modules')));

// API Routes

// Derive API key from signature using Polymarket SDK
app.post('/api/derive-api-key', async (req, res) => {
    try {
        const { address, nonce, signature } = req.body;
        
        console.log('📝 Deriving API key for address:', address);
        
        // Use Polymarket SDK to derive API credentials
        const { createL2Headers } = require('@polymarket/clob-client');
        
        // Derive credentials from signature
        const credentials = createL2Headers(
            address,
            nonce,
            signature
        );
        
        console.log('✅ API credentials derived');
        
        res.json(credentials);
        
    } catch (error) {
        console.error('❌ Error deriving API key:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// API Routes

// Derive API credentials for user using Polymarket SDK
app.post('/api/derive-api-key', async (req, res) => {
    try {
        const { address, signature, nonce } = req.body;
        
        console.log('🔑 Deriving API credentials for:', address);
        console.log('  Nonce:', nonce);
        
        // Use SDK to derive credentials from signature
        const { ClobClient } = require('@polymarket/clob-client');
        
        // Create temporary client
        const tempClient = new ClobClient(
            'https://clob.polymarket.com',
            137 // Polygon chainId
        );
        
        // Derive API key from signature
        const credentials = await tempClient.deriveApiKey(signature, nonce);
        
        console.log('✅ API credentials derived successfully');
        
        res.json(credentials);
        
    } catch (error) {
        console.error('❌ Error deriving credentials:', error.message);
        res.status(500).json({
            error: error.message,
            details: error.toString()
        });
    }
});

// Proxy endpoint для размещения ставок в Polymarket
app.post('/api/place-order', async (req, res) => {
    try {
        const { order, signature, owner, apiKey, apiSecret, apiPassphrase } = req.body;
        
        console.log('📤 Placing order in Polymarket via SDK:');
        console.log('  Owner:', owner);
        console.log('  Maker:', order.maker);
        console.log('  Token ID:', order.tokenId);
        console.log('  Side:', order.side);
        
        // Create CLOB client with user's credentials
        const clobClient = new ClobClient(
            'https://clob.polymarket.com',
            137, // Polygon chainId
            {
                key: apiKey,
                secret: apiSecret,
                passphrase: apiPassphrase
            }
        );
        
        // Post signed order
        const result = await clobClient.postOrder({
            ...order,
            signature: signature,
            owner: owner
        });
        
        console.log('✅ Order placed successfully!');
        console.log('  Result:', result);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error placing order:');
        console.error('  Error:', error.message);
        console.error('  Details:', error.response?.data || error);
        
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data || error.toString()
        });
    }
});

// Endpoint для проверки существующих ставок пользователя
app.get('/api/user-orders/:address', async (req, res) => {
    try {
        const address = req.params.address;
        const response = await axios.get(
            `https://clob.polymarket.com/orders?maker=${address}`,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching user orders:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get popular markets
app.get('/api/markets', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 150; // Увеличиваем до 150 событий
    const markets = await polymarketService.getPopularMarkets(limit);
    res.json({ success: true, data: markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get market by ID
app.get('/api/markets/:id', async (req, res) => {
  try {
    const market = await polymarketService.getMarketById(req.params.id);
    res.json({ success: true, data: market });
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user orders
app.get('/api/orders/:address', async (req, res) => {
  try {
    const orders = await polymarketService.getUserOrders(req.params.address);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get contract addresses
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      bsc: {
        chainId: process.env.BSC_CHAIN_ID,
        rpc: process.env.BSC_RPC,
        pancakeRouter: process.env.PANCAKESWAP_ROUTER,
        wbnb: process.env.WBNB_ADDRESS,
        usdt: process.env.USDT_BSC_ADDRESS,
        stargateRouter: process.env.STARGATE_ROUTER_BSC
      },
      polygon: {
        chainId: process.env.POLYGON_CHAIN_ID,
        rpc: process.env.POLYGON_RPC,
        usdc: process.env.USDC_POLYGON,
        ctfExchange: process.env.CTF_EXCHANGE,
        safeFactory: process.env.SAFE_FACTORY,
        proxyFactory: process.env.PROXY_FACTORY,
        stargateRouter: process.env.STARGATE_ROUTER_POLYGON
      }
    }
  });
});

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/bridge', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bridge.html'));
});

app.get('/markets', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'markets.html'));
});

app.get('/my-bets', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'my-bets.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 PariVision server running on http://localhost:${PORT}`);
  console.log(`📊 Markets: http://localhost:${PORT}/markets`);
  console.log(`🌉 Bridge: http://localhost:${PORT}/bridge`);
});