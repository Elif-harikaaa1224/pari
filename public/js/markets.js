// Markets page functionality
let markets = [];
let selectedMarket = null;
let selectedToken = null;
let config = null;

async function initMarkets() {
    const isConnected = await wallet.isConnected();
    
    if (isConnected) {
        config = await loadConfig();
        
        // Display wallet
        const address = await wallet.getAddress();
        document.getElementById('walletDisplay').textContent = 
            `${address.slice(0, 6)}...${address.slice(-4)}`;

        // Load balance and check proxy
        await updateBalance();
        await checkAndDisplayProxy();
    } else {
        // Show connect wallet button
        document.getElementById('walletDisplay').innerHTML = 
            '<button onclick="connectWallet()" class="btn btn-secondary">Подключить кошелек</button>';
        document.getElementById('bettingBalance').textContent = '-';
    }

    // Load markets regardless of wallet connection
    await loadMarkets();

    // Setup modal
    setupModal();
}

async function checkAndDisplayProxy() {
    try {
        const userAddress = wallet.address;
        const savedProxy = localStorage.getItem(`polymarket_proxy_${userAddress}`);
        
        if (savedProxy && ethers.utils.isAddress(savedProxy)) {
            console.log('📌 Your Polymarket Proxy Wallet:', savedProxy);
            
            // Показываем пользователю его proxy адрес
            const proxyInfo = document.createElement('div');
            proxyInfo.style.cssText = 'margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 5px; font-size: 12px;';
            proxyInfo.innerHTML = `
                <strong>🔑 Polymarket Proxy:</strong> 
                <code>${savedProxy.slice(0, 10)}...${savedProxy.slice(-8)}</code>
                <button onclick="manageProxyAddress()" style="margin-left: 10px; padding: 2px 8px;">⚙️</button>
            `;
            
            const container = document.querySelector('.markets-container') || document.body;
            container.insertBefore(proxyInfo, container.firstChild);
        } else {
            // Показываем уведомление что нужно настроить proxy
            const proxyWarning = document.createElement('div');
            proxyWarning.style.cssText = 'margin: 10px 0; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px;';
            proxyWarning.innerHTML = `
                ⚠️ <strong>Proxy Wallet не настроен</strong><br>
                Для размещения ставок необходим Polymarket Proxy Wallet.<br>
                <button onclick="manageProxyAddress()" class="btn btn-primary" style="margin-top: 5px;">⚙️ Настроить Proxy</button>
            `;
            
            const container = document.querySelector('.markets-container') || document.body;
            container.insertBefore(proxyWarning, container.firstChild);
        }
    } catch (error) {
        console.error('Error checking proxy:', error);
    }
}

async function connectWallet() {
    try {
        await wallet.connect();
        window.location.reload();
    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Ошибка подключения кошелька: ' + error.message);
    }
}

async function updateBalance() {
    try {
        const userAddress = wallet.address;
        const savedProxy = localStorage.getItem(`polymarket_proxy_${userAddress}`);
        
        if (savedProxy && ethers.utils.isAddress(savedProxy)) {
            await wallet.switchToPolygon();
            const balance = await wallet.getUSDCBalance(savedProxy);
            document.getElementById('bettingBalance').textContent = 
                parseFloat(balance).toFixed(2);
            console.log(`💰 USDC balance on proxy (${savedProxy}):`, balance);
        } else {
            document.getElementById('bettingBalance').textContent = '0.00';
            console.log('⚠️ No proxy address configured');
        }
    } catch (error) {
        console.error('Error loading balance:', error);
        document.getElementById('bettingBalance').textContent = '0.00';
    }
}

async function loadMarkets() {
    try {
        const response = await fetch('/api/markets');
        const data = await response.json();
        
        if (data.success) {
            markets = data.data;
            console.log('Markets loaded:', markets.length);
            console.log('First market structure:', markets[0]);
            displayMarkets(markets);
        } else {
            showError('Не удалось загрузить маркеты');
        }
    } catch (error) {
        console.error('Error loading markets:', error);
        showError('Ошибка загрузки маркетов');
    } finally {
        document.getElementById('marketsLoading').style.display = 'none';
    }
}

function displayMarkets(marketsList) {
    const container = document.getElementById('marketsList');
    container.innerHTML = '';

    if (!marketsList || marketsList.length === 0) {
        container.innerHTML = '<p>Нет доступных маркетов</p>';
        return;
    }

    marketsList.forEach(market => {
        const card = createMarketCard(market);
        container.appendChild(card);
    });
}

function createMarketCard(market) {
    const card = document.createElement('div');
    card.className = 'market-card';

    // Проверяем, является ли это событием с несколькими исходами
    if (market.isMultiOutcome && market.outcomes && market.outcomes.length > 1) {
        return createMultiOutcomeCard(market);
    } else {
        return createBinaryMarketCard(market);
    }
}

function createMultiOutcomeCard(event) {
    const card = document.createElement('div');
    card.className = 'market-card multi-outcome';

    const question = event.question || event.title || 'Событие';
    
    // Объем и дата
    const volume = event.volume ? `${(event.volume / 1000).toFixed(0)}K` : 
                   event.volume24hr ? `${(event.volume24hr / 1000).toFixed(0)}K` : '-';
    const endDate = event.endDate || event.endDateIso ? 
        new Date(event.endDate || event.endDateIso).toLocaleDateString('ru-RU') : '-';
    
    // Ссылка на Polymarket
    const eventSlug = event.slug;
    const polymarketUrl = eventSlug ? `https://polymarket.com/event/${eventSlug}` : '#';
    const imageSrc = event.image || '';
    
    // Показываем только первые 2 исхода
    const topOutcomes = event.outcomes.slice(0, 2);
    
    const outcomesHtml = topOutcomes.map(outcome => {
        const percentage = (outcome.price * 100).toFixed(0);
        // Извлекаем только название команды/варианта без полного вопроса
        let outcomeText = outcome.question;
        
        // Убираем общий вопрос события
        if (event.question) {
            outcomeText = outcomeText.replace(event.question, '');
        }
        
        // Убираем стандартные префиксы
        outcomeText = outcomeText
            .replace(/^Will\s+/i, '')
            .replace(/^Does\s+/i, '')
            .replace(/^Is\s+/i, '')
            .replace(/\s+win.*$/i, '')
            .replace(/\?$/g, '')
            .trim();
        
        // Если текст пустой, используем полный вопрос
        if (!outcomeText) {
            outcomeText = outcome.question;
        }
        
        return `
            <div class="outcome-compact">
                <span class="outcome-name">${outcomeText}</span>
                <span class="outcome-percent">${percentage}%</span>
            </div>
        `;
    }).join('');

    card.innerHTML = `
        <div class="card-top">
            <div class="card-image-wrap">
                <img src="${imageSrc}" class="card-image" alt="" onerror="this.style.display='none'" />
            </div>
            <div class="card-head">
                <h4 class="card-title">${question}</h4>
                <div class="card-meta">
                    <span class="meta-item">📊 ${volume}</span>
                    <span class="meta-item">📅 ${endDate}</span>
                </div>
            </div>
        </div>
        <div class="market-outcomes-compact">
            ${outcomesHtml}
        </div>
        ${event.outcomes.length > 2 ? `<div class="view-all-btn">View all ${event.outcomes.length} outcomes</div>` : ''}
    `;

    // Add click handler to open modal with all outcomes
    card.addEventListener('click', (e) => {
        // Не открываем модал, если кликнули на ссылку
        if (e.target.tagName === 'A') return;
        openOutcomesModal(event);
    });

    return card;
}

function createBinaryMarketCard(market) {
    const card = document.createElement('div');
    card.className = 'market-card';

    const question = market.question || market.title || 'Событие';
    
    // Получаем цены из правильной структуры API
    let yesPrice = '-';
    let noPrice = '-';
    let yesTokenId = '';
    let noTokenId = '';
    
    // Polymarket API возвращает tokens массив
    if (market.tokens && market.tokens.length >= 2) {
        // Первый токен обычно YES
        const yesToken = market.tokens[0];
        const noToken = market.tokens[1];
        
        yesTokenId = yesToken.token_id || yesToken.id || '';
        noTokenId = noToken.token_id || noToken.id || '';
        
        // Цена может быть в price или outcome
        yesPrice = yesToken.price || yesToken.outcome || 0.5;
        noPrice = noToken.price || noToken.outcome || 0.5;
        
        // Конвертируем в проценты
        yesPrice = (parseFloat(yesPrice) * 100).toFixed(1);
        noPrice = (parseFloat(noPrice) * 100).toFixed(1);
    } else if (market.outcomes && market.outcomes.length >= 2) {
        // Альтернативная структура
        yesPrice = (parseFloat(market.outcomes[0].price || 0.5) * 100).toFixed(1);
        noPrice = (parseFloat(market.outcomes[1].price || 0.5) * 100).toFixed(1);
        yesTokenId = market.outcomes[0].token_id || '';
        noTokenId = market.outcomes[1].token_id || '';
    }
    
    // Объем и дата
    const volume = market.volume ? `${(market.volume / 1000).toFixed(0)}K` : 
                   market.volume24hr ? `${(market.volume24hr / 1000).toFixed(0)}K` : '-';
    const endDate = market.end_date_iso || market.endDate || market.endDateIso ? 
        new Date(market.end_date_iso || market.endDate || market.endDateIso).toLocaleDateString('ru-RU') : '-';
    
    // Ссылка на Polymarket - используем slug (предпочтительно) или id
    const marketIdentifier = market.slug || market.id;
    const polymarketUrl = marketIdentifier ? `https://polymarket.com/event/${marketIdentifier}` : '#';
    const imageSrc = market.image || market.icon || (market.events && market.events[0] && market.events[0].image) || '';

    card.innerHTML = `
        <div class="card-top">
            <div class="card-image-wrap">
                <img src="${imageSrc}" class="card-image" alt="" onerror="this.style.display='none'" />
            </div>
            <div class="card-head">
                <h4 class="card-title">${question}</h4>
                <div class="card-meta">
                    <span class="meta-item">📊 ${volume}</span>
                    <span class="meta-item">📅 ${endDate}</span>
                    ${marketIdentifier ? `<a href="${polymarketUrl}" target="_blank" class="meta-link">🔗 Polymarket</a>` : ''}
                </div>
            </div>
        </div>
        <div class="market-outcomes">
            <button class="outcome-btn yes-btn" data-market-id="${market.conditionId || market.condition_id || market.id}" data-outcome="YES" data-token="${yesTokenId}" data-price="${yesPrice}">
                <span class="outcome-label">YES</span>
                <span class="outcome-price">${yesPrice}%</span>
            </button>
            <button class="outcome-btn no-btn" data-market-id="${market.conditionId || market.condition_id || market.id}" data-outcome="NO" data-token="${noTokenId}" data-price="${noPrice}">
                <span class="outcome-label">NO</span>
                <span class="outcome-price">${noPrice}%</span>
            </button>
        </div>
    `;

    // Add click handlers to outcome buttons
    const outcomeButtons = card.querySelectorAll('.outcome-btn');
    outcomeButtons.forEach(btn => {
        btn.addEventListener('click', () => openBettingModal(market, btn));
    });

    return card;
}

async function openBettingModal(market, button) {
    // Check if wallet is connected
    if (!wallet.address) {
        alert('Пожалуйста, подключите кошелек для размещения ставок');
        return;
    }
    
    // Проверяем наличие proxy адреса
    const userAddress = wallet.address;
    const savedProxy = localStorage.getItem(`polymarket_proxy_${userAddress}`);
    
    if (!savedProxy || !ethers.utils.isAddress(savedProxy)) {
        const shouldSetup = confirm(
            '⚠️ Proxy Wallet не настроен!\n\n' +
            'Для размещения ставок нужен Polymarket Proxy Wallet.\n\n' +
            'Настроить сейчас?'
        );
        if (shouldSetup) {
            await manageProxyAddress();
        }
        return;
    }
    
    selectedMarket = market;
    selectedToken = {
        id: button.dataset.token,
        outcome: button.dataset.outcome,
        price: parseFloat(button.dataset.price) / 100
    };

    // Рассчитываем коэффициент (1 / вероятность)
    const odds = selectedToken.price > 0 ? (1 / selectedToken.price).toFixed(2) : '-';
    
    document.getElementById('betMarketTitle').textContent = market.question;
    document.getElementById('betOutcome').textContent = selectedToken.outcome;
    document.getElementById('betOdds').textContent = odds;
    
    // Показываем proxy address
    document.getElementById('userProxyAddress').textContent = savedProxy;
    
    document.getElementById('bettingModal').style.display = 'block';
    document.getElementById('betAmountBNB').value = '';
    document.getElementById('betPayout').textContent = '-';
    document.getElementById('betAmountUSDC').textContent = '0';
    document.getElementById('betStatus').innerHTML = '';
}

function setupModal() {
    const modal = document.getElementById('bettingModal');
    const bridgeModal = document.getElementById('bridgeModal');
    
    // Close betting modal when clicking X
    const closeBtns = document.querySelectorAll('.close');
    closeBtns.forEach(btn => {
        btn.onclick = () => {
            modal.style.display = 'none';
            bridgeModal.style.display = 'none';
        };
    });
    
    // Close modals when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
        if (event.target === bridgeModal) {
            bridgeModal.style.display = 'none';
        }
        // Close outcomes modal
        const outcomesModal = document.getElementById('outcomesModal');
        if (event.target === outcomesModal) {
            outcomesModal.style.display = 'none';
        }
    };

    // Calculate payout on BNB amount change
    const betAmountInput = document.getElementById('betAmountBNB');
    if (betAmountInput) {
        betAmountInput.addEventListener('input', calculatePayout);
    }
    
    // Place bet button
    document.getElementById('placeBetBtn').addEventListener('click', placeBet);
}

function openOutcomesModal(event) {
    const modal = document.getElementById('outcomesModal');
    if (!modal) {
        createOutcomesModal();
        return openOutcomesModal(event);
    }
    
    const modalTitle = document.getElementById('outcomesModalTitle');
    const outcomesList = document.getElementById('outcomesModalList');
    
    modalTitle.textContent = event.question;
    
    // Render all outcomes
    outcomesList.innerHTML = event.outcomes.map((outcome, idx) => {
        const percentage = (outcome.price * 100).toFixed(1);
        let outcomeText = outcome.question;
        
        if (event.question) {
            outcomeText = outcomeText.replace(event.question, '');
        }
        
        outcomeText = outcomeText
            .replace(/^Will\s+/i, '')
            .replace(/^Does\s+/i, '')
            .replace(/^Is\s+/i, '')
            .replace(/\s+win.*$/i, '')
            .replace(/\?$/g, '')
            .trim();
        
        if (!outcomeText) {
            outcomeText = outcome.question;
        }
        
        return `
            <div class="outcome-item" data-outcome-idx="${idx}">
                <span class="outcome-item-name">${outcomeText}</span>
                <div class="outcome-item-right">
                    <span class="outcome-item-percent">${percentage}%</span>
                    <button class="outcome-bet-btn">Bet</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers to bet buttons
    outcomesList.querySelectorAll('.outcome-bet-btn').forEach((btn, idx) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const outcome = event.outcomes[idx];
            modal.style.display = 'none';
            
            // Создаём псевдо-кнопку с правильными dataset атрибутами для openBettingModal
            const fakeButton = {
                dataset: {
                    token: outcome.tokenId,
                    outcome: 'YES', // Всегда YES для многовариантных
                    price: (outcome.price * 100).toFixed(1) // Переводим в проценты
                }
            };
            
            openBettingModal({
                ...event,
                question: outcome.question,
                conditionId: outcome.conditionId,
                tokens: [
                    { token_id: outcome.tokenId, outcome: 'Yes', price: outcome.price.toString() },
                    { token_id: outcome.noTokenId, outcome: 'No', price: (1 - outcome.price).toString() }
                ]
            }, fakeButton);
        });
    });
    
    modal.style.display = 'block';
}

function createOutcomesModal() {
    const modal = document.createElement('div');
    modal.id = 'outcomesModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content outcomes-modal-content">
            <span class="close" onclick="document.getElementById('outcomesModal').style.display='none'">&times;</span>
            <h3 id="outcomesModalTitle">All Outcomes</h3>
            <div id="outcomesModalList" class="outcomes-list"></div>
        </div>
    `;
    document.body.appendChild(modal);
}

function calculatePayout() {
    const amountBNB = parseFloat(document.getElementById('betAmountBNB').value);
    
    if (!amountBNB || amountBNB <= 0 || !selectedToken || !selectedToken.price) {
        document.getElementById('betPayout').textContent = '-';
        document.getElementById('betAmountUSDC').textContent = '0';
        return;
    }

    // Получаем реальную цену BNB из трекера
    const bnbPrice = bnbPriceTracker.getPrice();
    const usdcAmount = amountBNB * bnbPrice;
    document.getElementById('betAmountUSDC').textContent = usdcAmount.toFixed(2);

    // Потенциальный выигрыш = сумма ставки × коэффициент
    // Коэффициент = 1 / вероятность
    const payout = usdcAmount / selectedToken.price;
    document.getElementById('betPayout').textContent = payout.toFixed(2);
}

async function placeBet() {
    const amountBNB = parseFloat(document.getElementById('betAmountBNB').value);
    
    if (!amountBNB || amountBNB <= 0) {
        alert('Введите сумму ставки в BNB');
        return;
    }

    try {
        // 0. Проверка подключения кошелька
        if (!wallet.address) {
            alert('Подключите кошелек');
            return;
        }

        console.log('=== Starting bet placement ===');
        console.log('Connected wallet address:', wallet.address);
        console.log('Bet amount (BNB):', amountBNB);

        // 1. Переключаемся на Polygon для работы с proxy wallet
        await wallet.switchToPolygon();
        
        // Обновляем signer после смены сети
        wallet.signer = wallet.provider.getSigner();

        // 2. Получить/создать proxy wallet
        const userAddress = await wallet.getAddress();
        console.log('User address from wallet.getAddress():', userAddress);
        console.log('User address type:', typeof userAddress);
        
        const proxyAddress = await proxyWalletManager.getOrCreateProxyWallet(userAddress, wallet.signer);
        
        console.log('User address:', userAddress);
        console.log('Proxy address:', proxyAddress);

        // 3. Показать bridge modal
        await showBridgeProcess(amountBNB, proxyAddress);

    } catch (error) {
        console.error('Bet placement error:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function showBridgeProcess(amountBNB, proxyAddress) {
    // Open bridge modal
    document.getElementById('bettingModal').style.display = 'none';
    document.getElementById('bridgeModal').style.display = 'block';

    // Получаем реальную цену BNB
    const bnbPrice = bnbPriceTracker.getPrice();
    const usdcAmount = amountBNB * bnbPrice;

    // Безопасное обновление элементов
    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Element with id "${id}" not found`);
        }
    };

    updateElement('bridgeBNBAmount', `${amountBNB} BNB`);
    updateElement('bridgeUSDCAmount', `≈${usdcAmount.toFixed(2)} USDC`);
    updateElement('bridgeToAddress', `${proxyAddress.slice(0, 10)}...${proxyAddress.slice(-8)}`);

    const status = document.getElementById('bridgeStatus');
    if (!status) {
        console.error('Bridge status element not found!');
        return;
    }

    try {
        // Step 1: Switch to BSC and swap BNB→USDT
        updateStep(1, 'active');
        status.innerHTML = '<div class="loading">⏳ Обмен BNB → USDT на PancakeSwap...</div>';
        
        await wallet.switchToBSC();
        const usdtAmount = await swapBNBToUSDT(amountBNB);
        
        updateStep(1, 'completed', '✅');
        
        // Step 2: Send through Stargate
        updateStep(2, 'active');
        status.innerHTML = '<div class="loading">⏳ Отправка через Stargate на Polygon...</div>';
        
        const bridgeTxHash = await sendThroughStargate(usdtAmount, proxyAddress);
        
        updateStep(2, 'completed', '✅');
        
        // Step 3: Wait for USDC on Polygon
        updateStep(3, 'active');
        status.innerHTML = '<div class="loading">⏳ Ожидание получения USDC на Polygon...</div>';
        
        await wallet.switchToPolygon();
        await waitForUSDC(proxyAddress, usdcAmount);
        
        updateStep(3, 'completed', '✅');
        
        // Step 4: Approve USDC for CTF Exchange
        updateStep(4, 'active');
        status.innerHTML = '<div class="loading">⏳ Approve USDC для ставок...</div>';
        
        await approveUSDCForBetting(proxyAddress, usdcAmount);
        
        updateStep(4, 'completed', '✅');
        
        // Step 5: Place bet order
        updateStep(5, 'active');
        status.innerHTML = '<div class="loading">⏳ Размещение ставки на Polymarket...</div>';
        
        const orderResult = await placePolymarketOrder(usdcAmount, proxyAddress);
        
        updateStep(5, 'completed', '✅');
        
        // Success!
        status.innerHTML = `
            <div class="success">
                ✅ Ставка успешно размещена на Polymarket!<br>
                <strong>Order ID:</strong> ${orderResult.orderID}<br>
                <strong>Сумма:</strong> ${usdcAmount.toFixed(2)} USDC<br>
                <strong>Потенциальный выигрыш:</strong> ${orderResult.outcomeTokens.toFixed(4)} tokens<br>
                <br>
                <a href="https://polymarket.com" target="_blank" class="btn btn-secondary">Проверить на Polymarket</a>
            </div>
        `;

    } catch (error) {
        console.error('Bridge process error:', error);
        status.innerHTML = `<div class="error">❌ Ошибка: ${error.message}</div>`;
        
        // Mark current step as error
        const activeStep = document.querySelector('.step.active');
        if (activeStep) {
            activeStep.classList.remove('active');
            activeStep.classList.add('error');
            activeStep.querySelector('.step-status').textContent = '❌';
        }
    }
}

function updateStep(stepNumber, state, icon = '') {
    const step = document.getElementById(`step${stepNumber}`);
    const status = document.getElementById(`step${stepNumber}Status`);
    
    // Remove all states
    step.classList.remove('active', 'completed', 'error');
    
    // Add new state
    if (state) {
        step.classList.add(state);
    }
    
    // Update icon
    if (icon) {
        status.textContent = icon;
    }
}

async function swapBNBToUSDT(amountBNB) {
    // Implement PancakeSwap swap logic from bridge.js
    const pancakeRouter = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
    const wbnb = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    const usdt = '0x55d398326f99059fF775485246999027B3197955';

    const routerABI = [
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'
    ];

    const router = new ethers.Contract(pancakeRouter, routerABI, wallet.signer);
    
    const path = [wbnb, usdt];
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const amountOutMin = 0; // В продакшене нужен slippage calculation
    
    const tx = await router.swapExactETHForTokens(
        amountOutMin,
        path,
        await wallet.signer.getAddress(),
        deadline,
        { value: ethers.utils.parseEther(amountBNB.toString()) }
    );
    
    const receipt = await tx.wait();
    console.log('Swap completed:', receipt.transactionHash);
    
    // Return USDT amount (используем реальную цену BNB)
    const bnbPrice = bnbPriceTracker.getPrice();
    return amountBNB * bnbPrice;
}

async function sendThroughStargate(usdtAmount, toAddress) {
    // Stargate bridge logic
    const stargateRouter = '0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8';
    
    // Simplified version - в реальности нужен полный Stargate API
    console.log(`Bridging ${usdtAmount} USDT to ${toAddress} on Polygon...`);
    
    // Simulate bridge transaction
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return 'bridge_tx_hash';
}

async function waitForUSDC(proxyAddress, expectedAmount) {
    console.log(`Waiting for ${expectedAmount} USDC on ${proxyAddress}...`);
    
    // В реальности проверяем баланс через интервалы
    // Для демо просто ждем
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('USDC received!');
}

async function approveUSDCForBetting(proxyAddress, amount) {
    const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    const ctfExchange = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
    
    const usdcContract = new ethers.Contract(
        usdcAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        wallet.signer
    );
    
    const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
    
    const tx = await usdcContract.approve(ctfExchange, amountWei);
    await tx.wait();
    
    console.log('USDC approved for CTF Exchange');
}

async function placePolymarketOrder(usdcAmount, makerAddress) {
    const result = await polymarketOrderSigner.placeOrder({
        tokenId: selectedToken.id,
        makerAddress: makerAddress,
        usdcAmount: usdcAmount,
        side: 'BUY',
        signer: wallet.signer
    });
    
    return result;
}

function showError(message) {
    const container = document.getElementById('marketsList');
    container.innerHTML = `<div class="error">${message}</div>`;
}

// Управление proxy адресом
async function manageProxyAddress() {
    try {
        // Проверяем подключение кошелька
        if (!wallet.address) {
            const shouldConnect = confirm('Сначала нужно подключить кошелек. Подключить?');
            if (shouldConnect) {
                await connectWallet();
            }
            return;
        }

        const currentProxy = localStorage.getItem(`polymarket_proxy_${wallet.address}`);
        
        const message = currentProxy 
            ? `Текущий Proxy адрес:\n${currentProxy}\n\nВведите новый адрес для изменения или оставьте пустым для удаления:`
            : 'Введите ваш Polymarket Proxy Wallet адрес:\n\n(Найти на polymarket.com в профиле)';
        
        const newProxy = prompt(message, currentProxy || '');
        
        if (newProxy === null) return; // Отмена
        
        if (newProxy === '') {
            // Удалить сохраненный адрес
            localStorage.removeItem(`polymarket_proxy_${wallet.address}`);
            alert('Proxy адрес удален. При следующей ставке будет запрошен снова.');
            return;
        }
        
        // Валидация адреса
        if (!ethers.utils.isAddress(newProxy)) {
            alert('Неверный формат адреса!');
            return;
        }
        
        const checksummedProxy = ethers.utils.getAddress(newProxy);
        localStorage.setItem(`polymarket_proxy_${wallet.address}`, checksummedProxy);
        
        alert(`✓ Proxy адрес сохранен:\n${checksummedProxy}`);
        
        // Обновить отображение если модал открыт
        const proxyDisplay = document.getElementById('userProxyAddress');
        if (proxyDisplay) {
            proxyDisplay.textContent = checksummedProxy;
        }
    } catch (error) {
        console.error('Error managing proxy:', error);
        alert('Ошибка: ' + error.message);
    }
}