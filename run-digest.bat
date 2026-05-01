@echo off
cd /d C:\Apps\youtube-digest
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set stamp=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%_%dt:~8,2%-%dt:~10,2%-%dt:~12,2%
call npm run digest >> logs\%stamp%.log 2>&1
