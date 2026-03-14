@echo off
:: Zentrix PM2 Auto-Start Script
:: This script is triggered by Windows Task Scheduler to restore PM2 processes on reboot.

cd /d "c:\Users\jose.rafael\zentrix_projects\task_management"
pm2 resurrect
