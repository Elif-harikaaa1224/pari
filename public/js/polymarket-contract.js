// Direct interaction with Polymarket CTF Exchange contract
// Bypass CLOB API - use smart contract directly

class PolymarketContract {
    constructor() {
        this.ctfExchangeAddress = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
        this.usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
        this.chainId = 137; // Polygon
        this.contract = null;
        this.usdcContract = null;
    }

    // Initialize contract with wallet
    async initialize(signer) {
        if (!signer) {
            throw new Error('Signer required to initialize contract');
        }

        console.log('🔧 Initializing CTF Exchange contract...');

        // Create contract instance
        this.contract = new ethers.Contract(
            this.ctfExchangeAddress,
            CTF_EXCHANGE_ABI,
            signer
        );

        // Create USDC contract instance
        this.usdcContract = new ethers.Contract(
            this.usdcAddress,
            [
                'function approve(address spender, uint256 amount) public returns (bool)',
                'function allowance(address owner, address spender) public view returns (uint256)',
                'function balanceOf(address account) public view returns (uint256)'
            ],
            signer
        );

        console.log('✅ Contract initialized');
        return true;
    }

    // Approve USDC for CTF Exchange
    async approveUSDC(amount) {
        try {
            console.log('💰 Approving USDC for CTF Exchange...');
            
            const signerAddress = await this.usdcContract.signer.getAddress();
            
            // Check current allowance
            const currentAllowance = await this.usdcContract.allowance(
                signerAddress,
                this.ctfExchangeAddress
            );

            const amountWei = ethers.utils.parseUnits(amount.toString(), 6); // USDC has 6 decimals

            console.log('Current allowance:', ethers.utils.formatUnits(currentAllowance, 6), 'USDC');
            console.log('Required amount:', amount, 'USDC');

            if (currentAllowance.gte(amountWei)) {
                console.log('✅ Already approved');
                return { alreadyApproved: true };
            }

            // Request approval
            console.log('📝 Requesting approval...');
            const tx = await this.usdcContract.approve(
                this.ctfExchangeAddress,
                amountWei
            );

            console.log('⏳ Waiting for approval confirmation...');
            console.log('TX hash:', tx.hash);

            const receipt = await tx.wait();
            console.log('✅ USDC approved!');
            console.log('Block:', receipt.blockNumber);

            return { 
                success: true, 
                txHash: tx.hash,
                blockNumber: receipt.blockNumber 
            };

        } catch (error) {
            console.error('❌ Error approving USDC:', error);
            throw error;
        }
    }

    // Get best price from CLOB orderbook (still need this for price discovery)
    async getBestPrice(tokenId, side = 'BUY') {
        try {
            const response = await fetch(
                `https://clob.polymarket.com/book?token_id=${tokenId}&side=${side}`
            );
            
            if (!response.ok) {
                throw new Error(`Failed to fetch orderbook: ${response.status}`);
            }

            const orderbook = await response.json();

            if (side === 'BUY') {
                // For BUY orders, we want the best ASK price (cheapest seller)
                if (!orderbook.asks || orderbook.asks.length === 0) {
                    throw new Error('No asks available in orderbook');
                }
                return parseFloat(orderbook.asks[0].price);
            } else {
                // For SELL orders, we want the best BID price (highest buyer)
                if (!orderbook.bids || orderbook.bids.length === 0) {
                    throw new Error('No bids available in orderbook');
                }
                return parseFloat(orderbook.bids[0].price);
            }
        } catch (error) {
            console.error('Error fetching price:', error);
            throw error;
        }
    }

    // Fill an existing order from the orderbook
    async fillOrder(orderData, signature, fillAmount) {
        try {
            console.log('📝 Filling order on-chain...');
            console.log('Order data received:', orderData);
            console.log('Signature:', signature);
            console.log('Fill amount:', fillAmount);

            if (!orderData) {
                throw new Error('Order data is undefined or null');
            }

            // Convert order data to contract format
            const order = {
                salt: orderData.salt || 0,
                maker: orderData.maker || ethers.constants.AddressZero,
                signer: orderData.signer || orderData.maker || ethers.constants.AddressZero,
                taker: orderData.taker || ethers.constants.AddressZero,
                tokenId: orderData.tokenId || orderData.token_id || '0',
                makerAmount: orderData.makerAmount || orderData.maker_amount || '0',
                takerAmount: orderData.takerAmount || orderData.taker_amount || '0',
                expiration: orderData.expiration || 0,
                nonce: orderData.nonce || 0,
                feeRateBps: orderData.feeRateBps || orderData.fee_rate_bps || 0,
                side: orderData.side === 'BUY' || orderData.side === 0 ? 0 : 1,
                signatureType: orderData.signatureType || orderData.signature_type || 0
            };

            console.log('Formatted order for contract:', order);

            // Validate required fields
            if (order.maker === ethers.constants.AddressZero) {
                throw new Error('Invalid maker address in order');
            }

            // Call fillOrder on contract
            console.log('🚀 Sending transaction...');
            const tx = await this.contract.fillOrder(
                order,
                signature,
                fillAmount
            );

            console.log('⏳ Waiting for confirmation...');
            console.log('TX hash:', tx.hash);

            const receipt = await tx.wait();
            console.log('✅ Order filled successfully!');
            console.log('Block:', receipt.blockNumber);
            console.log('Gas used:', receipt.gasUsed.toString());

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            console.error('❌ Error filling order:', error);
            
            // Parse error message
            if (error.message.includes('insufficient funds')) {
                throw new Error('Недостаточно USDC для покупки');
            } else if (error.message.includes('user rejected')) {
                throw new Error('Транзакция отклонена пользователем');
            } else if (error.message.includes('Order expired')) {
                throw new Error('Ордер истек');
            } else if (error.message.includes('Invalid signature')) {
                throw new Error('Неверная подпись ордера');
            }
            
            throw error;
        }
    }

    // Create a market order by matching with best available order
    async createMarketOrder(tokenId, usdcAmount, side = 'BUY') {
        try {
            console.log('🎯 Creating market order...');
            console.log('Token ID:', tokenId);
            console.log('USDC Amount:', usdcAmount);
            console.log('Side:', side);

            // 1. Get best price from orderbook
            const price = await this.getBestPrice(tokenId, side);
            console.log('Best price:', price);

            // 2. Fetch best order from orderbook to fill
            const response = await fetch(
                `https://clob.polymarket.com/book?token_id=${tokenId}&side=${side === 'BUY' ? 'SELL' : 'BUY'}`
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch orderbook: ${response.status}`);
            }

            const orderbook = await response.json();
            const orders = side === 'BUY' ? orderbook.asks : orderbook.bids;

            if (!orders || orders.length === 0) {
                throw new Error('No matching orders available');
            }

            const bestOrder = orders[0];
            console.log('Best order from API:', bestOrder);
            console.log('Order structure:', JSON.stringify(bestOrder, null, 2));

            // Extract order data - API может возвращать разную структуру
            let orderData, signature;
            
            if (bestOrder.order) {
                // Структура: { order: {...}, signature: '...' }
                orderData = bestOrder.order;
                signature = bestOrder.signature;
            } else if (bestOrder.salt) {
                // Структура: сам ордер на верхнем уровне
                orderData = bestOrder;
                signature = bestOrder.signature || bestOrder.sig;
            } else {
                throw new Error('Unknown order structure from API');
            }

            console.log('Extracted order data:', orderData);
            console.log('Extracted signature:', signature);

            if (!orderData || !signature) {
                throw new Error('Failed to extract order data or signature');
            }

            // 3. Calculate fill amount
            const usdcAmountWei = ethers.utils.parseUnits(usdcAmount.toString(), 6);
            
            // 4. Approve USDC if needed
            await this.approveUSDC(usdcAmount);

            // 5. Fill the order
            const result = await this.fillOrder(
                orderData,
                signature,
                usdcAmountWei.toString()
            );

            return {
                ...result,
                price,
                outcomeTokens: usdcAmount / price
            };

        } catch (error) {
            console.error('❌ Error creating market order:', error);
            throw error;
        }
    }

    // Get order hash for verification
    async getOrderHash(order) {
        try {
            const hash = await this.contract.hashOrder(order);
            return hash;
        } catch (error) {
            console.error('Error getting order hash:', error);
            throw error;
        }
    }

    // Check order status
    async getOrderStatus(orderHash) {
        try {
            const status = await this.contract.getOrderStatus(orderHash);
            return {
                isFilledOrCancelled: status.isFilledOrCancelled,
                remaining: status.remaining.toString()
            };
        } catch (error) {
            console.error('Error getting order status:', error);
            throw error;
        }
    }

    // Cancel order
    async cancelOrder(order) {
        try {
            console.log('❌ Cancelling order...');
            
            const tx = await this.contract.cancelOrder(order);
            console.log('TX hash:', tx.hash);
            
            const receipt = await tx.wait();
            console.log('✅ Order cancelled!');
            
            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error cancelling order:', error);
            throw error;
        }
    }
}

// Global instance
const polymarketContract = new PolymarketContract();
