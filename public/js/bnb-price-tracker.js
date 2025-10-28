// BNB Price Tracker
// Получает реальную цену BNB из нескольких источников

class BNBPriceTracker {
    constructor() {
        this.price = 600; // Default fallback
        this.updateInterval = 30000; // 30 seconds
        this.isUpdating = false;
    }

    // Get BNB price from multiple sources
    async fetchPrice() {
        try {
            // Source 1: CoinGecko API (бесплатный, без API ключа)
            const coinGeckoPrice = await this.fetchFromCoinGecko();
            if (coinGeckoPrice) {
                this.price = coinGeckoPrice;
                return coinGeckoPrice;
            }

            // Source 2: Binance API (публичный)
            const binancePrice = await this.fetchFromBinance();
            if (binancePrice) {
                this.price = binancePrice;
                return binancePrice;
            }

            // Source 3: CoinCap API
            const coinCapPrice = await this.fetchFromCoinCap();
            if (coinCapPrice) {
                this.price = coinCapPrice;
                return coinCapPrice;
            }

            console.warn('Could not fetch BNB price, using cached:', this.price);
            return this.price;

        } catch (error) {
            console.error('Error fetching BNB price:', error);
            return this.price;
        }
    }

    // CoinGecko API
    async fetchFromCoinGecko() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
            const data = await response.json();
            
            if (data.binancecoin && data.binancecoin.usd) {
                console.log('BNB price from CoinGecko:', data.binancecoin.usd);
                return parseFloat(data.binancecoin.usd);
            }
            return null;
        } catch (error) {
            console.error('CoinGecko fetch error:', error);
            return null;
        }
    }

    // Binance Public API
    async fetchFromBinance() {
        try {
            const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
            const data = await response.json();
            
            if (data.price) {
                console.log('BNB price from Binance:', data.price);
                return parseFloat(data.price);
            }
            return null;
        } catch (error) {
            console.error('Binance fetch error:', error);
            return null;
        }
    }

    // CoinCap API
    async fetchFromCoinCap() {
        try {
            const response = await fetch('https://api.coincap.io/v2/assets/binance-coin');
            const data = await response.json();
            
            if (data.data && data.data.priceUsd) {
                console.log('BNB price from CoinCap:', data.data.priceUsd);
                return parseFloat(data.data.priceUsd);
            }
            return null;
        } catch (error) {
            console.error('CoinCap fetch error:', error);
            return null;
        }
    }

    // Get current cached price
    getPrice() {
        return this.price;
    }

    // Start auto-update
    startAutoUpdate() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        
        // Initial fetch
        this.fetchPrice().then(() => {
            this.updateUI();
        });

        // Update every 30 seconds
        this.interval = setInterval(async () => {
            await this.fetchPrice();
            this.updateUI();
        }, this.updateInterval);

        console.log('BNB price auto-update started');
    }

    // Stop auto-update
    stopAutoUpdate() {
        if (this.interval) {
            clearInterval(this.interval);
            this.isUpdating = false;
            console.log('BNB price auto-update stopped');
        }
    }

    // Update UI elements showing BNB price
    updateUI() {
        // Update price display elements
        const priceElements = document.querySelectorAll('.bnb-price');
        priceElements.forEach(el => {
            el.textContent = `$${this.price.toFixed(2)}`;
        });

        // Update conversion calculations if needed
        if (typeof calculatePayout === 'function') {
            calculatePayout();
        }

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('bnbPriceUpdated', {
            detail: { price: this.price }
        }));
    }

    // Convert BNB to USD
    bnbToUSD(bnbAmount) {
        return bnbAmount * this.price;
    }

    // Convert USD to BNB
    usdToBNB(usdAmount) {
        return usdAmount / this.price;
    }

    // Format price for display
    formatPrice(bnbAmount) {
        const usd = this.bnbToUSD(bnbAmount);
        return `${bnbAmount.toFixed(4)} BNB ≈ $${usd.toFixed(2)}`;
    }
}

// Global instance
const bnbPriceTracker = new BNBPriceTracker();

// Auto-start on page load
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        bnbPriceTracker.startAutoUpdate();
    });

    // Stop on page unload
    window.addEventListener('beforeunload', () => {
        bnbPriceTracker.stopAutoUpdate();
    });
}
