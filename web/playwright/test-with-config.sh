#!/bin/bash

# 使用默认配置运行测试
echo "使用默认配置运行测试 (localhost:5173)..."
npx playwright test

# 使用自定义地址运行测试
echo "使用自定义地址运行测试..."
BASE_URL=http://localhost:3000 npx playwright test

# 使用生产环境地址运行测试
echo "使用生产环境地址运行测试..."
BASE_URL=https://your-prod-domain.com npx playwright test 