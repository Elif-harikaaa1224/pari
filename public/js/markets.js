// Markets page functionality
let markets = [];
let selectedMarket = null;
let selectedToken = null;
let config = null;

// Setup network change listener
function setupNetworkListener() {
    if (!window.ethereum) return;
    
    console.log('Setting up network change listener...');
    
    window.ethereum.on('chainChanged', async (chainIdHex) => {
        const chainId = parseInt(chainIdHex, 16);
        console.log('Network changed to chainId:', chainId);
        
        // Удаляем уведомление о переключении если есть
        const notification = document.getElementById('pendingBetNotification');
        if (notification) {
            notification.remove();
        }
        
        // НЕ перезагружаем страницу! Проверяем pending bet
        const pendingBetData = localStorage.getItem('pendingPolymarketBet');
        
        if (pendingBetData && chainId === 137) {
            console.log('✓ Switched to Polygon with pending bet - processing...');
            
            // Небольшая задержка для стабилизации провайдера
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Обрабатываем ставку
            await processPendingBet();
        } else if (pendingBetData && chainId !== 137) {
            console.log('Pending bet exists but not on Polygon yet, chainId:', chainId);
        } else {
            console.log('No pending bet or wrong network');
        }
    });
}

async function initMarkets() {
    // Устанавливаем listener для смены сети ПЕРВЫМ делом
    setupNetworkListener();
    
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
        
        // Проверяем есть ли незавершенная ставка после переключения сети
        await checkPendingBet();
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

async function processPendingBet() {
    try {
        const pendingBetData = localStorage.getItem('pendingPolymarketBet');
        if (!pendingBetData) {
            console.log('No pending bet found');
            return;
        }
        
        const pendingBet = JSON.parse(pendingBetData);
        console.log('Processing pending bet:', pendingBet);
        
        // Проверяем что это свежая ставка (не старше 10 минут)
        const age = Date.now() - pendingBet.timestamp;
        if (age > 10 * 60 * 1000) {
            console.log('Pending bet too old, removing');
            localStorage.removeItem('pendingPolymarketBet');
            return;
        }
        
        // Удаляем из localStorage чтобы не повторялось
        localStorage.removeItem('pendingPolymarketBet');
        
        // Восстанавливаем selectedToken и selectedMarket для placePolymarketOrder
        selectedToken = {
            id: pendingBet.tokenId,
            outcome: pendingBet.outcome,
            price: pendingBet.price
        };
        
        selectedMarket = {
            slug: pendingBet.marketSlug,
            question: pendingBet.marketQuestion
        };
        
        // Показываем модал с процессом
        const modal = document.getElementById('betModal');
        const modalContent = document.querySelector('.modal-content');
        
        modal.style.display = 'block';
        modalContent.innerHTML = `
            <span class="close" onclick="closeBridgeModal()">&times;</span>
            <h2>Размещение ставки</h2>
            <div class="bridge-status">
                <div class="info">
                    ⏳ Создание и подпись ордера для Polymarket...<br><br>
                    <strong>Событие:</strong> ${pendingBet.marketQuestion}<br>
                    <strong>Исход:</strong> ${pendingBet.outcome}<br>
                    <strong>Сумма:</strong> ${pendingBet.usdcBalance} USDC
                </div>
            </div>
        `;
        
        // Размещаем ставку
        try {
            console.log('Placing order with:', {
                tokenId: pendingBet.tokenId,
                proxyAddress: pendingBet.proxyAddress,
                amount: pendingBet.usdcBalance
            });
            
            const orderResult = await placePolymarketOrder(
                parseFloat(pendingBet.usdcBalance),
                pendingBet.proxyAddress
            );
            
            console.log('✓ Order placed successfully:', orderResult);
            
            // Показываем успех
            const status = document.querySelector('.bridge-status');
            status.innerHTML = `
                <div class="success">
                    ✅ <strong>Ставка успешно размещена!</strong><br><br>
                    <strong>Событие:</strong> ${pendingBet.marketQuestion}<br>
                    <strong>Исход:</strong> ${pendingBet.outcome}<br>
                    <strong>Цена:</strong> $${pendingBet.price}<br>
                    <strong>Сумма:</strong> ${pendingBet.usdcBalance} USDC<br><br>
                    ${orderResult.orderId ? `<strong>Order ID:</strong> ${orderResult.orderId}<br>` : ''}
                    <a href="https://polymarket.com/event/${pendingBet.marketSlug}" target="_blank" class="btn btn-primary">📊 View on Polymarket</a>
                </div>
            `;
            
            // Обновляем баланс
            await updateBalance();
            
        } catch (error) {
            console.error('Error placing order:', error);
            
            const status = document.querySelector('.bridge-status');
            status.innerHTML = `
                <div class="error">
                    ❌ <strong>Ошибка размещения ставки</strong><br><br>
                    ${error.message}<br><br>
                    <strong>USDC на адресе:</strong> ${pendingBet.proxyAddress}<br>
                    <a href="https://polygonscan.com/address/${pendingBet.proxyAddress}" target="_blank" class="btn btn-secondary">📊 Polygon Address</a>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error processing pending bet:', error);
    }
}

async function checkPendingBet() {
    try {
        const pendingBetData = localStorage.getItem('pendingPolymarketBet');
        if (!pendingBetData) return;
        
        const pendingBet = JSON.parse(pendingBetData);
        console.log('Found pending bet:', pendingBet);
        
        // Проверяем что это свежая ставка (не старше 10 минут)
        const age = Date.now() - pendingBet.timestamp;
        if (age > 10 * 60 * 1000) {
            console.log('Pending bet too old, removing');
            localStorage.removeItem('pendingPolymarketBet');
            return;
        }
        
        // Проверяем что мы на Polygon
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();
        
        if (network.chainId !== 137) {
            console.log('Not on Polygon yet, switching now...');
            
            // Показываем уведомление что переключаемся на Polygon
            const notification = document.createElement('div');
            notification.id = 'pendingBetNotification';
            notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
            notification.innerHTML = '⏳ Обнаружена незавершенная ставка. Переключение на Polygon...';
            document.body.appendChild(notification);
            
            try {
                await wallet.switchToPolygon();
                console.log('Polygon switch requested - chainChanged listener will handle bet placement');
            } catch (error) {
                console.error('Failed to switch to Polygon:', error);
                notification.innerHTML = '⚠️ Переключите сеть на Polygon вручную для завершения ставки';
                notification.style.background = '#ff9800';
            }
            
            return;
        }
        
        // Если уже на Polygon - сразу обрабатываем
        console.log('✓ Already on Polygon! Processing bet...');
        await processPendingBet();
        
    } catch (error) {
        console.error('Error checking pending bet:', error);
    }
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
            // Используем RPC для проверки баланса без переключения сети
            const polygonRPC = 'https://polygon-rpc.com';
            const polygonProvider = new ethers.providers.JsonRpcProvider(polygonRPC);
            const usdcContract = new ethers.Contract(
                '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
                ['function balanceOf(address) view returns (uint256)'],
                polygonProvider
            );
            
            const balance = await usdcContract.balanceOf(savedProxy);
            const balanceFormatted = ethers.utils.formatUnits(balance, 6); // USDC has 6 decimals
            
            document.getElementById('bettingBalance').textContent = 
                parseFloat(balanceFormatted).toFixed(2);
            console.log(`💰 USDC balance on proxy (${savedProxy}):`, balanceFormatted);
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
    const placeBetBtn = document.getElementById('placeBetBtn');
    if (placeBetBtn) {
        placeBetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎯 Place bet button clicked!');
            placeBet(e);
            return false;
        });
        console.log('✓ Place bet button handler attached');
    } else {
        console.error('❌ placeBetBtn not found!');
    }
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

async function placeBet(event) {
    // Предотвращаем перезагрузку страницы
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const amountBNB = parseFloat(document.getElementById('betAmountBNB').value);
    
    if (!amountBNB || amountBNB <= 0) {
        alert('Введите сумму ставки в BNB');
        return false;
    }

    try {
        // 0. Проверка подключения кошелька
        if (!wallet.address) {
            alert('Подключите кошелек');
            return false;
        }

        // 1. Проверка proxy адреса
        const userAddress = wallet.address;
        const savedProxy = localStorage.getItem(`polymarket_proxy_${userAddress}`);
        
        if (!savedProxy || !ethers.utils.isAddress(savedProxy)) {
            alert('⚠️ Proxy адрес не настроен! Нажмите "⚙️ Управление Proxy"');
            return;
        }

        // Проверка наличия Symbiosis
        if (typeof symbiosisBridge === 'undefined') {
            alert('❌ Symbiosis Bridge не загружен! Перезагрузите страницу.');
            console.error('symbiosisBridge is undefined!');
            return;
        }

        console.log('=== Starting bet placement ===');
        console.log('Connected wallet address:', wallet.address);
        console.log('Proxy address:', savedProxy);
        console.log('Bet amount (BNB):', amountBNB);
        
        // Проверка сети - должна быть BSC
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();
        console.log('Current network:', network.chainId, network.name);
        
        if (network.chainId !== 56) {
            alert(`❌ Неверная сеть!\n\nТекущая сеть: ${network.name || network.chainId}\nНужна: BNB Smart Chain (BSC)\n\nПереключите сеть в кошельке на BSC и попробуйте снова.`);
            return false;
        }
        
        // 2. Показать bridge modal и запустить процесс
        console.log('Opening bridge process modal...');
        await showBridgeProcess(amountBNB, savedProxy);

    } catch (error) {
        console.error('Bet placement error:', error);
        alert('Ошибка: ' + error.message);
    }
    
    return false; // Предотвращаем любое стандартное поведение
}

async function showBridgeProcess(amountBNB, proxyAddress) {
    console.log('=== showBridgeProcess called ===');
    console.log('Amount BNB:', amountBNB);
    console.log('Proxy address:', proxyAddress);
    console.log('symbiosisBridge exists:', typeof symbiosisBridge !== 'undefined');
    
    // Open bridge modal
    console.log('Closing betting modal...');
    document.getElementById('bettingModal').style.display = 'none';
    console.log('Opening bridge modal...');
    document.getElementById('bridgeModal').style.display = 'block';
    console.log('Modals switched');

    // Получаем реальную цену BNB
    const bnbPrice = bnbPriceTracker.getPrice();
    const usdcAmount = amountBNB * bnbPrice;
    console.log('BNB price:', bnbPrice, 'USDC amount:', usdcAmount);

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
        // Функция для обновления статуса
        const onStatusUpdate = (message) => {
            status.innerHTML = `<div class="loading">${message}</div>`;
        };

        // Step 1: Получить quote
        updateStep(1, 'active');
        onStatusUpdate('⏳ Расчет лучшего маршрута...');
        
        const estimatedOutput = await symbiosisBridge.getQuote(amountBNB);
        console.log('Estimated USDC output:', estimatedOutput);
        
        updateElement('bridgeUSDCAmount', `≈${estimatedOutput} USDC`);
        updateStep(1, 'completed', '✅');
        
        // Step 2-3: Выполнить полный bridge процесс (PancakeSwap + Stargate)
        updateStep(2, 'active');
        
        // Используем текущий provider (предполагаем что уже на BSC)
        const currentProvider = new ethers.providers.Web3Provider(window.ethereum);
        
        const result = await symbiosisBridge.bridgeAndBet(
            amountBNB,
            proxyAddress,
            currentProvider,
            onStatusUpdate
        );
        
        updateStep(2, 'completed', '✅');
        updateStep(3, 'completed', '✅');
        
        // Step 4: Ждем получения USDC на Polygon (даем время на bridge)
        updateStep(4, 'active');
        onStatusUpdate('⏳ Ожидание получения USDC на Polygon (5-15 мин)...');
        
        // Создаем отдельный provider для Polygon (без переключения сети в кошельке)
        const polygonRPC = 'https://polygon-rpc.com';
        const polygonProvider = new ethers.providers.JsonRpcProvider(polygonRPC);
        const usdcContract = new ethers.Contract(
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
            ['function balanceOf(address) view returns (uint256)'],
            polygonProvider
        );
        
        // Ждем 30 секунд перед первой проверкой
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Проверяем баланс несколько раз
        let usdcBalance = '0';
        for (let i = 0; i < 20; i++) {
            try {
                const balance = await usdcContract.balanceOf(proxyAddress);
                usdcBalance = ethers.utils.formatUnits(balance, 6); // USDC has 6 decimals
                console.log(`Balance check ${i + 1}/20:`, usdcBalance);
                
                if (parseFloat(usdcBalance) >= parseFloat(estimatedOutput) * 0.9) {
                    break; // Баланс получен!
                }
            } catch (e) {
                console.error('Balance check error:', e);
            }
            
            onStatusUpdate(`⏳ Ожидание USDC... Проверка ${i + 1}/20 (${Math.floor((i + 1) * 30)}с)`);
            await new Promise(resolve => setTimeout(resolve, 30000)); // 30 секунд между проверками
        }
        
        updateStep(4, 'completed', '✅');
        
        // Step 5: Размещение ставки
        updateStep(5, 'active');
        
        console.log('=== Step 5: Placing bet ===');
        console.log('Selected market:', selectedMarket);
        console.log('Selected token:', selectedToken);
        console.log('USDC balance:', usdcBalance);
        console.log('Proxy address:', proxyAddress);
        
        // Сохраняем состояние перед переключением сети (страница может перезагрузиться)
        const pendingBet = {
            marketSlug: selectedMarket.slug,
            marketQuestion: selectedMarket.question,
            tokenId: selectedToken.id,
            outcome: selectedToken.outcome,
            price: selectedToken.price,
            usdcBalance: usdcBalance,
            proxyAddress: proxyAddress,
            timestamp: Date.now()
        };
        
        console.log('Saving pending bet to localStorage:', pendingBet);
        localStorage.setItem('pendingPolymarketBet', JSON.stringify(pendingBet));
        
        // Показываем промежуточное сообщение
        status.innerHTML = `
            <div class="info">
                ✅ USDC получен: ${usdcBalance}<br><br>
                ⏳ Переключите сеть на <strong>Polygon</strong> в кошельке для размещения ставки...<br><br>
                <small>Ожидание переключения сети...</small>
            </div>
        `;
        
        // Запрашиваем переключение на Polygon
        try {
            console.log('Requesting Polygon network switch...');
            await wallet.switchToPolygon();
            console.log('Switch request sent - page will reload');
            
            // Показываем финальное сообщение
            status.innerHTML = `
                <div class="info">
                    ✅ <strong>Bridge успешно завершен!</strong><br><br>
                    <strong>USDC получен:</strong> ${usdcBalance}<br>
                    <strong>Bridge TX:</strong> <a href="https://bscscan.com/tx/${result.txHash}" target="_blank">${result.txHash.slice(0, 10)}...</a><br><br>
                    ⏳ Переключение на Polygon для размещения ставки...<br><br>
                    <small>После переключения сети страница перезагрузится и ставка разместится автоматически.</small>
                </div>
            `;
            
        } catch (switchError) {
            console.log('Switch error:', switchError);
            
            status.innerHTML = `
                <div class="info">
                    ✅ <strong>Bridge успешно завершен!</strong><br><br>
                    <strong>USDC получен:</strong> ${usdcBalance}<br>
                    <strong>Bridge TX:</strong> <a href="https://bscscan.com/tx/${result.txHash}" target="_blank">${result.txHash.slice(0, 10)}...</a><br><br>
                    ⚠️ <strong>Переключите сеть на Polygon вручную</strong><br><br>
                    После переключения страница перезагрузится и ставка разместится автоматически.<br><br>
                    <a href="https://polygonscan.com/address/${proxyAddress}" target="_blank" class="btn btn-secondary">📊 Polygon Address</a>
                </div>
            `;
        }

        // Обновить баланс
        setTimeout(updateBalance, 2000);

    } catch (error) {
        console.error('Bridge process error:', error);
        status.innerHTML = `<div class="error">❌ Ошибка: ${error.message}<br><br>Детали в консоли (F12)</div>`;
        
        // Mark current step as error
        const activeStep = document.querySelector('.step.active');
        if (activeStep) {
            activeStep.classList.remove('active');
            activeStep.classList.add('error');
            const statusSpan = activeStep.querySelector('.step-status');
            if (statusSpan) statusSpan.textContent = '❌';
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
    console.log('=== Placing Polymarket Order ===');
    console.log('Selected market:', selectedMarket);
    console.log('Selected token:', selectedToken);
    console.log('Token ID:', selectedToken.id);
    console.log('Maker address:', makerAddress);
    console.log('USDC amount:', usdcAmount);
    
    const result = await polymarketOrderSigner.placeOrder({
        tokenId: selectedToken.id,
        makerAddress: makerAddress,
        usdcAmount: usdcAmount,
        side: 'BUY',
        signer: wallet.signer
    });
    
    console.log('Order placement result:', result);
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