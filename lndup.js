#!/usr/bin/env node
// lndup: Tiny program to hardlink duplicate files optimally
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

/*lndup v0.4 GPL-3.0 <https://github.com/chinory/lndup>*/
'use strict';
{
const noop=()=>{};
const path=require('path');
const BASENAME=path.basename(process.argv[1]);
const argv = ((a)=>{
    for(var r=new Map(),c,i=0;i<a.length&&a[i].length>1&&a[i].startsWith("-");++i){
        if(a[i].startsWith("--"))
        {if(a[i].length > 2)r.set(a[i].slice(2));else{++i;break}}
        else for(c of a[i].slice(1))r.set(c);
    }return r.set('', a.slice(i));
})(process.argv.slice(2));
if (argv.delete('help')) { 
    process.stdout.write(`Usage: ${BASENAME} [OPTION]... PATH...\n`);
    process.stdout.write("Hardlink duplicate files.\n\n  -n, --dry-run  don't link\n  -v, --verbose  explain what is being done\n  -q, --quiet    don't output extra information\n      --help     display this help and exit\n      --version  output version information and exit\n      --hasher   start as a hash work process\n\nSee <https://github.com/chinory/lndup>\n");
}  
else if (argv.delete('version')) {
    process.stdout.write("lndup v0.4\n");
} 
else { const fs=require('fs'), crypto=require('crypto');
if (argv.delete('hasher')) { 
    const BUFSIZE = 1024**2*16;
    (function main(){
        var buff = Buffer.allocUnsafe(BUFSIZE), fail = Buffer.alloc(20);
        require('readline').createInterface({input:process.stdin}).on('line', line=>{
            if (line.length === 0) process.exit();
            try {
                var fd = fs.openSync(line, 'r');
                let len = fs.fstatSync(fd).size;
                const hash = crypto.createHash('sha1');
                while (len > BUFSIZE) {
                    fs.readSync(fd, buff, 0, BUFSIZE, null);
                    hash.update(buff);
                    len -= BUFSIZE;
                }
                fs.readSync(fd, buff, 0, len, null);
                var digest = hash.update(buff.slice(0, len)).digest();
            } catch (err) {
                process.stdout.write(fail);
                process.stderr.write(`#${err.toString()}\n`);
            }
            if (fd) {
                fs.close(fd, noop);
                if (digest) process.stdout.write(digest);
            }
        });
    })();
} 
else { const child_process=require('child_process');
    const ACTION = !(argv.delete('dry-run') | argv.delete('n'));
    const VERBOSE = (argv.delete('verbose') | argv.delete('v'))>0;
    const EXTINFO = !(argv.delete('quiet') | argv.delete('q'));
    if (argv.size > 1) {
        for (const name of argv.keys()) {
            if (name.length > 0) {
                console.error(`${BASENAME}: invalid option -- ${name}`);
            }
        }
        console.error(`Try '${BASENAME} --help' for more information.`);
        process.exit(1);
    }
    const SIZE_UNIT = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    const HASH_WORKS_N = require('os').cpus().length;
    const SMALLS_SIZE = 1024*8;
    Map.prototype.get_array = function(k){var v;return this.has(k)?this.get(k):(this.set(k,v=[]),v)};
    Map.prototype.get_map = function(k){var v;return this.has(k)?this.get(k):(this.set(k,v=new Map()),v)};
    (function main(){
        function rua(err) {
            return console.error(`#${err}`);
        }
        function hasher(callback, n) {
            var procs = [], queue = [], i = n;
            function onerror(chunk) { return process.stderr.write(chunk); }
            function spawn() {
                const q = [], p = child_process.spawn(process.argv0,[process.argv[1], '--hasher'], {windowsHide:true});
                p.stdout.on("readable", ()=>{for(var b; null !== (b = p.stdout.read(20));) callback(b,q.shift());});
                p.stderr.on("data", onerror);
                procs.push(p);
                queue.push(q);
            }
            function send(path, extra) {
                queue[i].push(extra);
                procs[i].stdin.write(path);
                procs[i].stdin.write('\n');
                if (++i === n) i=0;
            }
            function kill() {
                for (const p of procs) p.stdin.write('\n');
                procs=undefined; queue=undefined; i=undefined;
            }
            do{spawn()}while(--i>0);
            return [send, kill];
        }
        function link(src, dst) { 
            const sav = dst + '.' + crypto.randomBytes(8).toString('hex');
            fs.renameSync(dst, sav);
            try {
                fs.linkSync(src, dst);
            } catch (err) {
                try {
                    fs.renameSync(sav, dst);
                } catch (err) {
                    console.error("mv -f -- '%s' '%s' #%s", sav, dst, err);
                }
                throw err;
            }
            try {
                fs.unlinkSync(sav);
            } catch (err) {
                console.error("rm -f -- '%s' #%s", sav, err);
            }
        }
        function szstr(size) {
            for (var i = 0; i < 8 && size >= 1024; ++i) size /= 1024;
            return size.toFixed(i) + SIZE_UNIT[i];
        }
        function tprintf() {
            const maxlen = [];
            for (const line of arguments) {
                for (const i in line) {
                    line[i] = line[i].toString();
                    if (maxlen[i] === undefined || line[i].length > maxlen[i]) {
                        maxlen[i] = line[i].length;
                    }
                }
            }
            for (const line of arguments) {
                for (const i in line) {
                    line[i] = line[i].padStart(maxlen[i]);
                }
                console.log(line.join('  '));
            }
        }
        function probe(paths) {
            return new Promise(resolve => { var n = 0;
                if (EXTINFO) {
                    console.time('#Profile: Time: scheme'); 
                    console.time('#Profile: Time: 1-probe');
                }
                var by_dev = new Map();
                var select_n=0, select_size=0, stat_n=0, stat_size=0, readdir_n=0, readdir_size=0;
                function done() {
                    if (EXTINFO) {
                        tprintf(['#Stat: 1-probe: Readdir:', readdir_n, szstr(readdir_size)],
                                ['#Stat: 1-probe: Stat:   ', stat_n, szstr(stat_size)],
                                ['#Stat: 1-probe: Select: ', select_n, szstr(select_size)]);
                    }
                    return resolve(by_dev);
                }
                function readdir(dir) { ++n; ++readdir_n;
                    return fs.readdir(dir, (err, files)=>{ --n; 
                        if (err) rua(err); else {
                            for (let name of files) {
                                name = path.join(dir, name);
                                readdir_size += name.length;
                                stat(name);
                            }
                        }
                        if (n === 0) return done();
                    });
                }
                function stat(path) { ++n;  ++stat_n;
                    return fs.lstat(path, (err, stat)=>{ --n; 
                        if (err) rua(err); else {
                            if (stat.isDirectory()) {
                                return readdir(path);
                            } else if (stat.isFile()) {
                                stat_size += stat.size;
                                if (stat.size > 0) {
                                    ++select_n; select_size+=stat.size;
                                    by_dev.get_map(stat.dev).get_map(stat.size).get_map('').get_array(stat.ino).push(path);
                                }
                            }
                        }
                        if (n === 0) return done();
                    });
                }
                for (const path of paths) {
                    stat(path);
                }
            });
        }
        function verify(by_dev) {
            return new Promise(resolve => { var n = 0;
                if (EXTINFO) {
                    console.timeEnd('#Profile: Time: 1-probe'); 
                    console.time('#Profile: Time: 2-verify');
                }
                var smalls_size = SMALLS_SIZE;
                var hash_int_n=0, hash_int_size=0, hash_ext_n=0, hash_ext_size=0;
                var flow_int=0, flow_ext=0, flow_n=0;
                var buff = Buffer.allocUnsafe(SMALLS_SIZE), fail = Buffer.alloc(20);
                var send, kill; [send, kill] = hasher(hashback, HASH_WORKS_N);
                function hashback(hash, extra) { --n;
                    if (!hash.equals(fail)) extra[0].get_map(hash.toString('binary')).set(extra[1], extra[2]);
                    if (n === 0) return done();
                }
                function done() {
                    if (EXTINFO) {
                        const hash_n = hash_int_n + hash_ext_n;
                        const hash_size = hash_int_size + hash_ext_size;
                        const hash_int_avg = hash_int_size / hash_int_n;
                        const hash_ext_avg = hash_ext_size / hash_ext_n;
                        const hash_ext_to_int = hash_ext_avg/hash_int_avg;
                        tprintf(['#Stat: 2-verify: Hash-Int:', szstr(hash_int_size), `${hash_size>0?(hash_int_size*100/hash_size).toFixed(2):'0.00'}%`, hash_int_n, `${hash_n>0?(hash_int_n*100/hash_n).toFixed(2):'0.00'}%`, isNaN(hash_int_avg)?'NaN':szstr(hash_int_avg), isNaN(hash_ext_to_int)?'NaNx':'1.00x'],
                                ['#Stat: 2-verify: Hash-Ext:', szstr(hash_ext_size), `${hash_size>0?(hash_ext_size*100/hash_size).toFixed(2):'0.00'}%`, hash_ext_n, `${hash_n>0?(hash_ext_n*100/hash_n).toFixed(2):'0.00'}%`, isNaN(hash_ext_avg)?'NaN':szstr(hash_ext_avg), hash_ext_to_int.toFixed(2)+'x']);
                    }
                    kill();
                    return resolve(by_dev);
                }
                for (const [dev, by_size] of by_dev) {
                    for (const [size, by_content] of by_size) {
                        const by_ino = by_content.get(''); 
                        if (by_ino) {
                            if (by_ino.size > 1) {
                                for (const [ino, paths] of by_ino) {
                                    if (size > smalls_size) { 
                                        ++hash_ext_n; hash_ext_size += size; 
                                        ++n;
                                        send(paths[0], [by_content, ino, paths]);
                                    } else {
                                        ++hash_int_n; hash_int_size += size;
                                        let fd;
                                        try { 
                                            fd = fs.openSync(paths[0], 'r');
                                            const hash = crypto.createHash('sha1');
                                            fs.readSync(fd, buff, 0, size, null);
                                            hash.update(buff.slice(0, size));
                                            by_content.get_map(hash.digest('binary')).set(ino, paths);
                                        } catch (err) {
                                            rua(err);
                                        }
                                        if (fd) {
                                            try {
                                                fs.closeSync(fd);
                                            } catch (err) {
                                                rua(err);
                                            }
                                        }
                                    }
                                    ++flow_n; flow_ext += size;
                                    smalls_size = Math.floor(SMALLS_SIZE * flow_ext / (flow_int + flow_ext));
                                    if (flow_n === 8) {
                                        flow_n=4; flow_int>>=1; flow_ext>>=1;
                                    }
                                }
                            } 
                            by_content.delete('');
                        }
                    }
                }
                if (n === 0) return done();
            });
        }
        function solve(by_dev) {
            if (EXTINFO) {
                console.timeEnd('#Profile: Time: 2-verify');
                console.time('#Profile: Time: 3-solve');
            }
            const solutions = [];
            for (const [dev, by_size] of by_dev) {
                for (const [size, by_content] of by_size) {
                    for (const [digest, by_ino] of by_content) {
                        if (by_ino.size > 1) {
                            let major_i=0, major_n=0, dsts=[];
                            for (const [ino, paths] of by_ino) {
                                if (paths.length > major_n) {
                                    major_n = paths.length;
                                    major_i = ino;
                                }
                            }
                            for (const [ino, paths] of by_ino) {
                                if (ino !== major_i) {
                                    dsts.push(...paths);
                                }
                            }
                            solutions.push([size, by_ino.get(major_i)[0], dsts]);
                        }
                    }
                }
            }
            return solutions;
        }
        function execute(solutions) {
            if (EXTINFO) {
                console.timeEnd('#Profile: Time: 3-solve');
                console.timeEnd('#Profile: Time: scheme');
                console.time('#Profile: Time: execute');
            }
            var todo_size=0, todo_src_n=0, todo_dst_n=0,
                succ_size=0, succ_src_n=0, succ_dst_n=0,
                fail_size=0, fail_src_n=0, fail_dst_n=0;
            for (const [size, src, dsts] of solutions) {
                let succ_src_a=0, fail_src_a=0;
                for (const dst of dsts) {
                    if (VERBOSE) {
                        console.log("ln -f -- '%s' '%s'", src, dst);
                    }
                    if (ACTION) try {
                        link(src, dst);
                        succ_size += size;
                        succ_src_a = 1;
                        succ_dst_n += 1;
                    } catch (err) {
                        console.error("ln -f -- '%s' '%s' #%s", src, dst, err);
                        fail_size += size;
                        fail_src_a = 1;
                        fail_dst_n += 1;
                    }
                    todo_size += size;
                    todo_dst_n += 1;
                }
                todo_src_n += 1;
                succ_src_n += succ_src_a;
                fail_src_n += fail_src_a;
            }
            if (EXTINFO) { 
                console.timeEnd('#Profile: Time: execute');
                const mem = process.memoryUsage();
                console.log(`#Profile: Memory: rss: ${szstr(mem.rss)}`);
                console.log(`#Profile: Memory: heapTotal: ${szstr(mem.heapTotal)}`);
                console.log(`#Profile: Memory: heapUsed: ${szstr(mem.heapUsed)}`);
                console.log(`#Profile: Memory: external: ${szstr(mem.external)}`);
                tprintf(["#Result: TODO:", szstr(todo_size), todo_size, todo_src_n, todo_dst_n],
                        ["#Result: DONE:", szstr(succ_size), succ_size, succ_src_n, succ_dst_n],
                        ["#Result: FAIL:", szstr(fail_size), fail_size, fail_src_n, fail_dst_n]);
            }
        }
        probe(argv.get('')).then(verify).then(solve).then(execute);
    })();
}
}
}
