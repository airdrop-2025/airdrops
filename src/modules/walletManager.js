const { ethers } = require("ethers");
const bip39 = require("bip39");
const crypto = require("crypto");

/**
 * 钱包管理模块
 * 提供钱包生成、导入、管理等功能
 */
class WalletManager {
  constructor() {
    this.wallets = new Map();
    this.currentWallet = null;
  }

  /**
   * 生成新的助记词钱包
   */
  generateWallet(name = "default") {
    try {
      // 生成助记词
      const mnemonic = bip39.generateMnemonic();

      // 从助记词创建钱包
      const wallet = ethers.Wallet.fromPhrase(mnemonic);

      const walletInfo = {
        name,
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: mnemonic,
        publicKey: wallet.publicKey,
        createdAt: new Date().toISOString(),
      };

      this.wallets.set(name, walletInfo);
      this.currentWallet = walletInfo;

      console.log(`✓ 新钱包已生成: ${name} - ${wallet.address}`);

      return {
        success: true,
        wallet: {
          name: walletInfo.name,
          address: walletInfo.address,
          mnemonic: walletInfo.mnemonic,
          publicKey: walletInfo.publicKey,
        },
      };
    } catch (error) {
      console.error("生成钱包失败:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 从私钥导入钱包
   */
  importFromPrivateKey(privateKey, name = "imported") {
    try {
      const wallet = new ethers.Wallet(privateKey);

      const walletInfo = {
        name,
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        importedAt: new Date().toISOString(),
      };

      this.wallets.set(name, walletInfo);
      this.currentWallet = walletInfo;

      console.log(`✓ 钱包已从私钥导入: ${name} - ${wallet.address}`);

      return {
        success: true,
        wallet: {
          name: walletInfo.name,
          address: walletInfo.address,
          publicKey: walletInfo.publicKey,
        },
      };
    } catch (error) {
      console.error("从私钥导入钱包失败:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 从助记词导入钱包
   */
  importFromMnemonic(mnemonic, name = "imported", derivationPath) {
    try {
      // 验证助记词
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("无效的助记词");
      }

      const wallet = ethers.Wallet.fromPhrase(mnemonic, derivationPath);

      const walletInfo = {
        name,
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: mnemonic,
        publicKey: wallet.publicKey,
        derivationPath: derivationPath || "m/44'/60'/0'/0/0",
        importedAt: new Date().toISOString(),
      };

      this.wallets.set(name, walletInfo);
      this.currentWallet = walletInfo;

      console.log(`✓ 钱包已从助记词导入: ${name} - ${wallet.address}`);

      return {
        success: true,
        wallet: {
          name: walletInfo.name,
          address: walletInfo.address,
          mnemonic: walletInfo.mnemonic,
          publicKey: walletInfo.publicKey,
          derivationPath: walletInfo.derivationPath,
        },
      };
    } catch (error) {
      console.error("从助记词导入钱包失败:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 从助记词生成多个钱包地址
   */
  generateMultipleFromMnemonic(mnemonic, count = 10, startIndex = 0) {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("无效的助记词");
      }

      const wallets = [];

      for (let i = 0; i < count; i++) {
        const derivationPath = `m/44'/60'/0'/0/${startIndex + i}`;
        const wallet = ethers.Wallet.fromPhrase(mnemonic, derivationPath);

        wallets.push({
          index: startIndex + i,
          address: wallet.address,
          privateKey: wallet.privateKey,
          publicKey: wallet.publicKey,
          derivationPath: derivationPath,
        });
      }

      return {
        success: true,
        wallets: wallets,
        mnemonic: mnemonic,
      };
    } catch (error) {
      console.error("从助记词生成多个钱包失败:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 切换当前钱包
   */
  switchWallet(name) {
    const wallet = this.wallets.get(name);
    if (wallet) {
      this.currentWallet = wallet;
      console.log(`✓ 已切换到钱包: ${name} - ${wallet.address}`);
      return {
        success: true,
        wallet: {
          name: wallet.name,
          address: wallet.address,
        },
      };
    } else {
      return {
        success: false,
        error: `钱包 ${name} 不存在`,
      };
    }
  }

  /**
   * 获取当前钱包
   */
  getCurrentWallet() {
    if (this.currentWallet) {
      return {
        success: true,
        wallet: {
          name: this.currentWallet.name,
          address: this.currentWallet.address,
          publicKey: this.currentWallet.publicKey,
        },
      };
    } else {
      return {
        success: false,
        error: "未选择钱包",
      };
    }
  }

  /**
   * 获取所有钱包列表
   */
  getAllWallets() {
    const walletList = Array.from(this.wallets.values()).map((wallet) => ({
      name: wallet.name,
      address: wallet.address,
      publicKey: wallet.publicKey,
      createdAt: wallet.createdAt,
      importedAt: wallet.importedAt,
    }));

    return {
      success: true,
      wallets: walletList,
      current: this.currentWallet ? this.currentWallet.name : null,
    };
  }

  /**
   * 删除钱包
   */
  deleteWallet(name) {
    if (this.wallets.has(name)) {
      this.wallets.delete(name);

      // 如果删除的是当前钱包，清空当前钱包
      if (this.currentWallet && this.currentWallet.name === name) {
        this.currentWallet = null;
      }

      console.log(`✓ 钱包已删除: ${name}`);
      return {
        success: true,
        message: `钱包 ${name} 已删除`,
      };
    } else {
      return {
        success: false,
        error: `钱包 ${name} 不存在`,
      };
    }
  }

  /**
   * 获取钱包的以太坊实例
   */
  getEthersWallet(name, provider = null) {
    const walletInfo = name ? this.wallets.get(name) : this.currentWallet;

    if (!walletInfo) {
      throw new Error(`钱包 ${name || "current"} 不存在`);
    }

    const wallet = new ethers.Wallet(walletInfo.privateKey);
    return provider ? wallet.connect(provider) : wallet;
  }

  /**
   * 导出钱包私钥（谨慎使用）
   */
  exportPrivateKey(name, password = null) {
    const wallet = this.wallets.get(name);
    if (!wallet) {
      return {
        success: false,
        error: `钱包 ${name} 不存在`,
      };
    }

    // 简单的密码保护（实际应用中应使用更强的加密）
    if (password) {
      const encrypted = this.encryptData(wallet.privateKey, password);
      return {
        success: true,
        encryptedPrivateKey: encrypted,
      };
    } else {
      console.warn("⚠️ 导出未加密的私钥，请确保安全");
      return {
        success: true,
        privateKey: wallet.privateKey,
      };
    }
  }

  /**
   * 简单的数据加密（示例用途）
   */
  encryptData(data, password) {
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(password, "salt", 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    return {
      encrypted: encrypted,
      iv: iv.toString("hex"),
    };
  }

  /**
   * 验证地址格式
   */
  isValidAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * 验证私钥格式
   */
  isValidPrivateKey(privateKey) {
    try {
      new ethers.Wallet(privateKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证助记词
   */
  isValidMnemonic(mnemonic) {
    return bip39.validateMnemonic(mnemonic);
  }
}

// 创建默认实例
const walletManager = new WalletManager();

module.exports = {
  WalletManager,
  walletManager,
};
