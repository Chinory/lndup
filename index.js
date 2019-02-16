"use strict";

const iterHashWorks = exports.iterHashWorks = function* (devTable, dev) {
    var sizeTable = devTable[dev], sizes = Object.keys(sizeTable);
    for (var i = 0; i < sizes.length; ++i) { var size = Number(sizes[i]);
        var exkeyTable = sizeTable[sizes[i]], exkeys = Object.keys(exkeyTable);
        for (var j = 0; j < exkeys.length; ++j) {
            var digestTable = exkeyTable[exkeys[j]], inoTable, inos;
            if ((inoTable = digestTable[""]) && (inos = Object.keys(inoTable)).length > 1)
                // yield { size, digestTable, digest: "", inos };
                for (var k = 0; k < inos.length; ++k) {
                    var ino = inos[k], paths = inoTable[ino];
                    yield { size, digestTable, digest: "", ino, paths };
                }
        }
    }
};


const finishHashWork = exports.finishHashWork = function (work, newDigest) {
    var inoTableOld, pathsOld, inoTableNew, pathsNew;
    if ((inoTableOld = work.digestTable[work.digest]) && (pathsOld = inoTableOld[work.ino])) {
        if ((inoTableNew = work.digestTable[newDigest])) { if (inoTableNew === inoTableOld) return; }
        else inoTableNew = work.digestTable[newDigest] = {};
        if ((pathsNew = inoTableNew[work.ino]) && pathsNew !== pathsOld) 
            for (let i = 0; i < pathsOld.length; ++i) pathsNew.push(pathsOld[i]);
        else inoTableNew[work.ino] = pathsOld.slice();
        delete inoTableOld[work.ino];
        work.digest = newDigest;
    }
};


const iterLinkWorks = exports.iterLinkWorks = function* (devTable, dev) {
    var sizeTable = devTable[dev], sizes = Object.keys(sizeTable);
    for (var i = 0; i < sizes.length; ++i) { var size = Number(sizes[i]);
        var exkeyTable = sizeTable[sizes[i]], exkeys = Object.keys(exkeyTable);
        for (var j = 0; j < exkeys.length; ++j) {
            var digestTable = exkeyTable[exkeys[j]], digests = Object.keys(digestTable);
            for (var k = 0; k < digests.length; ++k) {
                var inoTable = digestTable[digests[k]], inos = Object.keys(inoTable);
                if (inos.length < 2) continue;
                for (var mm = 0, mmn = inoTable[inos[0]].length, m = 1, mn; m < inos.length; ++m)
                    if (mmn < (mn = inoTable[inos[m]].length)) mmn = mn, mm = m;
                if (!mmn) continue;
                var srcIno = inos[mm]; mm < inos.length - 1 ? inos[mm] = inos.pop() : inos.pop();
                yield { size, inoTable, srcIno, dstInos: inos };
            }
        }
    }
};

const finishLinkWork = exports.finishLinkWork = function (work, dstIno, dsti) {
    var dsts = work.inoTable[dstIno];
    work.inoTable[work.srcIno].push(dsts[dsti]);
    dsts[dsti] = "";
};

const finishLinkWorks = exports.finishLinkWorks = function (work) {
    for (var ino, i = 0; i < work.dstInos.length; ++i) {
        work.inoTable[ino = work.dstInos[i]] = work.inoTable[ino].filter(Boolean);
    }
};

const fs = require("fs");
const crypto = require("crypto");
const _path = require("path");
const readline = require("readline");
const child_process = require("child_process");

const isObject = obj => obj !== null && typeof obj === "object";
const noop = () => {};

class Queue {
    constructor () {
        this._in = [];
        this._out = [];
    }
    enqueue (item) {
        this._in.push(item);
    }
    dequeue (def) {
        if (this._out.length) {
            return this._out.pop();
        } else if (this._in.length) {
            this._out = this._in.reverse();
            this._in = [];
            return this._out.pop();
        } else {
            return def;
        }
    }
}
exports.Queue = Queue;


class MPHash {
    constructor (algorithm = "sha1", encoding = "hex", localBufferSize = 4096, childBufferSize = 8388608) {
        this.setStats();
        this.childs = [];
        this.childTurn = -1;
        this._childArgs = [MPHash.HASHD_PATH, algorithm, encoding, childBufferSize + ""];
        this._buffer = Buffer.alloc(localBufferSize);
        this._undone = 0;
        this._opened = false;
    }
    setStats (stats) {
        if (isObject(stats)) {
            if (!isObject(stats.hashInt)) stats.hashInt = { size: 0, count: 0 };
            if (!isObject(stats.hashExt)) stats.hashExt = { size: 0, count: 0 };
        } else stats = {
            hashInt: { size: 0, count: 0 },
            hashExt: { size: 0, count: 0 },
        };
        this.stats = stats;
    }
    createChild () {
        const child = { works: new Queue(), errs: new Queue(),
            proc: child_process.spawn(process.execPath, this._childArgs, {windowsHide: true}),
        };
        this.childs.push(child); ++this._undone;
        child.proc.on("error", err => this.onError(err));
        child.proc.on("close", () => { 
            var i = this.childs.indexOf(child);
            if (~i) i < this.childs.length - 1 ? this.childs[i] = this.childs.pop() : this.childs.pop();
            if (!--this._undone) return this.onDone();
        });
        readline.createInterface(child.proc.stderr).on("line", err => child.errs.enqueue(err));
        readline.createInterface(child.proc.stdout).on("line", digest => { 
            var work = child.works.dequeue();
            if (work) if (digest) {
                this.stats.hashExt.size += work.size; ++this.stats.hashExt.count;
                return work.callback("", digest);
            } else {
                return work.callback(child.errs.dequeue("unknown error"), "");
            }
        });
    }
    closeChild (i) {
        const child = this.childs[i];
        i < this.childs.length - 1 ? this.childs[i] = this.childs.pop() : this.childs.pop();
        child.proc.stdin.end();
    }
    closeChilds () {
        for (var child; (child = this.childs.pop());) {
            child.proc.stdin.end();
        }
    }
    open (childCount) {
        if (!this._opened && childCount > 0) {
            do this.createChild(); while (--childCount);
            this._opened = true; ++this._undone;
        }
    }
    close () {
        if (this._opened) {
            this._opened = false;
            this.closeChilds();
            if (!--this._undone) setImmediate(() => this.onDone());
        }
    }
    hash (path, size, callback, childIndex = -1) {
        if (!this._opened) return;
        if (size > this._buffer.length) {
            if (this.childs.length) {
                if (!~childIndex) childIndex = ++this.childTurn < this.childs.length ? this.childTurn : this.childTurn = 0;
                const child = this.childs[childIndex];
                child.works.enqueue({ size, callback });
                child.proc.stdin.write(`${path}\n`);
            } else {
                setImmediate(callback, "multi-process hash no child process", "");
            }
        } else {
            let fd, digest;
            try {
                fd = fs.openSync(path, "r");
            } catch (err) {
                setImmediate(callback, String(err), "");
                return;
            }
            try {
                digest = crypto.createHash(this._childArgs[1])
                    .update(this._buffer.slice(0, fs.readSync(fd, this._buffer, 0, this._buffer.length, 0)))
                    .digest(this._childArgs[2]);
            } catch (err) {
                fs.closeSync(fd);
                setImmediate(callback, String(err), "");
                return;
            }
            this.stats.hashInt.size += size; ++this.stats.hashInt.count;
            fs.closeSync(fd);
            setImmediate(callback, "", digest);
        }
    }
    /**
     * @param {string} event 
     * @param {Function} listener 
     */
    on (event, listener) {
        this["on" + event[0].toUpperCase() + event.slice(1)] = listener;
        return this;
    }
    onDone () {
        return;
    }
    /**
     * @param {Error} err 
     */
    onError (err) {
        return;
    }
}
MPHash.HASHD_PATH = _path.join(__dirname, "bin", "hashd");
exports.MPHash = MPHash;

/**
 * @typedef {(src: fs.PathLike, dst: fs.PathLike, callback: (err: NodeJS.ErrnoException, remedy: NodeJS.ErrnoException) => void) => void} SafeLinkFunc
 * @type {SafeLinkFunc}
 */
function safeLink (src, dst, callback) {
    const mid = `${dst}.${crypto.randomBytes(4).toString("hex")}`;
    fs.rename(dst, mid, errdm => errdm 
        ? callback(errdm, null) 
        : fs.link(src, dst, errln => errln 
            ? fs.rename(mid, dst, errmd => callback(errln, errmd))
            : fs.unlink(mid, errul => callback(null, errul))));
}
exports.safeLink = safeLink;

/**
 * @type {SafeLinkFunc}
 */
exports.successFakeLink = (src, dst, callback) => setImmediate(callback, null, null);

class Prober {
    constructor (data, stats) {
        this.setData(data);
        this.setStats(stats);
        this.visited = {};
        this._undone = 0;
        this._opened = false;
    }
    setData (data) {
        this.data = isObject(data) ? data : {};
    }
    setStats (stats) {
        if (isObject(stats)) {
            if (!isObject(stats.stat)) stats.stat = { size: 0, count: 0 };
            if (!isObject(stats.readdir)) stats.readdir = { size: 0, count: 0 };
            if (!isObject(stats.select)) stats.select = { size: 0, count: 0 };
        } else stats = {
            stat: { size: 0, count: 0 },
            readdir: { size: 0, count: 0 },
            select: { size: 0, count: 0 },
        };
        this.stats = stats;
    }
    open () {
        if (!this._opened) {
            this._opened = true;
            ++this._undone;
        }
    }
    close () {
        if (this._opened) {
            this._opened = false;
            if (!--this._undone) setImmediate(() => this.onDone());
        }
    }
    /**
     * @param {string} path 
     */
    probe (path) {
        if (this._opened) {
            this._stat(path, _path.basename(path), _path.resolve(path));
        }
    }
    on (event, listener) {
        this["on" + event[0].toUpperCase() + event.slice(1)] = listener;
        return this;
    }
    /**
     * @param {NodeJS.ErrnoException} err 
     * @param {string} path 
     * @param {fs.Stats} stats With this param, the error is from readdir(), else stat()
     */
    onError (err, path, stats) {}
    onDone () {}
    /**
     * @param {stats: fs.Stats, name: string, path: string} file
     * @returns {boolean} preserve?
     */
    onFile (stats, name, path) { return true; }
    /**
     * @param {stats: fs.Stats, name: string, path: string} file
     * @returns {string} extraKey
     */
    onExkey (stats, name, path) { return ""; }
    /**
     * @param {stats: fs.Stats, name: string, path: string, files: string[]} dir
     * @returns {boolean} preserve?
     */
    onDir (stats, name, path, files) { return true; }
    /**
     * @param {string} path 
     * @param {string} name
     * @param {string} absPath
     */
    _stat (path, name, absPath) {
        if (this.visited[absPath]) return; this.visited[absPath] = 1;
        ++this._undone;
        return fs.lstat(path, (err, stats) => {
            if (!err) {
                this.stats.stat.count++;
                this.stats.stat.size += stats.size;
                if (this.visited[absPath] === 1) {
                    this.visited[absPath] = 2;
                    if (stats.isFile()) {
                        if (stats.size > 0 && this.onFile(stats, name, path)) {
                            this.stats.select.count++;
                            this.stats.select.size += stats.size;
                            var node = this.data, key;
                            node = node[key = stats.dev + ""] || (node[key] = {});
                            node = node[key = stats.size + ""] || (node[key] = {});
                            node = node[key = this.onExkey(stats, name, path)] || (node[key] = {});
                            node = node[""] || (node[""] = {});
                            node = node[key = stats.ino + ""] || (node[key] = []);
                            node.push(path);
                        }
                    } else if (stats.isDirectory()) return fs.readdir(path, (err, files) => {
                        if (!err) {
                            if (this.onDir(stats, name, path, files)) {
                                this.stats.readdir.count++;
                                for (let i = 0; i < files.length; ++i) {
                                    this.stats.readdir.size += Buffer.byteLength(files[i]);
                                    this._stat(_path.join(path, files[i]), files[i], _path.join(absPath, files[i]));
                                }
                            }
                        } else this.onError(err, path, stats);
                        if (!--this._undone) this.onDone();
                    });
                }
            } else this.onError(err, path, null);
            if (!--this._undone) this.onDone();
        });
    }
}
exports.Prober = Prober;


class Hasher {
    constructor (data, stats, algorithm = "sha1", encoding = "hex", localBufferSize = 4096, childBufferSize = 8388608) {
        this.setData(data);
        this.setStats(stats);
        this.mphash = new MPHash(algorithm, encoding, localBufferSize, childBufferSize);
        this.mphash.setStats(this.stats);
        this._undone = 0;
        this._opened = false;
    }
    setData (data) {
        this.data = isObject(data) ? data : {};
    }
    setStats (stats) {
        if (isObject(stats)) {
            if (!isObject(stats.hash)) stats.hash = { size: 0, count: 0 };
        } else stats = {
            hash: { size: 0, count: 0 },
        };
        this.stats = stats;
    }
    open () {
        if (!this._opened) {
            this.mphash.open(Object.keys(this.data).length);
            this._opened = true;
            ++this._undone;
        }
    }
    close () {
        if (this._opened) {
            this.mphash.close();
            this._opened = false;
            if (!--this._undone) setImmediate(() => this.onDone());
        }
    }
    hash () {
        if (!this._opened) return; else ++this._undone;
        const iters = Object.keys(this.data).map(dev => iterHashWorks(this.data, dev));
        const process = () => {
            for (let i = 0; i < iters.length; ++i) {
                const result = iters[i].next();
                if (!result.done) {
                    const work = result.value;
                    this.mphash.hash(work.paths[0], work.size, (err, digest) => {
                        if (!err) {
                            finishHashWork(work, digest);
                            const sc = this.stats.hash;
                            sc.size += work.size; ++sc.count;
                        }
                    }, i); 
                } else {
                    this.mphash.closeChild(i);
                    if (i < iters.length - 1) iters[i] = iters.pop(); else iters.pop();
                }
            }
            if (iters.length) setImmediate(process);
            else if (!--this._undone) this.onDone(); 
        };
        setImmediate(process);
    }
    /** 
     * @param {string} event 
     * @param {Function} listener 
     */
    on (event, listener) {
        this["on" + event[0].toUpperCase() + event.slice(1)] = listener;
        return this;
    }
    /**
     * @param {string} err 
     * @param {string} path
     */
    onError (err, path) {
        return;
    }
    onDone () {
        return;
    }
}
exports.Hasher = Hasher;

class Linker {
    /**
     * @param {DevTable} tree 
     * @param {LinkerStats} stats 
     */
    constructor (tree, stats) {
        this.setTree(tree);
        this.setStats(stats);
        this._undone = 0;
    }
    /**
     * @param {DevTable} tree 
     */
    setTree (tree) {
        this.tree = isObject(tree) ? tree : {};
        return this;
    }
    /**
     * @typedef {{linkTodo: SizeSrcDst, linkDone: SizeSrcDst, linkFail: SizeSrcDst}} LinkerStats
     * @param {LinkerStats} stats 
     */
    setStats (stats) {
        if (isObject(stats)) {
            if (!isObject(stats.linkTodo)) stats.linkTodo = { size: 0, src: 0, dst: 0 };
            if (!isObject(stats.linkDone)) stats.linkDone = { size: 0, src: 0, dst: 0 };
            if (!isObject(stats.linkFail)) stats.linkFail = { size: 0, src: 0, dst: 0 };
        } else stats = {
            linkTodo: { size: 0, src: 0, dst: 0 },
            linkDone: { size: 0, src: 0, dst: 0 },
            linkFail: { size: 0, src: 0, dst: 0 },
        };
        this.stats = stats;
        return this;
    }
    /**
     * @param {SafeLinkFunc} link default = lndup.safeLink
     */
    link (link = safeLink) {
        ++this._undone;
        for (const dev of Object.keys(this.tree)) { ++this._undone;
            const works = dedupWorks(this.tree, dev); 
            let work = null;
            const callback = (err, remedy) => {
                if (err) {
                    this.stats.linkFail.src += work.src0;
                    this.stats.linkFail.dst++;
                    this.stats.linkFail.size += work.size;
                    this.onError(err, remedy, work.src, work.dst);
                    return next(false);
                } else {
                    this.stats.linkDone.src += work.src0;
                    this.stats.linkDone.dst++;
                    this.stats.linkDone.size += work.size;
                    if (remedy) this.onError(err, remedy, work.src, work.dst);
                    return next(true);
                }
            };
            const next = lastOk => {
                const next = works.next(lastOk);
                if (next.done) { if (!--this._undone) this.onDone(); return; }
                work = next.value;
                this.stats.linkTodo.src += work.src0;
                this.stats.linkTodo.dst++;
                this.stats.linkTodo.size += work.size;
                return link(work.src, work.dst, callback);
            };
            next(false);
        }
        if (!--this._undone) this.onDone();
        return this;
    }
    /**
     * @param {string} event 
     * @param {Function} listener 
     */
    on (event, listener) {
        this["on" + event[0].toUpperCase() + event.slice(1)] = listener;
        return this;
    }
    /**
     * @param {NodeJS.ErrnoException} err 
     * @param {NodeJS.ErrnoException} remedy
     * @param {string} src
     * @param {string} dst
     */
    onError (err, remedy, src, dst) {
        return;
    }
    onDone () {
        return;
    }
}
exports.Linker = Linker;