# Stargate Bridge Integration

## Описание процесса размещения ставки

Когда пользователь нажимает "Разместить ставку", происходит следующий процесс:

### 1️⃣ **Swap BNB → USDT** (BSC, PancakeSwap)
- Пользователь вводит сумму в BNB
- BNB обменивается на USDT через PancakeSwap Router
- Contract: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- Slippage: 2%
- Gas limit: ~300,000

### 2️⃣ **Approve USDT** (BSC)
- USDT approve для Stargate Router
- Contract: `0x55d398326f99059fF775485246999027B3197955` (USDT BSC)
- Spender: `0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8` (Stargate Router)
- Проверка существующего allowance перед approve

### 3️⃣ **Bridge USDT → USDC** (BSC → Polygon, Stargate)
- USDT с BSC отправляется на Polygon как USDC
- Stargate Router: `0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8`
- Source Pool: 2 (USDT на BSC)
- Destination Pool: 1 (USDC на Polygon)
- Destination Chain: 109 (Polygon)
- Получатель: Proxy адрес пользователя на Polygon
- LayerZero fee: ~0.01 BNB
- Gas limit: ~500,000

### 4️⃣ **Ожидание получения USDC** (Polygon)
- Автоматическая проверка баланса USDC на proxy адресе
- Проверка каждые 30 секунд
- Максимум 20 попыток (10 минут)
- Переключение сети на Polygon для проверки

### 5️⃣ **Размещение ставки** (Polygon, Polymarket)
- Создание и подпись ордера для Polymarket
- Использование полученного USDC
- Ордер отправляется на Polymarket CLOB API

## Технические детали

### Контракты

**BSC:**
- PancakeSwap Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- WBNB: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
- USDT: `0x55d398326f99059fF775485246999027B3197955`
- Stargate Router: `0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8`

**Polygon:**
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`

### Комиссии

1. **PancakeSwap swap**: ~0.3% от суммы
2. **Stargate bridge**: ~0.1% + LayerZero fee (~0.01 BNB)
3. **Gas fees**: 
   - BSC swap: ~0.001-0.003 BNB
   - BSC approve: ~0.0005 BNB
   - BSC bridge: ~0.003-0.005 BNB
   - LayerZero: ~0.01 BNB

**Общая комиссия:** ~0.4% + 0.015-0.02 BNB в gas

### Время выполнения

- **Swap на PancakeSwap:** ~10-30 секунд
- **Approve USDT:** ~10-30 секунд
- **Stargate bridge:** 5-15 минут
- **Проверка баланса:** автоматически
- **Размещение ордера:** ~5-10 секунд

**Общее время:** 5-15 минут

## Обработка ошибок

### Возможные ошибки:

1. **Недостаточно BNB для gas**
   - Проверка баланса перед началом
   - Рекомендуется иметь минимум 0.05 BNB

2. **Slippage превышен**
   - Автоматический retry с увеличенным slippage
   - Уведомление пользователя

3. **Bridge timeout**
   - Продолжение проверки баланса вручную
   - Ссылки на explorers для отслеживания

4. **Proxy адрес не настроен**
   - Блокировка процесса
   - Запрос на настройку proxy

### Логирование

Все шаги логируются в консоль браузера:
- Расчет сумм
- Transaction hashes
- Статус каждого шага
- Ошибки с полным stack trace

## Тестирование

### Рекомендации для тестирования:

1. Начните с малой суммы (0.01-0.05 BNB)
2. Убедитесь что есть достаточно BNB для gas (~0.05 BNB)
3. Настройте proxy адрес перед началом
4. Откройте консоль (F12) для мониторинга
5. Подготовьте ссылки на explorers:
   - BSCScan: https://bscscan.com
   - PolygonScan: https://polygonscan.com

### Мониторинг прогресса:

В модале отображаются 5 шагов:
1. ⏳ → ✅ Расчет суммы
2. ⏳ → ✅ Swap BNB → USDT
3. ⏳ → ✅ Bridge USDT → USDC
4. ⏳ → ✅ Получение USDC
5. ⏳ → ✅ Размещение ставки

При ошибке: ⏳ → ❌

## Файлы

- `public/js/stargate-bridge.js` - Основная логика bridge
- `public/js/markets.js` - Интеграция с UI
- `public/markets.html` - HTML модалы
