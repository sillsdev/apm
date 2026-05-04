git worktree add ../wt/%1 -b %1
cd ../wt/%1
npm install
cd src/renderer
npm install
cd ../..
npm run stamp
copy ..\..\apm-vite\env-config\*.* env-config\.
npm run devs
cursor .
