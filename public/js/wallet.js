// Wallet management
const wallet = {
    provider: null,
    signer: null,
    address: null,
    proxyAddress: null,

    // Initialize wallet connection
    async connect() {
        if (!window.ethereum) {
            throw new Error('MetaMask не установлен!');
        }

        // Check if ethers is loaded
        if (typeof ethers === 'undefined') {
            throw new Error('Ethers.js не загружен! Перезагрузите страницу.');
        }

        try {
            // Request account access
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.address = await this.signer.getAddress();

            // Switch to BSC network
            await this.switchToBSC();

            // Calculate proxy address
            await this.calculateProxyAddress();

            console.log('Wallet connected:', this.address);
            console.log('Proxy address:', this.proxyAddress);

            return this.address;
        } catch (error) {
            console.error('Error connecting wallet:', error);
            throw error;
        }
    },

    // Check if wallet is connected
    async isConnected() {
        if (!window.ethereum) return false;

        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
                this.address = accounts[0];
                
                // Переключаемся на BSC при загрузке страницы
                await this.switchToBSC();
                
                await this.calculateProxyAddress();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error checking wallet connection:', error);
            return false;
        }
    },

    // Get current address
    async getAddress() {
        if (!this.address) {
            this.address = await this.signer.getAddress();
        }
        return this.address;
    },

    // Switch to BSC network
    async switchToBSC() {
        const config = await loadConfig();
        const bscChainId = '0x' + parseInt(config.bsc.chainId).toString(16);

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: bscChainId }],
            });
        } catch (error) {
            // Chain not added, add it
            if (error.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: bscChainId,
                        chainName: 'BSC Mainnet',
                        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                        rpcUrls: [config.bsc.rpc],
                        blockExplorerUrls: ['https://bscscan.com']
                    }]
                });
            } else {
                throw error;
            }
        }
    },

    // Switch to Polygon network
    async switchToPolygon() {
        const config = await loadConfig();
        const polygonChainId = '0x' + parseInt(config.polygon.chainId).toString(16);

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: polygonChainId }],
            });
        } catch (error) {
            if (error.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: polygonChainId,
                        chainName: 'Polygon Mainnet',
                        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                        rpcUrls: [config.polygon.rpc],
                        blockExplorerUrls: ['https://polygonscan.com']
                    }]
                });
            } else {
                throw error;
            }
        }
    },

    // Calculate Polymarket proxy address
    async calculateProxyAddress() {
        const config = await loadConfig();
        
        // Попробуем получить реальный адрес прокси через события ProxyCreation
        try {
            const polygonProvider = new ethers.providers.JsonRpcProvider(config.polygon.rpc);
            const safeFactory = new ethers.Contract(
                config.polygon.safeFactory,
                [
                    'event ProxyCreation(address indexed proxy, address indexed owner)',
                    'function proxyCreationCode() external pure returns (bytes memory)'
                ],
                polygonProvider
            );
            
            // Ищем событие ProxyCreation для этого owner
            const filter = safeFactory.filters.ProxyCreation(null, this.address);
            const events = await safeFactory.queryFilter(filter, 0, 'latest');
            
            if (events.length > 0) {
                // Нашли! Используем реальный адрес
                this.proxyAddress = events[0].args.proxy;
                console.log('Found existing proxy address:', this.proxyAddress);
                return this.proxyAddress;
            }
        } catch (error) {
            console.log('Could not find existing proxy, calculating...', error);
        }
        
        // Если не нашли, вычисляем (упрощенная версия)
        // В реальности нужно использовать @polymarket/sdk getProxyWalletAddress
        const salt = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [this.address, 0])
        );
        
        // Это примерный расчет, может не совпадать с реальным
        this.proxyAddress = ethers.utils.getCreate2Address(
            config.polygon.safeFactory,
            salt,
            '0x4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67df3f25b18d7e29b0f5ae5f68'
        );

        console.log('Calculated proxy address (may be incorrect):', this.proxyAddress);
        console.log('⚠️ Для точного адреса используйте ваш существующий прокси с Polymarket.com');
        
        return this.proxyAddress;
    },

    // Get proxy address
    async getProxyAddress() {
        // Проверяем, есть ли сохраненный кастомный адрес
        const customProxy = localStorage.getItem('customProxyAddress');
        if (customProxy && ethers.utils.isAddress(customProxy)) {
            this.proxyAddress = customProxy;
            console.log('Using custom proxy address:', this.proxyAddress);
            return this.proxyAddress;
        }
        
        if (!this.proxyAddress) {
            await this.calculateProxyAddress();
        }
        return this.proxyAddress;
    },

    // Get BNB balance on BSC
    async getBNBBalance() {
        if (!this.signer) throw new Error('Wallet not connected');
        
        await this.switchToBSC();
        const balance = await this.signer.getBalance();
        return ethers.utils.formatEther(balance);
    },

    // Get USDC balance on Polygon
    async getUSDCBalance(address) {
        const config = await loadConfig();
        
        // Create provider for Polygon
        const polygonProvider = new ethers.providers.JsonRpcProvider(config.polygon.rpc);
        const usdcContract = new ethers.Contract(
            config.polygon.usdc,
            ERC20_ABI,
            polygonProvider
        );

        try {
            const balance = await usdcContract.balanceOf(address);
            return ethers.utils.formatUnits(balance, 6); // USDC has 6 decimals
        } catch (error) {
            console.error('Error getting USDC balance:', error);
            return '0';
        }
    },

    // Get current network
    async getCurrentNetwork() {
        const network = await this.provider.getNetwork();
        return network.chainId;
    }
};

// Initialize wallet on page load
async function initWallet() {
    if (window.ethereum) {
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                console.log('Wallet disconnected');
                window.location.reload();
            } else {
                console.log('Account changed');
                window.location.reload();
            }
        });

        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            console.log('Network changed');
            window.location.reload();
        });
    }
}