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
      
      // 初始化完整的响应结构
      const bugInfo = {
        id: bugId,
        title: '',
        status: '',
        priority: '',
        severity: '',
        confirmed: '',
        assignedTo: '',
        reporter: '',
        createdBy: '',
        resolvedBy: '',
        closedBy: '',
        cc: '',
        product: '',
        project: '',
        module: '',
        version: '',
        affectedVersion: '',
        resolvedVersion: '',
        os: '',
        browser: '',
        platformDevice: '',
        bugType: '',
        plan: '',
        attribution: '',
        attributionTeam: '',
        valueAttribute: '',
        activationCount: '',
        activationDate: '',
        probability: '',
        commonIssue: '',
        execution: '',
        requirement: '',
        task: '',
        relatedBugs: '',
        relatedCases: '',
        deadline: '',
        created: '',
        updated: '',
        lastModified: '',
        steps: '',
        description: '',
        keywords: '',
        solution: '',
        images: []
      };

      // 提取标题 - 保留完整标题，只移除BUG编号和最后的系统名称
      const fullTitle = $('title').text().trim();
      if (fullTitle) {
        // 移除开头的 "BUG #数字 " 和结尾的 " - 锐明RDMS"
        bugInfo.title = fullTitle
          .replace(/^BUG #\d+\s*/, '')
          .replace(/\s*-\s*锐明RDMS\s*$/, '')
          .replace(/\s*-\s*FT-V3\.X\s*-\s*锐明RDMS\s*$/, '')
          .trim();
      } else {
        bugInfo.title = $('.page-title, h1').text().trim();
      }

      // 提取图片
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        if (src && !src.includes('data:') && !src.includes('base64')) {
          const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          bugInfo.images.push(fullUrl);
        }
      });

      // 字段映射表 - 中文标签到英文字段的映射
      const fieldMapping = {
        '状态': 'status',
        'Bug状态': 'status',
        '优先级': 'priority',
        '严重程度': 'severity',
        '是否确认': 'confirmed',
        '指派给': 'assignedTo',
        '由谁创建': 'reporter',
        '创建者': 'createdBy',
        '报告人': 'reporter',
        '解决者': 'resolvedBy',
        '关闭者': 'closedBy',
        '抄送给': 'cc',
        '所属产品': 'product',
        '所属项目': 'project',
        '所属模块': 'module',
        '影响版本': 'version',
        '版本': 'affectedVersion',
        '解决版本': 'resolvedVersion',
        '操作系统': 'os',
        '浏览器': 'browser',
        '平台/设备': 'platformDevice',
        'Bug类型': 'bugType',
        '类型': 'bugType',
        '计划': 'plan',
        '所属计划': 'plan',
        '归属': 'attribution',
        '归属团队': 'attributionTeam',
        '价值属性': 'valueAttribute',
        '激活次数': 'activationCount',
        '激活日期': 'activationDate',
        '出现概率': 'probability',
        '常见问题': 'commonIssue',
        '执行': 'execution',
        '需求': 'requirement',
        '关联需求': 'requirement',
        '任务': 'task',
        '关联任务': 'task',
        '相关Bug': 'relatedBugs',
        '相关用例': 'relatedCases',
        '截止日期': 'deadline',
        '创建时间': 'created',
        '更新时间': 'updated',
        '最后修改': 'lastModified',
        '重现步骤': 'steps',
        '详细描述': 'description',
        '描述': 'description',
        '关键词': 'keywords',
        '解决方案': 'solution'
      };

      // 从表格中提取字段
      $('table tr, .table tr').each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        if (cells.length >= 2) {
          const label = cells.eq(0).text().trim();
          const value = cells.eq(1).text().trim();
          
          // 查找匹配的字段
          for (const [chineseLabel, englishField] of Object.entries(fieldMapping)) {
            if (label.includes(chineseLabel) && value) {
              bugInfo[englishField] = value;
              break;
            }
          }
        }
      });

      // 使用CSS选择器进一步提取字段
      Object.entries(fieldMapping).forEach(([chineseLabel, englishField]) => {
        if (!bugInfo[englishField]) {
          // 查找包含中文标签的元素
          const elements = $(`*:contains("${chineseLabel}")`);
          elements.each((i, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            
            // 如果元素只包含标签文本，查找相邻元素的值
            if (text === chineseLabel || text === chineseLabel + ':' || text === chineseLabel + '：') {
              const nextSibling = $el.next();
              const parent = $el.parent();
              const parentSiblings = parent.next();
              
              let value = '';
              if (nextSibling.length && nextSibling.text().trim()) {
                value = nextSibling.text().trim();
              } else if (parentSiblings.length && parentSiblings.text().trim()) {
                value = parentSiblings.text().trim();
              } else {
                // 查找同一行的其他单元格
                const row = $el.closest('tr');
                const cells = row.find('td');
                if (cells.length > 1) {
                  value = cells.eq(1).text().trim();
                }
              }
              
              if (value && value !== chineseLabel) {
                bugInfo[englishField] = value;
                return false; // 找到后停止查找
              }
            }
          });
        }
      });

      // 特殊处理一些字段
      // 提取步骤和描述（通常在较大的文本区域中）
      if (!bugInfo.steps) {
        const stepsArea = $('.steps, .reproduce-steps, [name*="steps"]').text().trim();
        if (stepsArea) bugInfo.steps = stepsArea;
      }
      
      if (!bugInfo.description) {
        const descArea = $('.description, .bug-description, [name*="desc"]').text().trim();
        if (descArea) bugInfo.description = descArea;
      }

      // 提取历史记录
      bugInfo.history = [];
      $('.histories-list li').each((i, historyItem) => {
        const $item = $(historyItem);
        const historyText = $item.clone().children().remove().end().text().trim();
        const comment = $item.find('.comment-content').text().trim();
        
        if (historyText) {
          // 解析历史记录文本，提取时间、操作人、操作内容
          const historyMatch = historyText.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}),\s*由\s*(.+?)\s*(.+)$/);
          
          const historyRecord = {
            rawText: historyText,
            comment: comment || null
          };
          
          if (historyMatch) {
            historyRecord.time = historyMatch[1];
            historyRecord.operator = historyMatch[2];
            historyRecord.action = historyMatch[3];
          }
          
          bugInfo.history.push(historyRecord);
        }
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
        title: '',
        status: '',
        priority: '',
        severity: '',
        assignedTo: '',
        reporter: '',
        product: '',
        productLine: '',
        productVersion: '',
        productSystem: '',
        project: '',
        module: '',
        version: '',
        created: '',
        updated: '',
        region: '',
        customerCode: '',
        customerName: '',
        expectedSolveDate: '',
        problemLevel: '',
        frontTechSupport: '',
        defectDescription: '',
        temporaryResponse: '',
        solution: '',
        defectAttribution: '',
        defectType: '',
        planFixTime: '',
        problemAttributionTeam: '',
        locationProblem: '',
        confirmed: '',
        solveDate: '',
        closeDate: '',
        submitPage: '',
        images: [],
        history: []
      };

      // 提取标题 - 优先从HTML title标签获取完整标题
      const fullTitle = $('title').text().trim();
      if (fullTitle) {
        // 移除开头的 "BUG #数字 " 和结尾的 " - 锐明RDMS"
        marketBugInfo.title = fullTitle
          .replace(/^BUG #\d+\s*/, '')
          .replace(/\s*-\s*锐明RDMS\s*$/, '')
          .trim();
      } else {
        // 备选方案：从页面标题元素获取
        const titleElement = $('.page-title .text');
        if (titleElement.length) {
          marketBugInfo.title = titleElement.text().trim();
        } else {
          marketBugInfo.title = $('.page-title').text().trim();
        }
      }

      // 提取产品信息
      $('.detail-title').each((i, titleEl) => {
        const $title = $(titleEl);
        const titleText = $title.text().trim();
        const $content = $title.next('.detail-content');
        
        if (titleText === '产品信息') {
          $content.find('tr').each((j, row) => {
            const $row = $(row);
            const cells = $row.find('th, td');
            
            for (let k = 0; k < cells.length; k += 2) {
              const label = $(cells[k]).text().trim();
              const value = $(cells[k + 1]).text().trim();
              
              if (label === '产品线') marketBugInfo.productLine = value;
              if (label === '所属产品') marketBugInfo.product = value;
              if (label === '产品问题版本号') marketBugInfo.productVersion = value;
              if (label === '产品系统组成') marketBugInfo.productSystem = value;
            }
          });
        }
        
        if (titleText === '客户信息') {
          $content.find('tr').each((j, row) => {
            const $row = $(row);
            const cells = $row.find('th, td');
            
            for (let k = 0; k < cells.length; k += 2) {
              const label = $(cells[k]).text().trim();
              const value = $(cells[k + 1]).text().trim();
              
              if (label === '所属大区') marketBugInfo.region = value;
              if (label === '客户代码') marketBugInfo.customerCode = value;
              if (label === '客户名称') marketBugInfo.customerName = value;
              if (label === '期望解决日期') marketBugInfo.expectedSolveDate = value;
            }
          });
        }
        
        if (titleText === '缺陷信息') {
          $content.find('tr').each((j, row) => {
            const $row = $(row);
            const cells = $row.find('th, td');
            
            for (let k = 0; k < cells.length; k += 2) {
              const label = $(cells[k]).text().trim();
              const value = $(cells[k + 1]).text().trim();
              
              if (label === '问题级别') marketBugInfo.problemLevel = value;
              if (label === '前方技术支持') marketBugInfo.frontTechSupport = value;
              if (label === '缺陷描述') {
                marketBugInfo.defectDescription = $(cells[k + 1]).find('.detail-content').text().trim() || value;
              }
            }
          });
        }
        
        if (titleText === '解决方案') {
          marketBugInfo.solution = $content.text().trim();
        }
        
        if (titleText === '缺陷归属') {
          marketBugInfo.defectAttribution = $content.text().trim();
        }
      });

      // 提取右侧基本信息 - 使用更宽泛的选择器
      $('.side-col table tr, #legendBasicInfo table tr, .table-data tr').each((i, row) => {
        const $row = $(row);
        const label = $row.find('th').text().trim();
        const value = $row.find('td').text().trim();
        
        if (label === '缺陷状态') marketBugInfo.status = value;
        if (label === '缺陷类型') marketBugInfo.defectType = value;
        if (label === '优先级') marketBugInfo.priority = value;
        if (label === '严重程度') marketBugInfo.severity = value;
        if (label === '指派给') marketBugInfo.assignedTo = value;
        if (label === '由谁创建') marketBugInfo.reporter = value;
        if (label === '创建日期') marketBugInfo.created = value;
        if (label === '最后修改') marketBugInfo.updated = value;
        if (label === '计划修复时间') marketBugInfo.planFixTime = value;
        if (label === '问题归属团队') marketBugInfo.problemAttributionTeam = value;
        if (label === '定位问题') marketBugInfo.locationProblem = value;
        if (label === '是否确认') marketBugInfo.confirmed = value;
        if (label === '解决日期') marketBugInfo.solveDate = value;
        if (label === '关闭日期') marketBugInfo.closeDate = value;
        if (label === '提交页面') marketBugInfo.submitPage = value;
        
        // 处理一些可能的字段变体
        if (label.includes('所属项目') && value && value !== '') marketBugInfo.project = value;
        if (label.includes('所属模块') && value && value !== '') marketBugInfo.module = value;
        if (label.includes('版本') && value && value !== '') marketBugInfo.version = value;
      });

      // 提取历史记录
      $('.histories-list li').each((i, historyItem) => {
        const $item = $(historyItem);
        const historyText = $item.clone().children().remove().end().text().trim();
        const comment = $item.find('.comment-content').text().trim();
        
        if (historyText) {
          // 解析历史记录文本，提取时间、操作人、操作内容
          const historyMatch = historyText.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}),\s*由\s*(.+?)\s*(.+)$/);
          
          const historyRecord = {
            rawText: historyText,
            comment: comment || null
          };
          
          if (historyMatch) {
            historyRecord.time = historyMatch[1];
            historyRecord.operator = historyMatch[2];
            historyRecord.action = historyMatch[3];
          }
          
          marketBugInfo.history.push(historyRecord);
        }
      });

      // 提取图片
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        if (src && !src.includes('data:') && !src.includes('base64') && !src.includes('theme/') && !src.includes('icon')) {
          const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          marketBugInfo.images.push(fullUrl);
        }
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
    
    // 查找Bug链接 - 修正选择器
    const bugLinks = $('a[href*="m=bug&f=view&bugID="]');
    
    bugLinks.each((index, link) => {
      if (index >= limit) return false;
      
      const $link = $(link);
      const href = $link.attr('href');
      const title = $link.text().trim();
      
      // 提取Bug ID - 修正正则表达式
      const match = href.match(/bugID=(\d+)/);
      const bugId = match ? match[1] : '';
      
      // 获取当前行的其他信息
      const $row = $link.closest('tr');
      const severity = $row.find('.label-severity-custom').text().trim() || 
                      $row.find('[title*="严重程度"]').text().trim();
      const priority = $row.find('.label-pri').text().trim();
      const reporter = $row.find('td').eq(6).text().trim(); // 创建者列
      const resolver = $row.find('td').eq(8).text().trim(); // 解决者列
      const resolution = $row.find('td').eq(9).text().trim(); // 方案列
      
      // 只处理有效的Bug
      if (bugId && parseInt(bugId) > 0 && title && title.length > 0) {
        bugs.push({
          id: bugId,
          title: title,
          status: '', // 状态信息在这个页面中不直接显示
          priority: priority,
          severity: severity,
          assignedTo: '', // 当前用户就是被指派人
          reporter: reporter,
          resolver: resolver,
          resolution: resolution,
          created: '',
          url: href.startsWith('http') ? href : `${this.baseUrl}${href.replace(/^\.\//, '')}`
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