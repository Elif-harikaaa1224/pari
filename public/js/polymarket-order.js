// Polymarket Order Signer
// Creates and signs orders using EIP-712 typed data

class PolymarketOrderSigner {
    constructor() {
        this.clobApiUrl = 'https://clob.polymarket.com';
        this.ctfExchangeAddress = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
        this.chainId = 137; // Polygon
    }

    // EIP-712 Domain for Polymarket CTF Exchange
    getDomain() {
        return {
            name: 'Polymarket CTF Exchange',
            version: '1',
            chainId: this.chainId,
            verifyingContract: this.ctfExchangeAddress
        };
    }

    // EIP-712 Types for Order
    getTypes() {
        return {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'maker', type: 'address' },
                { name: 'signer', type: 'address' },
                { name: 'taker', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
                { name: 'makerAmount', type: 'uint256' },
                { name: 'takerAmount', type: 'uint256' },
                { name: 'expiration', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'feeRateBps', type: 'uint256' },
                { name: 'side', type: 'uint8' },
                { name: 'signatureType', type: 'uint8' }
            ]
        };
    }

    // Get best price from orderbook
    async getBestPrice(tokenId, side = 'BUY') {
        try {
            const response = await fetch(`${this.clobApiUrl}/book?token_id=${tokenId}`);
            const orderbook = await response.json();
            
            if (side === 'BUY') {
                // For buying, take the best ask (lowest sell price)
                if (orderbook.asks && orderbook.asks.length > 0) {
                    return parseFloat(orderbook.asks[0].price);
                }
            } else {
                // For selling, take the best bid (highest buy price)
                if (orderbook.bids && orderbook.bids.length > 0) {
                    return parseFloat(orderbook.bids[0].price);
                }
            }
            
            // Default to 0.5 if no orders
            return 0.5;

        } catch (error) {
            console.error('Error getting best price:', error);
            return 0.5;
        }
    }

    // Create order data
    async createOrderData(params) {
        const {
            tokenId,
            makerAddress,
            usdcAmount,
            side = 'BUY'
        } = params;

        try {
            // Get best market price
            const price = await this.getBestPrice(tokenId, side);
            console.log(`Best ${side} price for token ${tokenId}:`, price);

            // Calculate amounts
            const timestamp = Math.floor(Date.now() / 1000);
            const usdcAmountWei = ethers.utils.parseUnits(usdcAmount.toString(), 6); // USDC has 6 decimals
            const outcomeTokens = usdcAmount / price;
            const outcomeAmountWei = ethers.utils.parseUnits(outcomeTokens.toFixed(6), 6);

            // Build order
            const order = {
                salt: timestamp,
                maker: makerAddress,
                signer: makerAddress,
                taker: '0x0000000000000000000000000000000000000000', // Anyone can take
                tokenId: tokenId,
                makerAmount: side === 'BUY' ? usdcAmountWei.toString() : outcomeAmountWei.toString(),
                takerAmount: side === 'BUY' ? outcomeAmountWei.toString() : usdcAmountWei.toString(),
                expiration: timestamp + 86400, // 24 hours
                nonce: timestamp,
                feeRateBps: '0',
                side: side === 'BUY' ? 0 : 1,
                signatureType: 0 // EOA
            };

            return { order, price, outcomeTokens };

        } catch (error) {
            console.error('Error creating order data:', error);
            throw error;
        }
    }

    // Sign order with EIP-712
    async signOrder(order, signerAddress) {
        try {
            console.log('Signing order with EIP-712...');

            const domain = this.getDomain();
            const types = this.getTypes();

            // Используем eth_signTypedData_v4 напрямую, чтобы избежать переключения сети
            const typedData = {
                types: {
                    EIP712Domain: [
                        { name: 'name', type: 'string' },
                        { name: 'version', type: 'string' },
                        { name: 'chainId', type: 'uint256' },
                        { name: 'verifyingContract', type: 'address' }
                    ],
                    Order: types.Order
                },
                primaryType: 'Order',
                domain: domain,
                message: order
            };

            console.log('Requesting signature from wallet...');
            const signature = await window.ethereum.request({
                method: 'eth_signTypedData_v4',
                params: [signerAddress, JSON.stringify(typedData)]
            });
            
            console.log('✓ Order signed');
            return signature;

        } catch (error) {
            console.error('Error signing order:', error);
            throw error;
        }
    }

    // Post order to Polymarket CLOB
    async postOrder(order, signature, ownerAddress) {
        try {
            console.log('📤 Sending order to Polymarket...');

            const payload = {
                order: {
                    salt: parseInt(order.salt),
                    maker: order.maker,
                    signer: order.signer,
                    taker: order.taker,
                    tokenId: order.tokenId,
                    makerAmount: order.makerAmount,
                    takerAmount: order.takerAmount,
                    expiration: parseInt(order.expiration),
                    nonce: parseInt(order.nonce),
                    feeRateBps: parseInt(order.feeRateBps),
                    side: order.side === 0 ? 'BUY' : 'SELL',
                    signatureType: parseInt(order.signatureType)
                },
                owner: ownerAddress,
                orderType: 'FOK', // Fill or Kill
                signature: signature
            };

            console.log('Order payload:', payload);

            // Отправляем через наш backend чтобы избежать CORS
            const response = await fetch('/api/place-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Server error:', errorData);
                throw new Error(errorData.error || `HTTP ${response.status}: Failed to place order`);
            }

            const result = await response.json();
            console.log('✅ Order placed successfully!');
            console.log('Result:', result);

            return result;

        } catch (error) {
            console.error('❌ Error posting order:', error);
            
            // Более понятные сообщения об ошибках
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Не удалось подключиться к серверу. Проверьте что сервер запущен.');
            }
            
            throw error;
        }
    }

    // Complete flow: create, sign, and post order
    async placeOrder(params) {
        const { tokenId, makerAddress, ownerAddress, usdcAmount, side, signer } = params;

        try {
            // 1. Create order data
            const { order, price, outcomeTokens } = await this.createOrderData({
                tokenId,
                makerAddress,
                usdcAmount,
                side
            });

            console.log('Order details:');
            console.log(`- USDC amount: ${usdcAmount}`);
            console.log(`- Price: ${price}`);
            console.log(`- Outcome tokens: ${outcomeTokens.toFixed(4)}`);

            // 2. Sign order (используем ownerAddress для подписи)
            const signerAddr = ownerAddress || makerAddress;
            console.log('Signing with address:', signerAddr);
            const signature = await this.signOrder(order, signerAddr);

            // 3. Post to CLOB (используем ownerAddress как owner)
            const ownerAddr = ownerAddress || makerAddress;
            console.log('Posting with owner:', ownerAddr);
            const result = await this.postOrder(order, signature, ownerAddr);

            return {
                success: true,
                orderID: result.orderID || result.id,
                price,
                outcomeTokens,
                data: result
            };

        } catch (error) {
            console.error('Error placing order:', error);
            throw error;
        }
    }

    // Get user's orders
    async getUserOrders(address) {
        try {
            const response = await fetch(`${this.clobApiUrl}/orders?maker=${address}`);
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
            const response = await fetch(`${this.clobApiUrl}/order/${orderId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to cancel order: ${response.statusText}`);
            }

            console.log('✓ Order cancelled');
            return true;

        } catch (error) {
            console.error('Error cancelling order:', error);
            throw error;
        }
    }
}

// Global instance
const polymarketOrderSigner = new PolymarketOrderSigner();
