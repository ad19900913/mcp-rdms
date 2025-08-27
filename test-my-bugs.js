#!/usr/bin/env node

import { spawn } from 'child_process';

const username = process.argv[2];
const password = process.argv[3];
const status = process.argv[4] || 'active'; // 默认查看活跃的BUG

if (!username || !password) {
  console.log('❌ 请提供用户名和密码');
  console.log('用法: node test-my-bugs.js <用户名> <密码> [状态]');
  console.log('示例: node test-my-bugs.js myuser mypass active');
  console.log('示例: node test-my-bugs.js myuser mypass all');
  process.exit(1);
}

console.log(`🧪 测试查看分配给我的BUG...\n`);
console.log(`📋 测试参数:`);
console.log(`- 用户名: ${username}`);
console.log(`- 状态过滤: ${status}`);
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
          console.log('3️⃣ 获取分配给我的BUG...');
          
          // 发送获取我的BUG请求
          const getMyBugsRequest = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "zentao_get_my_bugs",
              arguments: {
                status: status,
                limit: 20
              }
            }
          };
          
          mcpProcess.stdin.write(JSON.stringify(getMyBugsRequest) + '\n');
          step = 2;
          
        } else if (parsed.error) {
          console.log('❌ 登录失败:', parsed.error.message);
          mcpProcess.kill();
          process.exit(1);
        }
      }
      
      // 处理获取我的BUG响应
      if (parsed.id === 2 && step === 2) {
        if (parsed.result) {
          console.log('✅ 成功获取分配给我的BUG！\n');
          
          // 解析并显示BUG信息
          const data = JSON.parse(parsed.result.content[0].text);
          
          console.log('📋 我的BUG列表：');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`👤 分配给: ${data.assignedTo}`);
          console.log(`📊 状态过滤: ${data.status}`);
          console.log(`📈 总数: ${data.total}`);
          
          if (data.message) {
            console.log(`💬 ${data.message}`);
          }
          
          if (data.bugs && data.bugs.length > 0) {
            console.log('\n🐛 BUG详情:');
            data.bugs.forEach((bug, index) => {
              console.log(`\n${index + 1}. BUG #${bug.id}`);
              console.log(`   📝 标题: ${bug.title}`);
              console.log(`   📊 状态: ${bug.status}`);
              console.log(`   ⚡ 优先级: ${bug.priority}`);
              console.log(`   👨‍💻 报告人: ${bug.reporter}`);
              console.log(`   📅 创建时间: ${bug.created}`);
            });
          } else {
            console.log('\n🎉 太好了！您当前没有分配的BUG。');
          }
          
          console.log('\n🎉 测试完成！');
          
        } else if (parsed.error) {
          console.log('❌ 获取我的BUG失败:', parsed.error.message);
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