# RDMS MCP Server 项目结构

```
rdms-mcp-server/
├── .github/
│   └── workflows/
│       ├── publish.yml          # NPM自动发布工作流
│       └── test.yml             # 自动测试工作流
├── docs/
│   └── 需求背景.md              # 原始需求文档
├── index.js                     # 主服务器文件
├── test.js                      # 测试脚本
├── package.json                 # NPM包配置
├── package-lock.json            # 依赖锁定文件
├── README.md                    # 项目说明文档
├── LICENSE                      # MIT许可证
├── CHANGELOG.md                 # 版本更新日志
├── CONTRIBUTING.md              # 贡献指南
├── PUBLISHING.md                # 发布指南
├── PROJECT_STRUCTURE.md         # 项目结构说明
├── .gitignore                   # Git忽略文件
├── cursor-mcp-config.json       # Cursor MCP配置示例
└── cursor-settings-example.json # Cursor设置示例
```

## 核心文件说明

### index.js
- **RDMSMCPServer类** - 主服务器实现
- **工具处理器** - 处理所有MCP工具调用
- **图片分析功能** - AI视觉分析核心逻辑
- **认证管理** - Cookie会话管理
- **错误处理** - 完整的错误处理机制

### test.js
- **统一测试框架** - 支持多种测试场景
- **参数化测试** - 支持指定用户名、密码、测试类型
- **实时输出** - 详细的测试结果展示

### 配置文件
- **package.json** - 完整的NPM包信息
- **cursor-mcp-config.json** - Cursor集成配置
- **环境变量支持** - RDMS_BASE_URL, RDMS_USERNAME, RDMS_PASSWORD

### 文档文件
- **README.md** - 完整的使用说明和功能介绍
- **CHANGELOG.md** - 版本历史和更新记录
- **CONTRIBUTING.md** - 开发者贡献指南
- **PUBLISHING.md** - 发布到各平台的详细步骤

### 自动化
- **GitHub Actions** - 自动测试和发布流程
- **多Node.js版本测试** - 确保兼容性
- **自动NPM发布** - Release时自动发布

## 主要功能模块

### 1. 认证模块
- 登录RDMS系统
- Cookie会话管理
- 自动重新登录

### 2. BUG管理模块
- 获取BUG详情
- 搜索BUG
- 获取我的BUG
- 获取待处理BUG

### 3. 市场缺陷模块
- 获取市场缺陷详情
- 搜索市场缺陷
- 获取分配给我的缺陷

### 4. 图片分析模块 ⭐
- 自动提取BUG附件图片
- 下载图片数据
- 转换为base64格式
- 支持AI视觉分析

### 5. 工作面板模块
- 获取工作统计信息
- 展示BUG和缺陷数量

## 技术栈

- **Node.js 18+** - 运行环境
- **ES Modules** - 现代JavaScript模块系统
- **@modelcontextprotocol/sdk** - MCP协议实现
- **axios** - HTTP客户端
- **cheerio** - HTML解析
- **fs** - 文件系统操作（图片处理）

## 发布准备状态

✅ **代码完整性**
- 所有功能已实现并测试
- 错误处理完善
- 代码注释充分

✅ **文档完整性**
- README.md详细说明
- API文档完整
- 使用示例丰富

✅ **发布准备**
- package.json信息完整
- LICENSE文件存在
- CHANGELOG.md已更新
- GitHub Actions配置完成

✅ **质量保证**
- 测试覆盖完整
- 多Node.js版本兼容
- 自动化测试流程

项目已准备好发布到NPM和GitHub！