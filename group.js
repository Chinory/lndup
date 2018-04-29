#!/usr/bin/env node
// group.js: prototype of lndup's multi-file grouper
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

/*lndup group.js GPL-3.0 <https://github.com/chinory/lndup>*/

const fs=require('fs');

function fd_distributor(started, MAX_FD) {
    var fd_using=0, use_fd=[], funcs=[];
    function start() {
        for (let i=funcs.length; i>0;) {
            if (use_fd[--i] < MAX_FD - fd_using) {
                fd_using += use_fd.splice(i, 1)[0];
                started(funcs.splice(i, 1)[0](closed));
            }
        }
    }
    function closed() {
        --fd_using;
        start();
    }
    function apply(n, func) {
        if (n > MAX_FD) throw new Error('too much fd needed');
        use_fd.unshift(n);
        funcs.unshift(func);
        return start();
    }
    return apply;
}


// file must be same size
function group_same(paths, size) {
    return new Promise(resolve => {
        const BUFSIZE = 1024**2*1;
        var n = paths.length;
        if (n <= 1) return resolve([]);
        var OD = Array(n); 
        var fd = Array(n);
        var buf = Array(n); 
        var buf_i = new WeakMap(); 
        var wait = Array(n).fill(true)
        var wait_n = n;

        for (let k=0; k<n; ++k) {
            (OD[k]=Array(n).fill(true))[k]=false;
            fd[k] = fs.openSync(paths[k], 'r')
            buf[k] = Buffer.alloc(BUFSIZE)
            buf_i.set(buf[k], k);
        }

        for (let k=0; k<n; ++k) {
            fs.read(fd[k], buf[k], 0, BUFSIZE, null, diff);
        }

        var close_n = 0;
        function closed(err) {
            //console.error(`closed x${++close_n}: err:${err}`);
        }

        function next(i) { for (var D=OD[i], j=n; j>0;) if (D[--j] && wait[j]) return j; }
        function search(i) { wait[i]=false; for (var j; undefined!==(j=next(i));) search(j); }
        function entry() { for (var i=0; i<n; ++i) if (wait[i]) return i; }
        function group() {
            var i, k, g, r=[];
            for (k=n; k>0;) if(undefined!==wait[--k]) wait[k]=true;  
            while (undefined!==(i=entry())) {
                search(i);  // DFS
                for (g=[], k=0; k<n; ++k) if (wait[k]===false) {g.push(paths[k]); wait[k]=undefined};
                r.push(g);
            } 
            return resolve(r);
        }

        function diff(err, bytesRead, buffer) {
            var j, s=true, i=buf_i.get(buffer), D=OD[i];
            for (j=n; j>0;) {
                if (D[--j]) {
                    if (wait[j] || buffer.equals(buf[j])) { 
                        s = false;
                    } else {
                        D[j] = false; OD[j][i] = false;
                    }
                }
            }
            wait[i] = false; --wait_n;
            if (s) {  // isolate, close now
                console.error(`isolate close: ${paths[i]}`);
                fs.close(fd[i], closed);
                fd[i] = undefined;
                buf[i] = undefined;
                wait[i] = undefined;
            } 
            //console.error(`size:${size}, wait_n:${wait_n}`);
            if (wait_n === 0) {
                if (size > 0) {
                    //console.error(`raise read: i:${i}`);
                    size -= BUFSIZE;
                    for (j=n; j>0;) {
                        if (fd[--j]) {
                            wait[j]=true; ++wait_n;
                            //console.error(`read by ${paths[i]}: ${paths[j]}`);
                            fs.read(fd[j], buf[j], 0, BUFSIZE, null, diff);
                        }
                    }
                } else {  
                    for (j=n; j>0;) {
                        if (fd[--j]) {
                            fs.close(fd[j], closed); 
                        }
                    }
                    fd = undefined;
                    buf = undefined;
                    return group();
                }
            }
            
        }
    });
}


function test_main() {
    const paths = [];
    const rl = require('readline').createInterface({
        input:process.stdin,
    });
    rl.on('close',()=>{
        group_same(paths, fs.statSync(paths[0]).size).then(groups=>{
            for (const i in groups) {
                for (const path of groups[i]) {
                    console.log('%d %s', i, path);
                }
            }
        });
    });
    rl.on('line',line=>{
        if (line.length > 0) {
            paths.push(line);
        } else {
            rl.close();
        }
    });
}

test_main();