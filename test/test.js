#!/usr/bin/env node
/**
 * RDMS MCP Server 测试脚本
 * 测试对外暴露的5个MCP工具：
 * 1. rdms_get_bug - 获取BUG详情
 * 2. rdms_get_market_bug - 获取市场BUG详情
 * 3. rdms_get_my_bugs - 获取我的BUG
 * 4. rdms_get_my_market_bugs - 获取我的市场BUG
 * 5. rdms_download_image - 下载图片
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RDMSMCPTester {
    constructor() {
        this.serverPath = path.join(__dirname, '..', 'index.js');
        this.testBugId = '138363';
        this.testMarketBugId = '11636';
        this.testImageUrl = 'https://rdms.streamax.com/index.php?m=file&f=read&t=png&fileID=413370';
        
        // 定义各接口的预期字段
        this.expectedFields = {
            bugInfo: [
                'id', 'title', 'status', 'priority', 'severity', 'confirmed', 'assignedTo', 
                'reporter', 'createdBy', 'resolvedBy', 'closedBy', 'cc', 'product', 'project', 
                'module', 'version', 'affectedVersion', 'resolvedVersion', 'os', 'browser', 
                'platformDevice', 'bugType', 'plan', 'attribution', 'attributionTeam', 
                'valueAttribute', 'activationCount', 'activationDate', 'probability', 
                'commonIssue', 'execution', 'requirement', 'task', 'relatedBugs', 
                'relatedCases', 'deadline', 'created', 'updated', 'lastModified', 
                'steps', 'description', 'keywords', 'solution', 'images'
            ],
            marketBugInfo: [
                'id', 'title', 'status', 'priority', 'severity', 'assignedTo', 'reporter',
                'product', 'productLine', 'productVersion', 'productSystem', 'project', 'module', 'version',
                'created', 'updated', 'region', 'customerCode', 'customerName', 'expectedSolveDate',
                'problemLevel', 'frontTechSupport', 'defectDescription', 'temporaryResponse', 'solution',
                'defectAttribution', 'defectType', 'planFixTime', 'problemAttributionTeam', 'locationProblem',
                'confirmed', 'solveDate', 'closeDate', 'submitPage', 'images', 'history'
            ],
            bugsList: [
                'success', 'total', 'bugs', 'type', 'message'
            ],
            imageDownload: [
                'success', 'imageUrl', 'type', 'size', 'message'
            ]
        };
    }

    /**
     * 计算字段解析统计
     */
    calculateFieldStats(data, expectedFieldsKey) {
        const expectedFields = this.expectedFields[expectedFieldsKey] || [];
        const totalExpected = expectedFields.length;
        
        if (!data || typeof data !== 'object') {
            return {
                totalExpected,
                actualParsed: 0,
                percentage: 0,
                details: []
            };
        }

        let actualParsed = 0;
        const details = [];

        expectedFields.forEach(field => {
            const hasValue = data.hasOwnProperty(field) && 
                           data[field] !== null && 
                           data[field] !== undefined && 
                           data[field] !== '' && 
                           data[field] !== 'N/A' &&
                           !(Array.isArray(data[field]) && data[field].length === 0);
            
            if (hasValue) {
                actualParsed++;
                details.push({ field, hasValue: true, value: data[field] });
            } else {
                details.push({ field, hasValue: false, value: data[field] || 'N/A' });
            }
        });

        const percentage = totalExpected > 0 ? Math.round((actualParsed / totalExpected) * 100) : 0;

        return {
            totalExpected,
            actualParsed,
            percentage,
            details
        };
    }

    /**
     * 显示字段统计信息
     */
    displayFieldStats(stats, title) {
        console.log(`\n📋 ${title} - 字段解析统计:`);
        console.log(`预期字段数: ${stats.totalExpected}`);
        console.log(`实际解析数: ${stats.actualParsed}`);
        console.log(`解析成功率: ${stats.percentage}%`);
        
        // 显示有值的字段
        const fieldsWithValue = stats.details.filter(d => d.hasValue);
        if (fieldsWithValue.length > 0) {
            console.log(`✅ 有值字段 (${fieldsWithValue.length}个):`);
            fieldsWithValue.forEach(detail => {
                let displayValue = detail.value;
                if (Array.isArray(displayValue)) {
                    displayValue = `[${displayValue.length}个元素]`;
                } else if (typeof displayValue === 'string' && displayValue.length > 50) {
                    displayValue = displayValue.substring(0, 50) + '...';
                }
                console.log(`  • ${detail.field}: ${displayValue}`);
            });
        }
        
        // 显示缺失的字段
        const fieldsWithoutValue = stats.details.filter(d => !d.hasValue);
        if (fieldsWithoutValue.length > 0) {
            console.log(`❌ 缺失字段 (${fieldsWithoutValue.length}个):`);
            fieldsWithoutValue.slice(0, 10).forEach(detail => { // 只显示前10个
                console.log(`  • ${detail.field}`);
            });
            if (fieldsWithoutValue.length > 10) {
                console.log(`  ... 还有 ${fieldsWithoutValue.length - 10} 个字段`);
            }
        }
    }

    /**
     * 发送MCP请求到服务器
     */
    async sendMCPRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            const server = spawn('node', [this.serverPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    RDMS_BASE_URL: 'https://rdms.streamax.com',
                    RDMS_USERNAME: 'jiangyuanchen',
                    RDMS_PASSWORD: 'Rm123456'
                }
            });

            let output = '';
            let errorOutput = '';

            server.stdout.on('data', (data) => {
                output += data.toString();
            });

            server.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            server.on('close', (code) => {
                if (code === 0) {
                    try {
                        // 解析MCP响应
                        const lines = output.trim().split('\n');
                        const lastLine = lines[lines.length - 1];
                        const response = JSON.parse(lastLine);
                        resolve(response);
                    } catch (error) {
                        resolve({ error: 'Failed to parse response', output, errorOutput });
                    }
                } else {
                    reject({ code, error: errorOutput, output });
                }
            });

            // 发送MCP请求
            const request = {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: method,
                    arguments: params
                }
            };

            server.stdin.write(JSON.stringify(request) + '\n');
            server.stdin.end();

            // 设置超时
            setTimeout(() => {
                server.kill();
                reject({ error: 'Request timeout' });
            }, 30000);
        });
    }

    /**
     * 测试获取BUG详情
     */
    async testGetBug(bugId) {
        console.log(`\n=== 测试 rdms_get_bug (BUG ID: ${bugId}) ===`);
        
        try {
            const response = await this.sendMCPRequest('rdms_get_bug', { bugId });
            
            if (response.result && response.result.content) {
                const content = response.result.content[0];
                if (content.type === 'text') {
                    const bugData = JSON.parse(content.text);
                    console.log('✅ 获取BUG详情成功');
                    console.log(`BUG标题: ${bugData.title || 'N/A'}`);
                    console.log(`BUG状态: ${bugData.status || 'N/A'}`);
                    console.log(`严重程度: ${bugData.severity || 'N/A'}`);
                    console.log(`图片数量: ${bugData.images ? bugData.images.length : 0}`);
                    
                    // 计算并显示字段统计
                    const fieldStats = this.calculateFieldStats(bugData, 'bugInfo');
                    this.displayFieldStats(fieldStats, 'BUG详情');
                    
                    return { success: true, data: bugData, fieldStats };
                }
            }
            
            console.log(`❌ 获取BUG详情失败: ${JSON.stringify(response)}`);
            return { success: false, error: response };
        } catch (error) {
            console.log(`❌ 请求异常: ${error.message || JSON.stringify(error)}`);
            return { success: false, error: error.message || error };
        }
    }

    /**
     * 测试获取市场BUG详情
     */
    async testGetMarketBug(marketBugId) {
        console.log(`\n=== 测试 rdms_get_market_bug (市场BUG ID: ${marketBugId}) ===`);
        
        try {
            const response = await this.sendMCPRequest('rdms_get_market_bug', { marketBugId });
            
            if (response.result && response.result.content) {
                const content = response.result.content[0];
                if (content.type === 'text') {
                    const bugData = JSON.parse(content.text);
                    console.log('✅ 获取市场BUG详情成功');
                    console.log(`BUG标题: ${bugData.title || 'N/A'}`);
                    console.log(`BUG状态: ${bugData.status || 'N/A'}`);
                    console.log(`图片数量: ${bugData.images ? bugData.images.length : 0}`);
                    
                    // 计算并显示字段统计
                    const fieldStats = this.calculateFieldStats(bugData, 'marketBugInfo');
                    this.displayFieldStats(fieldStats, '市场BUG详情');
                    
                    return { success: true, data: bugData, fieldStats };
                }
            }
            
            console.log(`❌ 获取市场BUG详情失败: ${JSON.stringify(response)}`);
            return { success: false, error: response };
        } catch (error) {
            console.log(`❌ 请求异常: ${error.message || JSON.stringify(error)}`);
            return { success: false, error: error.message || error };
        }
    }

    /**
     * 测试获取我的BUG
     */
    async testGetMyBugs() {
        console.log(`\n=== 测试 rdms_get_my_bugs ===`);
        
        try {
            const response = await this.sendMCPRequest('rdms_get_my_bugs', { 
                status: 'active', 
                limit: 10 
            });
            
            if (response.result && response.result.content) {
                const content = response.result.content[0];
                if (content.type === 'text') {
                    const bugsData = JSON.parse(content.text);
                    console.log('✅ 获取我的BUG成功');
                    console.log(`BUG总数: ${bugsData.total || 0}`);
                    console.log(`返回数量: ${bugsData.bugs ? bugsData.bugs.length : 0}`);
                    if (bugsData.bugs && bugsData.bugs.length > 0) {
                        bugsData.bugs.slice(0, 3).forEach((bug, index) => {
                            console.log(`  ${index + 1}. ID: ${bug.id} - ${bug.title}`);
                        });
                    }
                    
                    // 计算并显示字段统计
                    const fieldStats = this.calculateFieldStats(bugsData, 'bugsList');
                    this.displayFieldStats(fieldStats, '我的BUG列表');
                    
                    return { success: true, data: bugsData, fieldStats };
                }
            }
            
            console.log(`❌ 获取我的BUG失败: ${JSON.stringify(response)}`);
            return { success: false, error: response };
        } catch (error) {
            console.log(`❌ 请求异常: ${error.message || JSON.stringify(error)}`);
            return { success: false, error: error.message || error };
        }
    }

    /**
     * 测试获取我的市场BUG
     */
    async testGetMyMarketBugs() {
        console.log(`\n=== 测试 rdms_get_my_market_bugs ===`);
        
        try {
            const response = await this.sendMCPRequest('rdms_get_my_market_bugs', { 
                limit: 10 
            });
            
            if (response.result && response.result.content) {
                const content = response.result.content[0];
                if (content.type === 'text') {
                    const bugsData = JSON.parse(content.text);
                    console.log('✅ 获取我的市场BUG成功');
                    console.log(`BUG总数: ${bugsData.total || 0}`);
                    console.log(`返回数量: ${bugsData.bugs ? bugsData.bugs.length : 0}`);
                    if (bugsData.bugs && bugsData.bugs.length > 0) {
                        bugsData.bugs.slice(0, 3).forEach((bug, index) => {
                            console.log(`  ${index + 1}. ID: ${bug.id} - ${bug.title}`);
                        });
                    }
                    
                    // 计算并显示字段统计
                    const fieldStats = this.calculateFieldStats(bugsData, 'bugsList');
                    this.displayFieldStats(fieldStats, '我的市场BUG列表');
                    
                    return { success: true, data: bugsData, fieldStats };
                }
            }
            
            console.log(`❌ 获取我的市场BUG失败: ${JSON.stringify(response)}`);
            return { success: false, error: response };
        } catch (error) {
            console.log(`❌ 请求异常: ${error.message || JSON.stringify(error)}`);
            return { success: false, error: error.message || error };
        }
    }

    /**
     * 测试下载图片
     */
    async testDownloadImage(imageUrl) {
        console.log(`\n=== 测试 rdms_download_image ===`);
        console.log(`图片URL: ${imageUrl}`);
        
        try {
            const response = await this.sendMCPRequest('rdms_download_image', { 
                imageUrl,
                analyze: true 
            });
            
            if (response.result && response.result.content) {
                const textContent = response.result.content.find(c => c.type === 'text');
                const imageContent = response.result.content.find(c => c.type === 'image');
                
                if (textContent) {
                    const imageData = JSON.parse(textContent.text);
                    console.log('✅ 下载图片成功');
                    console.log(`图片类型: ${imageData.type || 'N/A'}`);
                    console.log(`图片大小: ${imageData.size ? Math.round(imageData.size / 1024) + 'KB' : 'N/A'}`);
                    console.log(`包含图片数据: ${imageContent ? '是' : '否'}`);
                    
                    // 计算并显示字段统计
                    const fieldStats = this.calculateFieldStats(imageData, 'imageDownload');
                    this.displayFieldStats(fieldStats, '图片下载');
                    
                    return { success: true, data: imageData, fieldStats };
                }
            }
            
            console.log(`❌ 下载图片失败: ${JSON.stringify(response)}`);
            return { success: false, error: response };
        } catch (error) {
            console.log(`❌ 请求异常: ${error.message || JSON.stringify(error)}`);
            return { success: false, error: error.message || error };
        }
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('🚀 开始运行RDMS MCP Server测试...');
        console.log(`服务器路径: ${this.serverPath}`);
        console.log(`测试BUG ID: ${this.testBugId}`);
        console.log(`测试市场BUG ID: ${this.testMarketBugId}`);

        const results = {};

        // 1. 测试获取BUG详情
        results.getBug = await this.testGetBug(this.testBugId);

        // 2. 测试获取市场BUG详情
        results.getMarketBug = await this.testGetMarketBug(this.testMarketBugId);

        // 3. 测试获取我的BUG
        results.getMyBugs = await this.testGetMyBugs();

        // 4. 测试获取我的市场BUG
        results.getMyMarketBugs = await this.testGetMyMarketBugs();

        // 5. 测试下载图片
        results.downloadImage = await this.testDownloadImage(this.testImageUrl);

        // 输出测试总结
        console.log('\n📊 测试结果总结:');
        console.log('==================');
        
        const testNames = {
            getBug: '获取BUG详情',
            getMarketBug: '获取市场BUG详情',
            getMyBugs: '获取我的BUG',
            getMyMarketBugs: '获取我的市场BUG',
            downloadImage: '下载图片'
        };

        let successCount = 0;
        let totalCount = 0;
        let totalExpectedFields = 0;
        let totalParsedFields = 0;

        for (const [key, result] of Object.entries(results)) {
            totalCount++;
            const status = result.success ? '✅ 通过' : '❌ 失败';
            let fieldInfo = '';
            
            if (result.success && result.fieldStats) {
                const stats = result.fieldStats;
                fieldInfo = ` (字段: ${stats.actualParsed}/${stats.totalExpected}, ${stats.percentage}%)`;
                totalExpectedFields += stats.totalExpected;
                totalParsedFields += stats.actualParsed;
            }
            
            console.log(`${testNames[key]}: ${status}${fieldInfo}`);
            if (result.success) successCount++;
        }

        console.log(`\n总计: ${successCount}/${totalCount} 个测试通过`);
        
        if (totalExpectedFields > 0) {
            const overallPercentage = Math.round((totalParsedFields / totalExpectedFields) * 100);
            console.log(`字段解析总计: ${totalParsedFields}/${totalExpectedFields} (${overallPercentage}%)`);
        }
        
        if (successCount === totalCount) {
            console.log('🎉 所有测试都通过了！');
        } else {
            console.log('⚠️  部分测试失败，请检查MCP服务器或参数配置');
        }

        return results;
    }
}

/**
 * 解析命令行参数
 */
function parseArguments() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
RDMS MCP Server 测试脚本使用说明:

基本用法:
  node test.js [方法名]

支持的测试方法:
  rdms_get_bug           - 测试获取BUG详情
  rdms_get_market_bug    - 测试获取市场BUG详情
  rdms_get_my_bugs       - 测试获取我的BUG
  rdms_get_my_market_bugs - 测试获取我的市场BUG
  rdms_download_image    - 测试下载图片
  all                    - 运行所有测试 (默认)

示例:
  node test.js                      # 运行所有测试
  node test.js all                  # 运行所有测试
  node test.js rdms_get_bug         # 只测试获取BUG详情
  node test.js rdms_get_my_bugs     # 只测试获取我的BUG
  node test.js --help               # 显示帮助信息
        `);
        process.exit(0);
    }

    return {
        method: args[0] || 'all'
    };
}

/**
 * 主函数
 */
async function main() {
    try {
        const params = parseArguments();
        const tester = new RDMSMCPTester();

        console.log('🚀 开始运行RDMS MCP Server测试...');
        console.log(`测试方法: ${params.method}`);

        let results = {};

        switch (params.method) {
            case 'rdms_get_bug':
                results.getBug = await tester.testGetBug(tester.testBugId);
                break;
                
            case 'rdms_get_market_bug':
                results.getMarketBug = await tester.testGetMarketBug(tester.testMarketBugId);
                break;
                
            case 'rdms_get_my_bugs':
                results.getMyBugs = await tester.testGetMyBugs();
                break;
                
            case 'rdms_get_my_market_bugs':
                results.getMyMarketBugs = await tester.testGetMyMarketBugs();
                break;
                
            case 'rdms_download_image':
                results.downloadImage = await tester.testDownloadImage(tester.testImageUrl);
                break;
                
            case 'all':
            default:
                results = await tester.runAllTests();
                return; // runAllTests已经包含了结果总结
        }

        // 单个测试的结果总结
        console.log('\n📊 测试结果总结:');
        console.log('==================');
        
        const testNames = {
            getBug: '获取BUG详情',
            getMarketBug: '获取市场BUG详情',
            getMyBugs: '获取我的BUG',
            getMyMarketBugs: '获取我的市场BUG',
            downloadImage: '下载图片'
        };

        let successCount = 0;
        let totalCount = 0;

        for (const [key, result] of Object.entries(results)) {
            totalCount++;
            const status = result.success ? '✅ 通过' : '❌ 失败';
            console.log(`${testNames[key]}: ${status}`);
            if (result.success) successCount++;
        }

        console.log(`\n总计: ${successCount}/${totalCount} 个测试通过`);
        
        if (successCount === totalCount) {
            console.log('🎉 测试通过！');
        } else {
            console.log('⚠️  测试失败，请检查MCP服务器或参数配置');
        }

    } catch (error) {
        console.error(`❌ 程序执行错误: ${error.message}`);
        process.exit(1);
    }
}

// 运行主函数
main();

export default RDMSMCPTester;