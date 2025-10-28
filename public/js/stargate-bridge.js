// Stargate Bridge Integration
// Handles cross-chain bridge from BSC to Polygon using PancakeSwap + Stargate

class StargateBridge {
    constructor() {
        this.initialized = true;
        
        // BSC Contract addresses
        this.bsc = {
            pancakeRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
            wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            usdt: '0x55d398326f99059fF775485246999027B3197955',
            stargateRouter: '0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8',
            stargateChainId: 102 // BSC chain ID for Stargate
        };
        
        // Polygon addresses
        this.polygon = {
            usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            stargateChainId: 109 // Polygon chain ID for Stargate
        };
    }

    // Полный процесс: BNB → USDT → Bridge → USDC → Bet
    async bridgeAndBet(amountBNB, proxyAddress, provider, onStatusUpdate) {
        try {
            console.log('=== Starting Bridge Process ===');
            console.log('Amount BNB:', amountBNB);
            console.log('Proxy address:', proxyAddress);

            const signer = provider.getSigner();
            const fromAddress = await signer.getAddress();

            // ШАГ 1: Swap BNB → USDT на PancakeSwap
            onStatusUpdate?.('⏳ Обмен BNB на USDT через PancakeSwap...');
            const usdtAmount = await this.swapBNBtoUSDT(amountBNB, signer, onStatusUpdate);
            console.log('USDT received:', usdtAmount);

            // ШАГ 2: Approve USDT для Stargate Router
            onStatusUpdate?.('⏳ Разрешение USDT для Stargate...');
            await this.approveUSDT(usdtAmount, signer);

            // ШАГ 3: Bridge USDT → USDC через Stargate (BSC → Polygon)
            onStatusUpdate?.('⏳ Отправка через Stargate Bridge на Polygon...');
            const bridgeTx = await this.bridgeToPolygon(usdtAmount, proxyAddress, signer, onStatusUpdate);
            
            console.log('Bridge transaction:', bridgeTx.hash);
            onStatusUpdate?.('⏳ Ожидание подтверждения bridge...');
            
            const receipt = await bridgeTx.wait();
            console.log('Bridge confirmed:', receipt.transactionHash);

            return {
                success: true,
                txHash: receipt.transactionHash,
                usdtAmount: usdtAmount,
                toAddress: proxyAddress
            };

        } catch (error) {
            console.error('Bridge error:', error);
            throw error;
        }
    }

    // Swap BNB → USDT на PancakeSwap
    async swapBNBtoUSDT(amountBNB, signer, onStatusUpdate) {
        try {
            // Проверяем что мы на BSC
            const network = await signer.provider.getNetwork();
            if (network.chainId !== 56) {
                throw new Error(`Неверная сеть! Нужна BSC (chainId: 56), текущая: ${network.chainId}. Переключите сеть в кошельке на BNB Smart Chain.`);
            }
            
            const routerABI = [
                'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
                'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
            ];

            const router = new ethers.Contract(this.bsc.pancakeRouter, routerABI, signer);
            const amountWei = ethers.utils.parseEther(amountBNB.toString());
            
            // Получаем expected amount
            const path = [this.bsc.wbnb, this.bsc.usdt];
            
            console.log('Calling getAmountsOut with:', {
                amountWei: amountWei.toString(),
                path,
                router: this.bsc.pancakeRouter
            });
            
            const amounts = await router.getAmountsOut(amountWei, path);
            const expectedUSDT = amounts[1];
            
            console.log('Expected USDT:', ethers.utils.formatUnits(expectedUSDT, 18));
            
            // Slippage 2%
            const minUSDT = expectedUSDT.mul(98).div(100);
            const deadline = Math.floor(Date.now() / 1000) + 600; // 10 минут
            const userAddress = await signer.getAddress();

            onStatusUpdate?.('⏳ Подтвердите swap в MetaMask...');

            const tx = await router.swapExactETHForTokens(
                minUSDT,
                path,
                userAddress,
                deadline,
                { value: amountWei, gasLimit: 300000 }
            );

            onStatusUpdate?.('⏳ Swap выполняется...');
            const receipt = await tx.wait();
            console.log('Swap completed:', receipt.transactionHash);

            // Возвращаем количество USDT
            return ethers.utils.formatUnits(expectedUSDT, 18);

        } catch (error) {
            console.error('PancakeSwap error:', error);
            throw new Error('Ошибка обмена на PancakeSwap: ' + error.message);
        }
    }

    // Approve USDT для Stargate
    async approveUSDT(amount, signer) {
        try {
            const erc20ABI = [
                'function approve(address spender, uint256 amount) returns (bool)',
                'function allowance(address owner, address spender) view returns (uint256)'
            ];

            const usdtContract = new ethers.Contract(this.bsc.usdt, erc20ABI, signer);
            const userAddress = await signer.getAddress();
            
            // Проверяем текущий allowance
            const currentAllowance = await usdtContract.allowance(userAddress, this.bsc.stargateRouter);
            const amountWei = ethers.utils.parseUnits(amount, 18);
            
            if (currentAllowance.lt(amountWei)) {
                console.log('Approving USDT for Stargate...');
                const tx = await usdtContract.approve(this.bsc.stargateRouter, amountWei, {
                    gasLimit: 100000
                });
                await tx.wait();
                console.log('USDT approved');
            } else {
                console.log('USDT already approved');
            }

        } catch (error) {
            console.error('Approve error:', error);
            throw new Error('Ошибка approve USDT: ' + error.message);
        }
    }

    // Bridge через Stargate
    async bridgeToPolygon(usdtAmount, toAddress, signer, onStatusUpdate) {
        try {
            const stargateABI = [
                'function swap(uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address payable _refundAddress, uint256 _amountLD, uint256 _minAmountLD, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes _to, bytes _payload) payable'
            ];

            const stargate = new ethers.Contract(this.bsc.stargateRouter, stargateABI, signer);
            const userAddress = await signer.getAddress();
            
            const amountWei = ethers.utils.parseUnits(usdtAmount, 18);
            const minAmount = amountWei.mul(98).div(100); // 2% slippage

            // Stargate parameters
            const dstChainId = this.polygon.stargateChainId; // Polygon
            const srcPoolId = 2; // USDT pool на BSC
            const dstPoolId = 1; // USDC pool на Polygon
            
            // LayerZero parameters
            const lzTxParams = {
                dstGasForCall: 0,
                dstNativeAmount: 0,
                dstNativeAddr: '0x'
            };

            // Адрес получателя в bytes (без ABI encoding, просто bytes)
            // Stargate ожидает адрес как bytes, но БЕЗ padding
            const toAddressBytes = toAddress;

            onStatusUpdate?.('⏳ Подтвердите bridge транзакцию в MetaMask...');

            // Estimate fee
            const fee = ethers.utils.parseEther('0.01'); // ~0.01 BNB на комиссию LayerZero

            const tx = await stargate.swap(
                dstChainId,
                srcPoolId,
                dstPoolId,
                userAddress, // refund address
                amountWei,
                minAmount,
                lzTxParams,
                toAddressBytes,
                '0x', // пустой payload
                {
                    value: fee,
                    gasLimit: 500000
                }
            );

            return tx;

        } catch (error) {
            console.error('Stargate bridge error:', error);
            throw new Error('Ошибка Stargate bridge: ' + error.message);
        }
    }

    // Получить примерную сумму выхода
    async getQuote(amountBNB) {
        try {
            const bnbPrice = typeof bnbPriceTracker !== 'undefined' 
                ? bnbPriceTracker.getPrice() 
                : 600;
            
            // Вычитаем комиссии: PancakeSwap ~0.3%, Stargate ~0.1%
            const estimatedUSDC = amountBNB * bnbPrice * 0.996;
            
            console.log(`Quote: ${amountBNB} BNB ≈ ${estimatedUSDC.toFixed(2)} USDC`);
            return estimatedUSDC.toFixed(2);

        } catch (error) {
            console.error('Error getting quote:', error);
            return (amountBNB * 600 * 0.996).toFixed(2);
        }
    }
}

// Глобальный экземпляр (переименовываем для обратной совместимости)
const stargateBridge = new StargateBridge();
const symbiosisBridge = stargateBridge; // Alias для совместимости
console.log('✓ Stargate Bridge initialized');
