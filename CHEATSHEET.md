# 🎯 ШПАРГАЛКА - БЫСТРЫЙ СТАРТ

## 📋 ЧТО ЧИТАТЬ ЗАВТРА (по порядку):

1. **QUICK_START_TOMORROW.md** ← НАЧАТЬ С ЭТОГО
2. **CODE_TO_ADD_TOMORROW.js** ← КОПИРОВАТЬ КОД ОТСЮДА
3. **STATUS_REPORT.md** ← ЕСЛИ НУЖНЫ ДЕТАЛИ

---

## 🚀 ЗАПУСК СЕРВЕРА

```bash
cd C:\Users\Viktor\Desktop\Pari
node server.js
```

Откроется: http://localhost:3000/markets

---

## ⚙️ ПЕРВЫЙ ШАГ: НАСТРОИТЬ PROXY

1. Открыть http://localhost:3000/markets
2. Подключить MetaMask
3. Кнопка **"⚙️ Управление Proxy"**
4. Ввести адрес с polymarket.com
5. Готово! ✅

---

## 💻 ЧТО ДОБАВИТЬ В КОД

### 1. В `server.js` (после строки 15):

```javascript
app.post('/api/place-order', async (req, res) => {
    // ... код из CODE_TO_ADD_TOMORROW.js секция 1
});
```

### 2. В `public/js/polymarket-order.js` (заменить postOrder):

```javascript
async postOrder(signedOrder) {
    // ... код из CODE_TO_ADD_TOMORROW.js секция 2
}
```

---

## ✅ ПРОВЕРКИ

**В консоли браузера (F12):**
```javascript
// Proxy сохранен?
localStorage.getItem(`polymarket_proxy_${wallet.address}`)

// Цена BNB?
bnbPriceTracker.getPrice()

// Маркет выбран?
console.log(selectedMarket, selectedToken)
```

---

## 🎯 ЦЕЛЬ НА ЗАВТРА

**Сделать ОДНУ рабочую ставку через сайт!**

1. Настроить Proxy (5 мин) ✅
2. Добавить код (30 мин) ✅
3. Протестировать (15 мин) ✅

**Время:** 1 час максимум

---

## 🆘 ЕСЛИ НЕ РАБОТАЕТ

### Ошибка при нажатии кнопки Proxy
→ Подключите кошелек сначала

### Ошибка при размещении ставки
→ Проверьте `/api/place-order` добавлен в server.js

### Ставка не появилась на Polymarket
→ Подождите 1-2 минуты, обновите страницу

---

## 📂 ВАЖНЫЕ ФАЙЛЫ

- `server.js` - добавить endpoint
- `public/js/polymarket-order.js` - обновить postOrder
- `public/js/proxy-wallet.js` - управление proxy

---

**ВСЕГО 3 ФАЙЛА ИЗМЕНИТЬ ⚡**

**ВРЕМЯ: ~1 ЧАС 🕐**

**РЕЗУЛЬТАТ: РАБОЧИЕ СТАВКИ 🎉**

---

_Удачи! Начинай с QUICK_START_TOMORROW.md_
