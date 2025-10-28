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

// Derive API credentials from signature
app.post('/api/derive-api-key', async (req, res) => {
    try {
        const { address, nonce, signature } = req.body;
        
        console.log('� Deriving API credentials for:', address);
        
        // Polymarket uses deterministic API key derivation from signature
        // We need to hash the signature to create API credentials
        const crypto = require('crypto');
        const ethers = require('ethers');
        
        // Derive deterministic credentials from signature
        const hash = crypto.createHash('sha256').update(signature).digest('hex');
        
        const apiKey = hash.substring(0, 32);
        const apiSecret = hash.substring(32, 64);
        const apiPassphrase = crypto.createHash('sha256').update(hash).digest('hex').substring(0, 16);
        
        console.log('✅ API credentials derived');
        
        res.json({
            apiKey,
            apiSecret,
            apiPassphrase
        });
        
    } catch (error) {
        console.error('❌ Error deriving credentials:', error.message);
        res.status(500).json({
            error: error.message
        });
    }
});

// Proxy endpoint для размещения ставок в Polymarket
app.post('/api/place-order', async (req, res) => {
    try {
        const { order, signature, owner } = req.body;
        
        console.log('📤 Placing order in Polymarket CLOB:');
        console.log('  Owner:', owner);
        console.log('  Maker:', order.maker);
        console.log('  Token ID:', order.tokenId);
        console.log('  Side:', order.side);
        
        // Prepare order payload for Polymarket CLOB
        const payload = {
            orderType: 'FOK',
            signature: signature,
            owner: owner,
            ...order
        };
        
        console.log('Sending to Polymarket CLOB API...');
        
        // Send directly to Polymarket CLOB API
        const response = await axios.post(
            'https://clob.polymarket.com/order',
            payload,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        console.log('✅ Order placed successfully!');
        console.log('  Result:', response.data);
        
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Error placing order:');
        
        if (error.response) {
            console.error('  Status:', error.response.status);
            console.error('  Data:', error.response.data);
            res.status(error.response.status).json({
                error: error.response.data.error || error.response.data.message || 'Polymarket API error',
                details: error.response.data
            });
        } else {
            console.error('  Error:', error.message);
            res.status(500).json({
                error: error.message
            });
        }
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