const fs=require('fs');
const files=fs.readdirSync('public').filter(f=>f.endsWith('.html'));
files.forEach(f=>{
  let c=fs.readFileSync('public/'+f,'utf8');
  c=c.replace(/src=\"\/js\/api\.js(\?v=[0-9\.]+)?\"/g,'src=\"/js/api.js?v=1.4.2\"');
  fs.writeFileSync('public/'+f,c);
});
