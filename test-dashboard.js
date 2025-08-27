import { spawn } from 'child_process';

async function testDashboard() {
  const username = process.argv[2];
  const password = process.argv[3];
  
  if (!username || !password) {
    console.log('用法: node test-dashboard.js <用户名> <密码>');
    process.exit(1);
  }

  // 设置环境变量
  const env = {
    ...process.env,
    ZENTAO_BASE_URL: 'https://rdms.streamax.com',
    ZENTAO_USERNAME: username,
    ZENTAO_PASSWORD: password
  };

  console.log('🚀 测试禅道工作面板和BUG查询功能...\n');

  // 测试工作面板
  console.log('1️⃣ 测试工作面板...');
  await testTool('zentao_get_work_dashboard', {}, env);

  console.log('\n2️⃣ 测试待处理BUG...');
  await testTool('zentao_get_pending_bugs', { limit: 10 }, env);

  console.log('\n3️⃣ 测试市场缺陷...');
  await testTool('zentao_get_market_defects', { limit: 10 }, env);

  console.log('\n✅ 所有测试完成！');
}

function testTool(toolName, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['index.js'], { 
      env,
      stdio: ['pipe', 'pipe', 'inherit']
    });

    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      try {
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const response = JSON.parse(lastLine);
        
        if (response.result && response.result.content) {
          const content = JSON.parse(response.result.content[0].text);
          console.log(`✅ ${toolName} 成功:`);
          console.log(JSON.stringify(content, null, 2));
        } else if (response.error) {
          console.log(`❌ ${toolName} 失败:`, response.error.message);
        }
      } catch (error) {
        console.log(`❌ ${toolName} 解析失败:`, error.message);
        console.log('原始输出:', output);
      }
      resolve();
    });

    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();
  });
}

testDashboard().catch(console.error);