# Stand Bot Template

一个功能完整的项目交互模板，包含网页交互、智能合约交互和钱包管理功能。

## 🚀 功能特性

### 1. 网页交互模块 (WebClient)
- ✅ 支持 GET、POST、PUT、DELETE 请求
- ✅ 内置 SOCKS5 代理支持
- ✅ 自动错误处理和重试机制
- ✅ 文件下载功能
- ✅ 自定义请求头和认证

### 2. 智能合约交互模块 (ContractManager)
- ✅ 以太坊网络连接
- ✅ 智能合约调用（读写操作）
- ✅ Gas 费用估算和优化
- ✅ 交易状态监控
- ✅ ERC20 标准代币支持

### 3. 钱包管理模块 (WalletManager)
- ✅ 助记词钱包生成
- ✅ 私钥钱包导入
- ✅ 批量地址生成
- ✅ 钱包切换管理
- ✅ 安全的私钥导出

## 📦 安装

```bash
# 安装依赖
npm install

# 复制环境配置
cp .env.example .env

# 编辑环境变量
nano .env
```

## 🔧 配置

编辑 `.env` 文件设置你的配置：

```env
# 网络配置
RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
CHAIN_ID=1

# 代理配置（可选）
SOCKS5_PROXY=socks5://127.0.0.1:1080

# 钱包配置（请妥善保管）
PRIVATE_KEY=your-private-key-here
MNEMONIC=your-mnemonic-phrase-here
```

## 🎯 快速开始

### 基础使用

```javascript
const { WebClient, ContractManager, WalletManager } = require('./index.js');

// 1. 创建钱包
const walletManager = new WalletManager();
const wallet = walletManager.generateWallet('my-wallet');
console.log('新钱包地址:', wallet.wallet.address);

// 2. 网页请求
const webClient = new WebClient();
const response = await webClient.get('https://api.example.com/data');
console.log('请求结果:', response.data);

// 3. 合约交互
const contractManager = new ContractManager();
const balance = await contractManager.getBalance(wallet.wallet.address);
console.log('余额:', balance, 'ETH');
```

### 运行示例

```bash
# 运行完整示例
npm run start

# 或者直接运行示例文件
node examples/demo.js
```

## 📚 详细文档

### WebClient API

```javascript
const webClient = new WebClient({
    proxyUrl: 'socks5://127.0.0.1:1080',  // 可选
    timeout: 10000,
    userAgent: 'Custom User Agent'
});

// GET 请求
const result = await webClient.get('https://api.example.com');

// POST 请求
const result = await webClient.post('https://api.example.com', {
    key: 'value'
});

// 设置认证
webClient.setAuthToken('your-token');

// 测试代理
const proxyStatus = await webClient.testProxy();
```

### ContractManager API

```javascript
const contractManager = new ContractManager({
    rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/your-key',
    chainId: 1
});

// 连接钱包
await contractManager.connectWallet('your-private-key');

// 创建合约实例
contractManager.createContract(contractAddress, abi, 'MyContract');

// 调用只读方法
const result = await contractManager.callContract('MyContract', 'balanceOf', [address]);

// 执行写入方法
const tx = await contractManager.executeContract('MyContract', 'transfer', [to, amount]);
```

### WalletManager API

```javascript
const walletManager = new WalletManager();

// 生成新钱包
const wallet = walletManager.generateWallet('wallet-name');

// 从私钥导入
const imported = walletManager.importFromPrivateKey('0x...', 'imported-wallet');

// 从助记词生成多个地址
const multiWallets = walletManager.generateMultipleFromMnemonic(mnemonic, 10);

// 切换钱包
walletManager.switchWallet('wallet-name');

// 获取 ethers 钱包实例
const ethersWallet = walletManager.getEthersWallet('wallet-name', provider);
```

## 🔐 安全提醒

1. **私钥安全**: 永远不要在代码中硬编码私钥
2. **环境变量**: 使用 `.env` 文件管理敏感信息
3. **代理使用**: 确保代理服务器的安全性
4. **测试网络**: 在主网操作前先在测试网验证

## 🛠️ 项目结构

```
stand_bot_template/
├── src/
│   └── modules/
│       ├── webClient.js      # 网页交互模块
│       ├── contractManager.js # 合约交互模块
│       └── walletManager.js   # 钱包管理模块
├── examples/
│   └── demo.js               # 使用示例
├── index.js                  # 主入口文件
├── package.json              # 项目配置
├── .env.example              # 环境变量模板
└── README.md                 # 说明文档
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
