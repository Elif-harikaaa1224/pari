# Решение: Ставки через BNB Bridge без перезагрузки страницы

## Проблема
1. Пользователь бриджит BNB → USDT → USDC на Polygon
2. Деньги приходят на прокси кошелек
3. При переключении сети в Rabby Wallet страница перезагружается
4. Теряется контекст, ставка не засчитывается

## Решение: State Persistence + Network Listener

### 1. Сохранение состояния в localStorage/sessionStorage

```javascript
// utils/betStorage.js
export const BetStorage = {
  savePendingBet: (betData) => {
    sessionStorage.setItem('pendingBet', JSON.stringify({
      amount: betData.amount,
      timestamp: Date.now(),
      proxyWallet: betData.proxyWallet,
      status: 'pending_network_switch'
    }));
  },
  
  getPendingBet: () => {
    const bet = sessionStorage.getItem('pendingBet');
    return bet ? JSON.parse(bet) : null;
  },
  
  clearPendingBet: () => {
    sessionStorage.removeItem('pendingBet');
  }
};
```

### 2. Слушатель переключения сети

```javascript
// hooks/useNetworkListener.js
import { useEffect, useCallback } from 'react';
import { BetStorage } from '../utils/betStorage';

export const useNetworkListener = () => {
  useEffect(() => {
    // При переключении сети
    window.ethereum?.on('chainChanged', async (chainId) => {
      // НЕ перезагружаем страницу
      console.log('Сеть переключена на:', chainId);
      
      // Получаем ожидающую ставку
      const pendingBet = BetStorage.getPendingBet();
      
      if (pendingBet && chainId === '0x89') { // 0x89 = Polygon
        // Сеть переключена на Polygon - продолжаем обработку
        await processBetAfterNetworkSwitch(pendingBet);
      }
    });
    
    // Слушатель смены аккаунта
    window.ethereum?.on('accountsChanged', (accounts) => {
      console.log('Аккаунт переключен:', accounts);
      // Обновляем UI
    });
    
    return () => {
      window.ethereum?.removeAllListeners?.();
    };
  }, []);
};

const processBetAfterNetworkSwitch = async (pendingBet) => {
  try {
    const signer = await getSignerPolygon();
    const betContract = new ethers.Contract(
      POLYGON_BET_CONTRACT,
      BET_ABI,
      signer
    );
    
    // Проверяем баланс прокси кошелька
    const balance = await betContract.getProxyBalance(pendingBet.proxyWallet);
    
    if (balance >= pendingBet.amount) {
      // Размещаем ставку
      const tx = await betContract.placeBet(
        pendingBet.proxyWallet,
        pendingBet.amount
      );
      
      await tx.wait();
      console.log('✅ Ставка размещена!');
      BetStorage.clearPendingBet();
    } else {
      console.log('❌ Недостаточно средств на прокси');
    }
  } catch (error) {
    console.error('Ошибка при размещении ставки:', error);
  }
};
```

### 3. Основной поток ставки

```javascript
// components/BettingFlow.jsx
import { useNetworkListener } from '../hooks/useNetworkListener';
import { BetStorage } from '../utils/betStorage';

export const BettingFlow = () => {
  useNetworkListener(); // Подключаем слушатель
  
  const handlePlaceBet = async (amount) => {
    try {
      // 1. Сохраняем ставку ДО переключения сети
      BetStorage.savePendingBet({
        amount,
        proxyWallet: userProxyAddress
      });
      
      // 2. Переключаемся на нужную сеть
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }] // Polygon
      });
      
      // 3. НЕ делаем ничего здесь - слушатель обработает
      // страница перезагружается или нет - неважно
      
    } catch (error) {
      if (error.code === 4902) {
        // Сеть не добавлена - добавляем
        await addPolygonNetwork();
      }
    }
  };
  
  return (
    <button onClick={() => handlePlaceBet(100)}>
      Сделать ставку
    </button>
  );
};
```

### 4. Альтернатива: Отключение перезагрузки в провайдере

```javascript
// Если хотите полностью отключить перезагрузку:
// в вашем eth_rpc провайдере

window.ethereum.on('chainChanged', () => {
  // ⚠️ ВАЖНО: Это НЕ перезагружает страницу
  // и сохраняет все состояние React
  console.log('Сеть изменилась');
});

// Нужно явно обновить контракты и провайдеры
const reinitializeProviders = async () => {
  const newProvider = new ethers.providers.Web3Provider(window.ethereum);
  const newSigner = newProvider.getSigner();
  // Обновляем состояние React
};
```

## Лучшая практика: Использовать wagmi + viem

```typescript
// Если используете React - это просто!
import { useChainId, useSwitchChain } from 'wagmi';

export const BetComponent = () => {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  // wagmi автоматически НЕ перезагружает страницу
  // и сохраняет состояние
  
  const placeBet = async (amount) => {
    if (chainId !== 137) { // Polygon
      await switchChain({ chainId: 137 });
    }
    // Состояние сохранилось - продолжаем!
  };
};
```

## Проверка баланса на Polygon перед ставкой

```javascript
// Перед размещением ставки проверяем баланс на контракте
const verifyProxyBalance = async (proxyAddress, expectedAmount) => {
  const provider = new ethers.providers.JsonRpcProvider(
    'https://polygon-rpc.com'
  );
  
  const usdcContract = new ethers.Contract(
    POLYGON_USDC_ADDRESS,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  const balance = await usdcContract.balanceOf(proxyAddress);
  return balance.gte(ethers.utils.parseUnits(expectedAmount, 6));
};
```

## Итоговая архитектура

```
Пользователь делает ставку
    ↓
Сохраняем данные в sessionStorage
    ↓
Переключаемся на сеть (страница может перезагрузиться)
    ↓
Слушатель chainChanged срабатывает
    ↓
Проверяем баланс прокси кошелька на Polygon
    ↓
Если баланс OK → размещаем ставку
    ↓
Очищаем sessionStorage ✅
```

## Варианты по уровню сложности

**Вариант 1 (Простой)**: sessionStorage + chainListener
**Вариант 2 (Средний)**: Добавить БД (сохранять статус ставок)
**Вариант 3 (Продвинутый)**: wagmi + viem + локальное состояние

Какой вариант больше нравится?
