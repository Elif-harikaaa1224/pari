// Bridge functionality
let config = null;
let usdtBalance = '0';

async function initBridge() {
    const isConnected = await wallet.isConnected();
    
    if (!isConnected) {
        alert('Подключите кошелек!');
        window.location.href = '/';
        return;
    }

    config = await loadConfig();
    
    // Display wallet
    const address = await wallet.getAddress();
    document.getElementById('walletDisplay').textContent = 
        `${address.slice(0, 6)}...${address.slice(-4)}`;

    // Load balances
    await updateBalances();

    // Setup event listeners
    document.getElementById('bnbAmount').addEventListener('input', estimateSwap);
    document.getElementById('swapBtn').addEventListener('click', executeSwap);
    document.getElementById('bridgeBtn').addEventListener('click', executeBridge);
}

async function updateBalances() {
    try {
        // Get BNB balance
        const bnbBalance = await wallet.getBNBBalance();
        document.getElementById('availableBNB').textContent = parseFloat(bnbBalance).toFixed(4);
        document.getElementById('displayBNB').textContent = parseFloat(bnbBalance).toFixed(4) + ' BNB';

        // Get USDT balance on BSC
        await wallet.switchToBSC();
        const usdtContract = new ethers.Contract(
            config.bsc.usdt,
            ERC20_ABI,
            wallet.signer
        );
        const usdtBal = await usdtContract.balanceOf(wallet.address);
        usdtBalance = ethers.utils.formatUnits(usdtBal, 18);
        document.getElementById('availableUSDT').textContent = parseFloat(usdtBalance).toFixed(2) + ' USDT';
        document.getElementById('displayUSDT').textContent = parseFloat(usdtBalance).toFixed(2) + ' USDT';

        // Get USDC balance on Polygon
        const proxyAddress = await wallet.getProxyAddress();
        const usdcBalance = await wallet.getUSDCBalance(proxyAddress);
        document.getElementById('displayUSDC').textContent = parseFloat(usdcBalance).toFixed(2) + ' USDC';

    } catch (error) {
        console.error('Error updating balances:', error);
    }
}

async function estimateSwap() {
    const bnbAmount = document.getElementById('bnbAmount').value;
    
    if (!bnbAmount || bnbAmount <= 0) {
        document.getElementById('estimatedUSDT').textContent = '-';
        return;
    }

    try {
        await wallet.switchToBSC();
        const router = new ethers.Contract(
            config.bsc.pancakeRouter,
            PANCAKE_ROUTER_ABI,
            wallet.signer
        );

        const path = [config.bsc.wbnb, config.bsc.usdt];
        const amountIn = ethers.utils.parseEther(bnbAmount);
        
        const amounts = await router.getAmountsOut(amountIn, path);
        const usdtOut = ethers.utils.formatUnits(amounts[1], 18);
        
        document.getElementById('estimatedUSDT').textContent = 
            parseFloat(usdtOut).toFixed(2) + ' USDT';
        document.getElementById('usdtAmount').value = parseFloat(usdtOut).toFixed(2);
        document.getElementById('estimatedUSDC').textContent = 
            (parseFloat(usdtOut) * 0.995).toFixed(2) + ' USDC'; // ~0.5% bridge fee

    } catch (error) {
        console.error('Error estimating swap:', error);
        document.getElementById('estimatedUSDT').textContent = 'Ошибка';
    }
}

async function executeSwap() {
    const bnbAmount = document.getElementById('bnbAmount').value;
    
    if (!bnbAmount || bnbAmount <= 0) {
        alert('Введите сумму BNB');
        return;
    }

    const btn = document.getElementById('swapBtn');
    const status = document.getElementById('swapStatus');
    
    try {
        btn.disabled = true;
        btn.textContent = 'Обработка...';
        status.innerHTML = '<div class="loading">⏳ Ожидание подтверждения...</div>';

        await wallet.switchToBSC();

        const router = new ethers.Contract(
            config.bsc.pancakeRouter,
            PANCAKE_ROUTER_ABI,
            wallet.signer
        );

        const path = [config.bsc.wbnb, config.bsc.usdt];
        const amountIn = ethers.utils.parseEther(bnbAmount);
        const amounts = await router.getAmountsOut(amountIn, path);
        const amountOutMin = amounts[1].mul(95).div(100); // 5% slippage
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

        status.innerHTML = '<div class="loading">⏳ Выполнение swap...</div>';

        const tx = await router.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            { value: amountIn, gasLimit: 300000 }
        );

        status.innerHTML = '<div class="loading">⏳ Ожидание подтверждения транзакции...</div>';
        await tx.wait();

        status.innerHTML = '<div class="success">✅ Swap выполнен успешно!</div>';
        
        // Enable bridge button
        document.getElementById('bridgeBtn').disabled = false;

        // Update balances
        await updateBalances();

    } catch (error) {
        console.error('Swap error:', error);
        status.innerHTML = `<div class="error">❌ Ошибка: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Обменять BNB → USDT';
    }
}

async function executeBridge() {
    const usdtAmount = document.getElementById('usdtAmount').value;
    
    if (!usdtAmount || usdtAmount <= 0) {
        alert('Сначала выполните swap BNB → USDT');
        return;
    }

    const btn = document.getElementById('bridgeBtn');
    const status = document.getElementById('bridgeStatus');

    try {
        btn.disabled = true;
        btn.textContent = 'Обработка...';
        status.innerHTML = '<div class="loading">⏳ Подготовка к bridge...</div>';

        await wallet.switchToBSC();

        // Approve USDT for Stargate Router
        const usdtContract = new ethers.Contract(
            config.bsc.usdt,
            ERC20_ABI,
            wallet.signer
        );

        const amount = ethers.utils.parseUnits(usdtAmount, 18);
        const allowance = await usdtContract.allowance(wallet.address, config.bsc.stargateRouter);

        if (allowance.lt(amount)) {
            status.innerHTML = '<div class="loading">⏳ Approve USDT...</div>';
            const approveTx = await usdtContract.approve(config.bsc.stargateRouter, ethers.constants.MaxUint256);
            await approveTx.wait();
        }

        status.innerHTML = '<div class="loading">⏳ Выполнение bridge на Polygon...</div>';

        const stargateRouter = new ethers.Contract(
            config.bsc.stargateRouter,
            STARGATE_ROUTER_ABI,
            wallet.signer
        );

        const proxyAddress = await wallet.getProxyAddress();
        const minAmount = amount.mul(98).div(100); // 2% slippage

        // Prepare bridge params
        const lzTxParams = {
            dstGasForCall: 0,
            dstNativeAmount: 0,
            dstNativeAddr: '0x'
        };

        // Get LayerZero fee quote
        const toAddressBytes = ethers.utils.defaultAbiCoder.encode(['address'], [proxyAddress]);
        
        const fees = await stargateRouter.quoteLayerZeroFee(
            POLYGON_CHAIN_ID_STARGATE,
            1, // TYPE_SWAP_REMOTE
            toAddressBytes,
            '0x',
            lzTxParams
        );

        status.innerHTML = '<div class="loading">⏳ Отправка через Stargate Bridge...</div>';

        const bridgeTx = await stargateRouter.swap(
            POLYGON_CHAIN_ID_STARGATE, // Polygon
            USDT_POOL_ID_BSC, // USDT pool on BSC
            USDC_POOL_ID_POLYGON, // USDC pool on Polygon
            wallet.address, // refund address
            amount,
            minAmount,
            lzTxParams,
            toAddressBytes,
            '0x',
            { value: fees[0], gasLimit: 500000 }
        );

        status.innerHTML = '<div class="loading">⏳ Ожидание подтверждения... (может занять 5-10 минут)</div>';
        await bridgeTx.wait();

        status.innerHTML = `
            <div class="success">
                ✅ Bridge успешно выполнен!<br>
                USDC будет на вашем прокси-кошельке через 5-10 минут<br>
                <a href="/markets" class="btn btn-primary">Перейти к ставкам</a>
            </div>
        `;

        // Update balances after some time
        setTimeout(updateBalances, 10000);

    } catch (error) {
        console.error('Bridge error:', error);
        status.innerHTML = `<div class="error">❌ Ошибка: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Перевести на Polygon';
    }
}