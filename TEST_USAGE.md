# RDMS MCP 测试工具使用指南

## 🚀 快速开始

### 1. 设置环境变量
```bash
# Windows PowerShell
$env:RDMS_BASE_URL="http://your-rdms-system.com"
$env:RDMS_USERNAME="your-username"
$env:RDMS_PASSWORD="your-password"
$env:TEST_BUG_ID="123"
$env:TEST_DEFECT_ID="456"

# Linux/Mac
export RDMS_BASE_URL="http://your-rdms-system.com"
export RDMS_USERNAME="your-username"
export RDMS_PASSWORD="your-password"
export TEST_BUG_ID="123"
export TEST_DEFECT_ID="456"
```

### 2. 运行测试

#### 查看帮助
```bash
node test.js --help
```

#### 运行所有测试
```bash
node test.js
```

#### 运行单个测试
```bash
# 测试登录
node test.js rdms_login

# 测试获取Bug详情
node test.js rdms_get_bug

# 测试搜索Bug
node test.js rdms_search_bugs

# 测试获取我的Bug
node test.js rdms_get_my_bugs

# 测试获取市场缺陷详情
node test.js rdms_get_market_defect

# 测试搜索市场缺陷
node test.js rdms_search_market_defects

# 测试获取我的市场缺陷
node test.js rdms_get_market_defects

# 测试下载图片
node test.js rdms_download_image
```

## 📋 可用的测试方法

| 方法名 | 描述 | 主要参数 |
|--------|------|----------|
| `rdms_login` | 测试登录功能 | baseUrl, username, password |
| `rdms_get_bug` | 测试获取Bug详情 | bugId |
| `rdms_get_market_defect` | 测试获取市场缺陷详情 | defectId |
| `rdms_search_bugs` | 测试搜索Bug | query, limit |
| `rdms_search_market_defects` | 测试搜索市场缺陷 | query, limit |
| `rdms_get_my_bugs` | 测试获取我的Bug | status, limit |
| `rdms_get_market_defects` | 测试获取我的市场缺陷 | limit |
| `rdms_download_image` | 测试下载图片 | imageUrl, analyze |

## 🔧 环境变量说明

| 变量名 | 必需 | 描述 | 示例 |
|--------|------|------|------|
| `RDMS_BASE_URL` | ✅ | RDMS系统地址 | `http://demo.zentao.net` |
| `RDMS_USERNAME` | ✅ | 登录用户名 | `admin` |
| `RDMS_PASSWORD` | ✅ | 登录密码 | `123456` |
| `TEST_BUG_ID` | ❌ | 测试用的Bug ID | `123` |
| `TEST_DEFECT_ID` | ❌ | 测试用的缺陷ID | `456` |
| `TEST_IMAGE_URL` | ❌ | 测试用的图片URL | `http://demo.zentao.net/data/upload/1/image.png` |

## 📊 测试输出示例

```
🧪 测试 rdms_login...
📝 描述: 测试登录功能
📋 参数: {
  "baseUrl": "http://demo.zentao.net",
  "username": "admin",
  "password": "123456"
}
✅ 成功 (1234ms)
📤 结果: {
  "content": [
    {
      "type": "text",
      "text": "{\"success\":true,\"message\":\"Successfully logged in to RDMS system\"}"
    }
  ]
}

📊 测试总结
==================================================
✅ 成功: 8
❌ 失败: 0
⏱️  总耗时: 5678ms

📋 详细结果:
   ✅ rdms_login (1234ms)
   ✅ rdms_get_bug (567ms)
   ✅ rdms_get_market_defect (432ms)
   ✅ rdms_search_bugs (789ms)
   ✅ rdms_search_market_defects (654ms)
   ✅ rdms_get_my_bugs (321ms)
   ✅ rdms_get_market_defects (456ms)
   ✅ rdms_download_image (1225ms)
```

## 🚨 常见问题

### 1. 连接超时
- 检查 `RDMS_BASE_URL` 是否正确
- 确认网络连接正常
- 检查RDMS系统是否可访问

### 2. 登录失败
- 验证用户名和密码是否正确
- 检查RDMS系统是否支持API登录
- 确认账户没有被锁定

### 3. 测试数据不存在
- 设置正确的 `TEST_BUG_ID` 和 `TEST_DEFECT_ID`
- 确认测试用的Bug和缺陷在系统中存在
- 检查当前用户是否有权限访问这些数据

## 💡 提示

1. **首次运行**：建议先单独测试 `rdms_login` 确保连接正常
2. **批量测试**：运行所有测试前确保登录凭据正确
3. **调试模式**：可以修改测试脚本中的参数进行自定义测试
4. **性能测试**：注意观察各接口的响应时间