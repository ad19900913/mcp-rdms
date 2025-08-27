import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';

class ZentaoMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "zentao-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 创建带cookie支持的axios实例
    this.cookieJar = new CookieJar();
    this.client = wrapper(axios.create({
      jar: this.cookieJar,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }));

    // 从环境变量获取配置
    this.baseUrl = process.env.ZENTAO_BASE_URL || '';
    this.username = process.env.ZENTAO_USERNAME || '';
    this.password = process.env.ZENTAO_PASSWORD || '';
    this.isLoggedIn = false;
    
    this.setupHandlers();
    
    // 如果配置了用户名密码，自动登录
    if (this.baseUrl && this.username && this.password) {
      this.autoLogin();
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "zentao_login",
          description: "Login to Zentao system",
          inputSchema: {
            type: "object",
            properties: {
              baseUrl: {
                type: "string",
                description: "Base URL of the Zentao system (e.g., https://rdms.streamax.com)"
              },
              username: {
                type: "string",
                description: "Username for login"
              },
              password: {
                type: "string",
                description: "Password for login"
              }
            },
            required: ["baseUrl", "username", "password"]
          }
        },
        {
          name: "zentao_get_bug",
          description: "Get bug details by bug ID",
          inputSchema: {
            type: "object",
            properties: {
              bugId: {
                type: "string",
                description: "Bug ID to retrieve"
              }
            },
            required: ["bugId"]
          }
        },
        {
          name: "zentao_search_bugs",
          description: "Search bugs with filters",
          inputSchema: {
            type: "object",
            properties: {
              project: {
                type: "string",
                description: "Project ID or name"
              },
              status: {
                type: "string",
                description: "Bug status (active, resolved, closed, etc.)"
              },
              assignedTo: {
                type: "string",
                description: "Assigned user"
              },
              limit: {
                type: "number",
                description: "Maximum number of results",
                default: 20
              }
            }
          }
        },
        {
          name: "zentao_get_bug_list",
          description: "Get list of bugs for a project",
          inputSchema: {
            type: "object",
            properties: {
              project: {
                type: "string",
                description: "Project ID"
              },
              limit: {
                type: "number",
                description: "Maximum number of results",
                default: 50
              }
            }
          }
        },
        {
          name: "zentao_get_my_bugs",
          description: "Get bugs assigned to current logged-in user",
          inputSchema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                description: "Filter by status (active, resolved, closed, etc.). Default: active",
                default: "active"
              },
              limit: {
                type: "number",
                description: "Maximum number of results",
                default: 20
              }
            }
          }
        },
        {
          name: "zentao_get_work_dashboard",
          description: "Get work dashboard information including bug counts",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "zentao_get_pending_bugs",
          description: "Get pending bugs assigned to current user",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of results",
                default: 20
              }
            }
          }
        },
        {
          name: "zentao_get_market_defects",
          description: "Get market defects assigned to current user",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of results",
                default: 20
              }
            }
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "zentao_login":
            return await this.login(args.baseUrl, args.username, args.password);
          
          case "zentao_get_bug":
            return await this.getBug(args.bugId);
          
          case "zentao_search_bugs":
            return await this.searchBugs(args);
          
          case "zentao_get_bug_list":
            return await this.getBugList(args.project, args.limit);
          
          case "zentao_get_my_bugs":
          case "zentao_get_my_bugs":
            return await this.getMyBugs(args.status, args.limit);
          
          case "zentao_get_work_dashboard":
            return await this.getWorkDashboard();
          
          case "zentao_get_pending_bugs":
            return await this.getPendingBugs(args.limit);
          
          case "zentao_get_market_defects":
            return await this.getMarketDefects(args.limit);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error.message}`
        );
      }
    });
  }

  async login(baseUrl, username, password) {
    try {
      this.baseUrl = baseUrl.replace(/\/$/, '');
      
      // 首先获取登录页面
      const loginPageResponse = await this.client.get(`${this.baseUrl}/index.php?m=user&f=login`);
      const $ = cheerio.load(loginPageResponse.data);
      
      // 提取所有表单数据
      const verifyRand = $('input[name="verifyRand"]').val() || '';
      const referer = $('input[name="referer"]').val() || '/';
      
      // 执行登录
      const loginData = {
        account: username,
        password: password,
        referer: referer
      };
      
      // 只有当verifyRand存在时才添加
      if (verifyRand) {
        loginData.verifyRand = verifyRand;
      }

      const loginResponse = await this.client.post(
        `${this.baseUrl}/index.php?m=user&f=login`,
        new URLSearchParams(loginData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${this.baseUrl}/index.php?m=user&f=login`
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400
        }
      );

      // 检查登录响应
      const responseText = loginResponse.data;
      
      if (loginResponse.status === 302) {
        this.isLoggedIn = true;
        return {
          content: [
            {
              type: "text",
              text: `Successfully logged in to Zentao system at ${this.baseUrl}`
            }
          ]
        };
      } else if ((responseText.includes('parent.location') || responseText.includes('self.location')) && !responseText.includes('登录失败')) {
        this.isLoggedIn = true;
        return {
          content: [
            {
              type: "text",
              text: `Successfully logged in to Zentao system at ${this.baseUrl}`
            }
          ]
        };
      } else if (responseText.includes('登录失败') || responseText.includes('用户名或密码')) {
        throw new Error('登录失败：用户名或密码错误，请检查您的凭据');
      } else if (responseText.includes('验证码')) {
        throw new Error('登录失败：系统要求验证码，请通过浏览器登录或联系管理员');
      } else {
        // 保存调试信息
        console.error('Login response:', responseText.substring(0, 500));
        throw new Error('登录失败：未知错误，请检查网络连接和系统状态');
      }
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async autoLogin() {
    try {
      await this.login(this.baseUrl, this.username, this.password);
      console.error(`Auto-logged in to ${this.baseUrl} as ${this.username}`);
    } catch (error) {
      console.error(`Auto-login failed: ${error.message}`);
    }
  }

  async ensureLoggedIn() {
    if (!this.isLoggedIn && this.baseUrl && this.username && this.password) {
      await this.autoLogin();
    }
    if (!this.isLoggedIn) {
      throw new Error('Not logged in. Please configure ZENTAO_BASE_URL, ZENTAO_USERNAME, ZENTAO_PASSWORD in environment variables or use zentao_login tool.');
    }
  }

  async getBug(bugId) {
    await this.ensureLoggedIn();

    try {
      const response = await this.client.get(`${this.baseUrl}/index.php?m=bug&f=view&bugID=${bugId}`);
      const $ = cheerio.load(response.data);

      // 提取BUG详细信息
      const bugInfo = {
        id: bugId,
        title: $('.page-title').text().trim() || $('title').text().trim(),
        status: '',
        priority: '',
        severity: '',
        assignedTo: '',
        reporter: '',
        product: '',
        project: '',
        module: '',
        version: '',
        os: '',
        browser: '',
        steps: '',
        description: '',
        keywords: '',
        created: '',
        updated: ''
      };

      // 尝试多种选择器来提取BUG信息
      const extractBugInfo = () => {
        // 方法1: 尝试标准的table-info
        $('.table-info tr, .table tr, .detail-info tr').each((i, row) => {
          const $row = $(row);
          const label = $row.find('th, td:first-child').text().trim();
          const value = $row.find('td:last-child, td:nth-child(2)').text().trim();

          if (label && value && label !== value) {
            switch (label) {
              case '状态':
              case 'Status':
              case '当前状态':
                bugInfo.status = value;
                break;
              case '优先级':
              case 'Priority':
                bugInfo.priority = value;
                break;
              case '严重程度':
              case 'Severity':
                bugInfo.severity = value;
                break;
              case '指派给':
              case 'Assigned To':
              case '指派':
                bugInfo.assignedTo = value;
                break;
              case '由谁创建':
              case 'Reporter':
              case '创建者':
                bugInfo.reporter = value;
                break;
              case '所属产品':
              case 'Product':
              case '产品':
                bugInfo.product = value;
                break;
              case '所属项目':
              case 'Project':
              case '项目':
                bugInfo.project = value;
                break;
              case '所属模块':
              case 'Module':
              case '模块':
                bugInfo.module = value;
                break;
              case '影响版本':
              case 'Version':
              case '版本':
                bugInfo.version = value;
                break;
              case '操作系统':
              case 'OS':
                bugInfo.os = value;
                break;
              case '浏览器':
              case 'Browser':
                bugInfo.browser = value;
                break;
              case '创建日期':
              case 'Created':
              case '创建时间':
                bugInfo.created = value;
                break;
              case '关键词':
              case 'Keywords':
                bugInfo.keywords = value;
                break;
            }
          }
        });

        // 方法2: 尝试通过标签文本查找
        $('*').each((i, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          
          if (text.includes('状态：') || text.includes('Status:')) {
            const match = text.match(/状态[：:]\s*([^\s]+)/);
            if (match) bugInfo.status = match[1];
          }
          if (text.includes('优先级：') || text.includes('Priority:')) {
            const match = text.match(/优先级[：:]\s*([^\s]+)/);
            if (match) bugInfo.priority = match[1];
          }
          if (text.includes('指派给：') || text.includes('Assigned:')) {
            const match = text.match(/指派给[：:]\s*([^\s]+)/);
            if (match) bugInfo.assignedTo = match[1];
          }
        });
      };

      extractBugInfo();

      // 提取标题 - 尝试多种选择器
      if (!bugInfo.title) {
        bugInfo.title = $('.page-title').text().trim() || 
                      $('h1').text().trim() || 
                      $('title').text().trim() ||
                      $('.bug-title').text().trim();
      }

      // 提取重现步骤和描述 - 尝试多种选择器
      $('.article-content, .bug-content, .content, .description').each((i, content) => {
        const $content = $(content);
        const title = $content.prev('h4, h3, .title').text().trim();
        const contentText = $content.text().trim();
        
        if (title.includes('重现步骤') || title.includes('Steps') || title.includes('复现')) {
          bugInfo.steps = contentText;
        } else if (title.includes('描述') || title.includes('Description')) {
          bugInfo.description = contentText;
        }
      });

      // 如果还是没有获取到描述，尝试其他方式
      if (!bugInfo.description) {
        bugInfo.description = $('.bug-desc, .description, .detail-content').text().trim();
      }
      if (!bugInfo.steps) {
        bugInfo.steps = $('.bug-steps, .steps, .reproduce-steps').text().trim();
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(bugInfo, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get bug ${bugId}: ${error.message}`);
    }
  }

  async searchBugs(filters) {
    await this.ensureLoggedIn();

    try {
      let searchUrl = `${this.baseUrl}/index.php?m=bug&f=browse`;
      const params = new URLSearchParams();

      if (filters.project) {
        params.append('productID', filters.project);
      }
      if (filters.status) {
        params.append('browseType', filters.status);
      }
      if (filters.assignedTo) {
        params.append('assignedTo', filters.assignedTo);
      }

      if (params.toString()) {
        searchUrl += '&' + params.toString();
      }

      const response = await this.client.get(searchUrl);
      const $ = cheerio.load(response.data);

      const bugs = [];
      $('.table-condensed tbody tr').each((i, row) => {
        if (i >= (filters.limit || 20)) return false;
        
        const $row = $(row);
        const bug = {
          id: $row.find('td').eq(0).text().trim(),
          priority: $row.find('td').eq(1).text().trim(),
          title: $row.find('td').eq(2).find('a').text().trim(),
          status: $row.find('td').eq(3).text().trim(),
          assignedTo: $row.find('td').eq(4).text().trim(),
          reporter: $row.find('td').eq(5).text().trim(),
          created: $row.find('td').eq(6).text().trim()
        };
        
        if (bug.id) {
          bugs.push(bug);
        }
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ bugs, total: bugs.length }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to search bugs: ${error.message}`);
    }
  }

  async getBugList(project, limit = 50) {
    await this.ensureLoggedIn();
    return await this.searchBugs({ project, limit });
  }

  async getMyBugs(status = 'active', limit = 20) {
  async getMyBugs(status = 'active', limit = 20) {
    await this.ensureLoggedIn();

    try {
      // 使用与待处理BUG相同的URL
      const myBugsUrl = `${this.baseUrl}/index.php?m=my&f=work&mode=bug&type=assignedTo`;
      console.log(`正在获取我的BUG: ${myBugsUrl}`);
      
      const response = await this.client.get(myBugsUrl);
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await this.parseBugList(response.data, limit, '我的BUG');
      
    } catch (error) {
      throw new Error(`获取我的BUG失败: ${error.message}`);
    }
  }

  // 获取工作面板信息
  // 获取工作面板信息
  async getWorkDashboard() {
    await this.ensureLoggedIn();
    
    try {
      const dashboardUrl = `${this.baseUrl}/index.php?m=my&f=index`;
      console.log(`正在访问工作面板: ${dashboardUrl}`);
      
      const response = await this.client.get(dashboardUrl);
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const $ = cheerio.load(response.data);
      const dashboard = {};
      
      // 调试：输出页面内容的一部分
      console.log('页面标题:', $('title').text());
      console.log('页面内容长度:', response.data.length);
      
      // 尝试多种方式提取统计信息
      const selectors = [
        '.panel-body a',
        '.dashboard-item',
        '.my-work a',
        'a[href*="work"]',
        'a[href*="bug"]',
        '.statistic-item'
      ];
      
      for (const selector of selectors) {
        $(selector).each((index, element) => {
          const $link = $(element);
          const href = $link.attr('href') || '';
          const text = $link.text().trim();
          const number = $link.find('.number, .count, .label-badge, .badge').text().trim();
          
          console.log(`链接: ${href}, 文本: ${text}, 数字: ${number}`);
          
          if (href.includes('bug') && href.includes('assignedTo')) {
            dashboard.myBugs = number || text.match(/\d+/)?.[0] || '0';
          } else if (href.includes('task') && href.includes('assignedTo')) {
            dashboard.myTasks = number || text.match(/\d+/)?.[0] || '0';
          } else if (href.includes('story') && href.includes('assignedTo')) {
            dashboard.myStories = number || text.match(/\d+/)?.[0] || '0';
          }
        });
      }
      
      // 如果没有找到数据，尝试解析表格
      if (Object.keys(dashboard).length === 0) {
        $('table tr').each((index, element) => {
          const $row = $(element);
          const cells = $row.find('td');
          if (cells.length >= 2) {
            const label = cells.eq(0).text().trim();
            const value = cells.eq(1).text().trim();
            console.log(`表格行: ${label} = ${value}`);
            
            if (label.includes('BUG') || label.includes('bug')) {
              dashboard.myBugs = value;
            } else if (label.includes('任务') || label.includes('task')) {
              dashboard.myTasks = value;
            } else if (label.includes('需求') || label.includes('story')) {
              dashboard.myStories = value;
            }
          }
        });
      }
      
      // 添加页面原始信息用于调试
      dashboard.pageTitle = $('title').text();
      dashboard.pageSize = response.data.length;
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              dashboard: dashboard,
              message: '工作面板信息获取成功'
            }, null, 2)
          }
        ]
      };
      
    } catch (error) {
      throw new Error(`获取工作面板失败: ${error.message}`);
    }
  }

  // 获取待处理BUG
  async getPendingBugs(limit = 20) {
    await this.ensureLoggedIn();
    
    try {
      const pendingUrl = `${this.baseUrl}/index.php?m=my&f=work&mode=bug&type=assignedTo`;
      console.log(`正在获取待处理BUG: ${pendingUrl}`);
      
      const response = await this.client.get(pendingUrl);
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await this.parseBugList(response.data, limit, '待处理BUG');
      
    } catch (error) {
      throw new Error(`获取待处理BUG失败: ${error.message}`);
    }
  }

  // 获取市场缺陷
  async getMarketDefects(limit = 20) {
    await this.ensureLoggedIn();
    
    try {
      const defectsUrl = `${this.baseUrl}/index.php?m=bugmarket&f=browse&productid=0&branch=0&browseType=assigntome`;
      console.log(`正在获取市场缺陷: ${defectsUrl}`);
      
      const response = await this.client.get(defectsUrl);
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await this.parseBugList(response.data, limit, '市场缺陷');
      
    } catch (error) {
      throw new Error(`获取市场缺陷失败: ${error.message}`);
    }
  }

  // 通用BUG列表解析方法
  async parseBugList(html, limit, type) {
    const $ = cheerio.load(html);
    const bugs = [];
    
    // 尝试多种选择器来查找BUG列表
    const selectors = [
      'table tbody tr',
      '.table tbody tr',
      '#bugList tbody tr',
      '.bug-item',
      'tr[data-id]'
    ];
    
    let bugRows = $();
    for (const selector of selectors) {
      bugRows = $(selector);
      if (bugRows.length > 0) {
        console.log(`使用选择器找到 ${bugRows.length} 行: ${selector}`);
        break;
      }
    }
    
    bugRows.each((index, element) => {
      if (index >= limit) return false;
      
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length > 0) {
        const bug = {
          id: cells.eq(0).text().trim() || $row.attr('data-id') || '',
          title: cells.eq(1).text().trim() || cells.eq(2).text().trim() || '',
          status: cells.eq(3).text().trim() || cells.eq(4).text().trim() || '',
          priority: cells.eq(4).text().trim() || cells.eq(5).text().trim() || '',
          severity: cells.eq(5).text().trim() || cells.eq(6).text().trim() || '',
          assignedTo: cells.eq(6).text().trim() || cells.eq(7).text().trim() || '',
          reporter: cells.eq(7).text().trim() || cells.eq(8).text().trim() || '',
          created: cells.eq(8).text().trim() || cells.eq(9).text().trim() || ''
        };
        
        // 过滤空的BUG记录和表头
        if (bug.id && bug.title && bug.id !== 'ID' && !isNaN(parseInt(bug.id))) {
          bugs.push(bug);
        }
      }
    });
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            total: bugs.length,
            bugs: bugs,
            type: type,
            message: bugs.length > 0 ? `找到 ${bugs.length} 个${type}` : `暂无${type}`
          }, null, 2)
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Zentao MCP server running on stdio");
  }
}

const server = new ZentaoMCPServer();
server.run().catch(console.error);