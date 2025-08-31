const { ethers } = require("ethers");
const { SocksProxyAgent } = require("socks-proxy-agent");
const axios = require("axios");

/**
 * 智能合约交互模块
 * 提供以太坊智能合约的基础交互功能
 */
class ContractManager {
  constructor(options = {}) {
    this.rpcUrl =
      options.rpcUrl ||
      process.env.RPC_URL ||
      "https://eth-mainnet.alchemyapi.io/v2/demo";
    this.chainId = options.chainId || parseInt(process.env.CHAIN_ID) || 1;
    this.proxyUrl = options.proxyUrl || process.env.SOCKS5_PROXY;

    // 创建 provider，支持代理配置
    this.provider = this.createProvider();
    this.contracts = new Map();
  }

  /**
   * 解析代理 URL 格式
   */
  parseProxyUrl(proxyInput) {
    if (!proxyInput) return null;

    // 如果已经是完整的 URL 格式
    if (
      proxyInput.startsWith("socks5://") ||
      proxyInput.startsWith("http://")
    ) {
      return proxyInput;
    }

    const parts = proxyInput.split(":");

    if (parts.length === 4) {
      // ip:port:username:password 格式
      const [ip, port, username, password] = parts;
      return `socks5://${username}:${password}@${ip}:${port}`;
    } else if (parts.length === 2) {
      // ip:port 格式
      const [ip, port] = parts;
      return `socks5://${ip}:${port}`;
    } else {
      throw new Error(`不支持的代理格式: ${proxyInput}`);
    }
  }

  /**
   * 创建支持代理的 JsonRpcProvider
   */
  createProvider() {
    try {
      if (this.proxyUrl) {
        // 使用代理创建 provider
        const proxyUrl = this.parseProxyUrl(this.proxyUrl);
        const agent = new SocksProxyAgent(proxyUrl);

        // 创建自定义的 FetchRequest
        const fetchReq = new ethers.FetchRequest(this.rpcUrl);
        fetchReq.agent = agent;

        console.log(
          `✓ 已为 RPC 配置代理: ${proxyUrl.replace(
            /:\/\/[^:]+:[^@]+@/,
            "://***:***@"
          )}`
        );

        return new ethers.JsonRpcProvider(fetchReq, this.chainId);
      } else {
        // 没有代理，使用默认配置
        return new ethers.JsonRpcProvider(this.rpcUrl, this.chainId);
      }
    } catch (error) {
      console.warn(`⚠️ RPC 代理配置失败，使用默认配置: ${error.message}`);
      return new ethers.JsonRpcProvider(this.rpcUrl, this.chainId);
    }
  }

  /**
   * 设置代理（支持多种格式）
   */
  setProxy(proxyInput) {
    try {
      this.proxyUrl = proxyInput;

      // 重新创建 provider
      this.provider = this.createProvider();

      // 重新连接钱包（如果有）
      if (this.wallet) {
        this.wallet = this.wallet.connect(this.provider);
      }

      console.log(
        `✓ RPC 代理已更新: ${
          this.proxyUrl
            ? this.parseProxyUrl(this.proxyUrl).replace(
                /:\/\/[^:]+:[^@]+@/,
                "://***:***@"
              )
            : "无"
        }`
      );
      return { success: true, proxy: this.proxyUrl };
    } catch (error) {
      console.error(`RPC 代理设置失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 连接钱包
   */
  async connectWallet(privateKey) {
    try {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      console.log(`✓ 钱包已连接: ${this.wallet.address}`);
      return {
        success: true,
        address: this.wallet.address,
        balance: await this.getBalance(this.wallet.address),
      };
    } catch (error) {
      console.error("钱包连接失败:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取账户余额
   */
  async getBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("获取余额失败:", error.message);
      return "0";
    }
  }

  /**
   * 获取网络信息
   */
  async getNetworkInfo() {
    try {
      const network = await this.provider.getNetwork();
      const gasPrice = await this.provider.getFeeData();
      const blockNumber = await this.provider.getBlockNumber();

      return {
        success: true,
        network: {
          name: network.name,
          chainId: Number(network.chainId),
          blockNumber,
          gasPrice: {
            gasPrice: gasPrice.gasPrice
              ? ethers.formatUnits(gasPrice.gasPrice, "gwei")
              : null,
            maxFeePerGas: gasPrice.maxFeePerGas
              ? ethers.formatUnits(gasPrice.maxFeePerGas, "gwei")
              : null,
            maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
              ? ethers.formatUnits(gasPrice.maxPriorityFeePerGas, "gwei")
              : null,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 创建合约实例
   */
  createContract(address, abi, name) {
    try {
      const contract = new ethers.Contract(
        address,
        abi,
        this.wallet || this.provider
      );
      this.contracts.set(name, contract);
      console.log(`✓ 合约实例已创建: ${name} - ${address}`);
      return contract;
    } catch (error) {
      console.error("创建合约实例失败:", error.message);
      return null;
    }
  }

  /**
   * 获取合约实例
   */
  getContract(name) {
    return this.contracts.get(name);
  }

  /**
   * 调用合约只读方法
   */
  async callContract(contractName, methodName, params = []) {
    try {
      const contract = this.getContract(contractName);
      if (!contract) {
        throw new Error(`合约 ${contractName} 不存在`);
      }

      const result = await contract[methodName](...params);
      return {
        success: true,
        result: result,
      };
    } catch (error) {
      console.error(
        `调用合约方法失败 ${contractName}.${methodName}:`,
        error.message
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 执行合约写入方法
   */
  async executeContract(contractName, methodName, params = [], options = {}) {
    try {
      if (!this.wallet) {
        throw new Error("未连接钱包，无法执行交易");
      }

      const contract = this.getContract(contractName);
      if (!contract) {
        throw new Error(`合约 ${contractName} 不存在`);
      }

      // 估算 gas
      const estimatedGas = await contract[methodName].estimateGas(
        ...params,
        options
      );
      console.log(`预估 Gas: ${estimatedGas.toString()}`);

      // 执行交易
      const tx = await contract[methodName](...params, {
        gasLimit: (estimatedGas * 120n) / 100n, // 增加 20% gas 余量
        ...options,
      });

      console.log(`交易已发送: ${tx.hash}`);

      // 等待交易确认
      const receipt = await tx.wait();
      console.log(`交易已确认: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        receipt: receipt,
      };
    } catch (error) {
      console.error(
        `执行合约方法失败 ${contractName}.${methodName}:`,
        error.message
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 发送 ETH
   */
  async sendETH(to, amount, options = {}) {
    try {
      if (!this.wallet) {
        throw new Error("未连接钱包，无法发送交易");
      }

      const tx = await this.wallet.sendTransaction({
        to: to,
        value: ethers.parseEther(amount.toString()),
        ...options,
      });

      console.log(`ETH 转账已发送: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`ETH 转账已确认: ${receipt.transactionHash}`);

      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("发送 ETH 失败:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取交易详情
   */
  async getTransaction(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      return {
        success: true,
        transaction: tx,
        receipt: receipt,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 等待交易确认
   */
  async waitForTransaction(txHash, confirmations = 1) {
    try {
      console.log(`等待交易确认: ${txHash}`);
      const receipt = await this.provider.waitForTransaction(
        txHash,
        confirmations
      );
      console.log(`交易已确认 ${confirmations} 次: ${txHash}`);
      return {
        success: true,
        receipt: receipt,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 测试 RPC 代理连接
   */
  async testRpcProxy() {
    if (!this.proxyUrl) {
      return { success: false, message: "未配置 RPC 代理" };
    }

    try {
      console.log("正在测试 RPC 代理连接...");
      const blockNumber = await this.provider.getBlockNumber();

      return {
        success: true,
        message: "RPC 代理连接正常",
        blockNumber: blockNumber,
        rpcUrl: this.rpcUrl,
      };
    } catch (error) {
      return {
        success: false,
        message: "RPC 代理连接失败",
        error: error.message,
      };
    }
  }
}

// ERC20 标准 ABI (部分常用方法)
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

// 创建默认实例
const contractManager = new ContractManager();

module.exports = {
  ContractManager,
  contractManager,
  ERC20_ABI,
};
