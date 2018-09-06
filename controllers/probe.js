'use strict';

const fs = require('fs');
const Path = require('path');

const Tree = require('../models/tree');
  
class Probe {
    /**
     * constructor
     * @param {Tree} tree 
     */
    constructor (tree) {
        this.tree = tree;
        this.stats = Probe.Stats();
        this.undone = 0;
        this.visited = {};
        this._input = false;
    }
    static Stats () {
        return {
            readdir: { size: 0, count: 0 },
            stat:    { size: 0, count: 0 },
            select:  { size: 0, count: 0 }
        };
    }
    /**
     * input a path to probe
     * @param {string} path 
     */
    probe (path) {
        if (!this._input) {
            this._input = true;
            this.undone++;
        }
        return this._stat(path);
    }
    /**
     * stop path input. if nothing undone, emit onDone()
     */
    close () {
        if (this._input) {
            this._input = false;
            if (!--this.undone) return this.onDone();
        }
    }
    _stat (path) {
        if (!this.visited[path]) {
            this.visited[path] = 1;
            this.undone++;
            return fs.lstat(path, (err, stats) => {
                this.undone--;
                if (err) {
                    if (this.onError(err)) return;
                } else {
                    this.stats.stat.count++;
                    this.stats.stat.size += stats.size;
                    if (this.visited[path] === 1) {
                        this.visited[path] = 2;
                        if (stats.isDirectory()) return this._readdir(path, stats);
                        if (stats.isFile() && stats.size > 0 && this.onFile(stats, path)) {
                            this.stats.select.count++;
                            this.stats.select.size += stats.size;
                            this.tree.add(
                                stats.dev,
                                stats.size,
                                this.onGetExkey(stats, path),
                                '',
                                stats.ino,
                                path
                            );
                        }
                    }
                }
                if (!this.undone) return this.onDone();
            });
        }
    }
    _readdir (path, stats) {
        this.undone++;
        return fs.readdir(path, (err, files) => {
            this.undone--;
            if (err) {
                if (this.onError(err)) return;
            } else {
                if (this.onDirectory(stats, path, files)) {
                    this.stats.readdir.count++;
                    for (let name of files) {
                        name = Path.join(path, name);
                        this.stats.readdir.size += Buffer.byteLength(name);
                        this._stat(name);
                    }
                }
            }
            if (!this.undone) return this.onDone();
        });
    }
    /**
     * an error occurred
     * @param   {Error}   err 
     * @returns {boolean} abort
     */
    onError (err) {
        console.error('#' + err);
        return false;
    }
    /**
     * all jobs finished
     * @returns {void}
     */
    onDone () {
        return;
    }
    /**
     * filter file
     * @param {fs.Stats} stats 
     * @param {string}   path 
     * @returns {boolean} preserve this file
     */
    onFile (stats, path) {
        return true;
    }
    /**
     * filter directory
     * @param   {fs.Stats}  stats 
     * @param   {string}    path 
     * @param   {string[]}  files 
     * @returns {boolean} preserve this directory
     */
    onDirectory (stats, path, files) {
        return true;
    }
    /**
     * calc extra key
     * @param {fs.Stats} stats 
     * @param {string}   path 
     */
    onGetExkey (stats, path) {
        return '';
    }
}

module.exports = Probe;
