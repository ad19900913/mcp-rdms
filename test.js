#!/usr/bin/env node
import { RDMSMCPServer } from './index.js';

// 测试配置
const TEST_CONFIG = {
  baseUrl: process.env.RDMS_BASE_URL || 'https://rdms.streamax.com',
  username: process.env.RDMS_USERNAME || 'jiangyuanchen',
  password: process.env.RDMS_PASSWORD || 'Rm123456',
  testBugId: process.env.TEST_BUG_ID || '141480',
  testDefectId: process.env.TEST_DEFECT_ID || '11636',
  testImageUrl: process.env.TEST_IMAGE_URL || 'https://rdms.streamax.com/index.php?m=file&f=read&t=png&fileID=411376'
};

// 所有可用的测试方法
const AVAILABLE_TESTS = {
  'rdms_login': {
    description: '测试登录功能',
    args: {
      baseUrl: TEST_CONFIG.baseUrl,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password
    }
  },
  'rdms_get_bug': {
    description: '测试获取Bug详情',
    args: {
      bugId: TEST_CONFIG.testBugId
    }
  },
  'rdms_get_market_defect': {
    description: '测试获取市场缺陷详情',
    args: {
      defectId: TEST_CONFIG.testDefectId
    }
  },
  'rdms_get_my_bugs': {
    description: '测试获取我的Bug',
    args: {
      status: 'active',
      limit: 5
    }
  },
  'rdms_get_market_defects': {
    description: '测试获取我的市场缺陷',
    args: {
      limit: 5
    }
  },
  'rdms_download_image': {
    description: '测试下载图片',
    args: {
      imageUrl: TEST_CONFIG.testImageUrl,
      analyze: true
    }
  }
};

class RDMSTester {
  constructor() {
    this.server = new RDMSMCPServer();
    this.results = [];
  }

  async testTool(toolName, args) {
    console.log(`\n🧪 测试 ${toolName}...`);
    console.log(`📝 描述: ${AVAILABLE_TESTS[toolName]?.description || '未知测试'}`);
    console.log(`📋 参数:`, JSON.stringify(args, null, 2));
    
    const startTime = Date.now();
    
    try {
      let result;
      
      // 直接调用服务器方法
      switch (toolName) {
        case 'rdms_login':
          result = await this.server.login(args.baseUrl, args.username, args.password);
          break;
        case 'rdms_get_bug':
          result = await this.server.getBug(args.bugId);
          break;
        case 'rdms_get_market_defect':
          result = await this.server.getMarketDefect(args.defectId);
          break;
        case 'rdms_get_my_bugs':
          result = await this.server.getMyBugs(args.status, args.limit);
          break;
        case 'rdms_get_market_defects':
          result = await this.server.getMarketDefects(args.limit);
          break;
        case 'rdms_download_image':
          result = await this.server.downloadImage(args.imageUrl, args.filename, args.analyze);
          break;
        default:
          throw new Error(`未知的测试方法: ${toolName}`);
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ 成功 (${duration}ms)`);
      console.log(`📤 结果:`, JSON.stringify(result, null, 2));
      
      this.results.push({
        tool: toolName,
        status: 'success',
        duration,
        result
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.log(`❌ 失败 (${duration}ms)`);
      console.log(`🚨 错误:`, error.message);
      
      this.results.push({
        tool: toolName,
        status: 'error',
        duration,
        error: error.message
      });
      
      return { error: error.message };
    }
  }

  async runSingleTest(toolName) {
    if (!AVAILABLE_TESTS[toolName]) {
      console.log(`❌ 未知的测试方法: ${toolName}`);
      console.log(`📋 可用的测试方法:`);
      Object.keys(AVAILABLE_TESTS).forEach(name => {
        console.log(`   - ${name}: ${AVAILABLE_TESTS[name].description}`);
      });
      return;
    }

    console.log(`🎯 单独测试: ${toolName}`);
    await this.testTool(toolName, AVAILABLE_TESTS[toolName].args);
    this.printSummary();
  }

  async runAllTests() {
    console.log('🚀 开始运行所有测试...\n');
    
    // 首先测试登录
    if (AVAILABLE_TESTS['rdms_login']) {
      await this.testTool('rdms_login', AVAILABLE_TESTS['rdms_login'].args);
    }
    
    // 然后测试其他方法
    for (const [toolName, config] of Object.entries(AVAILABLE_TESTS)) {
      if (toolName !== 'rdms_login') {
        await this.testTool(toolName, config.args);
      }
    }
    
    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 测试总结');
    console.log('='.repeat(50));
    
    const successful = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'error').length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`✅ 成功: ${successful}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`⏱️  总耗时: ${totalTime}ms`);
    
    if (failed > 0) {
      console.log('\n🚨 失败的测试:');
      this.results
        .filter(r => r.status === 'error')
        .forEach(r => {
          console.log(`   - ${r.tool}: ${r.error}`);
        });
    }
    
    console.log('\n📋 详细结果:');
    this.results.forEach(r => {
      const status = r.status === 'success' ? '✅' : '❌';
      console.log(`   ${status} ${r.tool} (${r.duration}ms)`);
    });
  }

  printUsage() {
    console.log(`
🧪 RDMS MCP 测试工具

用法:
  node test.js                    # 运行所有测试
  node test.js [method_name]      # 运行指定测试

可用的测试方法:
${Object.entries(AVAILABLE_TESTS).map(([name, config]) => 
  `  ${name.padEnd(25)} - ${config.description}`
).join('\n')}

环境变量配置:
  RDMS_BASE_URL      - RDMS系统地址
  RDMS_USERNAME      - 用户名
  RDMS_PASSWORD      - 密码
  TEST_BUG_ID        - 测试用的Bug ID
  TEST_DEFECT_ID     - 测试用的缺陷ID
  TEST_IMAGE_URL     - 测试用的图片URL

示例:
  node test.js rdms_login
  node test.js rdms_get_bug
  RDMS_BASE_URL=http://demo.zentao.net node test.js
`);
  }
}

async function main() {
  const tester = new RDMSTester();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 运行所有测试
    await tester.runAllTests();
  } else if (args[0] === '--help' || args[0] === '-h') {
    // 显示帮助
    tester.printUsage();
    return;
  } else {
    // 运行指定测试
    const toolName = args[0];
    await tester.runSingleTest(toolName);
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('🚨 未处理的Promise拒绝:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 未捕获的异常:', error);
  process.exit(1);
});

// 运行测试
main().catch(console.error);