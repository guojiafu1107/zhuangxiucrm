"""
Vercel ASGI 入口文件
Vercel Python Runtime 自动检测 app 变量作为 ASGI 应用
"""
import sys
import os

# 确保能导入 app 模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app as application

# Vercel 需要导出一个 ASGI 兼容的 app
app = application
