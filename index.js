import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class ZentaoMCPServer {
  static cookies = {};

  constructor() {
    this.server = new Server(
      {
        name: 'zentao-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.baseUrl = process.env.ZENTAO_BASE_URL || '';
    this.username = process.env.ZENTAO_USERNAME || '';
    this.password = process.env.ZENTAO_PASSWORD || '';
    this.isLoggedIn = false;
    
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    this.setupCookieInterceptors();
    this.setupToolHandlers();
  }

  setupCookieInterceptors() {
    // 请求拦截器：添加cookies
    this.client.interceptors.request.use(config => {
      const cookieString = Object.entries(ZentaoMCPServer.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      if (cookieString) {
        config.headers.Cookie = cookieString;
      }
      
      return config;
    });

    // 响应拦截器：保存cookies
    this.client.interceptors.response.use(response => {
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        setCookieHeader.forEach(cookie => {
          const [nameValue] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          if (name && value) {
            ZentaoMCPServer.cookies[name.trim()] = value.trim();
          }
        });
      }
      return response;
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'zentao_login',
          description: 'Login to Zentao system',
          inputSchema: {
            type: 'object',
            properties: {
              baseUrl: { type: 'string', description: 'Zentao base URL' },
              username: { type: 'string', description: 'Username' },
              password: { type: 'string', description: 'Password' }
            },
            required: ['baseUrl', 'username', 'password']
          }
        },
        {
          name: 'zentao_get_bug',
          description: 'Get bug details by ID with image extraction',
          inputSchema: {
            type: 'object',
            properties: {
              bugId: { type: 'string', description: 'Bug ID' }
            },
            required: ['bugId']
          }
        },
        {
          name: 'zentao_get_market_defect',
          description: 'Get market defect details by ID with image extraction',
          inputSchema: {
            type: 'object',
            properties: {
              defectId: { type: 'string', description: 'Market defect ID' }
            },
            required: ['defectId']
          }
        },
        {
          name: 'zentao_search_bugs',
          description: 'Search bugs with enhanced filters',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              assignedTo: { type: 'string', description: 'Assigned to user' },
              status: { type: 'string', description: 'Bug status' },
              severity: { type: 'string', description: 'Bug severity' },
              execution: { type: 'string', description: 'Execution/iteration version' },
              limit: { type: 'number', description: 'Max results', default: 20 }
            }
          }
        },
        {
          name: 'zentao_search_market_defects',
          description: 'Search market defects',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              assignedTo: { type: 'string', description: 'Assigned to user' },
              status: { type: 'string', description: 'Defect status' },
              limit: { type: 'number', description: 'Max results', default: 20 }
            }
          }
        },
        {
          name: 'zentao_get_my_bugs',
          description: 'Get bugs assigned to current user',
          inputSchema: {
            type: 'object',
            properties: {
              status: { type: 'string', description: 'Filter by status', default: 'active' },
              limit: { type: 'number', description: 'Max results', default: 20 }
            }
          }
        },
        {
          name: 'zentao_get_pending_bugs',
          description: 'Get pending bugs assigned to current user',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max results', default: 20 }
            }
          }
        },
        {
          name: 'zentao_get_market_defects',
          description: 'Get market defects assigned to current user',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max results', default: 20 }
            }
          }
        },
        {
          name: 'zentao_get_work_dashboard',
          description: 'Get work dashboard information',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'zentao_login':
            return { content: [{ type: 'text', text: JSON.stringify(await this.login(args.baseUrl, args.username, args.password)) }] };
          case 'zentao_get_bug':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getBug(args.bugId)) }] };
          case 'zentao_get_market_defect':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getMarketDefect(args.defectId)) }] };
          case 'zentao_search_bugs':
            return { content: [{ type: 'text', text: JSON.stringify(await this.searchBugs(args.query, args)) }] };
          case 'zentao_search_market_defects':
            return { content: [{ type: 'text', text: JSON.stringify(await this.searchMarketDefects(args.query, args)) }] };
          case 'zentao_get_my_bugs':
          case 'zentao_get_pending_bugs':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getMyBugs(args.status, args.limit)) }] };
          case 'zentao_get_market_defects':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getMarketDefects(args.limit)) }] };
          case 'zentao_get_work_dashboard':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getWorkDashboard()) }] };
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
      }
    });
  }

  async login(baseUrl, username, password) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    
    try {
      // 1. 获取登录页面
      const loginPageResponse = await this.client.get(`${baseUrl}/index.php?m=user&f=login`);
      const $ = cheerio.load(loginPageResponse.data);
      const token = $('input[name="token"]').val();
      
      // 2. 构建登录数据
      const loginData = new URLSearchParams({
        account: username,
        password: password,
        keepLogin: '1'
      });
      
      if (token) {
        loginData.append('token', token);
      }
      
      // 3. 执行登录
      const loginResponse = await this.client.post(`${baseUrl}/index.php?m=user&f=login`, loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${baseUrl}/index.php?m=user&f=login`
        }
      });

      if (loginResponse.data.includes("self.location='/'") || loginResponse.data.length < 200) {
        this.isLoggedIn = true;
        console.log(`Auto-logged in to ${baseUrl} as ${username}`);
        return { success: true, message: `Successfully logged in to Zentao system at ${baseUrl}` };
      } else {
        throw new Error('Login failed - invalid credentials or response');
      }
    } catch (error) {
      this.isLoggedIn = false;
      return { success: false, error: error.message };
    }
  }

  async autoLogin() {
    if (this.baseUrl && this.username && this.password) {
      return await this.login(this.baseUrl, this.username, this.password);
    }
    return { success: false, error: 'Missing login credentials' };
  }

  async ensureLoggedIn() {
    if (!this.isLoggedIn && this.baseUrl && this.username && this.password) {
      await this.autoLogin();
    }
    if (!this.isLoggedIn) {
      throw new Error('Not logged in. Please configure environment variables or use zentao_login tool.');
    }
  }

  async getBug(bugId) {
    await this.ensureLoggedIn();
    try {
      const response = await this.client.get(`${this.baseUrl}/index.php?m=bug&f=view&bugID=${bugId}`);
      
      // 检查是否被重定向到登录页面
      if (response.data.includes('login') && response.data.length < 500) {
        throw new Error('Session expired, please login again');
      }
      
      const $ = cheerio.load(response.data);
      
      const bugInfo = {
        id: bugId,
        title: $('title').text().replace(/^BUG #\d+\s*/, '').replace(/\s*-.*$/, '').trim() || 
               $('.page-title, h1').text().trim(),
        status: '', priority: '', severity: '', assignedTo: '', reporter: '',
        product: '', project: '', module: '', version: '', os: '', browser: '',
        steps: '', description: '', keywords: '', created: '', updated: '',
        images: []
      };

      // Extract images
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        if (src && !src.includes('data:') && !src.includes('base64')) {
          const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          bugInfo.images.push(fullUrl);
        }
      });

      // Extract bug fields using multiple strategies
      $('table tr, .table tr').each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        if (cells.length >= 2) {
          const label = cells.eq(0).text().trim();
          const value = cells.eq(1).text().trim();
          
          if (label.includes('状态') || label.includes('Bug状态')) bugInfo.status = value;
          if (label.includes('优先级')) bugInfo.priority = value;
          if (label.includes('严重程度')) bugInfo.severity = value;
          if (label.includes('指派给')) bugInfo.assignedTo = value;
          if (label.includes('由谁创建') || label.includes('创建者')) bugInfo.reporter = value;
          if (label.includes('所属产品')) bugInfo.product = value;
          if (label.includes('所属项目')) bugInfo.project = value;
          if (label.includes('所属模块')) bugInfo.module = value;
          if (label.includes('影响版本')) bugInfo.version = value;
        }
      });

      // Alternative extraction method
      const keywords = ['状态', '优先级', '严重程度', '指派给'];
      keywords.forEach(keyword => {
        const elements = $(`*:contains("${keyword}")`);
        elements.each((i, el) => {
          const $el = $(el);
          const parent = $el.parent();
          const siblings = parent.find('td, span, div').not($el);
          if (siblings.length > 0) {
            const value = siblings.first().text().trim();
            if (value && !bugInfo[keyword === '状态' ? 'status' : 
                                keyword === '优先级' ? 'priority' : 
                                keyword === '严重程度' ? 'severity' : 'assignedTo']) {
              if (keyword === '状态') bugInfo.status = value;
              if (keyword === '优先级') bugInfo.priority = value;
              if (keyword === '严重程度') bugInfo.severity = value;
              if (keyword === '指派给') bugInfo.assignedTo = value;
            }
          }
        });
      });

      return bugInfo;
    } catch (error) {
      return { error: error.message };
    }
  }

  async getMarketDefect(defectId) {
    await this.ensureLoggedIn();
    try {
      const response = await this.client.get(`${this.baseUrl}/index.php?m=bugmarket&f=view&bugID=${defectId}`);
      const $ = cheerio.load(response.data);
      
      const defectInfo = {
        id: defectId,
        title: $('.page-title').text().trim() || $('title').text().trim(),
        status: '', priority: '', severity: '', assignedTo: '', reporter: '',
        product: '', project: '', module: '', version: '', created: '', updated: '',
        images: []
      };

      // Extract images
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        if (src && !src.includes('data:') && !src.includes('base64')) {
          const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          defectInfo.images.push(fullUrl);
        }
      });

      // Extract defect fields (similar to bug extraction)
      $('.table-form tr, .detail tr').each((i, row) => {
        const $row = $(row);
        const label = $row.find('th, .label').text().trim();
        const value = $row.find('td:not(.label)').text().trim();
        
        if (label.includes('状态') || label.includes('Status')) defectInfo.status = value;
        if (label.includes('优先级') || label.includes('Priority')) defectInfo.priority = value;
        if (label.includes('严重程度') || label.includes('Severity')) defectInfo.severity = value;
        if (label.includes('指派给') || label.includes('AssignedTo')) defectInfo.assignedTo = value;
        if (label.includes('由谁创建') || label.includes('Reporter')) defectInfo.reporter = value;
        if (label.includes('所属产品') || label.includes('Product')) defectInfo.product = value;
        if (label.includes('所属项目') || label.includes('Project')) defectInfo.project = value;
        if (label.includes('所属模块') || label.includes('Module')) defectInfo.module = value;
      });

      return defectInfo;
    } catch (error) {
      return { error: error.message };
    }
  }

  async searchBugs(query = '', options = {}) {
    await this.ensureLoggedIn();
    try {
      let searchUrl = `${this.baseUrl}/index.php?m=bug&f=browse`;
      const params = new URLSearchParams();
      
      if (query) params.append('param', query);
      if (options.assignedTo) params.append('assignedTo', options.assignedTo);
      if (options.status) params.append('browseType', options.status);
      if (options.execution) params.append('execution', options.execution);
      
      if (params.toString()) {
        searchUrl += '&' + params.toString();
      }

      const response = await this.client.get(searchUrl);
      return this.parseBugList(response.data, options.limit || 20, 'BUG搜索');
    } catch (error) {
      return { success: false, error: error.message, bugs: [] };
    }
  }

  async searchMarketDefects(query = '', options = {}) {
    await this.ensureLoggedIn();
    try {
      let searchUrl = `${this.baseUrl}/index.php?m=bugmarket&f=browse`;
      const params = new URLSearchParams();
      
      if (query) params.append('param', query);
      if (options.assignedTo) params.append('assignedTo', options.assignedTo);
      if (options.status) params.append('browseType', options.status);
      
      if (params.toString()) {
        searchUrl += '&' + params.toString();
      }

      const response = await this.client.get(searchUrl);
      return this.parseBugList(response.data, options.limit || 20, '市场缺陷搜索');
    } catch (error) {
      return { success: false, error: error.message, bugs: [] };
    }
  }

  async getMyBugs(status = 'active', limit = 20) {
    await this.ensureLoggedIn();
    try {
      const myBugsUrl = `${this.baseUrl}/index.php?m=my&f=work&mode=bug&type=assignedTo`;
      const response = await this.client.get(myBugsUrl);
      return this.parseBugList(response.data, limit, '我的BUG');
    } catch (error) {
      return { success: false, error: error.message, bugs: [] };
    }
  }


  async getMarketDefects(limit = 20) {
    await this.ensureLoggedIn();
    try {
      const defectsUrl = `${this.baseUrl}/index.php?m=bugmarket&f=browse&productid=0&branch=0&browseType=assigntome`;
      const response = await this.client.get(defectsUrl);
      return this.parseBugList(response.data, limit, '市场缺陷');
    } catch (error) {
      return { success: false, error: error.message, bugs: [] };
    }
  }

  async getWorkDashboard() {
    await this.ensureLoggedIn();
    try {
      const dashboardUrl = `${this.baseUrl}/index.php?m=my&f=index`;
      const response = await this.client.get(dashboardUrl);
      const $ = cheerio.load(response.data);
      
      const dashboard = {
        pageTitle: $('title').text().trim(),
        pageSize: response.data.length
      };

      // Extract dashboard statistics
      $('.dashboard .panel, .block').each((i, panel) => {
        const $panel = $(panel);
        const title = $panel.find('.panel-heading, .block-title, h3, h4').text().trim();
        const count = $panel.find('.count, .number, strong').text().trim();
        
        if (title.includes('BUG') || title.includes('bug')) {
          dashboard.myBugs = count;
        }
        if (title.includes('缺陷')) {
          dashboard.myDefects = count;
        }
      });

      return {
        success: true,
        dashboard,
        message: '工作面板信息获取成功'
      };
    } catch (error) {
      return { success: false, error: error.message, dashboard: {} };
    }
  }

  parseBugList(html, limit = 20, type = 'BUG') {
    const $ = cheerio.load(html);
    const bugs = [];
    
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
      if (bugRows.length > 0) break;
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
          severity: cells.eq(2).text().trim() || cells.eq(3).text().trim() || '',
          assignedTo: cells.eq(5).text().trim() || cells.eq(6).text().trim() || '',
          reporter: cells.eq(6).text().trim() || cells.eq(7).text().trim() || '',
          created: cells.eq(7).text().trim() || cells.eq(8).text().trim() || ''
        };
        
        if (bug.id && bug.title) {
          bugs.push(bug);
        }
      }
    });
    
    return {
      success: true,
      total: bugs.length,
      bugs: bugs,
      type: type,
      message: bugs.length > 0 ? `找到 ${bugs.length} 个${type}` : `暂无${type}`
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Zentao MCP server running on stdio');
  }
}

const server = new ZentaoMCPServer();
server.run().catch(console.error);