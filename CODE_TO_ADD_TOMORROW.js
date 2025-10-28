// ===================================
// КОД ДЛЯ ДОБАВЛЕНИЯ ЗАВТРА
// ===================================

// ============================================================================
// 1. ДОБАВИТЬ В server.js (после строки app.use(express.static('public'));)
// ============================================================================

// Proxy endpoint для размещения ставок в Polymarket
app.post('/api/place-order', async (req, res) => {
    try {
        const order = req.body;
        console.log('📤 Placing order in Polymarket:');
        console.log('  Token ID:', order.tokenId);
        console.log('  Maker:', order.maker);
        console.log('  Side:', order.side);
        console.log('  Amount:', order.makerAmount);
        
        const response = await axios.post(
            'https://clob.polymarket.com/order',
            order,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 секунд
            }
        );
        
        console.log('✅ Order placed successfully!');
        console.log('  Order ID:', response.data.orderId);
        console.log('  Status:', response.data.status);
        
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Error placing order:');
        
        if (error.response) {
            // Ошибка от Polymarket API
            console.error('  Status:', error.response.status);
            console.error('  Data:', error.response.data);
            res.status(error.response.status).json({
                error: error.response.data.error || error.response.data.message || 'Polymarket API error',
                details: error.response.data
            });
        } else if (error.request) {
            // Запрос был отправлен но ответа не получено
            console.error('  No response from Polymarket');
            res.status(503).json({
                error: 'No response from Polymarket API. Try again later.'
            });
        } else {
            // Что-то пошло не так при настройке запроса
            console.error('  Error:', error.message);
            res.status(500).json({
                error: error.message
            });
        }
    }
});

// Endpoint для проверки существующих ставок пользователя
app.get('/api/user-orders/:address', async (req, res) => {
    try {
        const address = req.params.address;
        const response = await axios.get(
            `https://clob.polymarket.com/orders?maker=${address}`,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching user orders:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// 2. ЗАМЕНИТЬ В public/js/polymarket-order.js 
//    (найти функцию postOrder и заменить целиком)
// ============================================================================

async postOrder(signedOrder) {
    try {
        console.log('📤 Sending order to Polymarket...');
        console.log('Order data:', {
            tokenId: signedOrder.tokenId,
            maker: signedOrder.maker,
            side: signedOrder.side,
            price: signedOrder.price
        });

        // Отправляем через наш backend чтобы избежать CORS
        const response = await fetch('/api/place-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(signedOrder)
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

// ============================================================================
// 3. ОПЦИОНАЛЬНО: УЛУЧШЕНИЕ showBridgeProcess в public/js/markets.js
//    (Добавить после строки await showBridgeProcess(amountBNB, proxyAddress);)
// ============================================================================

// В функции placeBet() после строки:
// await showBridgeProcess(amountBNB, proxyAddress);

// Добавить:

// Закрыть bridge modal
document.getElementById('bridgeModal').style.display = 'none';

// Показать результат
alert(`✅ Ставка размещена успешно!\n\nПроверьте на polymarket.com в разделе "My Bets"`);

// Обновить баланс
await updateBalance();

// Обновить список маркетов
await loadMarkets();

// ============================================================================
// 4. АЛЬТЕРНАТИВНЫЙ ПУТЬ: Упрощенная версия БЕЗ bridge
//    (если bridge не работает - просто размещаем ставку напрямую)
// ============================================================================

// В public/js/markets.js заменить функцию placeBet на:

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

        // 1. Переключаемся на Polygon
        await wallet.switchToPolygon();
        wallet.signer = wallet.provider.getSigner();

        // 2. Получить proxy wallet
        const userAddress = await wallet.getAddress();
        const proxyAddress = await proxyWalletManager.getOrCreateProxyWallet(userAddress, wallet.signer);
        
        console.log('User address:', userAddress);
        console.log('Proxy address:', proxyAddress);

        // 3. УПРОЩЕННАЯ ВЕРСИЯ: Сразу размещаем ставку
        // (Предполагаем что у пользователя уже есть USDC на proxy адресе)
        
        const bnbPrice = bnbPriceTracker.getPrice();
        const usdcAmount = amountBNB * bnbPrice;
        
        const confirmation = confirm(
            `Разместить ставку?\n\n` +
            `Событие: ${selectedMarket.question}\n` +
            `Исход: ${selectedToken.outcome}\n` +
            `Сумма: ${usdcAmount.toFixed(2)} USDC\n` +
            `Коэффициент: ${(1/selectedToken.price).toFixed(2)}\n` +
            `Выигрыш: ${(usdcAmount/selectedToken.price).toFixed(2)} USDC\n\n` +
            `⚠️ ВАЖНО: У вас должен быть USDC на Polygon адресе:\n${proxyAddress}`
        );
        
        if (!confirmation) return;

        // Показываем процесс
        alert('⏳ Создаем подпись для ставки...');

        // Размещаем ставку напрямую
        const result = await placePolymarketOrder(usdcAmount, proxyAddress);
        
        console.log('Bet placed:', result);
        
        // Успех!
        alert(
            `✅ Ставка размещена!\n\n` +
            `Order ID: ${result.orderId}\n` +
            `Статус: ${result.status}\n\n` +
            `Проверьте на polymarket.com`
        );
        
        // Закрыть модал
        document.getElementById('bettingModal').style.display = 'none';
        
        // Обновить UI
        await updateBalance();

    } catch (error) {
        console.error('Bet placement error:', error);
        alert('❌ Ошибка при размещении ставки:\n\n' + error.message);
    }
}

// ============================================================================
// 5. ОТЛАДКА: Добавить логирование в polymarket-order.js
//    (В начало функции placeOrder)
// ============================================================================

async placeOrder(params) {
    console.log('=== PLACE ORDER DEBUG ===');
    console.log('1. Input params:', params);
    
    const { tokenId, makerAddress, usdcAmount, side, signer } = params;
    
    console.log('2. Token ID:', tokenId);
    console.log('3. Maker address:', makerAddress);
    console.log('4. USDC amount:', usdcAmount);
    console.log('5. Side:', side);
    console.log('6. Signer:', signer ? 'OK' : 'MISSING!');
    
    // ... остальной код функции
}

// ============================================================================
// 6. ПРОВЕРКА: Скрипт для тестирования в консоли браузера
//    (Открыть F12 на странице markets и вставить в консоль)
// ============================================================================

// Проверка 1: Proxy адрес сохранен?
console.log('Proxy address:', localStorage.getItem(`polymarket_proxy_${wallet.address}`));

// Проверка 2: Цена BNB работает?
console.log('BNB price:', bnbPriceTracker.getPrice());

// Проверка 3: Выбран маркет?
console.log('Selected market:', selectedMarket);
console.log('Selected token:', selectedToken);

// Проверка 4: Кошелек подключен?
console.log('Wallet address:', wallet.address);
console.log('Wallet signer:', wallet.signer);

// Проверка 5: Баланс USDC
wallet.getUSDCBalance(localStorage.getItem(`polymarket_proxy_${wallet.address}`))
    .then(balance => console.log('USDC balance:', balance));

// ============================================================================
// 7. FAQ: Частые проблемы и решения
// ============================================================================

/*
ПРОБЛЕМА: "Proxy address not found"
РЕШЕНИЕ: Нажать "⚙️ Управление Proxy" и ввести адрес вручную

ПРОБЛЕМА: "Insufficient USDC balance"
РЕШЕНИЕ: Пополнить USDC на proxy адрес через bridge или прямой перевод

ПРОБЛЕМА: "Invalid signature"
РЕШЕНИЕ: Убедиться что подключен правильный кошелек (владелец proxy)

ПРОБЛЕМА: "Network mismatch"
РЕШЕНИЕ: Переключиться на Polygon (код должен делать автоматически)

ПРОБЛЕМА: "CORS error"
РЕШЕНИЕ: Убедиться что запрос идет через `/api/place-order` а не напрямую

ПРОБЛЕМА: "Order rejected by Polymarket"
РЕШЕНИЕ: Проверить что:
  1. Proxy адрес правильный
  2. USDC есть на proxy адресе
  3. Подпись создана правильным кошельком
  4. Сумма больше минимальной ($1-2)
*/
