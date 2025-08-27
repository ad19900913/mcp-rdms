# 发布RDMS MCP Server到公共仓库指南

## 发布到GitHub

### 1. 创建GitHub仓库
```bash
# 在GitHub上创建新仓库 rdms-mcp-server
# 然后在本地初始化git
git init
git add .
git commit -m "Initial commit: RDMS MCP Server v1.0.0"
git branch -M main
git remote add origin https://github.com/your-username/rdms-mcp-server.git
git push -u origin main
```

### 2. 创建Release
1. 在GitHub仓库页面点击 "Releases"
2. 点击 "Create a new release"
3. 标签版本: `v1.0.0`
4. 发布标题: `RDMS MCP Server v1.0.0`
5. 描述内容:
```markdown
## 🎉 首次发布 - RDMS MCP Server v1.0.0

### ✨ 主要功能
- 🔐 RDMS系统认证登录
- 🐛 完整的BUG信息提取
- 🖼️ **AI图片分析** - 自动提取并分析BUG附件图片
- 🔍 多条件搜索功能
- 📊 工作面板统计信息
- 🏪 市场缺陷管理
- 📥 图片下载和处理

### 🚀 快速开始
1. 安装: `npm install rdms-mcp-server`
2. 配置Cursor MCP
3. 开始使用AI分析BUG图片！

详细使用说明请查看 [README.md](./README.md)
```

## 发布到NPM

### 1. 准备NPM账户
```bash
# 登录NPM
npm login

# 检查登录状态
npm whoami
```

### 2. 发布前检查
```bash
# 检查包信息
npm pack --dry-run

# 运行测试
npm test

# 检查包内容
npm pack
tar -tzf rdms-mcp-server-1.0.0.tgz
```

### 3. 发布到NPM
```bash
# 发布
npm publish

# 如果是第一次发布公共包
npm publish --access public
```

### 4. 验证发布
```bash
# 检查包是否发布成功
npm view rdms-mcp-server

# 测试安装
npm install rdms-mcp-server
```

## 发布到MCP Registry

### 1. 提交到MCP官方注册表
1. Fork [MCP Registry](https://github.com/modelcontextprotocol/registry)
2. 在 `servers/` 目录下创建 `rdms-mcp-server.json`:

```json
{
  "name": "rdms-mcp-server",
  "description": "MCP server for reading RDMS bug tracking system with AI image analysis",
  "author": "CodeBuddy",
  "homepage": "https://github.com/your-username/rdms-mcp-server",
  "license": "MIT",
  "runtime": "node",
  "categories": ["productivity", "automation", "testing"],
  "keywords": ["rdms", "bug-tracking", "ai-vision", "image-analysis"],
  "installation": {
    "npm": "rdms-mcp-server"
  },
  "configuration": {
    "command": "node",
    "args": ["node_modules/rdms-mcp-server/index.js"],
    "env": {
      "RDMS_BASE_URL": "https://your-rdms-url.com",
      "RDMS_USERNAME": "your_username", 
      "RDMS_PASSWORD": "your_password"
    }
  }
}
```

3. 提交Pull Request

## 推广和文档

### 1. 创建演示视频
- 展示登录RDMS系统
- 演示获取BUG详情
- 重点展示AI图片分析功能
- 展示搜索和列表功能

### 2. 撰写博客文章
- 介绍MCP协议
- 展示RDMS集成的价值
- AI图片分析的创新点
- 使用案例和最佳实践

### 3. 社区推广
- 在MCP Discord频道分享
- 在Reddit r/programming 发布
- 在Twitter/X上宣传
- 在相关技术论坛分享

## 维护和更新

### 版本管理
```bash
# 更新版本
npm version patch  # 1.0.1
npm version minor  # 1.1.0
npm version major  # 2.0.0

# 发布更新
git push --tags
npm publish
```

### 持续集成
考虑设置GitHub Actions进行：
- 自动测试
- 自动发布到NPM
- 自动生成Release Notes

## 检查清单

发布前确保：
- [ ] 所有测试通过
- [ ] README.md完整且准确
- [ ] LICENSE文件存在
- [ ] CHANGELOG.md已更新
- [ ] package.json信息完整
- [ ] 敏感信息已移除
- [ ] 示例配置文件已更新
- [ ] 版本号正确
- [ ] Git标签已创建

发布后：
- [ ] 验证NPM包可正常安装
- [ ] 验证GitHub Release正确
- [ ] 更新相关文档链接
- [ ] 通知用户和社区