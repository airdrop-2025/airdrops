const axios = require("axios");
const { SocksProxyAgent } = require("socks-proxy-agent");
const UserAgent = require("user-agents");

/**
 * 网页交互模块
 * 支持常规 HTTP 请求和 socks5 代理
 */
class WebClient {
  constructor(options = {}) {
    this.proxyUrl = options.proxyUrl || process.env.SOCKS5_PROXY;
    this.timeout = options.timeout || 10000;
    this.useRandomUserAgent = options.useRandomUserAgent !== false; // 默认使用随机 User-Agent
    this.userAgent = options.userAgent || this.generateUserAgent();
    this.headers = options.headers || {};
    this.client = this.createAxiosInstance();
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
   * 设置代理（支持多种格式）
   */
  setProxy(proxyInput) {
    try {
      this.proxyUrl = this.parseProxyUrl(proxyInput);

      // 重新创建 axios 实例
      this.client = this.createAxiosInstance();

      console.log(
        `✓ 代理已更新: ${
          this.proxyUrl
            ? this.proxyUrl.replace(/:\/\/[^:]+:[^@]+@/, "://***:***@")
            : "无"
        }`
      );
      return { success: true, proxy: this.proxyUrl };
    } catch (error) {
      console.error(`代理设置失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成随机 User-Agent
   */
  generateUserAgent() {
    if (this.useRandomUserAgent) {
      try {
        const userAgent = new UserAgent();
        return userAgent.toString();
      } catch (error) {
        console.warn("⚠️ 生成随机 User-Agent 失败，使用默认值:", error.message);
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
      }
    }
    return (
      this.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );
  }

  /**
   * 创建 axios 实例
   */
  createAxiosInstance() {
    const config = {
      timeout: this.timeout,
      headers: {
        "User-Agent": this.userAgent,
        ...this.headers,
      },
    };

    // 如果配置了代理，则添加代理支持
    if (this.proxyUrl) {
      try {
        const proxyUrl = this.parseProxyUrl(this.proxyUrl);
        const agent = new SocksProxyAgent(proxyUrl);
        config.httpAgent = agent;
        config.httpsAgent = agent;
        console.log(
          `✓ 已配置 SOCKS5 代理: ${proxyUrl.replace(
            /:\/\/[^:]+:[^@]+@/,
            "://***:***@"
          )}`
        );
      } catch (error) {
        console.warn(`⚠️ 代理配置失败: ${error.message}`);
      }
    }

    return axios.create(config);
  }

  /**
   * GET 请求
   */
  async get(url, config = {}) {
    try {
      const response = await this.client.get(url, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * POST 请求
   */
  async post(url, data = {}, config = {}) {
    try {
      const response = await this.client.post(url, data, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * PUT 请求
   */
  async put(url, data = {}, config = {}) {
    try {
      const response = await this.client.put(url, data, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * DELETE 请求
   */
  async delete(url, config = {}) {
    try {
      const response = await this.client.delete(url, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(url, outputPath) {
    try {
      const response = await this.client.get(url, {
        responseType: "stream",
      });

      return {
        success: true,
        stream: response.data,
        contentType: response.headers["content-type"],
        contentLength: response.headers["content-length"],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 设置默认请求头
   */
  setDefaultHeaders(headers) {
    Object.assign(this.client.defaults.headers.common, headers);
  }

  /**
   * 设置认证令牌
   */
  setAuthToken(token, type = "Bearer") {
    this.client.defaults.headers.common["Authorization"] = `${type} ${token}`;
  }

  /**
   * 错误处理
   */
  handleError(error) {
    const errorInfo = {
      success: false,
      message: error.message,
      code: error.code,
    };

    if (error.response) {
      // 服务器响应了错误状态码
      errorInfo.status = error.response.status;
      errorInfo.data = error.response.data;
      errorInfo.headers = error.response.headers;
    } else if (error.request) {
      // 请求已发出但没有收到响应
      errorInfo.type = "NO_RESPONSE";
    } else {
      // 请求配置错误
      errorInfo.type = "REQUEST_SETUP_ERROR";
    }

    return errorInfo;
  }

  /**
   * 测试代理连接
   */
  async testProxy() {
    if (!this.proxyUrl) {
      return { success: false, message: "未配置代理" };
    }

    try {
      const result = await this.get("https://httpbin.org/ip");
      if (result.success) {
        return {
          success: true,
          message: "代理连接正常",
          ip: result.data.origin,
        };
      } else {
        return {
          success: false,
          message: "代理连接失败",
          error: result.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "代理测试失败",
        error: error.message,
      };
    }
  }

  /**
   * 设置是否使用随机 User-Agent
   */
  setRandomUserAgent(enabled = true) {
    this.useRandomUserAgent = enabled;
    if (enabled) {
      this.userAgent = this.generateUserAgent();
      this.client.defaults.headers.common["User-Agent"] = this.userAgent;
      console.log(`✓ 已启用随机 User-Agent: ${this.userAgent}`);
    }
  }

  /**
   * 获取当前 User-Agent
   */
  getCurrentUserAgent() {
    return this.userAgent;
  }

  /**
   * 更新 User-Agent（可以是随机或指定的）
   */
  refreshUserAgent(customUserAgent = null) {
    if (customUserAgent) {
      this.userAgent = customUserAgent;
      this.useRandomUserAgent = false;
    } else {
      this.userAgent = this.generateUserAgent();
    }
    this.client.defaults.headers.common["User-Agent"] = this.userAgent;
    console.log(`✓ User-Agent 已更新: ${this.userAgent}`);
    return this.userAgent;
  }

  /**
   * 获取随机 User-Agent 信息
   */
  getUserAgentInfo() {
    try {
      const userAgent = new UserAgent();
      return {
        success: true,
        userAgent: userAgent.toString(),
        browser: userAgent.browser,
        version: userAgent.version,
        os: userAgent.os,
        platform: userAgent.platform,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// 创建默认实例
const webClient = new WebClient();

module.exports = {
  WebClient,
  webClient,
};
