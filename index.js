const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 导入所有模块
const { WebClient, webClient } = require('./src/modules/webClient');
const { ContractManager, contractManager, ERC20_ABI } = require('./src/modules/contractManager');
const { WalletManager, walletManager } = require('./src/modules/walletManager');

// 工具函数
const utils = {
    /**
     * 延时函数
     */
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    /**
     * 格式化 ETH 数量显示
     */
    formatETH: async (wei, decimals = 4) => {
        const { ethers } = require('ethers');
        return parseFloat(ethers.formatEther(wei)).toFixed(decimals);
    },
    
    /**
     * 解析 ETH 数量
     */
    parseETH: async (ether) => {
        const { ethers } = require('ethers');
        return ethers.parseEther(ether.toString());
    },
    
    /**
     * 生成随机字符串
     */
    randomString: (length = 8) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * 当前时间戳
     */
    timestamp: () => Math.floor(Date.now() / 1000),
    
    /**
     * 格式化日期
     */
    formatDate: (date = new Date()) => {
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }
};

console.log('🚀 Stand Bot Template 已初始化');
console.log('📦 可用模块: WebClient, ContractManager, WalletManager');
console.log('🔧 工具函数: utils.*');

// 导出所有模块和工具函数
module.exports = {
    WebClient,
    webClient,
    ContractManager,
    contractManager,
    ERC20_ABI,
    WalletManager,
    walletManager,
    utils
};
