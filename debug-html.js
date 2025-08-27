#!/usr/bin/env node

import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import fs from 'fs';

const username = process.argv[2];
const password = process.argv[3];
const bugId = process.argv[4] || '141480';

if (!username || !password) {
  console.log('用法: node debug-html.js <用户名> <密码> [BUG_ID]');
  process.exit(1);
}

async function debugBugHTML() {
  try {
    const cookieJar = new CookieJar();
    const client = wrapper(axios.create({
      jar: cookieJar,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }));

    const baseUrl = 'https://rdms.streamax.com';
    
    // 登录
    console.log('🔐 登录中...');
    const loginPageResponse = await client.get(`${baseUrl}/index.php?m=user&f=login`);
    const $ = cheerio.load(loginPageResponse.data);
    
    const loginData = {
      account: username,
      password: password,
      referer: $('input[name="referer"]').val() || '/'
    };

    await client.post(`${baseUrl}/index.php?m=user&f=login`, new URLSearchParams(loginData), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // 获取BUG页面
    console.log(`📄 获取BUG ${bugId}页面...`);
    const bugResponse = await client.get(`${baseUrl}/index.php?m=bug&f=view&bugID=${bugId}`);
    
    // 保存完整HTML
    fs.writeFileSync(`bug-${bugId}.html`, bugResponse.data);
    console.log(`✅ HTML已保存到 bug-${bugId}.html`);
    
    // 分析结构
    const $bug = cheerio.load(bugResponse.data);
    
    console.log('\n🔍 页面结构分析:');
    console.log('- 标题元素:', $bug('h1, .page-title, .bug-title').length);
    console.log('- 表格元素:', $bug('table').length);
    console.log('- 表格行数:', $bug('tr').length);
    
    // 输出所有表格内容
    $bug('table').each((i, table) => {
      console.log(`\n📊 表格 ${i + 1}:`);
      $bug(table).find('tr').each((j, row) => {
        const cells = $bug(row).find('th, td').map((k, cell) => $bug(cell).text().trim()).get();
        if (cells.length > 0) {
          console.log(`  行 ${j + 1}: ${cells.join(' | ')}`);
        }
      });
    });
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

debugBugHTML();