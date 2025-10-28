// Symbiosis Bridge Integration
// Handles cross-chain swaps from BSC to Polygon using Symbiosis API

class SymbiosisBridge {
    constructor() {
        this.initialized = true; // Всегда готов к работе
        this.apiUrl = 'https://api-v2.symbiosis.finance/crosschain/v1';
    }

    // Свап BNB -> USDC с BSC на Polygon через Symbiosis API
    async swapBNBtoUSDC(amountBNB, toAddress, provider, onStatusUpdate) {
        try {
            console.log('=== Starting Symbiosis Bridge ===');
            console.log('Amount BNB:', amountBNB);
            console.log('To address:', toAddress);

            const signer = provider.getSigner();
            const fromAddress = await signer.getAddress();

            // 1. Получаем quote и transaction data от Symbiosis API
            onStatusUpdate?.('⏳ Получение quote от Symbiosis...');

            const quoteData = await this.getSwapData(
                amountBNB,
                fromAddress,
                toAddress
            );

            console.log('Quote received:', quoteData);

            const estimatedOutput = parseFloat(quoteData.amountOut) / 1e6; // USDC имеет 6 decimals
            console.log('Estimated USDC output:', estimatedOutput);

            onStatusUpdate?.(`✓ Получите ≈${estimatedOutput.toFixed(2)} USDC`);

            // 2. Выполняем транзакцию
            onStatusUpdate?.('⏳ Подтвердите транзакцию в MetaMask...');

            const tx = await signer.sendTransaction({
                to: quoteData.tx.to,
                data: quoteData.tx.data,
                value: quoteData.tx.value,
                gasLimit: quoteData.tx.gas || 500000
            });

            onStatusUpdate?.('⏳ Транзакция отправлена! Ожидание подтверждения...');
            console.log('Transaction hash:', tx.hash);

            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt.transactionHash);

            onStatusUpdate?.('⏳ Средства отправлены! Ожидание получения на Polygon (5-15 мин)...');

            // 3. Отслеживаем статус
            await this.waitForBridgeCompletion(receipt.transactionHash, onStatusUpdate);

            return {
                success: true,
                txHash: receipt.transactionHash,
                outputAmount: estimatedOutput.toFixed(2),
                toAddress: toAddress
            };

        } catch (error) {
            console.error('Symbiosis bridge error:', error);
            throw error;
        }
    }

    // Получить данные для свапа через Symbiosis API
    async getSwapData(amountBNB, fromAddress, toAddress) {
        try {
            const amountWei = ethers.utils.parseEther(amountBNB.toString()).toString();

            // Параметры для Symbiosis API
            const params = {
                tokenAmountIn: {
                    chainId: 56, // BSC
                    address: '', // Пустой = нативный токен (BNB)
                    symbol: 'BNB',
                    decimals: 18,
                    amount: amountWei
                },
                tokenOut: {
                    chainId: 137, // Polygon
                    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
                    symbol: 'USDC',
                    decimals: 6
                },
                from: fromAddress,
                to: toAddress,
                slippage: 500, // 5%
                deadline: Math.floor(Date.now() / 1000) + 1200 // 20 минут
            };

            console.log('Requesting swap data from Symbiosis API...');
            console.log('Params:', params);

            const response = await fetch(`${this.apiUrl}/swap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error(`Symbiosis API error: ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Error getting swap data:', error);
            throw new Error('Не удалось получить данные для свапа: ' + error.message);
        }
    }

    // Ожидание завершения bridge транзакции
    async waitForBridgeCompletion(txHash, onStatusUpdate) {
        const maxAttempts = 60; // 60 попыток по 15 секунд = 15 минут
        const checkInterval = 15000; // 15 секунд

        for (let i = 0; i < maxAttempts; i++) {
            try {
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
            }
        }

        onStatusUpdate?.('⚠️ Проверка статуса превысила таймаут. Проверьте баланс вручную.');
        return 'timeout';
    }

    // Проверка статуса bridge через API
    async checkBridgeStatus(txHash) {
        try {
            const response = await fetch(`${this.apiUrl}/tx/${txHash}`);
            
            if (!response.ok) {
                return 'pending';
            }

            const data = await response.json();
            
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
            // Используем простой расчет по текущей цене BNB
            const bnbPrice = typeof bnbPriceTracker !== 'undefined' 
                ? bnbPriceTracker.getPrice() 
                : 600;
            
            // Вычитаем примерно 0.5% на комиссии
            const estimatedUSDC = amountBNB * bnbPrice * 0.995;
            
            console.log(`Quote: ${amountBNB} BNB ≈ ${estimatedUSDC.toFixed(2)} USDC`);
            return estimatedUSDC.toFixed(2);

        } catch (error) {
            console.error('Error getting quote:', error);
            return (amountBNB * 600 * 0.995).toFixed(2);
        }
    }
}

// Глобальный экземпляр
const symbiosisBridge = new SymbiosisBridge();
console.log('✓ Symbiosis Bridge initialized');
