#!/usr/bin/env node
/*lndup hash.js <https://github.com/chinory/lndup>*/
'use strict';
const fs=require('fs'), crypto=require('crypto');

var argv = (function(a){
    for(var r=new Map(),c,i=0;i<a.length&&a[i].length>1&&a[i].startsWith("-");++i){
        if(a[i].startsWith("--"))
        {if(a[i].length > 2)r.set(a[i].slice(2));else{++i;break}}
        else for(c of a[i].slice(1))r.set(c);
    }return r.set('', a.slice(i));
})(process.argv.slice(2));

if (argv.delete('hasher')) {
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
                process.stderr.write(e.toString()+'\n');
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
    (function(){
        function onerror(chunk) { process.stderr.write(chunk); }
        function hasher(callback, n) {
            var procs=[],queue=[],i=n;
            function spawn() {
                const q=[],p=child_process.spawn(process.argv0,[process.argv[1],'--hasher'],{windowsHide:true});
                p.stdout.on("readable",()=>{for(var a;null!==(a=p.stdout.read(20));)callback(a,q.shift())});
                p.stderr.on("data",onerror);
                procs.push(p);queue.push(q);
            }
            function send(path, extra) {
                queue[i].push(extra);
                procs[i].stdin.write(path);
                procs[i].stdin.write('\n');
                if(++i===n)i=0;
            }
            function kill() {
                for(const p of procs)p.stdin.write('\n');
                procs=undefined;queue=undefined;i=undefined;
            }
            do{spawn()}while(--i>0);
            return [send, kill];
        }
        const fail = Buffer.alloc(20);
        function callback(hash, path) {
            if(!fail.equals(hash)) {
                console.log(`${hash.toString('hex')}  ${path}`);
            }
        }
        var send, kill; [send, kill] = hasher(callback, CPU_N);
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
    })();
}