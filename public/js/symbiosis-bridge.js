// Symbiosis Bridge Integration
// Handles cross-chain swaps from BSC to Polygon

class SymbiosisBridge {
    constructor() {
        this.initialized = false;
        this.symbiosis = null;
    }

    // Initialize Symbiosis SDK
    async init() {
        if (this.initialized) return;

        try {
            console.log('Initializing Symbiosis SDK...');
            
            // Symbiosis будет загружен через CDN в HTML
            if (typeof Symbiosis === 'undefined') {
                throw new Error('Symbiosis SDK not loaded. Add script to HTML.');
            }

            // Создаем экземпляр Symbiosis
            // Используем mainnet конфигурацию
            this.symbiosis = new Symbiosis('mainnet', 'PariVision');
            
            this.initialized = true;
            console.log('✓ Symbiosis SDK initialized');
        } catch (error) {
            console.error('Failed to initialize Symbiosis:', error);
            throw error;
        }
    }

    // Свап BNB -> USDC с BSC на Polygon
    async swapBNBtoUSDC(amountBNB, toAddress, provider, onStatusUpdate) {
        try {
            await this.init();

            console.log('=== Starting Symbiosis Bridge ===');
            console.log('Amount BNB:', amountBNB);
            console.log('To address:', toAddress);

            // 1. Настройка токенов
            const tokenAmountIn = {
                chainId: 56, // BSC
                address: '', // Пустой адрес = нативный токен (BNB)
                symbol: 'BNB',
                decimals: 18,
                amount: ethers.utils.parseEther(amountBNB.toString()).toString()
            };

            const tokenOut = {
                chainId: 137, // Polygon
                address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
                symbol: 'USDC',
                decimals: 6
            };

            onStatusUpdate?.('⏳ Расчет оптимального маршрута...');

            // 2. Получаем лучший маршрут для свапа
            const swapping = this.symbiosis.newSwapping();
            
            const { route, tokenAmountOut, approveTo, feeToken } = await swapping.exactIn(
                tokenAmountIn,
                tokenOut,
                toAddress, // Получатель на Polygon
                5, // slippage 5%
                Math.floor(Date.now() / 1000) + 20 * 60 // deadline 20 минут
            );

            console.log('Route calculated:');
            console.log('- Input:', tokenAmountIn.amount, 'BNB');
            console.log('- Output:', ethers.utils.formatUnits(tokenAmountOut, 6), 'USDC');
            console.log('- Fee token:', feeToken.symbol);

            onStatusUpdate?.(`✓ Получите ≈${ethers.utils.formatUnits(tokenAmountOut, 6)} USDC`);

            // 3. Выполняем swap
            onStatusUpdate?.('⏳ Подтвердите транзакцию в MetaMask...');

            const signer = provider.getSigner();
            
            const txRequest = {
                to: route.transactionRequest.to,
                data: route.transactionRequest.data,
                value: route.transactionRequest.value || tokenAmountIn.amount,
                gasLimit: route.transactionRequest.gasLimit || 500000
            };

            console.log('Sending transaction:', txRequest);
            const tx = await signer.sendTransaction(txRequest);
            
            onStatusUpdate?.('⏳ Транзакция отправлена! Ожидание подтверждения...');
            console.log('Transaction hash:', tx.hash);

            // 4. Ждем подтверждения
            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt.transactionHash);

            onStatusUpdate?.('⏳ Средства отправлены! Ожидание получения на Polygon (5-15 мин)...');

            // 5. Отслеживаем статус через API
            const finalStatus = await this.waitForBridgeCompletion(receipt.transactionHash, onStatusUpdate);

            return {
                success: true,
                txHash: receipt.transactionHash,
                outputAmount: ethers.utils.formatUnits(tokenAmountOut, 6),
                toAddress: toAddress
            };

        } catch (error) {
            console.error('Symbiosis bridge error:', error);
            throw error;
        }
    }

    // Ожидание завершения bridge транзакции
    async waitForBridgeCompletion(txHash, onStatusUpdate) {
        const maxAttempts = 60; // 60 попыток по 15 секунд = 15 минут
        const checkInterval = 15000; // 15 секунд

        for (let i = 0; i < maxAttempts; i++) {
            try {
                // Проверяем статус через API Symbiosis
                const status = await this.checkBridgeStatus(txHash);
                
                console.log(`Bridge status check ${i + 1}/${maxAttempts}:`, status);

                if (status === 'completed') {
                    onStatusUpdate?.('✅ Средства получены на Polygon!');
                    return 'completed';
                } else if (status === 'pending') {
                    const elapsed = Math.floor((i * checkInterval) / 1000);
                    onStatusUpdate?.(`⏳ Обработка... (${elapsed}с / ~900с)`);
                } else if (status === 'failed') {
                    throw new Error('Bridge transaction failed');
                }

                await new Promise(resolve => setTimeout(resolve, checkInterval));
            } catch (error) {
                console.error('Error checking bridge status:', error);
                // Продолжаем проверку даже при ошибках API
            }
        }

        // Если не дождались - это не значит что транзакция не прошла
        onStatusUpdate?.('⚠️ Проверка статуса превысила таймаут. Проверьте баланс вручную.');
        return 'timeout';
    }

    // Проверка статуса bridge через API
    async checkBridgeStatus(txHash) {
        try {
            // Symbiosis API endpoint для проверки статуса
            const response = await fetch(`https://api.symbiosis.finance/crosschain/v1/tx/${txHash}`);
            
            if (!response.ok) {
                return 'pending'; // Если API недоступен, считаем что еще обрабатывается
            }

            const data = await response.json();
            
            // Статусы: pending, success, failed
            if (data.status === 'success') return 'completed';
            if (data.status === 'failed') return 'failed';
            return 'pending';

        } catch (error) {
            console.error('Error checking status:', error);
            return 'pending';
        }
    }

    // Получить примерную сумму выхода
    async getQuote(amountBNB) {
        try {
            await this.init();

            const tokenAmountIn = {
                chainId: 56,
                address: '',
                symbol: 'BNB',
                decimals: 18,
                amount: ethers.utils.parseEther(amountBNB.toString()).toString()
            };

            const tokenOut = {
                chainId: 137,
                address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
                symbol: 'USDC',
                decimals: 6
            };

            const swapping = this.symbiosis.newSwapping();
            
            const { tokenAmountOut } = await swapping.exactIn(
                tokenAmountIn,
                tokenOut,
                '0x0000000000000000000000000000000000000000', // Dummy address для quote
                5,
                Math.floor(Date.now() / 1000) + 20 * 60
            );

            return ethers.utils.formatUnits(tokenAmountOut, 6);

        } catch (error) {
            console.error('Error getting quote:', error);
            // Fallback на примерный курс
            const bnbPrice = bnbPriceTracker?.getPrice() || 600;
            return (amountBNB * bnbPrice * 0.995).toFixed(2); // -0.5% fees
        }
    }
}

// Глобальный экземпляр
const symbiosisBridge = new SymbiosisBridge();
