#!/usr/bin/env node
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
import fs from 'fs';
import path from 'path';

export class RDMSMCPServer {
  static cookies = {};

  constructor() {
    this.server = new Server(
      {
        name: 'rdms-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.baseUrl = process.env.RDMS_BASE_URL || '';
    this.username = process.env.RDMS_USERNAME || '';
    this.password = process.env.RDMS_PASSWORD || '';
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
      const cookieString = Object.entries(RDMSMCPServer.cookies)
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
            RDMSMCPServer.cookies[name.trim()] = value.trim();
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
          name: 'rdms_login',
          description: 'Login to RDMS system. Once logged in successfully, the session cookies will be automatically cached and reused for all subsequent API calls. You only need to call this once per session - the system will automatically handle authentication for future requests using the cached cookies. If a session expires, the system will attempt auto-login using stored credentials.',
          inputSchema: {
            type: 'object',
            properties: {
              baseUrl: { type: 'string', description: 'RDMS base URL' },
              username: { type: 'string', description: 'Username' },
              password: { type: 'string', description: 'Password' }
            },
            required: ['baseUrl', 'username', 'password']
          }
        },
        {
          name: 'rdms_get_bug',
          description: 'Get bug details by ID with image extraction. Returns bug information including image URLs but NOT image content. If you need to analyze image content, use the rdms_download_image tool with the returned image URLs.',
          inputSchema: {
            type: 'object',
            properties: {
              bugId: { type: 'string', description: 'Bug ID' }
            },
            required: ['bugId']
          }
        },
        {
          name: 'rdms_get_market_bug',
          description: 'Get market bug details by ID with image extraction. Returns market bug information including image URLs but NOT image content. If you need to analyze image content, use the rdms_download_image tool with the returned image URLs.',
          inputSchema: {
            type: 'object',
            properties: {
              marketBugId: { type: 'string', description: 'Market bug ID' }
            },
            required: ['marketBugId']
          }
        },
        {
          name: 'rdms_get_my_bugs',
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
          name: 'rdms_get_my_market_bugs',
          description: 'Get market bugs assigned to current user',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max results', default: 20 }
            }
          }
        },
        {
          name: 'rdms_download_image',
          description: 'Download and optionally analyze image from RDMS system',
          inputSchema: {
            type: 'object',
            properties: {
              imageUrl: { type: 'string', description: 'Image URL from RDMS' },
              filename: { type: 'string', description: 'Optional filename for saved image' },
              analyze: { type: 'boolean', description: 'Whether to return image for AI analysis', default: true }
            },
            required: ['imageUrl']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'rdms_login':
            return { content: [{ type: 'text', text: JSON.stringify(await this.login(args.baseUrl, args.username, args.password)) }] };
          case 'rdms_get_bug':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getBug(args.bugId)) }] };
          case 'rdms_get_market_bug':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getMarketBug(args.marketBugId)) }] };
          case 'rdms_get_my_bugs':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getMyBugs(args.status, args.limit)) }] };
          case 'rdms_get_my_market_bugs':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getMyMarketBugs(args.limit)) }] };
          case 'rdms_download_image':
            return await this.downloadImage(args.imageUrl, args.filename, args.analyze);
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
        return { success: true, message: `Successfully logged in to RDMS system at ${baseUrl}` };
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
      throw new Error('Not logged in. Please configure environment variables or use rdms_login tool.');
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

  async getMarketBug(marketBugId) {
    await this.ensureLoggedIn();
    try {
      const response = await this.client.get(`${this.baseUrl}/index.php?m=bugmarket&f=view&bugID=${marketBugId}`);
      const $ = cheerio.load(response.data);
      
      const marketBugInfo = {
        id: marketBugId,
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
          marketBugInfo.images.push(fullUrl);
        }
      });

      // Extract market bug fields
      $('.table-form tr, .detail tr').each((i, row) => {
        const $row = $(row);
        const label = $row.find('th, .label').text().trim();
        const value = $row.find('td:not(.label)').text().trim();
        
        if (label.includes('状态') || label.includes('Status')) marketBugInfo.status = value;
        if (label.includes('优先级') || label.includes('Priority')) marketBugInfo.priority = value;
        if (label.includes('严重程度') || label.includes('Severity')) marketBugInfo.severity = value;
        if (label.includes('指派给') || label.includes('AssignedTo')) marketBugInfo.assignedTo = value;
        if (label.includes('由谁创建') || label.includes('Reporter')) marketBugInfo.reporter = value;
        if (label.includes('所属产品') || label.includes('Product')) marketBugInfo.product = value;
        if (label.includes('所属项目') || label.includes('Project')) marketBugInfo.project = value;
        if (label.includes('所属模块') || label.includes('Module')) marketBugInfo.module = value;
      });

      return marketBugInfo;
    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeImages(imageUrls) {
    const analysis = [];
    
    for (const imageUrl of imageUrls) {
      try {
        // Download image data
        const response = await this.client.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        const base64Image = imageBuffer.toString('base64');
        
        // Determine image type
        const contentType = response.headers['content-type'] || 'image/png';
        const imageType = contentType.split('/')[1] || 'png';
        
        analysis.push({
          url: imageUrl,
          type: imageType,
          size: imageBuffer.length,
          base64: `data:${contentType};base64,${base64Image}`,
          description: `Image from RDMS (${imageType}, ${Math.round(imageBuffer.length / 1024)}KB)`
        });
      } catch (error) {
        analysis.push({
          url: imageUrl,
          error: `Failed to download image: ${error.message}`
        });
      }
    }
    
    return analysis;
  }

  async downloadImage(imageUrl, filename, analyze = true) {
    await this.ensureLoggedIn();
    
    try {
      const response = await this.client.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/png';
      const imageType = contentType.split('/')[1] || 'png';
      
      if (analyze) {
        // Return image data for AI analysis
        const base64Image = imageBuffer.toString('base64');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                imageUrl,
                type: imageType,
                size: imageBuffer.length,
                message: `Image downloaded successfully (${Math.round(imageBuffer.length / 1024)}KB)`
              })
            },
            {
              type: 'image',
              data: base64Image,
              mimeType: contentType
            }
          ]
        };
      } else {
        // Save to file if filename provided
        if (filename) {
          const filepath = path.resolve(filename);
          fs.writeFileSync(filepath, imageBuffer);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                imageUrl,
                savedTo: filepath,
                type: imageType,
                size: imageBuffer.length,
                message: `Image saved to ${filepath}`
              })
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                imageUrl,
                type: imageType,
                size: imageBuffer.length,
                message: 'Image downloaded successfully'
              })
            }]
          };
        }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            imageUrl
          })
        }]
      };
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

  async getMyMarketBugs(limit = 20) {
    await this.ensureLoggedIn();
    try {
      const marketBugsUrl = `${this.baseUrl}/index.php?m=bugmarket&f=browse&productid=0&branch=0&browseType=assigntome`;
      const response = await this.client.get(marketBugsUrl);
      return this.parseBugList(response.data, limit, '市场Bug');
    } catch (error) {
      return { success: false, error: error.message, bugs: [] };
    }
  }


  parseBugList(html, limit = 20, type = 'BUG') {
    const $ = cheerio.load(html);
    const bugs = [];
    
    // 查找Bug链接
    const bugLinks = $('a[href*="m=bug&f=view&id="]');
    
    bugLinks.each((index, link) => {
      if (index >= limit) return false;
      
      const $link = $(link);
      const href = $link.attr('href');
      const title = $link.text().trim();
      
      // 提取Bug ID
      const match = href.match(/id=(\d+)/);
      const bugId = match ? match[1] : '';
      
      // 只处理有效的Bug
      if (bugId && parseInt(bugId) > 0 && title && title.length > 0) {
        bugs.push({
          id: bugId,
          title: title,
          status: '',
          priority: '',
          severity: '',
          assignedTo: '',
          reporter: '',
          created: '',
          url: href.startsWith('http') ? href : `${this.baseUrl}/${href.replace(/^\.\//, '')}`
        });
      }
    });
    
    // 如果找到Bug，返回结果
    if (bugs.length > 0) {
      return {
        success: true,
        total: bugs.length,
        bugs: bugs,
        type: type,
        message: `找到 ${bugs.length} 个${type}`
      };
    }
    
    // 检查是否显示"暂时没有Bug"
    const emptyTip = $('.table-empty-tip').text().trim();
    if (emptyTip.includes('暂时没有Bug')) {
      return {
        success: true,
        total: 0,
        bugs: [],
        type: type,
        message: `暂无${type}`
      };
    }
    
    // 默认返回空结果
    return {
      success: true,
      total: 0,
      bugs: [],
      type: type,
      message: `暂无${type}`
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RDMS MCP server running on stdio');
  }
}

const server = new RDMSMCPServer();
server.run().catch(console.error);