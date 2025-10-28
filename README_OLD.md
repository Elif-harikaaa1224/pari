# 🎯 PariVision - Децентрализованная платформа ставок на Polymarket

Полная интеграция с Polymarket через BNB bridge. Каждый пользователь размещает ставки со своего кошелька напрямую в пулы Polymarket.

## ✅ Главные фичи

- 🔐 **Decentralized** - Никаких серверных кошельков, только ваш MetaMask
- 🌉 **Auto Bridge** - BNB → USDC через PancakeSwap + Stargate
- 🏦 **Proxy Wallets** - Автоматическое создание Gnosis Safe для каждого
- 📝 **EIP-712 Signing** - Безопасные подписи ордеров
- 🎯 **Real Polymarket** - Ставки размещаются в настоящих пулах
- ✨ **No API Keys** - Работает без регистрации

---

## 🚀 Быстрый старт

```bash
# Установка
npm install

# Запуск
npm start

# Открыть
http://localhost:3000/markets
```

---

## 💡 Как это работает

### Для пользователя:

1. Подключает BNB кошелек (MetaMask)
2. Выбирает событие и исход
3. Вводит сумму в BNB
4. Система автоматически:
   - Находит/создает Proxy Wallet
   - Обменивает BNB → USDC
   - Отправляет на Polygon
   - Размещает ставку в Polymarket

5. **Проверяет ставку на polymarket.com** ✅

### Технически:

```
BNB Wallet (BSC)
    ↓
Gnosis Safe Proxy (создается автоматически)
    ↓  
BNB → USDT (PancakeSwap)
    ↓
USDT → USDC (Stargate Bridge)
    ↓
USDC Approve (CTF Exchange)
    ↓
EIP-712 Signature (MetaMask)
    ↓
CLOB API (Polymarket)
    ↓
✅ Ставка в пуле!
```

---

## 📦 Компоненты

### Frontend (100% работы)

- **proxy-wallet.js** - Управление Gnosis Safe proxy
- **polymarket-order.js** - EIP-712 подписи и CLOB API
- **markets.js** - Полный процесс ставок с bridge
- **wallet.js** - Web3 интеграция (BSC/Polygon)

### Backend (минимальный)

- **polymarket-service.js** - Gamma API для маркетов
- **server.js** - Express статика

### Контракты (Polygon)

- CTF Exchange: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- Proxy Factory: `0x91E9382983B5CD5F2F46e19B0EF93A3C816F0D39`

---

## 🎮 Процесс ставки

```
1. Выбор события → 2. Ввод BNB → 3. Bridge Modal
    ↓                     ↓              ↓
[Маркет]          [0.1 BNB ≈ $60]   [5 шагов]
                                        ↓
                                 ✅ Ставка размещена
```

**Время:** ~6-16 минут (bridge + подтверждения)

**Комиссии:** 
- Gas BSC: ~$0.50
- Swap: ~0.25%
- Bridge: ~0.1%
- Gas Polygon: ~$0.01
- Polymarket: 2% от выигрыша

---

## 🔐 Безопасность

✅ Приватные ключи остаются в MetaMask  
✅ EIP-712 типизированные подписи  
✅ Proxy wallet под вашим контролем  
✅ Все транзакции требуют подтверждения  
✅ Открытый исходный код  

❌ Нет серверных кошельков  
❌ Нет API ключей  
❌ Нет custody  

---

## 📖 Документация

- **[POLYMARKET_INTEGRATION.md](./POLYMARKET_INTEGRATION.md)** - Полная техническая документация
- **[Polymarket Docs](https://docs.polymarket.com/)** - Официальная документация
- **[Gamma API](https://gamma-api.polymarket.com/docs)** - API reference

---

## 🧪 Тестирование

### Требования:
- MetaMask с BNB (BSC mainnet)
- ~0.1 BNB для теста
- ~0.1 MATIC для gas (Polygon)

### Тест:
1. Откройте http://localhost:3000/markets
2. Подключите кошелек
3. Выберите событие с низким volume
4. Введите 0.01-0.05 BNB
5. Пройдите bridge process
6. Проверьте на polymarket.com

---

## ⚡ Статус

**Готово к использованию!**

✅ Proxy wallet auto-creation  
✅ EIP-712 order signing  
✅ CLOB API integration  
✅ Bridge BSC → Polygon  
✅ Real Polymarket orders  

**Ваши ставки размещаются в реальных пулах Polymarket!** 🎉

---

## 📄 Лицензия

MIT

---

**Сделано с ❤️ для децентрализованного беттинга**
