# 装修企业CRM系统 - Fly.io 一键部署脚本
# 在 PowerShell 中运行:  ./scripts/deploy-flyio.ps1
# 前置条件: 安装 Fly CLI (iwr https://fly.io/install.ps1 -useb | iex)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 装修企业CRM系统 - Fly.io 部署脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 fly CLI 是否安装
if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
    Write-Host "正在安装 Fly CLI..." -ForegroundColor Yellow
    iwr https://fly.io/install.ps1 -useb | iex
    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# 检查登录状态
Write-Host "检查 Fly.io 登录状态..." -ForegroundColor Yellow
fly auth whoami
if ($LASTEXITCODE -ne 0) {
    Write-Host "请登录 Fly.io（使用邮箱+手机验证，无需信用卡）" -ForegroundColor Yellow
    fly auth login
}

Write-Host ""
Write-Host "步骤 1/4: 创建 PostgreSQL 数据库..." -ForegroundColor Green
fly postgres create --name zhuangxiu-crm-db --region nrt --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1

Write-Host ""
Write-Host "步骤 2/4: 部署后端 API..." -ForegroundColor Green
Set-Location ../backend
fly launch --dockerfile Dockerfile --name zhuangxiu-crm-backend --region nrt --no-deploy

# 生成 JWT 密钥
$jwtSecret = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
$jwtSecret = $jwtSecret.Substring(0, 64)

fly secrets set JWT_SECRET_KEY="$jwtSecret" --app zhuangxiu-crm-backend
fly secrets set DEBUG=false --app zhuangxiu-crm-backend
fly secrets set CORS_ORIGINS="https://zhuangxiu-crm-frontend.fly.dev" --app zhuangxiu-crm-backend

# 关联 PostgreSQL
fly postgres attach zhuangxiu-crm-db --app zhuangxiu-crm-backend

Write-Host ""
Write-Host "步骤 3/4: 部署前端..." -ForegroundColor Green
Set-Location ../frontend
fly launch --dockerfile Dockerfile --name zhuangxiu-crm-frontend --region nrt --no-deploy

fly secrets set NEXT_PUBLIC_API_URL="https://zhuangxiu-crm-backend.fly.dev" --app zhuangxiu-crm-frontend

Write-Host ""
Write-Host "步骤 4/4: 部署所有服务..." -ForegroundColor Green
Set-Location ../backend
fly deploy --app zhuangxiu-crm-backend

Set-Location ../frontend
fly deploy --app zhuangxiu-crm-frontend

Set-Location ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 部署完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "后端地址: https://zhuangxiu-crm-backend.fly.dev" -ForegroundColor Green
Write-Host "前端地址: https://zhuangxiu-crm-frontend.fly.dev" -ForegroundColor Green
Write-Host "API 文档: https://zhuangxiu-crm-backend.fly.dev/docs" -ForegroundColor Green
Write-Host ""
Write-Host "注意：" -ForegroundColor Yellow
Write-Host "- 首次启动需要几分钟构建Docker镜像" -ForegroundColor Yellow
Write-Host "- 数据库自动创建并关联" -ForegroundColor Yellow
Write-Host "- 部署后回到后端更新 CORS_ORIGINS（如果需要）" -ForegroundColor Yellow
