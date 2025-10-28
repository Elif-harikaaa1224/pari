const axios = require('axios');

async function testEventStructure() {
  try {
    const response = await axios.get('https://gamma-api.polymarket.com/markets?limit=30&active=true&closed=false');
    
    // Группируем по событиям
    const eventGroups = {};
    
    response.data.forEach(market => {
      // Проверяем, есть ли events
      if (market.events && market.events.length > 0) {
        const event = market.events[0];
        const eventSlug = event.slug;
        
        if (!eventGroups[eventSlug]) {
          eventGroups[eventSlug] = {
            title: event.title,
            slug: eventSlug,
            markets: []
          };
        }
        
        eventGroups[eventSlug].markets.push({
          question: market.question,
          slug: market.slug,
          id: market.id,
          prices: JSON.parse(market.outcomePrices || '["0", "0"]')
        });
      }
    });
    
    // Показываем события с несколькими маркетами
    console.log('=== СОБЫТИЯ С НЕСКОЛЬКИМИ ИСХОДАМИ ===\n');
    Object.values(eventGroups).forEach(event => {
      if (event.markets.length > 1) {
        console.log(`EVENT: ${event.title}`);
        console.log(`Slug: ${event.slug}`);
        console.log(`Markets count: ${event.markets.length}`);
        event.markets.slice(0, 5).forEach((m, i) => {
          console.log(`  ${i+1}. ${m.question.substring(0, 60)}... (${(parseFloat(m.prices[0]) * 100).toFixed(1)}%)`);
        });
        console.log('');
      }
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testEventStructure();
