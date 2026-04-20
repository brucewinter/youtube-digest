@echo off
cd /d C:\Apps\youtube-digest
call npm run digest >> logs\digest.log 2>&1
