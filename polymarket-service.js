const axios = require('axios');

// Gamma API - публичный API Polymarket
const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

class PolymarketService {
  // Получаем маркеты из Gamma API и группируем по событиям
  async getPopularMarkets(limit = 100) {
    try {
      console.log('Fetching markets from Gamma API...');
      
      // Получаем максимум маркетов для лучшей группировки
      const response = await axios.get(`${GAMMA_API}/markets`, {
        params: {
          limit: 500, // Максимальное количество для получения всех популярных событий
          active: true,
          closed: false,
          order: 'volume24hr',
          ascending: false
        },
        timeout: 20000
      });
      
      let markets = response.data;
      console.log(`✓ Fetched ${markets.length} markets from Gamma API\n`);
      
      // Группируем маркеты по событиям
      const eventGroups = {};
      const standaloneMarkets = [];
      
      markets.forEach((market, idx) => {
        try {
          // Парсим цены
          if (market.outcomePrices) {
            const prices = JSON.parse(market.outcomePrices);
            const yesPrice = parseFloat(prices[0] || 0.5);
            const noPrice = parseFloat(prices[1] || 0.5);
            
            // Парсим токены
            let tokenIds = ['', ''];
            if (market.clobTokenIds) {
              try {
                tokenIds = JSON.parse(market.clobTokenIds);
              } catch (e) {}
            }
            
            market.tokens = [
              { token_id: tokenIds[0] || '', outcome: 'Yes', price: yesPrice.toString() },
              { token_id: tokenIds[1] || '', outcome: 'No', price: noPrice.toString() }
            ];
          }
          
          // Проверяем, является ли маркет частью события с несколькими исходами
          if (market.events && market.events.length > 0) {
            const event = market.events[0];
            const eventSlug = event.slug;
            
            if (!eventGroups[eventSlug]) {
              eventGroups[eventSlug] = {
                id: event.id || market.id,
                slug: eventSlug,
                question: event.title,
                description: event.description,
                endDate: event.endDate || market.endDate,
                endDateIso: event.endDate || market.endDateIso,
                // Event image (fallback to icon or market image)
                image: event.image || event.icon || market.image || market.icon || '',
                category: market.category || event.category,
                volume: 0, // Будем суммировать
                volume24hr: 0, // Будем суммировать
                active: event.active && !event.closed,
                closed: event.closed || market.closed,
                isMultiOutcome: true,
                outcomes: []
              };
            }
            
            // Суммируем объемы всех маркетов события
            eventGroups[eventSlug].volume += parseFloat(market.volume || 0);
            eventGroups[eventSlug].volume24hr += parseFloat(market.volume24hr || 0);
            
            // Добавляем исход к событию
            if (market.tokens && market.tokens.length >= 2) {
              eventGroups[eventSlug].outcomes.push({
                marketId: market.id,
                conditionId: market.conditionId,
                question: market.question,
                slug: market.slug,
                price: parseFloat(market.tokens[0].price),
                tokenId: market.tokens[0].token_id,
                noTokenId: market.tokens[1].token_id
              });
            }
          } else {
            // Обычный бинарный маркет
            if (market.tokens && market.tokens.length >= 2) {
              standaloneMarkets.push(market);
            }
          }
        } catch (e) {
          console.log(`Error parsing market ${idx + 1}: ${e.message}`);
        }
      });
      
      // Преобразуем события в формат для отображения
      const groupedEvents = Object.values(eventGroups)
        .filter(event => {
          // Включаем события с несколькими исходами ИЛИ популярные одиночные
          const isActive = event.active && !event.closed;
          const hasMultipleOutcomes = event.outcomes.length > 1;
          const hasAnyVolume = event.volume24hr > 0 || event.volume > 0;
          
          return isActive && hasMultipleOutcomes && hasAnyVolume;
        })
        .map(event => {
          // Сортируем исходы по вероятности
          event.outcomes.sort((a, b) => b.price - a.price);
          console.log(`EVENT: ${event.question.substring(0, 60)}... (${event.outcomes.length} outcomes, Vol: $${(event.volume24hr || 0).toFixed(0)})`);
          return event;
        });
      
      // Добавляем standalone маркеты (популярные бинарные маркеты)
      const validStandaloneMarkets = standaloneMarkets
        .filter(m => {
          const hasValidPrices = m.tokens.some(t => parseFloat(t.price) > 0 && parseFloat(t.price) < 1);
          const isActive = m.active && !m.closed;
          const hasVolume = m.volume24hr > 50 || m.volume > 500; // Еще ниже порог
          return hasValidPrices && isActive && hasVolume;
        })
        .map(m => {
          m.isMultiOutcome = false;
          console.log(`BINARY: ${m.question.substring(0, 60)}... YES: ${(parseFloat(m.tokens[0].price) * 100).toFixed(1)}% (Vol: $${(m.volume24hr || 0).toFixed(0)})`);
          return m;
        });
      
      // Объединяем и сортируем по объему за 24 часа
      const allMarkets = [...groupedEvents, ...validStandaloneMarkets]
        .sort((a, b) => {
          const volA = a.volume24hr || a.volume || 0;
          const volB = b.volume24hr || b.volume || 0;
          return volB - volA;
        })
        .slice(0, Math.min(limit, 150)); // Максимум 150 событий
      
      console.log(`\n✓ Successfully loaded ${allMarkets.length} items (${groupedEvents.length} multi-outcome, ${validStandaloneMarkets.length} binary)!\n`);
      return allMarkets;
      
    } catch (error) {
      console.error('Error fetching from Gamma API:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response:', error.response.data);
      }
      return [];
    }
  }

  // Get market by ID
  async getMarketById(marketId) {
    try {
      const response = await axios.get(`${GAMMA_API}/markets/${marketId}`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching market:', error.message);
      throw error;
    }
  }

  // Get user orders
  async getUserOrders(proxyAddress) {
    try {
      const response = await axios.get(`${CLOB_API}/orders`, {
        params: { maker: proxyAddress },
        timeout: 10000
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching user orders:', error.message);
      return [];
    }
  }

  // Get token price
  async getTokenPrice(tokenId) {
    try {
      const response = await axios.get(`${CLOB_API}/midpoint`, {
        params: { token_id: tokenId },
        timeout: 5000
      });
      return response.data?.mid || '0.5';
    } catch (error) {
      return '0.5';
    }
  }

  // Get orderbook price
  async getPrice(tokenId, side = 'BUY') {
    try {
      const response = await axios.get(`${CLOB_API}/price`, {
        params: { token_id: tokenId, side: side },
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching price:', error.message);
      return { price: '0.5' };
    }
  }

  // Get midpoint
  async getMidpoint(tokenId) {
    try {
      const response = await axios.get(`${CLOB_API}/midpoint`, {
        params: { token_id: tokenId },
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching midpoint:', error.message);
      throw error;
    }
  }
}

module.exports = new PolymarketService();