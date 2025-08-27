# Contributing to RDMS MCP Server

Thank you for your interest in contributing to RDMS MCP Server! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/rdms-mcp-server.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Access to an RDMS system for testing

### Environment Setup
```bash
export RDMS_BASE_URL="https://your-rdms-url.com"
export RDMS_USERNAME="your_username"
export RDMS_PASSWORD="your_password"
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test
node test.js <username> <password> <test-type>
```

## Code Style

- Use ES modules (import/export)
- Follow async/await patterns
- Include comprehensive error handling
- Add JSDoc comments for public methods
- Use descriptive variable and function names

## Submitting Changes

1. Ensure all tests pass
2. Update documentation if needed
3. Add entries to CHANGELOG.md
4. Commit with descriptive messages
5. Push to your fork
6. Create a Pull Request

## Reporting Issues

When reporting issues, please include:
- RDMS system version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Error messages or logs

## Feature Requests

Feature requests are welcome! Please:
- Check existing issues first
- Provide clear use cases
- Explain the expected behavior
- Consider implementation complexity

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain a professional tone

Thank you for contributing!