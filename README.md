# 🎯 PariVision - Polymarket Betting Platform

## ✅ РАБОТАЕТ! Полная интеграция с Polymarket

Каждый пользователь размещает ставки напрямую в пул Polymarket через свой Proxy Wallet.

---

## 🚀 Быстрый старт

```bash
npm start
```

Откройте http://localhost:3000/markets

---

## 🎮 Как это работает

### Для пользователя (5 простых шагов):

1. **Подключает MetaMask** (BNB или Polygon)
2. **Выбирает событие** из 500+ активных маркетов
3. **Вводит сумму в BNB** (например, 0.1 BNB)
4. **Система автоматически:**
   - Находит/создает Proxy Wallet ✅
   - Делает bridge BNB → USDC ✅
   - Размещает ставку в Polymarket ✅
5. **Проверяет на polymarket.com** - ставка там! 🎉

---

## 💰 Реальная цена BNB

✅ Обновляется каждые 30 секунд  
✅ Из 3 источников: CoinGecko, Binance, CoinCap  
✅ Отображается в верхней панели  
✅ Автоматический пересчет в USDC  

---

## 🔧 Что реализовано

### 1. Proxy Wallet Manager
- Автоматический поиск существующих Gnosis Safe
- Создание новых через Proxy Factory
- Детерминистические адреса (create2)
- Кеширование для скорости

### 2. EIP-712 Order Signing
- Типизированные подписи для Polymarket
- Получение цен из orderbook
- Posting в CLOB API (без API ключей!)
- Управление ордерами

### 3. BNB Price Tracker
- Реальная цена каждые 30 сек
- 3 источника данных
- Автообновление UI
- Точная конвертация BNB ↔ USD

### 4. Bridge Process
- Модальное окно с 5 шагами
- BNB → USDT (PancakeSwap)
- USDT → USDC (Stargate)
- Автоматический approve
- Визуализация прогресса

---

## 📦 Файлы проекта

### ✨ Новые компоненты:

```
public/js/
├── proxy-wallet.js          # Proxy wallet management
├── polymarket-order.js      # EIP-712 order signing
├── bnb-price-tracker.js     # Реальная цена BNB
└── markets.js               # Полный процесс ставок
```

### 📄 Документация:

```
POLYMARKET_INTEGRATION.md    # Подробная документация
README.md                    # Это файл
```

---

## 🎯 Процесс размещения ставки

```
Пользователь вводит сумму в BNB
         ↓
Система получает реальную цену BNB ($XXX.XX)
         ↓
Вычисляет сумму в USDC
         ↓
Находит/создает Proxy Wallet
         ↓
Открывает Bridge Modal:
  1. ⚡ Swap BNB → USDT (PancakeSwap)
  2. 🌉 Bridge USDT → USDC (Stargate)
  3. 📥 Получение USDC на Polygon
  4. ✅ Approve USDC для CTF Exchange
  5. 🎯 Подпись EIP-712 и размещение
         ↓
✅ Ставка в пуле Polymarket!
```

---

## 🔐 Безопасность

✅ **Приватные ключи НЕ на сервере** - все в MetaMask  
✅ **EIP-712 подписи** - видите что подписываете  
✅ **Proxy Wallet под контролем** - ваш Gnosis Safe  
✅ **Публичные API** - не нужны credentials  
✅ **Open Source** - весь код доступен  

---

## 💡 Требования

- MetaMask установлен
- BNB на BSC (~0.1-0.5 для теста)
- MATIC на Polygon (~0.1 для gas)

---

## 🧪 Тест

```bash
# 1. Запустить
npm start

# 2. Открыть
http://localhost:3000/markets

# 3. Подключить MetaMask

# 4. Выбрать любое событие

# 5. Ввести 0.05 BNB

# 6. Подтвердить транзакции

# 7. Проверить на polymarket.com ✅
```

---

## ❓ FAQ

**Q: Куда идут деньги?**  
A: На ваш личный Gnosis Safe proxy wallet

**Q: Нужны API ключи?**  
A: НЕТ! Работает через публичные endpoints

**Q: Откуда цена BNB?**  
A: CoinGecko/Binance/CoinCap, обновляется каждые 30 сек

**Q: Сколько времени занимает ставка?**  
A: ~6-16 минут (bridge + подтверждения)

**Q: Можно проверить ставку?**  
A: ДА! На polymarket.com → Portfolio → Orders

**Q: Сколько стоит?**  
A: Gas BSC (~$0.5) + Swap (~0.25%) + Bridge (~0.1%) + Gas Polygon (~$0.05)

---

## 📊 Контракты

### Polygon:
- CTF Exchange: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- Proxy Factory: `0x91E9382983B5CD5F2F46e19B0EF93A3C816F0D39`

### BSC:
- PancakeSwap: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- Stargate: `0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8`

---

## 📚 Документация

- **Полная документация:** [POLYMARKET_INTEGRATION.md](./POLYMARKET_INTEGRATION.md)
- **Polymarket Docs:** https://docs.polymarket.com
- **CLOB Client GitHub:** https://github.com/Polymarket/clob-client

---

## ✅ Готово к использованию!

Все компоненты реализованы и протестированы:

✅ Proxy Wallet Manager  
✅ EIP-712 Order Signing  
✅ Реальная цена BNB  
✅ Bridge интеграция  
✅ Polymarket CLOB API  

**Ставки идут напрямую в Polymarket!** 🎉

---

Made with ❤️ for Polymarket integration
