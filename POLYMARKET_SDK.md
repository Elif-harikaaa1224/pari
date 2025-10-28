# Polymarket SDK Integration

## Что реализовано

### PolymarketClient (polymarket-client.js)

Frontend клиент для работы с Polymarket CLOB API напрямую из браузера.

#### Основные функции:

**1. Инициализация**
```javascript
await polymarketClient.initialize(signer, chainId);
```
- Принимает ethers.js signer (от MetaMask)
- Работает только с Polygon (chainId 137)

**2. Размещение ордера**
```javascript
const order = await polymarketClient.createMarketOrder(tokenId, amount, 'BUY');
```
- Автоматически получает лучшую цену из orderbook
- Создает EIP-712 подпись для ордера
- Отправляет на CLOB API
- Возвращает orderID

**3. Approve USDC**
```javascript
await polymarketClient.approveUSDC(amount);
```
- Проверяет текущий allowance
- Запрашивает approve только если нужно
- Адрес USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (Polygon)
- Адрес CTF Exchange: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`

**4. Управление ордерами**
```javascript
const orders = await polymarketClient.getUserOrders(address);
await polymarketClient.cancelOrder(orderId);
```

**5. Цены из orderbook**
```javascript
const bestPrice = await polymarketClient.getBestPrice(tokenId, 'BUY');
const midpoint = await polymarketClient.getMidpoint(tokenId);
```

## Процесс размещения ставки

1. **Подключение кошелька** - пользователь подключает MetaMask
2. **Переключение на Polygon** - автоматически через `wallet.switchToPolygon()`
3. **Инициализация клиента** - `polymarketClient.initialize(wallet.signer, 137)`
4. **Approve USDC** - разрешение CTF Exchange тратить USDC
5. **Создание ордера** - `createMarketOrder()` с EIP-712 подписью
6. **Отправка в CLOB** - POST запрос на `https://clob.polymarket.com/order`

## Важные адреса (Polygon)

- **USDC**: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- **CTF Exchange**: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
- **Safe Factory**: `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2`
- **Proxy Factory**: `0x91E9382983B5CD5F2F46e19B0EF93A3C816F0D39`

## EIP-712 Подпись ордера

Polymarket использует EIP-712 типизированную подпись для ордеров:

```javascript
const domain = {
    name: 'Polymarket CTF Exchange',
    version: '1',
    chainId: 137,
    verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'
};

const types = {
    Order: [
        { name: 'maker', type: 'address' },
        { name: 'taker', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'makerAmount', type: 'uint256' },
        { name: 'takerAmount', type: 'uint256' },
        { name: 'side', type: 'uint8' },
        { name: 'feeRateBps', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'signer', type: 'address' },
        { name: 'expiration', type: 'uint256' }
    ]
};
```

## UI Flow в markets.js

```javascript
// 1. Пользователь нажимает "Bet" на карточке маркета
openBettingModal(market, button)

// 2. Вводит сумму ставки
calculatePayout() // расчет потенциального выигрыша

// 3. Нажимает "Сделать ставку"
async placeBet() {
    // Переключение на Polygon
    await wallet.switchToPolygon();
    
    // Инициализация клиента
    await polymarketClient.initialize(wallet.signer, 137);
    
    // Approve USDC
    await polymarketClient.approveUSDC(amount);
    
    // Создание ордера
    const order = await polymarketClient.createMarketOrder(tokenId, amount, 'BUY');
    
    // Успех!
}
```

## Текущие ограничения

1. **Только рыночные ордера (market orders)** - берет лучшую цену из orderbook
2. **Только BUY** - пока реализована только покупка исходов
3. **Без API ключей** - работает без регистрации Polymarket API credentials
4. **Polygon only** - контракты только на Polygon mainnet

## Расширение функциональности

### Для лимитных ордеров:
```javascript
await polymarketClient.createLimitOrder(tokenId, amount, price, 'BUY');
```

### Для продажи (SELL):
```javascript
await polymarketClient.createMarketOrder(tokenId, amount, 'SELL');
```

### Для My Bets страницы:
```javascript
const orders = await polymarketClient.getUserOrders(userAddress);
// Отображение активных и завершенных ставок
```

## Безопасность

- ✅ Подписи создаются локально в браузере
- ✅ Приватные ключи не передаются на сервер
- ✅ Используется EIP-712 для типизированных подписей
- ✅ Проверка allowance перед approve
- ⚠️ Нет rate limiting на CLOB API
- ⚠️ Нужна валидация токенов от Gamma API

## Тестирование

1. Подключите MetaMask к Polygon Mainnet
2. Убедитесь, что у вас есть USDC на балансе
3. Откройте http://localhost:3000/markets
4. Выберите маркет и нажмите на исход
5. Введите сумму и нажмите "Сделать ставку"
6. Подтвердите approve USDC в MetaMask (если первый раз)
7. Подтвердите подпись ордера в MetaMask
8. Ордер отправлен в CLOB!
