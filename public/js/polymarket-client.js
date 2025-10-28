// Polymarket CLOB Client wrapper for frontend
class PolymarketClient {
    constructor() {
        this.clobClient = null;
        this.isInitialized = false;
    }

    // Initialize CLOB client with user's wallet
    async initialize(signer, chainId = 137) {
        if (this.isInitialized) return;

        try {
            // Polymarket работает только на Polygon (chainId 137)
            if (chainId !== 137) {
                throw new Error('Polymarket поддерживает только Polygon (chainId 137)');
            }

            console.log('Initializing Polymarket CLOB Client...');

            // Для фронтенда нам нужен только REST API
            // Реальные ставки будут через подписанные транзакции
            this.signer = signer;
            this.chainId = chainId;
            this.isInitialized = true;

            console.log('✓ Polymarket client initialized');
        } catch (error) {
            console.error('Failed to initialize Polymarket client:', error);
            throw error;
        }
    }

    // Create and submit a market order
    async createMarketOrder(tokenId, amount, side = 'BUY') {
        if (!this.isInitialized) {
            throw new Error('Client not initialized. Call initialize() first.');
        }

        try {
            console.log(`Creating ${side} order for token ${tokenId}, amount: ${amount}`);

            // 1. Get best price from orderbook
            const price = await this.getBestPrice(tokenId, side);
            
            // 2. Create order params
            const orderParams = {
                tokenID: tokenId,
                price: price,
                size: amount,
                side: side,
                feeRateBps: 0, // Fee rate in basis points
                nonce: Date.now(),
                expiration: Math.floor(Date.now() / 1000) + 86400 // 24 hours
            };

            // 3. Sign order with wallet
            const signature = await this.signOrder(orderParams);

            // 4. Submit to CLOB
            const response = await fetch('https://clob.polymarket.com/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...orderParams,
                    signature
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to create order');
            }

            console.log('✓ Order created:', result);
            return result;

        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    }

    // Get best available price for token
    async getBestPrice(tokenId, side = 'BUY') {
        try {
            const response = await fetch(`https://clob.polymarket.com/price?token_id=${tokenId}&side=${side}`);
            const data = await response.json();
            return data.price || '0.5';
        } catch (error) {
            console.error('Error getting price:', error);
            return '0.5';
        }
    }

    // Get midpoint price
    async getMidpoint(tokenId) {
        try {
            const response = await fetch(`https://clob.polymarket.com/midpoint?token_id=${tokenId}`);
            const data = await response.json();
            return data.mid || '0.5';
        } catch (error) {
            console.error('Error getting midpoint:', error);
            return '0.5';
        }
    }

    // Sign order with user's wallet
    async signOrder(orderParams) {
        try {
            // Create EIP-712 typed data for Polymarket order
            const domain = {
                name: 'Polymarket CTF Exchange',
                version: '1',
                chainId: this.chainId,
                verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' // CTF Exchange на Polygon
            };

            const types = {
                Order: [
                    { name: 'maker', type: 'address' },
                    { name: 'taker', type: 'address' },
                    { name: 'tokenId', type: 'uint256' },
                    { name: 'makerAmount', type: 'uint256' },
                    { name: 'takerAmount', type: 'uint256' },
                    { name: 'side', type: 'uint8' },
                    { name: 'feeRateBps', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'signer', type: 'address' },
                    { name: 'expiration', type: 'uint256' }
                ]
            };

            const makerAddress = await this.signer.getAddress();

            const value = {
                maker: makerAddress,
                taker: '0x0000000000000000000000000000000000000000',
                tokenId: orderParams.tokenID,
                makerAmount: ethers.utils.parseUnits(orderParams.size.toString(), 6), // USDC 6 decimals
                takerAmount: ethers.utils.parseUnits((orderParams.size / orderParams.price).toString(), 6),
                side: orderParams.side === 'BUY' ? 0 : 1,
                feeRateBps: orderParams.feeRateBps,
                nonce: orderParams.nonce,
                signer: makerAddress,
                expiration: orderParams.expiration
            };

            // Sign with EIP-712
            const signature = await this.signer._signTypedData(domain, types, value);
            return signature;

        } catch (error) {
            console.error('Error signing order:', error);
            throw error;
        }
    }

    // Approve USDC for CTF Exchange
    async approveUSDC(amount) {
        try {
            console.log('Approving USDC for CTF Exchange...');

            const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC на Polygon
            const ctfExchangeAddress = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

            const usdcContract = new ethers.Contract(
                usdcAddress,
                [
                    'function approve(address spender, uint256 amount) public returns (bool)',
                    'function allowance(address owner, address spender) public view returns (uint256)'
                ],
                this.signer
            );

            // Check current allowance
            const currentAllowance = await usdcContract.allowance(
                await this.signer.getAddress(),
                ctfExchangeAddress
            );

            const amountBN = ethers.utils.parseUnits(amount.toString(), 6);

            if (currentAllowance.lt(amountBN)) {
                console.log('Current allowance insufficient, requesting approval...');
                const tx = await usdcContract.approve(ctfExchangeAddress, amountBN);
                console.log('Approval tx sent:', tx.hash);
                
                const receipt = await tx.wait();
                console.log('✓ USDC approved:', receipt.transactionHash);
                return receipt;
            } else {
                console.log('✓ Already approved');
                return { alreadyApproved: true };
            }

        } catch (error) {
            console.error('Error approving USDC:', error);
            throw error;
        }
    }

    // Get user's orders
    async getUserOrders(address) {
        try {
            const response = await fetch(`https://clob.polymarket.com/orders?maker=${address}`);
            const data = await response.json();
            return data || [];
        } catch (error) {
            console.error('Error getting user orders:', error);
            return [];
        }
    }

    // Cancel order
    async cancelOrder(orderId) {
        try {
            console.log('Cancelling order:', orderId);

            const response = await fetch(`https://clob.polymarket.com/order/${orderId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to cancel order');
            }

            console.log('✓ Order cancelled');
            return result;

        } catch (error) {
            console.error('Error cancelling order:', error);
            throw error;
        }
    }
}

// Export global instance
const polymarketClient = new PolymarketClient();
