import { spawn } from 'child_process';

async function runTests() {
  const username = process.argv[2];
  const password = process.argv[3];
  const testType = process.argv[4] || 'all';
  
  // 如果没有提供用户名密码，只进行基本的语法检查
  if (!username || !password) {
    console.log('🔍 运行基本语法检查...');
    try {
      // 导入模块进行语法检查
      await import('./index.js');
      console.log('✅ 语法检查通过');
      console.log('\n📝 完整测试用法: node test.js <用户名> <密码> [测试类型]');
      console.log('测试类型: all, login, bug, dashboard, pending, market, my-bugs');
      return;
    } catch (error) {
      console.error('❌ 语法检查失败:', error.message);
      process.exit(1);
    }
  }

  // 设置环境变量
  const env = {
    ...process.env,
    RDMS_BASE_URL: 'https://rdms.streamax.com',
    RDMS_USERNAME: username,
    RDMS_PASSWORD: password
  };

  console.log('🚀 RDMS MCP服务器测试套件\n');

  if (testType === 'all' || testType === 'login') {
    console.log('1️⃣ 测试登录...');
    await testTool('rdms_login', {
      baseUrl: 'https://rdms.streamax.com',
      username: username,
      password: password
    }, env);
  }

  if (testType === 'all' || testType === 'bug') {
    const bugId = process.argv[5] || '141480';
    console.log(`\n2️⃣ 测试获取BUG ${bugId}...`);
    await testTool('rdms_get_bug', { bugId: bugId }, env);
  }

  if (testType === 'all' || testType === 'dashboard') {
    console.log('\n3️⃣ 测试工作面板...');
    await testTool('rdms_get_work_dashboard', {}, env);
  }

  if (testType === 'all' || testType === 'pending') {
    console.log('\n4️⃣ 测试待处理BUG...');
    await testTool('rdms_get_pending_bugs', { limit: 10 }, env);
  }

  if (testType === 'all' || testType === 'market') {
    console.log('\n5️⃣ 测试市场缺陷...');
    await testTool('rdms_get_market_defects', { limit: 10 }, env);
  }

  if (testType === 'all' || testType === 'my-bugs') {
    console.log('\n6️⃣ 测试我的BUG...');
    await testTool('rdms_get_my_bugs', { status: 'active', limit: 10 }, env);
  }

  console.log('\n✅ 测试完成！');
}

async function testTool(toolName, args, env) {
  return new Promise((resolve) => {
    const child = spawn('node', ['index.js'], { 
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      console.log('Zentao MCP server running on stdio');
    });

    child.on('close', () => {
      try {
        const lines = output.trim().split('\n').filter(line => line.trim());
        const lastLine = lines[lines.length - 1];
        
        if (!lastLine) {
          console.log(`❌ ${toolName} 失败: 无响应`);
          resolve();
          return;
        }

        const response = JSON.parse(lastLine);
        
        if (response.result && response.result.content) {
          let content;
          try {
            content = JSON.parse(response.result.content[0].text);
          } catch {
            content = response.result.content[0].text;
          }
          console.log(`✅ ${toolName} 成功:`);
          console.log(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
        } else if (response.error) {
          console.log(`❌ ${toolName} 失败:`, response.error.message);
        }
      } catch (error) {
        console.log(`❌ ${toolName} 解析失败:`, error.message);
        console.log('原始输出:', output.substring(0, 500));
      }
      resolve();
    });

    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();
  });
}

runTests().catch(console.error);