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

/*lndup v0.2 GPL-3.0 <https://github.com/chinory/lndup>*/

const fs=require('fs'), crypto=require('crypto');

if (process.argv[2] === '--hasher') {
    function main(){
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
            } catch (err) {
                process.stdout.write(fail);
                process.stderr.write(err.toString());
            }
            if(fd){
                try{fs.closeSync(fd)}catch(e){}
                if(hash)process.stdout.write(hash);
            }
        });
    };
} else {
    const path=require('path'), child_process=require('child_process');
    function hasher(callback, n) {
        var procs=[],queue=[],i=n;
        function spawn() {
            const q=[],p=child_process.spawn(process.argv0,[process.argv[1],'--hasher'],{windowsHide:true});
            p.stdout.on("readable",()=>{for(var a;null!==(a=p.stdout.read(20));)callback(a,q.shift())});
            p.stderr.on("data",rua);
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
    Map.prototype.getd_array = function(key) {
        let value = this.get(key);
        if (value === undefined) {
            value = [];
            this.set(key, value);
        }
        return value;
    }
    Map.prototype.getd_map = function(key) {
        let value = this.get(key);
        if (value === undefined) {
            value = new Map();
            this.set(key, value);
        }
        return value;
    }
    function rua(err) {
        console.error('#%s', err);
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
    const SIZE_UNIT = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    function szstr(size) {
        for (var i = 0; i < 8 && size >= 1024; ++i) size /= 1024;
        return size.toFixed(i) + SIZE_UNIT[i];
    }
    function printt() {
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
            console.time('#Profile: Time: scheme');
            console.time('#Profile: Time: 1-probe');
            var map_dev = new Map();
            var select_n=0, select_size=0, stat_n=0, stat_size=0, readdir_n=0, readdir_size=0;
            function done() {
                printt(['#Stat: 1-probe: Readdir:', readdir_n, szstr(readdir_size)],
                       ['#Stat: 1-probe: Stat:   ', stat_n, szstr(stat_size)],
                       ['#Stat: 1-probe: Select: ', select_n, szstr(select_size)]);
                return resolve(map_dev);
            }
            function readdir(dir) { ++n; ++readdir_n;
                return fs.readdir(dir, (err, files)=>{ --n; 
                    if (err) {rua(err)} else {
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
                    if (err) {rua(err)} else {
                        if (stat.isDirectory()) {
                            return readdir(path);
                        } else if (stat.isFile()) {
                            stat_size += stat.size;
                            if (stat.size > 0) {
                                map_dev.getd_map(stat.dev).getd_map(stat.size).getd_map('').getd_array(stat.ino).push(path);
                                ++select_n; select_size+=stat.size;
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
    const CPU_N = require('os').cpus().length;
    function verify(map_dev) {
        return new Promise(resolve => { var n = 0;
            console.timeEnd('#Profile: Time: 1-probe');
            console.time('#Profile: Time: 2-verify');
            const SMF_BASE=1024*8;
            var SMALL_FILE=SMF_BASE, SMF_SUM=0, SMF_N=0;
            var hash_int_n=0,hash_int_size=0,hash_ext_n=0,hash_ext_size=0;
            function done() {
                const hash_n=hash_int_n+hash_ext_n, hash_size=hash_int_size+hash_ext_size;
                const hash_int_avg=hash_int_size/hash_int_n, hash_ext_avg=hash_ext_size/hash_ext_n;
                printt(['#Stat: 2-verify: Hash-Int:', szstr(hash_int_size), `${hash_size>0?(hash_int_size*100/hash_size).toFixed(2):'0.00'}%`, hash_int_n, `${hash_n>0?(hash_int_n*100/hash_n).toFixed(2):'0.00'}%`, isNaN(hash_int_avg)?'NaN':szstr(hash_int_avg), '1.00x'],
                       ['#Stat: 2-verify: Hash-Ext:', szstr(hash_ext_size), `${hash_size>0?(hash_ext_size*100/hash_size).toFixed(2):'0.00'}%`, hash_ext_n, `${hash_n>0?(hash_ext_n*100/hash_n).toFixed(2):'0.00'}%`, isNaN(hash_ext_avg)?'NaN':szstr(hash_ext_avg), (hash_ext_avg/hash_int_avg).toFixed(2)+'x']);
                console.log('#Stat: 2-verify: SMALL_FILE: avg: '+szstr(SMF_SUM/SMF_N));

                kill();
                return resolve(map_dev);
            }
            var buff = Buffer.allocUnsafe(SMF_BASE), fail = Buffer.alloc(20);
            var send, kill; [send, kill] = hasher(callback, CPU_N);
            function callback(hash, e) { --n;
                if (!hash.equals(fail)) e[0].getd_map(hash.toString('binary')).set(e[1], e[2]);
                if (n === 0) return done();
            }
            var fc_int=0, fc_ext=0, fc_n=0;
            for (const [dev, map_size] of map_dev) {
                for (const [size, map_hash] of map_size) {
                    const map_ino = map_hash.get('');
                    if (map_ino !== undefined) {
                        if (map_ino.size > 1) {
                            for (const [ino, paths] of map_ino) {
                                if (fc_n===8) fc_n=4,fc_int>>=1,fc_ext>>=1; 
                                if (size > SMALL_FILE) { ++n;
                                    ++hash_ext_n; hash_ext_size += size; 
                                    ++fc_n; fc_ext += size;
                                    send(paths[0], [map_hash, ino, paths]);
                                } else {
                                    ++hash_int_n; hash_int_size += size;
                                    ++fc_n; fc_int += size;
                                    let fd;
                                    try { 
                                        fd = fs.openSync(paths[0], 'r');
                                        const hasher = crypto.createHash('sha1');
                                        fs.readSync(fd, buff, 0, size, null);
                                        map_hash.getd_map(hasher.update(buff.slice(0, size)).digest('binary')).set(ino, paths);
                                    } catch (err) {
                                        rua(err);
                                    }
                                    if(fd)try{fs.closeSync(fd)}catch(e){rua(e)}
                                }
                                ++SMF_N; SMF_SUM += SMALL_FILE;
                                SMALL_FILE = Math.floor(SMF_BASE*fc_ext/(fc_int+fc_ext));
                            }
                        }
                        map_hash.delete('');
                    }
                }
            }
            if (n === 0) return done();
        });
    }
    function solve(map_dev) {
        console.timeEnd('#Profile: Time: 2-verify');
        console.time('#Profile: Time: 3-solve');
        const solutions = [];
        for (const [dev, map_size] of map_dev) {
            for (const [size, map_hash] of map_size) {
                for (const [hash, map_ino] of map_hash) {
                    if (map_ino.size > 1) {
                        let major_i=0, major_n=0;
                        for (const [ino, paths] of map_ino) {
                            if (paths.length > major_n) {
                                major_n = paths.length;
                                major_i = ino;
                            }
                        }
                        const dsts = [];
                        for (const [ino, paths] of map_ino) {
                            if (ino !== major_i) {
                                dsts.push(...paths);
                            }
                        }
                        solutions.push([size, map_ino.get(major_i)[0], dsts]);
                    }
                }
            }
        }
        return solutions;
    }
    function execute(solutions) {
        console.timeEnd('#Profile: Time: 3-solve');
        console.timeEnd('#Profile: Time: scheme');
        console.time('#Profile: Time: execute');
        var todo_size=0, todo_src_n=0, todo_dst_n=0,
            succ_size=0, succ_src_n=0, succ_dst_n=0,
            fail_size=0, fail_src_n=0, fail_dst_n=0;
        for (const [size, src, dsts] of solutions) {
            let succ_src_a=0, fail_src_a=0;
            for (const dst of dsts) {
                try {
                    link(src, dst);
                    // console.log("ln -f -- '%s' '%s'", src, dst);
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
        console.timeEnd('#Profile: Time: execute');
        { const mem = process.memoryUsage();
            console.log(`#Profile: Memory: rss: ${szstr(mem.rss)}`);
            console.log(`#Profile: Memory: heapTotal: ${szstr(mem.heapTotal)}`);
            console.log(`#Profile: Memory: heapUsed: ${szstr(mem.heapUsed)}`);
            console.log(`#Profile: Memory: external: ${szstr(mem.external)}`);
        }
        printt(["#Result: TODO:", szstr(todo_size), todo_size, todo_src_n, todo_dst_n],
               ["#Result: DONE:", szstr(succ_size), succ_size, succ_src_n, succ_dst_n],
               ["#Result: FAIL:", szstr(fail_size), fail_size, fail_src_n, fail_dst_n]);
    }
    function main(){
        probe(process.argv.slice(2)).then(verify).then(solve).then(execute);
    };
}
main();
