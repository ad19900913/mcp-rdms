# RDMS MCP Server 快速开始指南

## 🚀 5分钟快速上手

### 步骤1: 安装
```bash
npm install rdms-mcp-server
```

### 步骤2: 配置Cursor
在Cursor设置中添加MCP服务器配置：

```json
{
  "mcpServers": {
    "rdms": {
      "command": "node",
      "args": ["node_modules/rdms-mcp-server/index.js"],
      "env": {
        "RDMS_BASE_URL": "https://rdms.streamax.com",
        "RDMS_USERNAME": "your_username",
        "RDMS_PASSWORD": "your_password"
      }
    }
  }
}
```

### 步骤3: 重启Cursor
重启Cursor以加载MCP服务器。

### 步骤4: 开始使用
在Cursor中直接询问：

```
"帮我查看BUG 141480的详情，并分析其中的图片"
```

## 🎯 主要功能演示

### 1. 查看BUG详情（含AI图片分析）
```
请获取BUG 141480的详细信息，包括图片分析
```

AI将自动：
- 登录RDMS系统
- 获取BUG详情
- 提取附件图片
- 分析图片内容
- 提供完整报告

### 2. 搜索相关BUG
```
搜索所有与"登录"相关的高优先级BUG
```

### 3. 查看我的工作
```
显示我的工作面板，包括分配给我的BUG和市场缺陷
```

### 4. 分析特定图片
```
下载并分析这个图片：https://rdms.streamax.com/index.php?m=file&f=read&t=png&fileID=413370
```

## 🔧 高级配置

### 环境变量方式
```bash
export RDMS_BASE_URL="https://rdms.streamax.com"
export RDMS_USERNAME="your_username"
export RDMS_PASSWORD="your_password"
```

### 本地开发
```bash
git clone https://github.com/your-username/rdms-mcp-server.git
cd rdms-mcp-server
npm install
node test.js your_username your_password
```

## 🎨 使用场景

### 场景1: BUG分析师
```
"分析最近一周分配给我的所有高优先级BUG，特别关注图片中的错误信息"
```

### 场景2: 项目经理
```
"生成本周的BUG统计报告，包括各状态BUG数量和主要问题类型"
```

### 场景3: 开发人员
```
"查看BUG 12345的详情，分析错误截图，并给出可能的解决方案"
```

### 场景4: 测试人员
```
"搜索所有与'界面显示'相关的BUG，分析图片中的UI问题"
```

## 🆘 常见问题

### Q: 登录失败怎么办？
A: 检查用户名密码是否正确，确认RDMS系统可访问。

### Q: 图片分析不工作？
A: 确认网络连接正常，图片URL可访问。

### Q: 如何更新配置？
A: 修改Cursor设置中的环境变量，重启Cursor。

## 📞 获取帮助

- 📖 [完整文档](./README.md)
- 🐛 [报告问题](https://github.com/your-username/rdms-mcp-server/issues)
- 💬 [讨论区](https://github.com/your-username/rdms-mcp-server/discussions)

---

**🎉 恭喜！您已成功配置RDMS MCP Server，现在可以让AI帮您分析BUG和图片了！**