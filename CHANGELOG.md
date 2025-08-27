# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-08-27

### Added
- Initial release of RDMS MCP Server
- Login functionality for RDMS system authentication
- Bug details retrieval with comprehensive field extraction
- Market defect details retrieval
- Advanced search functionality for bugs and market defects
- Work dashboard information retrieval
- My bugs and pending bugs listing
- **AI Image Analysis** - Automatic extraction and analysis of bug attachment images
- Image download functionality with base64 conversion for AI vision
- Cookie-based session management
- Comprehensive error handling and logging
- Full test suite with multiple test scenarios

### Features
- 🔐 Secure authentication with RDMS systems
- 🐛 Complete bug information extraction
- 🖼️ AI-powered image analysis for bug attachments
- 🔍 Multi-criteria search capabilities
- 📊 Dashboard and statistics retrieval
- 🏪 Market defect management
- 📥 Image download and processing
- 🧪 Comprehensive testing framework

### Technical Details
- Built with Node.js and ES modules
- Uses @modelcontextprotocol/sdk for MCP integration
- Axios for HTTP requests with cookie support
- Cheerio for HTML parsing
- Base64 image encoding for AI analysis
- Environment variable configuration support