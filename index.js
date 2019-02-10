"use strict";
/**
 * @typedef {{[ino: string]: string[]}} DigestNode
 * @typedef {{[digest: string]: DigestNode}} ExkeyNode
 * @typedef {{[exkey: string]: ExkeyNode}} SizeNode
 * @typedef {{[size: string]: SizeNode}} DevNode
 * @typedef {{[dev: string]: DevNode}} RootNode
 */

/**
 * @typedef {{size: number, count: number}} SizeCount
 * @typedef {{size: number, src: number, dst: number}} SizeSrcDst
 */

/**
 * @param {RootNode} rootNode
 */
function addFile (rootNode, dev, size, exkey, digest, ino, path) {
    const devNode = rootNode[dev] || (rootNode[dev] = {});
    const sizeNode = devNode[size] || (devNode[size] = {});
    const exkeyNode = sizeNode[exkey] || (sizeNode[exkey] = {});
    const digestNode = exkeyNode[digest] || (exkeyNode[digest] = {});
    const paths = digestNode[ino] || (digestNode[ino] = []);
    paths.push(path);
}
exports.addFile = addFile;

/**
 * @param {RootNode} rootNode 
 * @returns {RootNode} new one
 */
function filterHashWorks (rootNode) {
    const newRootNode = {};
    for (const dev of Object.keys(rootNode)) {
        const devNode = rootNode[dev]; 
        const newDevNode = {}; let useDev = false;
        for (const size of Object.keys(devNode)) {
            const sizeNode = devNode[size]; 
            const newSizeNode = {}; let useSize = false;
            for (const exkey of Object.keys(sizeNode)) {
                const exkeyNode = sizeNode[exkey];
                const digestlessNode = exkeyNode[""];
                if (digestlessNode) {
                    const inoArray = Object.keys(digestlessNode);
                    let inoCount = inoArray.length;
                    if (inoCount > 1) {
                        const newDigestlessNode = {};
                        for (const ino of inoArray) {
                            const paths = digestlessNode[ino];
                            if (paths.length)
                                newDigestlessNode[ino] = paths.slice();
                            else --inoCount;
                        }
                        if (inoCount > 1) {
                            newSizeNode[exkey] = {[""]: newDigestlessNode}, useSize = true;
                        }
                    }
                }
            } if (useSize) newDevNode[size] = newSizeNode, useDev = true;
        } if (useDev) newRootNode[dev] = newDevNode;
    }
    return newRootNode;
}
exports.filterHashWorks = filterHashWorks;

/**
 * @param {RootNode} rootNode
 * @param {string} dev
 */
function* hashWorks (rootNode, dev) {
    const devNode = rootNode[dev],
        sizeArray = Object.keys(devNode);
    let sizeCount = sizeArray.length;
    for (const _size of sizeArray) { 
        const size = Number(_size);
        const sizeNode = devNode[_size],
            exkeyArray = Object.keys(sizeNode);
        let exkeyCount = exkeyArray.length;
        for (const exkey of exkeyArray) {
            const exkeyNode = sizeNode[exkey],
                digestArray = Object.keys(exkeyNode);
            let digestCount = digestArray.length; 
            const digestlessNode = exkeyNode[""];
            if (digestlessNode) { 
                const inoArray = Object.keys(digestlessNode); 
                let inoCount = inoArray.length; 
                if (inoCount > 1) for (const ino of inoArray) {
                    const paths = digestlessNode[ino]; 
                    if (paths.length) {
                        const digest = yield {paths, size};
                        if (digest) {
                            const digestNode = exkeyNode[digest];
                            if (digestNode) {
                                const inoNode = digestNode[ino];
                                if (inoNode) inoNode.push(...paths);
                                else digestNode[ino] = paths.slice();
                            } else {
                                exkeyNode[digest] = {[ino]: paths.slice()}; ++digestCount;
                            }
                            delete digestlessNode[ino]; --inoCount;
                        }
                    }
                } if (!inoCount) { delete exkeyNode[""]; --digestCount; }
            } if (!digestCount) { delete sizeNode[exkey]; --exkeyCount; }
        } if (!exkeyCount) { delete devNode[_size]; --sizeCount; }
    } if (!sizeCount) { delete rootNode[dev]; }  
}
exports.hashWorks = hashWorks;


/**
 * @param {RootNode} rootNode 
 * @returns {RootNode} new one
 */
function filterdedupWorks (rootNode) {
    const newRootNode = {};
    for (const dev of Object.keys(rootNode)) {
        const devNode = rootNode[dev]; 
        const newDevNode = {}; let useDev = false;
        for (const size of Object.keys(devNode)) {
            const sizeNode = devNode[size]; 
            const newSizeNode = {}; let useSize = false;
            for (const exkey of Object.keys(sizeNode)) {
                const exkeyNode = sizeNode[exkey]; 
                const newExkeyNode = {}; let useExkey = false;
                for (const digest of Object.keys(exkeyNode)) if (digest) {
                    const digestNode = exkeyNode[digest];
                    const newDigestNode = {},
                        inoArray = Object.keys(digestNode);
                    let inoCount = inoArray.length;
                    if (inoCount > 1) {
                        for (const ino of inoArray)  {
                            const paths = digestNode[ino];
                            if (paths.length) 
                                newDigestNode[ino] = paths.slice();
                            else --inoCount;
                        }
                        if (inoCount > 1) {
                            newExkeyNode[digest] = newDigestNode, useExkey = true;
                        }
                    }
                } if (useExkey) newSizeNode[exkey] = newExkeyNode, useSize = true;
            } if (useSize) newDevNode[size] = newSizeNode, useDev = true;
        } if (useDev) newRootNode[dev] = newDevNode;
    }
    return newRootNode;
}
exports.filterdedupWorks = filterdedupWorks;

/**
 * @param {RootNode} rootNode
 * @param {string} dev
 */
function* dedupWorks (rootNode, dev) {
    const devNode = rootNode[dev],
        sizeArray = Object.keys(devNode); 
    let sizeCount = sizeArray.length;
    for (const size of sizeArray) { 
        const sizeNum = Number(size);
        const sizeNode = devNode[size],
            exkeyArray = Object.keys(sizeNode); 
        let exkeyCount = exkeyArray.length;
        for (const exkey of exkeyArray) { 
            const exkeyNode = sizeNode[exkey],
                digestArray = Object.keys(exkeyNode); 
            let digestCount = digestArray.length;
            for (const digest of digestArray) if (digest) { 
                const digestNode = exkeyNode[digest],
                    inoArray = Object.keys(digestNode); 
                let inoCount = inoArray.length; 
                if (inoCount > 1) {
                    let mostInoIndex = 0, 
                        mostInoCount = digestNode[inoArray[0]].length;
                    for (let i = 1; i < inoCount; ++i) {
                        const count = digestNode[inoArray[i]].length;
                        if (mostInoCount < count) 
                            mostInoCount = count,
                            mostInoIndex = i;
                    }
                    if (mostInoCount) {
                        const mostInoPaths = digestNode[inoArray[mostInoIndex]];
                        const src = mostInoPaths[0]; let src0 = 1;
                        for (let inoIndex = 0; inoIndex < inoCount; ++inoIndex) {
                            if (inoIndex === mostInoIndex) continue;
                            const dsts = digestNode[inoArray[inoIndex]]; let fail = 0;
                            for (let i = 0, n = dsts.length; i < n; ++i) { 
                                const dst = dsts[i];
                                if (yield {src, dst, size: sizeNum, src0}) {
                                    mostInoPaths.push(dst); 
                                    src0 = 0;
                                } else dsts[fail++] = dst;
                                
                            }
                            dsts.length = fail;
                        }
                    }
                }
                for (const ino of inoArray) {
                    if (!digestNode[ino].length) { delete digestNode[ino]; --inoCount; }
                }
                if (!inoCount) { delete exkeyNode[digest]; --digestCount; }
            } if (!digestCount) { delete sizeNode[exkey]; --exkeyCount; }
        } if (!exkeyCount) { delete devNode[sizeNum]; --sizeCount; }
    } if (!sizeCount) { delete rootNode[dev]; }  
}
exports.dedupWorks = dedupWorks;

const fs = require("fs");
const crypto = require("crypto");
const _path = require("path");
const readline = require("readline");
const child_process = require("child_process");

const isObject = obj => obj !== null && typeof obj === "object";
const noop = () => {};

/** @template T */
class Queue {
    constructor () {
        /** @type {T[]} */
        this._in = [];
        /** @type {T[]} */
        this._out = [];
    }
    /** @param {T} item */
    enqueue (item) {
        this._in.push(item);
    }
    /** @param {T} def */
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

/** 
 * multi-process hash
 * @typedef {{proc:child_process.ChildProcess,errs:Queue<string>,callbacks:Queue<(err:string,digest:string)=>void>}} MPHashChildProcess
 */
class MPHash {
    constructor (algorithm = "sha1", encoding = "hex", localBufferSize = 4096, childBufferSize = 8388608) {
        /** @type {MPHashChildProcess[]} */
        this.cps = [];
        this.cur = -1;
        this.setStats();
        this._args = [MPHash.HASHD_PATH, algorithm, encoding, childBufferSize + ""];
        this._buffer = Buffer.alloc(localBufferSize);
    }
    /**
     * @typedef {{hashInt: SizeCount, hashExt: SizeCount}} MPHashStats
     * @param {MPHashStats} stats 
     */
    setStats (stats) {
        if (isObject(stats)) {
            if (!isObject(stats.hashInt)) stats.hashInt = { size: 0, count: 0 };
            if (!isObject(stats.hashExt)) stats.hashExt = { size: 0, count: 0 };
        } else stats = {
            hashInt: { size: 0, count: 0 },
            hashExt: { size: 0, count: 0 },
        };
        this.stats = stats;
        return this;
    }
    /**
     * @param {number} count
     */
    open (count) {
        const cps = this.cps;
        for (let i = 0; i < count; ++i) {
            const cp = {
                proc: child_process.spawn(process.execPath, this._args, {windowsHide: true}),
                errs: new Queue(),
                callbacks: new Queue(),
            };
            cp.proc.on("error", err => this.onError(err));
            cp.proc.on("close", () => { 
                const i = cps.indexOf(cp);
                if (~i) { let n = cps.length;
                    if (i < --n) cps[i] = cps.pop(); else cps.pop();
                    if (!n) this.onDone();
                }
            });
            readline.createInterface(cp.proc.stderr).on("line", line => cp.errs.enqueue(line));
            readline.createInterface(cp.proc.stdout).on("line", line => line
                ? cp.callbacks.dequeue(noop)("", line)
                : cp.callbacks.dequeue(noop)(cp.errs.dequeue(""), ""));
            cps.push(cp);
        }
        return this;
    }
    close () {
        for (const cp of this.cps)
            cp.proc.stdin.end();
        this.cps = [];
        return this;
    }
    /**
     * @param {string} path 
     * @param {number} size
     * @param {(err: string, digest: string) => void} callback 
     */
    hash (path, size, callback) {
        if (size > this._buffer.length) {
            if (this.cps.length) {
                const cp = this.cps[++this.cur < this.cps.length ? this.cur : this.cur = 0];
                cp.callbacks.enqueue((err, digest) => {
                    if (!err) {
                        this.stats.hashExt.size += size;
                        this.stats.hashExt.count++;
                    }
                    return callback(err, digest);
                });
                cp.proc.stdin.write(`${path}\n`);
            } else {
                setImmediate(callback, String(Error("MPHash no child processes")), "");
                return;
            }
        } else {
            let fd = 0;
            try {
                fd = fs.openSync(path, "r");
            } catch (err) {
                setImmediate(callback, String(err), "");
                return;
            }
            let digest = "";
            try {
                digest = crypto.createHash(this._args[1])
                    .update(this._buffer.slice(0, fs.readSync(fd, this._buffer, 0, this._buffer.length, null)))
                    .digest(this._args[2]);
            } catch (err) {
                fs.close(fd, noop);
                setImmediate(callback, String(err), "");
                return;
            }
            this.stats.hashInt.size += size;
            this.stats.hashInt.count++;
            fs.close(fd, noop);
            setImmediate(callback, "", digest);
        }
    }
    /**
     * @returns {HasherHashFunc}
     */
    getHash () {
        return (path, size, callback) => this.hash(path, size, callback);
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
    /**
     * @param {RootNode} tree 
     * @param {ProberStats} stats 
     */
    constructor (tree, stats) {
        this.setTree(tree);
        this.setStats(stats);
        /** @type {{[path: string]: 1 | 2}} 1: stat called, 2: stat returned */
        this.visited = {};
        this._undone = 0;
        this._opened = false;
    }
    /**
     * @param {RootNode} tree 
     */
    setTree (tree) {
        this.tree = isObject(tree) ? tree : {};
        return this;
    }
    /**
     * @typedef {{stat: SizeCount, readdir: SizeCount, select: SizeCount}} ProberStats
     * @param {ProberStats} stats 
     */
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
        return this;
    }
    open () {
        if (!this._opened) {
            this._opened = true;
            ++this._undone;
        }
        return this;
    }
    /**
     * @param {string} path 
     */
    probe (path) {
        if (this._opened) this._stat(path, _path.basename(path), _path.resolve(path));
        if (!this._undone) this.onDone();
        return this;
    }
    /**
     * @returns {(path: string) => this}
     */
    getProbe () {
        return path => this.probe(path);
    }
    close () {
        if (this._opened) {
            this._opened = false;
            if (!--this._undone) this.onDone();
        }
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
     * @param {string} path 
     * @param {fs.Stats} stats With this param, the error is from readdir(), else stat()
     */
    onError (err, path, stats) {
        return;
    }
    onDone () {
        return;
    }
    /**
     * @param {{stats: fs.Stats, path: string, name: string}} file
     * @returns {boolean} preserve?
     */
    onFile (file) {
        return true;
    }
    /**
     * @param {{stats: fs.Stats, path: string, name: string}} file
     * @returns {string} extraKey
     */
    onExkey (file) {
        return "";
    }
    /**
     * @param {{stats: fs.Stats, path: string, name: string, files: string[]}} dir
     * @returns {boolean} preserve?
     */
    onDir (dir) {
        return true;
    }
    /**
     * @param {string} path 
     * @param {string} name
     * @param {string} absPath
     */
    _stat (path, name, absPath) {
        if (this.visited[absPath] === undefined) {
            this.visited[absPath] = 1;
            ++this._undone;
            return fs.lstat(path, (err, stats) => {
                if (!err) {
                    this.stats.stat.count++;
                    this.stats.stat.size += stats.size;
                    if (this.visited[absPath] === 1) {
                        this.visited[absPath] = 2;
                        if (stats.isFile()) {
                            if (stats.size > 0 && this.onFile({stats, path, name})) {
                                this.stats.select.count++;
                                this.stats.select.size += stats.size;
                                addFile(this.tree, stats.dev + "", stats.size + "", this.onExkey({stats, path, name}), "", stats.ino + "", path);
                            }
                        } else if (stats.isDirectory()) return fs.readdir(path, (err, files) => {
                            if (!err) {
                                if (this.onDir({stats, path, name, files})) {
                                    this.stats.readdir.count++;
                                    for (const name of files) {
                                        this.stats.readdir.size += Buffer.byteLength(name);
                                        this._stat(_path.join(path, name), name, _path.join(absPath, name));
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
}
exports.Prober = Prober;


class Hasher {
    /**
     * @param {RootNode} tree 
     * @param {HasherStats} stats 
     */
    constructor (tree, stats) {
        this.setTree(tree);
        this.setStats(stats);
        this._undone = 0;
    }
    /**
     * @param {RootNode} tree 
     */
    setTree (tree) {
        this.tree = isObject(tree) ? tree : {};
        return this;
    }
    /**
     * @typedef {{hash: SizeCount}} HasherStats
     * @param {HasherStats} stats 
     */
    setStats (stats) {
        if (isObject(stats)) {
            if (!isObject(stats.hash)) stats.hash = { size: 0, count: 0 };
        } else stats = {
            hash: { size: 0, count: 0 },
        };
        this.stats = stats;
        return this;
    }
    /**
     * @param {() => NodeJS.ReadWriteStream} newHash 
     */
    setNewHash (newHash) {
        this.newHash = newHash;
        return this;
    }
    /**
     * @typedef {(path: string, size: number, callback: (err: string, digest: string) => void) => void} HasherHashFunc
     * @param {HasherHashFunc} hash 
     */
    hash (hash) {
        ++this._undone;
        for (const dev of Object.keys(this.tree)) { ++this._undone;
            const works = hashWorks(this.tree, dev); 
            let paths = [], size = 0, i = 0;
            const callback = (err, digest) => {
                if (!err) {
                    this.stats.hash.count++;
                    this.stats.hash.size += size;
                    return next(digest); 
                } else {
                    this.onError(err, paths[i]);
                    return next("");  
                }
            };
            const next = digest => { 
                if (digest || !(++i < paths.length)) {
                    const next = works.next(digest);
                    if (next.done) { if (!--this._undone) this.onDone(); return; }
                    paths = next.value.paths, size = next.value.size, i = 0;
                }
                return hash(paths[i], size, callback);
            };
            next("");
        }
        if (!--this._undone) this.onDone();
        return this;
    }
    /**
     * @param {HasherHashFunc} hash 
     */
    getHash (hash) {
        return () => this.hash(hash);
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
     * @param {RootNode} tree 
     * @param {LinkerStats} stats 
     */
    constructor (tree, stats) {
        this.setTree(tree);
        this.setStats(stats);
        this._undone = 0;
    }
    /**
     * @param {RootNode} tree 
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
     * @param {SafeLinkFunc} link default = lndup.safeLink
     */
    getLink (link = safeLink) {
        return () => this.link(link);
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