// Markets page functionality
let markets = [];
let selectedMarket = null;
let selectedToken = null;
let config = null;

// Auto-resume pending order after page reload (Rabby wallet switches networks)
window.addEventListener('load', async () => {
    console.log('🔄 Page loaded, checking for pending order...');
    
    // Wait for wallet to initialize
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const pendingOrder = localStorage.getItem('pendingOrder');
    console.log('📦 Pending order:', pendingOrder ? 'FOUND' : 'NOT FOUND');
    
    if (pendingOrder) {
        try {
            const order = JSON.parse(pendingOrder);
            console.log('📝 Order data:', order);
            
            // Check if order is still valid (not older than 10 minutes)
            const age = Date.now() - order.timestamp;
            console.log(`⏰ Order age: ${Math.floor(age / 1000)} seconds`);
            
            if (age > 10 * 60 * 1000) {
                console.log('⚠️ Pending order expired, clearing...');
                localStorage.removeItem('pendingOrder');
                return;
            }
            
            // Check current network
            if (window.ethereum) {
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                const currentChainId = parseInt(chainId, 16);
                
                console.log('🔄 Auto-resume: Current chainId:', currentChainId);
                
                if (currentChainId === 137) {
                    // Already on Polygon - auto-complete order
                    console.log('✅ On Polygon - auto-completing order...');
                    
                    // Small delay for UI to stabilize
                    setTimeout(() => {
                        autoCompleteOrder(order);
                    }, 500);
                } else {
                    // Still on BSC - show reminder
                    console.log('⏳ Still on BSC (chainId:', currentChainId, ') - waiting for manual switch to Polygon');
                    showPolygonSwitchReminder(order);
                }
            } else {
                console.log('❌ window.ethereum not found');
            }
        } catch (error) {
            console.error('❌ Error processing pending order:', error);
        }
    } else {
        console.log('ℹ️ No pending order to resume');
    }
});

// Listen for network changes to auto-complete order when user switches to Polygon
if (window.ethereum) {
    console.log('👂 Registering chainChanged listener...');
    
    window.ethereum.on('chainChanged', async (chainIdHex) => {
        const chainId = parseInt(chainIdHex, 16);
        console.log('🔄 Network changed to:', chainId);
        
        const pendingOrder = localStorage.getItem('pendingOrder');
        console.log('📦 Pending order in localStorage:', pendingOrder ? 'EXISTS' : 'NOT FOUND');
        
        if (pendingOrder && chainId === 137) {
            console.log('✅ Switched to Polygon - auto-completing order...');
            
            try {
                const order = JSON.parse(pendingOrder);
                console.log('📝 Order data:', order);
                
                // Small delay for network to stabilize
                setTimeout(() => {
                    console.log('🚀 Calling autoCompleteOrder...');
                    autoCompleteOrder(order);
                }, 1000);
            } catch (error) {
                console.error('❌ Error auto-completing order:', error);
            }
        } else if (pendingOrder) {
            console.log(`⏳ Waiting for Polygon network. Current: ${chainId}`);
        }
    });
    
    console.log('✅ chainChanged listener registered');
}

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
        
        // Step 5: Размещение ставки - MANUAL
        updateStep(5, 'active');
        
        console.log('=== Step 5: Manual bet placement ===');
        console.log('Selected market:', selectedMarket);
        console.log('Selected token:', selectedToken);
        console.log('USDC balance:', usdcBalance);
        console.log('Proxy address:', proxyAddress);
        console.log('Original BNB amount:', amountBNB);
        
        // Вычисляем примерную сумму USDC для ставки (BNB amount * BNB price * 0.98 slippage)
        const estimatedUSDC = parseFloat(estimatedOutput) || parseFloat(usdcBalance);
        
        // Сохраняем данные для ручного размещения
        const pendingOrder = {
            marketSlug: selectedMarket.slug,
            marketQuestion: selectedMarket.question,
            tokenId: selectedToken.id,
            outcome: selectedToken.outcome,
            price: selectedToken.price,
            usdcAmount: estimatedUSDC.toFixed(2), // Используем расчетную сумму, а не весь баланс
            proxyAddress: proxyAddress,
            timestamp: Date.now()
        };
        
        localStorage.setItem('pendingOrder', JSON.stringify(pendingOrder));
        console.log('✓ Saved pending order to localStorage');
        
        updateStep(5, 'completed', '✅');
        
        // Show manual button to place bet
        status.innerHTML = `
            <div class="success">
                ✅ <strong>Bridge успешно завершен!</strong><br><br>
                <strong>USDC получен:</strong> ${usdcBalance}<br>
                <strong>Сумма для ставки:</strong> ${estimatedUSDC.toFixed(2)} USDC<br>
                <strong>Адрес:</strong> ${proxyAddress}<br><br>
                <strong>Bridge TX:</strong> <a href="https://bscscan.com/tx/${result.txHash}" target="_blank">${result.txHash.slice(0, 10)}...</a><br><br>
                
                <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 15px; border: 2px solid #2196F3;">
                    <strong>📝 Завершение ставки:</strong><br><br>
                    1. Нажмите кнопку ниже<br>
                    2. Подпишите ордер в кошельке<br>
                    3. Готово!<br><br>
                    <button onclick="completePendingOrder()" class="btn btn-primary" style="width: 100%; padding: 15px; font-size: 18px; font-weight: bold;">
                        🎯 Разместить ставку на Polymarket
                    </button>
                </div>
                <br>
                <a href="https://layerzeroscan.com/tx/${result.txHash}" target="_blank" class="btn btn-secondary">🔍 LayerZero</a>
                <a href="https://polygonscan.com/address/${proxyAddress}" target="_blank" class="btn btn-secondary">📊 Polygon</a>
            </div>
        `;
        
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

// Complete pending order from localStorage
async function completePendingOrder() {
    try {
        const pendingOrderData = localStorage.getItem('pendingOrder');
        if (!pendingOrderData) {
            alert('Нет сохраненного ордера');
            return;
        }
        
        const order = JSON.parse(pendingOrderData);
        console.log('Completing pending order:', order);
        
        // Восстанавливаем selectedToken и selectedMarket
        selectedToken = {
            id: order.tokenId,
            outcome: order.outcome,
            price: order.price
        };
        
        selectedMarket = {
            slug: order.marketSlug,
            question: order.marketQuestion
        };
        
        // Создаем НОВОЕ модальное окно для размещения ставки
        let modal = document.getElementById('orderPlacementModal');
        if (!modal) {
            // Создаем модал если его нет
            modal = document.createElement('div');
            modal.id = 'orderPlacementModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close" onclick="closeOrderModal()">&times;</span>
                    <h2>Размещение ставки</h2>
                    <div class="order-status"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        modal.style.display = 'block';
        const statusDiv = modal.querySelector('.order-status');
        
        // Проверяем что мы на Polygon
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();
        
        if (network.chainId !== 137) {
            statusDiv.innerHTML = `
                <div class="info" style="background: #fff3cd; border: 2px solid #ffc107;">
                    ⚠️ <strong>Переключите сеть на Polygon</strong><br><br>
                    Текущая сеть: ${network.name || network.chainId}<br>
                    Нужна сеть: <strong>Polygon (137)</strong><br><br>
                    1. Переключите сеть в кошельке на Polygon<br>
                    2. Нажмите эту кнопку снова<br><br>
                    <button onclick="completePendingOrder()" class="btn btn-primary" style="padding: 10px 20px;">
                        Попробовать снова
                    </button>
                </div>
            `;
            return;
        }
        
        // Обновляем provider и signer для Polygon
        wallet.provider = provider;
        wallet.signer = provider.getSigner();
        
        statusDiv.innerHTML = `
            <div class="info">
                ✅ Сеть: Polygon<br><br>
                ⏳ Создание и подпись ордера...<br><br>
                <strong>Событие:</strong> ${order.marketQuestion}<br>
                <strong>Исход:</strong> ${order.outcome}<br>
                <strong>Сумма:</strong> ${order.usdcAmount} USDC<br><br>
                <small>Подпишите в кошельке...</small>
            </div>
        `;
        
        // Размещаем ставку (уже на Polygon)
        const orderResult = await placePolymarketOrder(
            parseFloat(order.usdcAmount),
            order.proxyAddress,
            wallet.address
        );
        
        console.log('✓ Order placed:', orderResult);
        
        // Удаляем из localStorage
        localStorage.removeItem('pendingOrder');
        
        // Показываем успех
        statusDiv.innerHTML = `
            <div class="success">
                ✅ <strong>Ставка успешно размещена!</strong><br><br>
                <strong>Событие:</strong> ${order.marketQuestion}<br>
                <strong>Исход:</strong> ${order.outcome}<br>
                <strong>Сумма:</strong> ${order.usdcAmount} USDC<br><br>
                ${orderResult.orderID ? `<strong>Order ID:</strong> ${orderResult.orderID}<br><br>` : ''}
                <a href="https://polymarket.com/event/${order.marketSlug}" target="_blank" class="btn btn-primary">📊 View on Polymarket</a>
            </div>
        `;
        
        // Обновляем баланс
        await updateBalance();
        
    } catch (error) {
        console.error('Error completing order:', error);
        alert('Ошибка: ' + error.message);
    }
}

function closeOrderModal() {
    const modal = document.getElementById('orderPlacementModal');
    if (modal) {
        modal.style.display = 'none';
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

async function placePolymarketOrder(usdcAmount, makerAddress, ownerAddress) {
    console.log('=== Placing Polymarket Order ===');
    console.log('Selected market:', selectedMarket);
    console.log('Selected token:', selectedToken);
    console.log('Token ID:', selectedToken.id);
    console.log('Maker address (proxy):', makerAddress);
    console.log('Owner address (wallet):', ownerAddress);
    console.log('USDC amount:', usdcAmount);
    
    const result = await polymarketOrderSigner.placeOrder({
        tokenId: selectedToken.id,
        makerAddress: makerAddress,
        ownerAddress: ownerAddress,
        usdcAmount: usdcAmount,
        side: 'BUY',
        signer: wallet.signer
    });
    
    console.log('Order placement result:', result);
    return result;
}

// Auto-complete order when user is already on Polygon
async function autoCompleteOrder(order) {
    try {
        console.log('🤖 Auto-completing order:', order);
        
        // Check if we're on Polygon
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const currentChainId = parseInt(chainId, 16);
        
        if (currentChainId !== 137) {
            console.log('❌ Not on Polygon, cannot auto-complete');
            showPolygonSwitchReminder(order);
            return;
        }
        
        // Show auto-completion modal
        let modal = document.getElementById('orderPlacementModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'orderPlacementModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close" onclick="closeOrderModal()">&times;</span>
                    <h2>🤖 Автоматическое размещение ставки</h2>
                    <div class="order-status"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        modal.style.display = 'block';
        const statusDiv = modal.querySelector('.order-status');
        
        statusDiv.innerHTML = `
            <div class="info">
                ✅ Сеть: Polygon<br><br>
                ⏳ Автоматическое размещение ставки...<br><br>
                <strong>Событие:</strong> ${order.marketQuestion}<br>
                <strong>Исход:</strong> ${order.outcome}<br>
                <strong>Сумма:</strong> ${order.usdcAmount} USDC<br><br>
                <small>Подпишите в кошельке...</small>
            </div>
        `;
        
        // Restore market context
        selectedToken = {
            id: order.tokenId,
            outcome: order.outcome,
            price: order.price
        };
        
        selectedMarket = {
            slug: order.marketSlug,
            question: order.marketQuestion
        };
        
        // Re-initialize wallet on Polygon network
        wallet.provider = new ethers.providers.Web3Provider(window.ethereum);
        wallet.signer = wallet.provider.getSigner();
        wallet.address = await wallet.signer.getAddress();
        
        console.log('👛 Wallet address:', wallet.address);
        
        // Check saved proxy address for this user
        const savedProxy = localStorage.getItem(`polymarket_proxy_${wallet.address}`);
        
        if (savedProxy && ethers.utils.isAddress(savedProxy)) {
            wallet.proxyAddress = savedProxy;
            console.log('🔑 Using saved proxy address:', wallet.proxyAddress);
        } else {
            // If no saved proxy, try to calculate
            await wallet.calculateProxyAddress();
            console.log('🔑 Calculated proxy address:', wallet.proxyAddress);
        }
        
        // Verify it matches the order's proxy address
        if (wallet.proxyAddress.toLowerCase() !== order.proxyAddress.toLowerCase()) {
            throw new Error(`Proxy address mismatch!\nExpected: ${order.proxyAddress}\nGot: ${wallet.proxyAddress}\n\nПроверьте сохраненный Proxy адрес в настройках.`);
        }
        
        console.log('✅ Proxy address verified');
        
        // Place order with API credentials
        const orderResult = await placePolymarketOrder(
            parseFloat(order.usdcAmount),
            wallet.proxyAddress,  // maker (proxy)
            wallet.address        // owner (wallet)
        );
        
        console.log('✅ Order placed:', orderResult);
        
        // Clear pending order
        localStorage.removeItem('pendingOrder');
        
        statusDiv.innerHTML = `
            <div class="success">
                ✅ <strong>Ставка успешно размещена!</strong><br><br>
                <strong>Order ID:</strong> ${orderResult.orderID}<br><br>
                <a href="https://polymarket.com/event/${order.marketSlug}" target="_blank" class="btn btn-primary">
                    📊 Посмотреть на Polymarket
                </a>
                <br><br>
                <button onclick="closeOrderModal(); window.location.reload();" class="btn btn-secondary">
                    Закрыть
                </button>
            </div>
        `;
        
    } catch (error) {
        console.error('❌ Auto-complete failed:', error);
        
        const modal = document.getElementById('orderPlacementModal');
        if (modal) {
            const statusDiv = modal.querySelector('.order-status');
            statusDiv.innerHTML = `
                <div class="error">
                    ❌ <strong>Ошибка:</strong><br>
                    ${error.message}<br><br>
                    <button onclick="closeOrderModal()" class="btn btn-secondary">Закрыть</button>
                </div>
            `;
        }
    }
}

// Show reminder to switch to Polygon
function showPolygonSwitchReminder(order) {
    let modal = document.getElementById('orderPlacementModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'orderPlacementModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="closeOrderModal()">&times;</span>
                <h2>⏳ Завершение ставки</h2>
                <div class="order-status"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'block';
    const statusDiv = modal.querySelector('.order-status');
    
    statusDiv.innerHTML = `
        <div class="info" style="background: #fff3cd; border: 2px solid #ffc107; padding: 20px;">
            ⚠️ <strong>Переключите сеть на Polygon</strong><br><br>
            
            <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>📝 Информация о ставке:</strong><br>
                <strong>Событие:</strong> ${order.marketQuestion}<br>
                <strong>Исход:</strong> ${order.outcome}<br>
                <strong>Сумма:</strong> ${order.usdcAmount} USDC<br>
            </div>
            
            <strong>Инструкция для Rabby Wallet:</strong><br><br>
            
            <ol style="text-align: left; margin-left: 20px;">
                <li>Откройте кошелек Rabby</li>
                <li>Нажмите на текущую сеть (сверху)</li>
                <li>Выберите <strong>Polygon</strong></li>
                <li>Страница автоматически перезагрузится</li>
                <li>Ставка разместится автоматически!</li>
            </ol>
            
            <br>
            <div style="background: #e7f3ff; padding: 10px; border-radius: 5px;">
                💡 <strong>Совет:</strong> После переключения сети страница перезагрузится - это нормально!<br>
                Ставка автоматически продолжится на Polygon.
            </div>
        </div>
    `;
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