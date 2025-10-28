# 🌉 Symbiosis Bridge Integration

## Что это?

Symbiosis - это cross-chain протокол для обмена токенов между различными блокчейнами. Мы используем его для автоматического bridge BNB (BSC) → USDC (Polygon).

## Преимущества перед Stargate

✅ **Проще в использовании** - один вызов вместо множества шагов
✅ **Автоматический роутинг** - находит лучший путь для swap
✅ **Поддержка нативных токенов** - можно отправлять BNB напрямую
✅ **Встроенный swap** - не нужно делать отдельный swap на PancakeSwap
✅ **Отслеживание статуса** - API для проверки транзакций

## Как работает наша интеграция

### 1. Инициализация
```javascript
const symbiosisBridge = new SymbiosisBridge();
await symbiosisBridge.init();
```

### 2. Получение quote (оценка выхода)
```javascript
const estimatedUSDC = await symbiosisBridge.getQuote(amountBNB);
// Возвращает примерное количество USDC которое получим
```

### 3. Выполнение bridge
```javascript
const result = await symbiosisBridge.swapBNBtoUSDC(
    amountBNB,          // Сколько BNB отправляем
    proxyAddress,       // Куда получить USDC на Polygon
    wallet.provider,    // Web3 provider (MetaMask)
    onStatusUpdate      // Callback для обновления UI
);
```

### 4. Получение результата
```javascript
{
    success: true,
    txHash: "0x...",           // Hash транзакции на BSC
    outputAmount: "598.45",    // Количество USDC
    toAddress: "0x..."         // Адрес получателя на Polygon
}
```

## Процесс с точки зрения пользователя

1. **Пользователь вводит сумму** в BNB
2. **Система показывает оценку** сколько USDC получит
3. **Пользователь подтверждает** транзакцию в MetaMask
4. **Транзакция отправляется** на BSC
5. **Symbiosis обрабатывает** (5-15 минут):
   - Получает BNB на BSC
   - Обменивает на промежуточные токены если нужно
   - Отправляет через мосты на Polygon
   - Конвертирует в USDC на Polygon
   - Отправляет на указанный адрес
6. **USDC появляется** на Proxy адресе пользователя на Polygon
7. **Автоматически размещается ставка** на Polymarket

## Технические детали

### Структура входных токенов
```javascript
const tokenAmountIn = {
    chainId: 56,              // BSC
    address: '',              // Пустой = нативный токен (BNB)
    symbol: 'BNB',
    decimals: 18,
    amount: ethers.utils.parseEther(amountBNB.toString()).toString()
};

const tokenOut = {
    chainId: 137,             // Polygon
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    symbol: 'USDC',
    decimals: 6
};
```

### Параметры swap
```javascript
const { route, tokenAmountOut } = await swapping.exactIn(
    tokenAmountIn,
    tokenOut,
    toAddress,         // Получатель
    5,                 // Slippage 5%
    deadline           // Unix timestamp
);
```

### Отслеживание статуса
```javascript
// Symbiosis API endpoint
GET https://api.symbiosis.finance/crosschain/v1/tx/{txHash}

// Возвращает:
{
    status: "pending" | "success" | "failed",
    from_chain: 56,
    to_chain: 137,
    ...
}
```

## Обработка ошибок

### Типичные ошибки:

**1. "User rejected transaction"**
- Пользователь отклонил транзакцию в MetaMask
- Решение: Попросить подтвердить заново

**2. "Insufficient funds"**
- Недостаточно BNB для транзакции + gas
- Решение: Показать сколько нужно (сумма + ~$2 gas)

**3. "Route not found"**
- Symbiosis не может найти путь для swap
- Решение: Попробовать другую сумму или проверить ликвидность

**4. "Bridge timeout"**
- Транзакция обрабатывается дольше ожидаемого
- Решение: Продолжить ожидание, проверить на PolygonScan

## Fees (комиссии)

### Что платит пользователь:
1. **Gas на BSC** (~$0.20-0.50) - за отправку транзакции
2. **Symbiosis fee** (~0.1-0.3%) - комиссия протокола
3. **Slippage** (до 5%) - разница между ожидаемой и фактической ценой

### Итого:
При обмене 0.1 BNB (~$60):
- Отправил: 0.1 BNB
- Получил: ~59.5 USDC
- Потери: ~$0.70 (1.2%)

## Мониторинг транзакций

### В консоли браузера (F12):
```
=== Starting Symbiosis Bridge ===
Amount BNB: 0.1
Route calculated:
- Input: 100000000000000000 BNB
- Output: 59500000 USDC
Transaction hash: 0x...
Bridge status check 1/60: pending
Bridge status check 2/60: pending
...
Bridge status check 15/60: completed
✅ Средства получены на Polygon!
```

### На блокчейн эксплорерах:
- **BSC**: https://bscscan.com/tx/{txHash}
- **Polygon**: https://polygonscan.com/address/{proxyAddress}

## Тестирование

### В testnet:
1. Получить test BNB на BSC testnet
2. Изменить `new Symbiosis('mainnet')` на `new Symbiosis('testnet')`
3. Использовать testnet адреса токенов

### С минимальными суммами:
- Минимум: 0.01 BNB (~$6)
- Рекомендуется для теста: 0.05 BNB (~$30)

## Альтернативные сценарии

### Если Symbiosis недоступен:
```javascript
async getQuote(amountBNB) {
    try {
        // Пытаемся получить quote от Symbiosis
        return await this.symbiosisQuote(amountBNB);
    } catch (error) {
        // Fallback на простой расчет по текущей цене
        const bnbPrice = bnbPriceTracker.getPrice();
        return (amountBNB * bnbPrice * 0.995).toFixed(2);
    }
}
```

### Если bridge занимает слишком долго:
- Показываем пользователю прогресс
- Даем возможность проверить статус вручную
- Сохраняем txHash для последующей проверки

## Полезные ссылки

- **Документация**: https://docs.symbiosis.finance/
- **JS SDK**: https://docs.symbiosis.finance/developer-tools/symbiosis-js-sdk
- **API**: https://docs.symbiosis.finance/developer-tools/symbiosis-api
- **Explorer**: https://explorer.symbiosis.finance/
- **GitHub**: https://github.com/symbiosis-finance/js-sdk

## Поддержка

Если возникают проблемы:
1. Проверьте консоль браузера (F12)
2. Проверьте баланс BNB на BSC
3. Проверьте статус транзакции на BscScan
4. Подождите 15-20 минут для bridge
5. Проверьте баланс USDC на Polygon

## Roadmap улучшений

- [ ] Добавить предварительный расчет gas fees
- [ ] Показывать детальный breakdown комиссий
- [ ] Сохранять историю bridge транзакций
- [ ] Добавить возможность bridge из других сетей
- [ ] Интеграция с Symbiosis Explorer для трекинга
