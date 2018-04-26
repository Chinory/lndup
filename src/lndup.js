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

/*lndup v0.1 GPL-3.0 <https://github.com/chinory/lndup>*/


const fs=require('fs'), path=require('path'), crypto=require('crypto');

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

function printt(table) {
    const maxlen = Array(table[0].length).fill(0);
    for (const line of table) {
        for (const i in line) {
            line[i] = line[i].toString();
            if (line[i].length > maxlen[i]) {
                maxlen[i] = line[i].length;
            }
        }
    }
    for (const line of table) {
        for (const i in line) {
            line[i] = line[i].padStart(maxlen[i]);
        }
        console.log(line.join('  '));
    }
}

function probe(paths) {
    return new Promise(resolve => { var n = 0;
        const map_dev = new Map();
        function readdir(dir) { ++n;
            return fs.readdir(dir, (err, files)=>{ --n;
                if (err) {rua(err)} else {
                    for (const name of files) {
                        stat(path.join(dir, name));
                    }
                }
                if (n === 0) {
                    return resolve(map_dev);
                }
            });
        }
        function stat(path) { ++n;
            return fs.lstat(path, (err, stat)=>{ --n;
                if (err) {rua(err)} else {
                    if (stat.isDirectory()) {
                        return readdir(path);
                    } else if (stat.isFile()) {
                        if (stat.size > 0) {
                            map_dev.getd_map(stat.dev).getd_map(stat.size).getd_map('').getd_array(stat.ino).push(path);
                        }
                    }
                }
                if (n === 0) {
                    return resolve(map_dev);
                }
            });
        }
        for (const path of paths) {
            stat(path);
        }
    });
}

const SMALL_FILE = 16777216; //16MiB
function verify(map_dev) {
    const buf = Buffer.allocUnsafe(SMALL_FILE);
    for (const [dev, map_size] of map_dev) {
        for (const [size, map_hash] of map_size) {
            const map_ino = map_hash.get('');
            if (map_ino !== undefined) {
                if (map_ino.size > 1) {
                    for (const [ino, paths] of map_ino) {
                        let fd;
                        for (const path of paths) {
                            try {
                                fd = fs.openSync(path, 'r');
                                break;
                            } catch (err) {rua(err)}
                        }
                        if (fd) {
                            let hash;
                            try {
                                const hasher = crypto.createHash('sha1');
                                let len = size;
                                while (len > SMALL_FILE) {
                                    fs.readSync(fd, buf, 0, SMALL_FILE, null);
                                    hasher.update(buf);
                                    len -= SMALL_FILE;
                                }
                                fs.readSync(fd, buf, 0, len, null);
                                hash = hasher.update(buf.slice(0, len)).digest('binary');
                            } catch (err) {rua(err)}
                            try{fs.closeSync(fd)}catch(err){rua(err)}
                            if (hash) map_hash.getd_map(hash).set(ino, paths);
                        }
                    }
                }
                map_hash.delete('');
            }
        }
    }
    return map_dev;
}

function plan(map_dev) {
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
        }
        todo_src_n += 1;
        succ_src_n += succ_src_a;
        fail_src_n += fail_src_a;
    }
    todo_size = succ_size + fail_size;
    todo_dst_n = succ_dst_n + fail_dst_n;
    printt([["#Done:  TODO", szstr(todo_size), todo_size, todo_src_n, todo_dst_n],
            ["#Done:  SUCC", szstr(succ_size), succ_size, succ_src_n, succ_dst_n],
            ["#Done:  FAIL", szstr(fail_size), fail_size, fail_src_n, fail_dst_n],
        ]);
}

probe(process.argv.splice(2)).then(verify).then(plan).then(execute);

