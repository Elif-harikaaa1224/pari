// Proxy Wallet Manager for Polymarket
// Manages Gnosis Safe proxy wallets for each user

class ProxyWalletManager {
    constructor() {
        this.proxyCache = {}; // Cache proxy addresses
        this.safeFactoryAddress = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2';
        this.proxyFactoryAddress = '0x91E9382983B5CD5F2F46e19B0EF93A3C816F0D39';
    }

    // Get or create proxy wallet for user
    async getOrCreateProxyWallet(userAddress, signer) {
        try {
            console.log('Getting proxy wallet for:', userAddress);

            // Validate address
            if (!userAddress || !ethers.utils.isAddress(userAddress)) {
                throw new Error(`Invalid user address: ${userAddress}`);
            }

            // Ensure proper checksum
            userAddress = ethers.utils.getAddress(userAddress);

            // 1. Проверяем localStorage - может пользователь уже ввел свой proxy
            const savedProxy = localStorage.getItem(`polymarket_proxy_${userAddress}`);
            if (savedProxy && ethers.utils.isAddress(savedProxy)) {
                console.log('✓ Using saved proxy from localStorage:', savedProxy);
                this.proxyCache[userAddress] = savedProxy;
                return savedProxy;
            }

            // 2. Проверяем cache в памяти
            if (this.proxyCache[userAddress]) {
                console.log('✓ Using cached proxy:', this.proxyCache[userAddress]);
                return this.proxyCache[userAddress];
            }

            // 3. Проверяем через Polymarket API
            try {
                const apiProxy = await this.checkPolymarketAPI(userAddress);
                if (apiProxy) {
                    console.log('✓ Found proxy via Polymarket API:', apiProxy);
                    this.proxyCache[userAddress] = apiProxy;
                    localStorage.setItem(`polymarket_proxy_${userAddress}`, apiProxy);
                    return apiProxy;
                }
            } catch (error) {
                console.log('Could not check Polymarket API:', error.message);
            }

            // 4. Пытаемся вычислить proxy адрес детерминистически
            try {
                const computedProxy = await this.computeProxyAddress(userAddress, signer);
                const provider = signer.provider;
                const code = await provider.getCode(computedProxy);
                
                if (code !== '0x') {
                    console.log('✓ Found deployed proxy at computed address:', computedProxy);
                    this.proxyCache[userAddress] = computedProxy;
                    localStorage.setItem(`polymarket_proxy_${userAddress}`, computedProxy);
                    return computedProxy;
                }
            } catch (error) {
                console.log('Could not compute proxy address:', error.message);
            }

            // 5. Просим пользователя ввести существующий proxy адрес
            const userProxyInput = prompt(
                '🔑 Введите ваш Polymarket Proxy Wallet адрес:\n\n' +
                '📍 Найти на: polymarket.com → Profile → Settings → Wallet Address\n' +
                '⚠️  Это НЕ ваш обычный кошелек, а специальный Polymarket Proxy!\n\n' +
                'Если у вас еще нет proxy - создайте его на polymarket.com, сделав любую тестовую ставку.'
            );

            if (userProxyInput && ethers.utils.isAddress(userProxyInput)) {
                const proxyAddress = ethers.utils.getAddress(userProxyInput);
                console.log('✓ Using user-provided proxy:', proxyAddress);
                this.proxyCache[userAddress] = proxyAddress;
                localStorage.setItem(`polymarket_proxy_${userAddress}`, proxyAddress);
                return proxyAddress;
            }

            // 6. Если не ввели - показываем инструкцию
            throw new Error(
                'Для размещения ставок нужен Polymarket Proxy Wallet.\n\n' +
                'Как получить:\n' +
                '1. Зайдите на polymarket.com\n' +
                '2. Подключите ваш кошелек\n' +
                '3. Сделайте любую минимальную ставку (это создаст proxy)\n' +
                '4. В профиле скопируйте Proxy Wallet адрес\n' +
                '5. Вернитесь сюда и используйте кнопку "⚙️ Управление Proxy"'
            );

        } catch (error) {
            console.error('Error managing proxy wallet:', error);
            throw error;
        }
    }

    // Check Polymarket API for existing proxy
    async checkPolymarketAPI(userAddress) {
        try {
            const response = await fetch(`https://clob.polymarket.com/user/${userAddress}`);
            if (response.ok) {
                const data = await response.json();
                if (data.proxyWallet && ethers.utils.isAddress(data.proxyWallet)) {
                    return ethers.utils.getAddress(data.proxyWallet);
                }
            }
            return null;
        } catch (error) {
            console.error('Error checking Polymarket API:', error);
            return null;
        }
    }

    // Find existing proxy wallet
    async findExistingProxy(userAddress, signer) {
        try {
            // Method 1: Call Polymarket API to check if user has proxy
            const response = await fetch(`https://clob.polymarket.com/user/${userAddress}`);
            if (response.ok) {
                const data = await response.json();
                if (data.proxyWallet) {
                    return data.proxyWallet;
                }
            }

            // Method 2: Compute proxy address deterministically
            // Polymarket uses create2 for deterministic addresses
            const computedProxy = await this.computeProxyAddress(userAddress, signer);
            
            // Check if this address has code (is deployed)
            const provider = signer.provider;
            const code = await provider.getCode(computedProxy);
            
            if (code !== '0x') {
                // Proxy exists
                return computedProxy;
            }

            return null;

        } catch (error) {
            console.error('Error finding existing proxy:', error);
            return null;
        }
    }

    // Compute proxy address using create2
    async computeProxyAddress(userAddress, signer) {
        try {
            console.log('computeProxyAddress called with:', userAddress);
            
            // Validate address format
            if (!userAddress || !ethers.utils.isAddress(userAddress)) {
                throw new Error(`Invalid user address: ${userAddress}`);
            }

            // Ensure proper checksum
            const checksummedAddress = ethers.utils.getAddress(userAddress);
            console.log('Checksummed address:', checksummedAddress);

            const proxyFactoryABI = [
                'function proxyFor(address owner) external view returns (address)'
            ];

            const proxyFactory = new ethers.Contract(
                this.proxyFactoryAddress,
                proxyFactoryABI,
                signer
            );

            const proxyAddress = await proxyFactory.proxyFor(checksummedAddress);
            return proxyAddress;

        } catch (error) {
            console.error('Error computing proxy address:', error);
            console.error('User address was:', userAddress);
            throw error;
        }
    }

    // Create new proxy wallet
    async createProxyWallet(userAddress, signer) {
        try {
            const proxyFactoryABI = [
                'function createProxy(address owner, bytes memory data) external returns (address)',
                'function proxyFor(address owner) external view returns (address)'
            ];

            const proxyFactory = new ethers.Contract(
                this.proxyFactoryAddress,
                proxyFactoryABI,
                signer
            );

            // Empty initialization data
            const initData = '0x';

            console.log('Sending transaction to create proxy...');
            const tx = await proxyFactory.createProxy(userAddress, initData);
            console.log('Transaction sent:', tx.hash);
            
            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt.transactionHash);

            // Get the created proxy address
            const proxyAddress = await proxyFactory.proxyFor(userAddress);
            
            return proxyAddress;

        } catch (error) {
            console.error('Error creating proxy wallet:', error);
            throw error;
        }
    }

    // Check if address has proxy
    hasProxy(userAddress) {
        return !!this.proxyCache[userAddress];
    }

    // Get cached proxy
    getCachedProxy(userAddress) {
        return this.proxyCache[userAddress];
    }

    // Clear cache
    clearCache() {
        this.proxyCache = {};
    }
}

// Global instance
const proxyWalletManager = new ProxyWalletManager();
