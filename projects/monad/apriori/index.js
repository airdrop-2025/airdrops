const { ContractManager } = require("../../../src/modules/contractManager");
const { WebClient } = require("../../../src/modules/webClient");
const { MONAD_CONFIG } = require("../config");
const fs = require("fs");
const path = require("path");

const CHECKIN_CONTRACT_ADDRESS = "0x703e753E9a2aCa1194DED65833EAec17dcFeAc1b";
const CHECKIN_ABI = ["function checkIn()"];

/**
 * 单个钱包的 Monad Apriori 签到实例
 * 架构理念：一个钱包 = 一个 Apriori 实例 = 独立的合约管理器
 */
class MonadApriori {
  constructor(privateKey, options = {}) {
    this.privateKey = privateKey;
    this.config = { ...MONAD_CONFIG, ...options.config };
    this.contractAddress = options.contractAddress || CHECKIN_CONTRACT_ADDRESS;
    this.contractABI = options.contractABI || CHECKIN_ABI;
    this.gasPrice = options.gasPrice || "55000000000";
    this.proxyUrl = options.proxyUrl || null;
    this.walletId = options.walletId || Math.random().toString(36).substr(2, 9);

    // 钱包状态
    this.address = null;
    this.balance = null;
    this.isInitialized = false;

    // 执行结果
    this.result = {
      success: false,
      error: null,
      txHash: null,
      blockNumber: null,
      gasUsed: null,
      walletId: this.walletId,
    };

    // 每个实例独立的合约管理器
    this.contractManager = new ContractManager({
      rpcUrl: this.config.rpc,
      chainId: this.config.chainId,
      proxyUrl: this.proxyUrl,
    });

    // 每个实例独立的网页客户端
    this.webClient = new WebClient({
      proxyUrl: this.proxyUrl,
      headers: {
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9",
        "if-none-match": 'W/"89-cy2cRAe3SGVjNuQemLmadChVmCQ"',
        origin: "https://of.apr.io",
        priority: "u=1, i",
        referer: "https://of.apr.io/",
        "sec-ch-ua":
          '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
      },
    });

    this.token = null;

    console.log(
      `🆕 创建 Apriori 实例 [${this.walletId}]${
        this.proxyUrl ? " (含代理)" : " (无代理)"
      }`
    );
  }

  async initialize() {
    if (this.isInitialized) return true;

    console.log(`🔗 初始化 Apriori 实例 [${this.walletId}]...`);
    const walletResult = await this.contractManager.connectWallet(
      this.privateKey
    );
    if (!walletResult.success) {
      throw new Error(`钱包连接失败: ${walletResult.error}`);
    }

    this.address = walletResult.address;
    this.balance = walletResult.balance;
    this.isInitialized = true;

    console.log(`✓ 实例 [${this.walletId}] 初始化完成: ${this.address}`);
    return true;
  }

  async login() {
    if (!this.isInitialized) {
      throw new Error("实例未初始化，请先调用 initialize()");
    }

    console.log(`🔑 登录中...`);

    // 获取网络信息
    const networkInfo = await this.contractManager.getNetworkInfo();
    if (!networkInfo.success) {
      throw new Error(`获取网络信息失败: ${networkInfo.error}`);
    }

    // 获取 nonce 值
    const nonceResult = await this.getNonce();
    if (!nonceResult.success) {
      throw new Error(`获取 nonce 失败: ${nonceResult.error}`);
    }

    console.log(
      `✅ 实例 [${this.walletId}] 获取 nonce 成功:`,
      nonceResult.nonce.nonce
    );

    // 构造签名消息
    const signMessage = await this.createSignMessage(nonceResult.nonce.nonce);
    console.log(`📝 实例 [${this.walletId}] 构造签名消息完成`);

    // 钱包签名
    const signature = await this.signMessage(signMessage);
    if (!signature.success) {
      throw new Error(`钱包签名失败: ${signature.error}`);
    }

    console.log(`✍️ 实例 [${this.walletId}] 钱包签名成功`);

    // 调用登录 API
    const loginResult = await this.performLogin({
      walletAddress: this.address,
      signature: signature.signature,
      message: signMessage,
    });

    if (!loginResult.success) {
      throw new Error(`登录 API 调用失败: ${loginResult.error}`);
    }

    console.log(`✅ 实例 [${this.walletId}] 登录成功`);
    console.log(`📊 登录响应:`, loginResult.data);

    this.token = loginResult.data.access_token;

    return {
      success: true,
      loginData: loginResult.data,
      nonce: nonceResult.nonce.nonce,
      signature: signature.signature,
      message: signMessage,
    };
  }

  /**
   * 构造签名消息
   */
  async createSignMessage(nonce) {
    // 获取当前时间和过期时间
    const now = new Date();
    const issuedAt = now.toISOString();
    const expirationTime = new Date(
      now.getTime() + 24 * 60 * 60 * 1000
    ).toISOString(); // 24小时后过期

    // 按照 curl 命令中的格式构造消息
    const message = `of.apr.io wants you to sign in with your Ethereum account:\n${this.address}\n\nPlease sign this message to verify your account ownership.\n\nURI: https://of.apr.io\nVersion: 1\nChain ID: ${this.config.chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;

    console.log(`📋 实例 [${this.walletId}] 签名消息:`);
    console.log(message);

    return message;
  }

  /**
   * 使用钱包签名消息
   */
  async signMessage(message) {
    try {
      if (!this.contractManager.wallet) {
        throw new Error("钱包未连接，无法签名");
      }

      console.log(`✍️ 实例 [${this.walletId}] 正在签名消息...`);

      // 使用 ethers 钱包签名消息
      const signature = await this.contractManager.wallet.signMessage(message);

      console.log(`✅ 实例 [${this.walletId}] 消息签名成功`);
      console.log(`🔐 签名结果: ${signature.substring(0, 20)}...`);

      return {
        success: true,
        signature: signature,
      };
    } catch (error) {
      console.error(
        `❌ 实例 [${this.walletId}] 消息签名失败: ${error.message}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取 nonce 值，用于签名验证
   */
  async getNonce() {
    if (!this.isInitialized) {
      throw new Error("实例未初始化，请先调用 initialize()");
    }

    console.log(`⏳ 实例 [${this.walletId}] 正在获取 nonce...`);

    try {
      // 构建 API URL
      const apiUrl = `https://wallet-collection-api.apr.io/auth/nonce/${this.address}`;

      // 设置请求头，按照 curl 命令的格式

      // 使用 webClient 实例发送 GET 请求
      const response = await this.webClient.get(apiUrl);

      if (response.success) {
        console.log(`✅ 实例 [${this.walletId}] 获取 nonce 成功`);
        console.log(`📊 响应状态: ${response.status}`);
        console.log(`📝 响应数据:`, response.data);
        return {
          success: true,
          nonce: response.data,
        };
      } else {
        throw new Error(`API 请求失败: ${response.error}`);
      }
    } catch (error) {
      console.error(
        `❌ 实例 [${this.walletId}] 获取 nonce 失败: ${error.message}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 执行登录 API 调用
   */
  async performLogin(loginData) {
    try {
      console.log(`🚀 实例 [${this.walletId}] 正在调用登录 API...`);

      // 构建 API URL
      const apiUrl = "https://wallet-collection-api.apr.io/auth/login";

      // 构建请求数据
      const requestData = {
        walletAddress: loginData.walletAddress,
        signature: loginData.signature,
        message: loginData.message,
      };

      console.log(`📦 实例 [${this.walletId}] 发送登录数据:`);
      console.log(`   钱包地址: ${requestData.walletAddress}`);
      console.log(`   签名: ${requestData.signature.substring(0, 20)}...`);
      console.log(`   消息长度: ${requestData.message.length} 字符`);

      // 使用 webClient 实例发送 POST 请求
      const response = await this.webClient.post(apiUrl, requestData);

      if (response.success) {
        console.log(`✅ 实例 [${this.walletId}] 登录 API 调用成功`);
        console.log(`📊 响应状态: ${response.status}`);
        console.log(`📝 登录响应:`, response.data);

        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
        };
      } else {
        throw new Error(`登录 API 请求失败: ${response.error}`);
      }
    } catch (error) {
      console.error(
        `❌ 实例 [${this.walletId}] 登录 API 调用失败: ${error.message}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async executeCheckIn() {
    if (!this.isInitialized) {
      throw new Error("实例未初始化，请先调用 initialize()");
    }

    console.log(`⏳ 实例 [${this.walletId}] 正在执行签到...`);

    // 为当前实例创建合约
    this.contractManager.createContract(
      this.contractAddress,
      this.contractABI,
      `checkin-${this.walletId}`
    );

    // 执行签到交易
    const txResult = await this.contractManager.executeContract(
      `checkin-${this.walletId}`,
      "checkIn",
      [],
      { gasPrice: this.gasPrice }
    );

    if (txResult.success) {
      this.result = {
        success: true,
        txHash: txResult.transactionHash,
        blockNumber: txResult.blockNumber,
        gasUsed: txResult.gasUsed,
        walletId: this.walletId,
      };
      console.log(
        `✅ 实例 [${this.walletId}] 签到成功! Gas: ${txResult.gasUsed}`
      );
    } else {
      throw new Error(txResult.error);
    }
  }

  /**
   * 记录签到到平台 API
   */
  async recordCheckIn(transactionHash, accessToken, walletApp = "OKX") {
    if (!this.isInitialized) {
      throw new Error("实例未初始化，请先调用 initialize()");
    }

    console.log(`📡 实例 [${this.walletId}] 正在记录签到到平台...`);

    try {
      // 构建 API URL
      const apiUrl = "https://wallet-collection-api.apr.io/wallets/checkin";

      // 设置请求头，按照 curl 命令的格式
      const headers = {
        authorization: `Bearer ${accessToken}`,
      };

      // 构建请求数据
      const requestData = {
        walletAddress: this.address,
        transactionHash: transactionHash,
        chainId: this.config.chainId,
        walletApp: walletApp,
      };

      console.log(`📦 实例 [${this.walletId}] 发送签到记录数据:`);
      console.log(`   钱包地址: ${requestData.walletAddress}`);
      console.log(`   交易哈希: ${requestData.transactionHash}`);
      console.log(`   链 ID: ${requestData.chainId}`);
      console.log(`   钱包应用: ${requestData.walletApp}`);

      // 使用 webClient 实例发送 POST 请求
      const response = await this.webClient.post(apiUrl, requestData, {
        headers,
      });

      if (response.success) {
        console.log(`✅ 实例 [${this.walletId}] 签到记录成功`);
        console.log(`📊 响应状态: ${response.status}`);
        console.log(`📝 记录响应:`, response.data);

        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
        };
      } else {
        // 更详细的错误信息
        const errorMsg = response.message || response.error || "未知错误";
        const statusCode = response.status || "N/A";
        console.error(`❌ API 请求失败 [状态: ${statusCode}]: ${errorMsg}`);
        if (response.data) {
          console.error(`❌ 响应数据:`, response.data);
        }
        throw new Error(
          `平台记录 API 请求失败 [状态: ${statusCode}]: ${errorMsg}`
        );
      }
    } catch (error) {
      console.error(
        `❌ 实例 [${this.walletId}] 签到记录失败: ${error.message}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 更新用户分数
   */
  async updateMyPoints(accessToken) {
    if (!this.isInitialized) {
      throw new Error("实例未初始化，请先调用 initialize()");
    }

    console.log(`💯 实例 [${this.walletId}] 正在更新用户分数...`);

    try {
      // 构建 API URL
      const apiUrl =
        "https://wallet-collection-api.apr.io/users/update-my-points";

      // 设置请求头，按照 curl 命令的格式
      const headers = {
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9",
        authorization: `Bearer ${accessToken}`,
        "content-length": "0",
        "content-type": "application/json",
        origin: "https://of.apr.io",
        priority: "u=1, i",
        referer: "https://of.apr.io/",
        "sec-ch-ua":
          '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      };

      console.log(`📦 实例 [${this.walletId}] 发送分数更新请求`);
      console.log(`   API: ${apiUrl}`);
      console.log(`   方法: POST`);
      console.log(`   身份验证: Bearer Token`);
      console.log(`   请求体: 空`);

      // 使用 webClient 实例发送 POST 请求（空请求体）
      const response = await this.webClient.post(apiUrl, {}, { headers });

      if (response.success) {
        console.log(`✅ 实例 [${this.walletId}] 分数更新成功`);
        console.log(`📊 响应状态: ${response.status}`);
        console.log(`📝 分数响应:`, response.data);

        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
        };
      } else {
        // 更详细的错误信息
        const errorMsg = response.message || response.error || "未知错误";
        const statusCode = response.status || "N/A";
        console.error(
          `❌ 分数更新 API 请求失败 [状态: ${statusCode}]: ${errorMsg}`
        );
        if (response.data) {
          console.error(`❌ 响应数据:`, response.data);
        }
        throw new Error(
          `分数更新 API 请求失败 [状态: ${statusCode}]: ${errorMsg}`
        );
      }
    } catch (error) {
      console.error(
        `❌ 实例 [${this.walletId}] 分数更新失败: ${error.message}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 运行当前 Apriori 实例的完整签到流程
   * 每个实例独立执行，互不干扰
   */
  async run() {
    const startTime = Date.now();
    console.log(`\n🚀 启动 Apriori 实例 [${this.walletId}]`);

    try {
      // 显示代理信息
      if (this.proxyUrl) {
        const displayProxy = this.proxyUrl.includes("@")
          ? this.proxyUrl.split("@")[1]
          : this.proxyUrl;
        console.log(`🔄 实例 [${this.walletId}] 使用代理: ${displayProxy}`);
      } else {
        console.log(`🔄 实例 [${this.walletId}] 无代理模式`);
      }

      // 初始化钱包
      await this.initialize();
      console.log(`📍 实例 [${this.walletId}] - 地址: ${this.address}`);
      console.log(
        `💰 实例 [${this.walletId}] - 余额: ${this.balance} ${this.config.symbol}`
      );

      // 执行登录获取 access token
      const loginResult = await this.login();
      if (!loginResult || !loginResult.success) {
        throw new Error(`登录失败: ${loginResult?.error || "未知错误"}`);
      }

      const accessToken = loginResult.loginData.access_token;
      console.log(`🔑 实例 [${this.walletId}] 登录成功，获取 access token`);

      // 执行链上签到
      await this.executeCheckIn();
      console.log(`⛳ 实例 [${this.walletId}] 链上签到成功`);

      // 记录签到到平台
      const recordResult = await this.recordCheckIn(
        this.result.txHash,
        accessToken
      );
      if (!recordResult.success) {
        console.warn(
          `⚠️ 实例 [${this.walletId}] 平台记录失败: ${recordResult.error}`
        );
        // 平台记录失败不影响链上签到的成功
      } else {
        console.log(`📡 实例 [${this.walletId}] 平台记录成功`);

        // 平台记录成功后，更新用户分数
        const pointsResult = await this.updateMyPoints(accessToken);
        if (!pointsResult.success) {
          console.warn(
            `⚠️ 实例 [${this.walletId}] 分数更新失败: ${pointsResult.error}`
          );
          // 分数更新失败不影响签到流程
        } else {
          console.log(`💯 实例 [${this.walletId}] 分数更新成功`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`🎯 实例 [${this.walletId}] 完成签到! 耗时: ${duration}s`);
      console.log(`🔗 交易链接: ${this.config.explorer}${this.result.txHash}`);

      return {
        ...this.result,
        address: this.address,
        balance: this.balance,
        duration,
      };
    } catch (error) {
      this.result.error = error.message;
      this.result.success = false;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(
        `❌ 实例 [${this.walletId}] 执行失败: ${error.message} (耗时: ${duration}s)`
      );

      return {
        ...this.result,
        address: this.address,
        balance: this.balance,
        duration,
      };
    }
  }
}

/**
 * 批量签到管理器
 * 架构理念：一个管理器 = 多个独立的 Apriori 实例 = 多个独立的钱包执行单元
 */
class MonadAprioriManager {
  constructor(options = {}) {
    this.config = { ...MONAD_CONFIG, ...options.config };
    this.gasPrice = options.gasPrice || "55000000000";
    this.delay = options.delay || 2000;
    this.privateKeysFile =
      options.privateKeysFile ||
      path.join(__dirname, "..", "config", "private_keys.txt");
    this.proxiesFile =
      options.proxiesFile ||
      path.join(__dirname, "..", "config", "proxies.txt");

    // 配置数据
    this.privateKeys = [];
    this.proxies = [];

    // Apriori 实例集合（每个钱包对应一个实例）
    this.instances = [];

    // 执行结果集合
    this.results = [];

    console.log("🏢 初始化 Monad Apriori 管理器...");
  }

  readLinesFromFile(filePath) {
    try {
      return fs
        .readFileSync(filePath, "utf-8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#"));
    } catch (error) {
      console.error(`❌ 读取文件失败: ${filePath}`);
      return [];
    }
  }

  loadConfig() {
    this.privateKeys = this.readLinesFromFile(this.privateKeysFile);
    this.proxies = this.readLinesFromFile(this.proxiesFile);

    if (this.privateKeys.length === 0) {
      throw new Error(`未找到私钥文件: ${this.privateKeysFile}`);
    }

    console.log(`🔑 发现 ${this.privateKeys.length} 个私钥`);
    console.log(`🌐 发现 ${this.proxies.length} 个代理`);
  }

  /**
   * 创建多个独立的 Apriori 实例
   * 架构理念：一个私钥 = 一个 Apriori 实例 = 一个独立的执行单元
   */
  createInstances() {
    console.log("🏭 正在创建多个独立的 Apriori 实例...");

    this.instances = this.privateKeys.map((privateKey, index) => {
      // 按顺序分配代理（如果有）
      const proxy =
        this.proxies.length > 0
          ? this.proxies[index % this.proxies.length]
          : null;

      // 创建独立的 Apriori 实例
      const instance = new MonadApriori(privateKey, {
        config: this.config,
        gasPrice: this.gasPrice,
        proxyUrl: proxy,
        walletId: `wallet-${(index + 1).toString().padStart(3, "0")}`,
      });

      console.log(
        `✓ 实例 ${index + 1}/${this.privateKeys.length} 创建完成${
          proxy ? " (含代理)" : " (无代理)"
        }`
      );
      return instance;
    });

    console.log(`🎆 已成功创建 ${this.instances.length} 个独立的 Apriori 实例`);
    console.log(
      `🔄 架构模式: ${this.instances.length} 个钱包 → ${this.instances.length} 个 Apriori 实例`
    );
  }

  /**
   * 执行所有 Apriori 实例
   * 架构理念：顺序执行每个独立的实例，实例间互不干扰
   */
  async run() {
    console.log("\n🚀 启动 Monad 批量签到管理器...");
    console.log(
      `📊 网络: ${this.config.name} (Chain ID: ${this.config.chainId})`
    );
    console.log(`🕰️ 实例间隔: ${this.delay / 1000}s`);

    // 加载配置
    this.loadConfig();

    // 创建多个独立的 Apriori 实例
    this.createInstances();

    console.log("\n🏁 开始执行所有 Apriori 实例...");

    // 顺序执行每个独立的实例
    for (let i = 0; i < this.instances.length; i++) {
      console.log(`\n🔶 === 实例 ${i + 1}/${this.instances.length} ===`);

      // 执行当前实例
      const result = await this.instances[i].run();
      this.results.push({ index: i + 1, ...result });

      // 实例间延迟（除了最后一个）
      if (i < this.instances.length - 1) {
        console.log(`⏰ 实例间等待 ${this.delay / 1000} 秒...`);
        await new Promise((resolve) => setTimeout(resolve, this.delay));
      }
    }

    // 显示执行统计
    this.showSummary();
  }

  /**
   * 显示执行统计结果
   */
  showSummary() {
    const successCount = this.results.filter((r) => r.success).length;
    const failureCount = this.results.length - successCount;
    const totalDuration = this.results.reduce(
      (sum, r) => sum + (parseFloat(r.duration) || 0),
      0
    );

    console.log(`\n📊 === 执行统计报告 ===`);
    console.log(`📦 总实例数: ${this.results.length}`);
    console.log(
      `✅ 成功: ${successCount}/${this.results.length} (${(
        (successCount / this.results.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `❌ 失败: ${failureCount}/${this.results.length} (${(
        (failureCount / this.results.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(`⏱️ 总耗时: ${totalDuration.toFixed(2)}s`);
    console.log(
      `⚡ 平均耗时: ${(totalDuration / this.results.length).toFixed(2)}s/实例`
    );

    if (failureCount > 0) {
      console.log(`\n⚠️ 失败的实例:`);
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - 实例 ${r.index}: ${r.error}`);
        });
    }

    console.log(`\n🎉 所有 Apriori 实例执行完毕！`);
  }
}

// 脚本执行
if (require.main === module) {
  const manager = new MonadAprioriManager();
  manager.run().catch((error) => {
    console.error("💥 执行失败:", error.message);
    process.exit(1);
  });
}

module.exports = { MonadApriori, MonadAprioriManager };
