#!/usr/bin/env node

import { spawn } from 'child_process';

// 从命令行参数获取用户名、密码和BUG ID
const username = process.argv[2];
const password = process.argv[3];
const bugId = process.argv[4] || '141480'; // 默认为141480

console.log(`🧪 完整测试：登录 + 读取BUG ${bugId}...\n`);

if (!username || !password) {
  console.log('❌ 请提供用户名和密码');
  console.log('用法: node test-with-login.js <用户名> <密码> [BUG_ID]');
  console.log('示例: node test-with-login.js myuser mypass 141480');
  console.log('示例: node test-with-login.js myuser mypass 123456');
  process.exit(1);
}

console.log(`📋 测试参数:`);
console.log(`- 用户名: ${username}`);
console.log(`- BUG ID: ${bugId}`);
console.log('');

// 启动MCP服务器
const mcpProcess = spawn('node', ['index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

console.log('1️⃣ 启动MCP服务器...');

let step = 1;
let response = '';

setTimeout(() => {
  console.log('2️⃣ 登录禅道系统...');
  
  // 发送登录请求
  const loginRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "zentao_login",
      arguments: {
        baseUrl: "https://rdms.streamax.com",
        username: username,
        password: password
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(loginRequest) + '\n');
  
}, 2000);

mcpProcess.stdout.on('data', (data) => {
  response += data.toString();
  
  const lines = response.split('\n').filter(line => line.trim());
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      
      // 处理登录响应
      if (parsed.id === 1 && step === 1) {
        if (parsed.result) {
          console.log('✅ 登录成功！');
          console.log(`3️⃣ 获取BUG ${bugId}...`);
          
          // 发送获取BUG请求
          const getBugRequest = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "zentao_get_bug",
              arguments: {
                bugId: bugId
              }
            }
          };
          
          mcpProcess.stdin.write(JSON.stringify(getBugRequest) + '\n');
          step = 2;
          
        } else if (parsed.error) {
          console.log('❌ 登录失败:', parsed.error.message);
          console.log('\n🔍 调试信息：');
          console.log('- 用户名:', username);
          console.log('- 密码长度:', password.length);
          console.log('- 基础URL: https://rdms.streamax.com');
          console.log('- BUG ID:', bugId);
          console.log('\n💡 可能的原因：');
          console.log('1. 网络连接问题');
          console.log('2. 禅道系统需要验证码');
          console.log('3. 用户名格式问题（可能需要邮箱格式）');
          console.log('4. 禅道系统的登录机制有变化');
          console.log('5. IP限制或安全策略');
          
          mcpProcess.kill();
          process.exit(1);
        }
      }
      
      // 处理获取BUG响应
      if (parsed.id === 2 && step === 2) {
        if (parsed.result) {
          console.log(`✅ 成功获取BUG ${bugId}！\n`);
          
          // 解析并显示BUG信息
          const bugData = JSON.parse(parsed.result.content[0].text);
          
          console.log('📋 BUG详细信息：');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`🆔 ID: ${bugData.id}`);
          console.log(`📝 标题: ${bugData.title}`);
          console.log(`📊 状态: ${bugData.status}`);
          console.log(`⚡ 优先级: ${bugData.priority}`);
          console.log(`🔥 严重程度: ${bugData.severity}`);
          console.log(`👤 指派给: ${bugData.assignedTo}`);
          console.log(`👨‍💻 报告人: ${bugData.reporter}`);
          console.log(`📦 产品: ${bugData.product}`);
          console.log(`🏗️ 项目: ${bugData.project}`);
          console.log(`📁 模块: ${bugData.module}`);
          console.log(`📅 创建时间: ${bugData.created}`);
          
          if (bugData.description) {
            console.log(`\n📄 描述:`);
            console.log(bugData.description.substring(0, 300) + (bugData.description.length > 300 ? '...' : ''));
          }
          
          if (bugData.steps) {
            console.log(`\n🔄 重现步骤:`);
            console.log(bugData.steps.substring(0, 300) + (bugData.steps.length > 300 ? '...' : ''));
          }
          
          console.log('\n🎉 测试完成！MCP服务器可以成功读取禅道BUG信息！');
          
        } else if (parsed.error) {
          console.log('❌ 获取BUG失败:', parsed.error.message);
        }
        
        mcpProcess.kill();
        process.exit(0);
      }
      
    } catch (e) {
      // 继续等待完整响应
    }
  }
});

// 20秒后超时
setTimeout(() => {
  console.log('❌ 测试超时');
  mcpProcess.kill();
  process.exit(1);
}, 20000);

mcpProcess.on('error', (error) => {
  console.error('❌ MCP服务器启动失败:', error.message);
  process.exit(1);
});