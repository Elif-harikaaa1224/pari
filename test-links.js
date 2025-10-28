const axios = require('axios');

async function testLinks() {
  try {
    const response = await axios.get('https://gamma-api.polymarket.com/markets?limit=3&active=true&closed=false');
    
    response.data.forEach((m, i) => {
      console.log(`${i+1}. ${m.question.substring(0, 50)}...`);
      console.log(`   ID: ${m.id}`);
      console.log(`   Slug: ${m.slug}`);
      console.log(`   Link: https://polymarket.com/event/${m.slug}`);
      console.log('');
    });
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testLinks();
