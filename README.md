# Zentao MCP Server

这是一个专为禅道(Zentao)BUG跟踪系统设计的MCP服务器，让Cursor能够直接读取和操作禅道系统中的BUG信息。

## 功能特性
## 功能特性

- 🔐 **自动登录** - 支持禅道系统的用户认证
- 🐛 **BUG详情** - 根据BUG ID获取完整的BUG信息
- 🔍 **搜索功能** - 支持多条件搜索BUG
- 📋 **列表获取** - 获取项目的BUG列表
- 👤 **我的BUG** - 查看分配给当前用户的BUG
- 📊 **工作面板** - 获取工作面板统计信息
- ⏳ **待处理BUG** - 查看待处理的BUG列表
- 🏪 **市场缺陷** - 查看分配给自己的市场缺陷

## 安装步骤

1. 安装依赖：
```bash
npm install
```

2. 在Cursor中配置MCP服务器，在设置中添加：
```json
{
  "mcpServers": {
    "zentao": {
      "command": "node",
      "args": ["path/to/zentao-mcp-server/index.js"]
    }
  }
}
```

## 使用方法

### 1. 登录禅道系统
```javascript
// 使用zentao_login工具
{
  "baseUrl": "https://rdms.streamax.com",
  "username": "your_username",
  "password": "your_password"
}
```

### 2. 获取BUG详情
```javascript
// 使用zentao_get_bug工具
{
  "bugId": "141480"
}
```

### 3. 搜索BUG
```javascript
// 使用zentao_search_bugs工具
{
  "project": "project_id",
  "status": "active",
  "assignedTo": "username",
  "limit": 20
}
```

### 4. 获取BUG列表
```javascript
// 使用zentao_get_bug_list工具
{
  "project": "project_id",
  "limit": 50
}
```

## 支持的BUG信息字段

- ID、标题、状态、优先级、严重程度
- 指派人、报告人、所属产品、项目、模块
- 影响版本、操作系统、浏览器
- 重现步骤、描述、关键词
- 创建时间、更新时间

## 注意事项

- 首次使用需要先调用`zentao_login`工具进行登录
- 登录状态会在会话期间保持
- 支持大部分标准的禅道系统版本
- 网络超时设置为30秒

## 故障排除

如果遇到登录问题：
1. 检查网络连接和URL是否正确
2. 确认用户名密码是否正确
3. 检查禅道系统是否需要验证码
4. 查看是否有IP限制或其他安全策略

## 开发说明

本MCP服务器使用以下技术：
- Node.js + ES模块
- @modelcontextprotocol/sdk
- axios (HTTP客户端)
- cheerio (HTML解析)
- tough-cookie (Cookie管理)