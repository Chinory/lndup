#!/usr/bin/env node
// hasher.js: prototype of lndup's adaptive multi-process hasher
// Copyright (C) 2018  Chinory

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

/*lndup hasher.js GPL-3.0 <https://github.com/chinory/lndup>*/

const fs=require('fs'), crypto=require('crypto');
if (process.argv[2] === '--hasher') {
(function(){
    const BUFSIZE = 1024**2*16;
    var buff=Buffer.allocUnsafe(BUFSIZE),fail=Buffer.alloc(20);
    require('readline').createInterface({input:process.stdin}).on('line',line=>{
        if(line.length===0){process.exit()}
        try {
            var fd=fs.openSync(line, 'r');
            let len=fs.fstatSync(fd).size;
            const hasher=crypto.createHash('sha1');
            while (len > BUFSIZE) {
                fs.readSync(fd, buff, 0, BUFSIZE, null);
                hasher.update(buff);
                len -= BUFSIZE;
            }
            fs.readSync(fd, buff, 0, len, null);
            var hash=hasher.update(buff.slice(0, len)).digest();
        } catch (e) {
            process.stdout.write(fail);
        }
        if(fd){
            try{fs.closeSync(fd)}catch(e){}
            if(hash)process.stdout.write(hash);
        }
    });
})();
} else {
const child_process = require('child_process');
const CPU_N = require('os').cpus().length;
function hasher(callback, max_n=CPU_N) {
    var procs=[],queue=[],cur=0;
    function spawn() {
        const q=[],p=child_process.spawn(process.argv0,[process.argv[1],'--hasher'],{windowsHide:true});
        p.stdout.on("readable",()=>{for(var a;null!==(a=p.stdout.read(20));)callback(a,q.shift())});
        procs.push(p);queue.push(q);
    }
    function send(path, extra) {
        const n=procs.length;
        for(var i=0;i<n&&queue[i].length>0;++i);
        i>=n&&(n<max_n?spawn():cur<n?i=cur++:(cur=1,i=0));
        queue[i].push(extra);
        procs[i].stdin.write(`${path}\n`);
    }
    function kill() {
        for(const p of procs)p.stdin.write('\n');
        procs=[];queue=[];cur=0;
    }
    return [send, kill];
}
function callback(hash, path) {
    console.log(`${hash.toString('hex')}  ${path}`);
}
const [send, kill] = hasher(callback);
process.stdin.on('close', kill);
const rl = require('readline').createInterface({
    input:process.stdin,
});
rl.on('line',line=>{
    if (line.length > 0) {
        send(line, line);
    } else {
        rl.close();
        kill();
    }
});
}