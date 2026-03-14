@echo off
set MSG=%~1
if "%MSG%"=="" set MSG=update
git add .
git commit -m "%MSG%"
git push