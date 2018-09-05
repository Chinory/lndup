class Tree {
    /**
     * constructor
     * @param {Entry} entry 
     */
    constructor (entry) {
        this.entry = entry;
    }
    /**
     * add a path
     * @param {string} dev
     * @param {string} size    
     * @param {string} exkey 
     * @param {string} digest 
     * @param {string} ino 
     * @param {string} path 
     * @returns {Tree}
     */
    add (dev, size, exkey, digest, ino, path) {
        if (path) {
            let node = this.entry;
            node = node[dev]    || (node[dev]    = {});
            node = node[size]   || (node[size]   = {});
            node = node[exkey]  || (node[exkey]  = {});
            node = node[digest] || (node[digest] = {});
            node = node[ino]    || (node[ino]    = []);
            node.push(path);
        }
        return this;
    }

    /**
     * get devs
     * @returns {string[]}
     */
    devs () {
        return Object.keys(this.entry);
    }
    /**
     * validations iterator, get next with true will delete the validation
     * @param {string} dev 
     * @returns {IterableIterator<{exkeyNode: ExkeyNode, ino: string, paths: Path[], size: string}>}
     */
    * validations (dev) {
        // TODO
        const devNode = this.entry[dev];
        if (!devNode) return;
        let sizeCount = 0;
        for (const size in devNode) {
            ++sizeCount;
            const sizeNode = devNode[size];
            let exkeyCount = 0;
            for (const exkey in sizeNode) {
                ++exkeyCount;
                const exkeyNode = sizeNode[exkey];
                let digestCount = 0;
                for (const digest in exkeyNode) {
                    ++digestCount;
                    if (digest !== '') continue;
                    const digestNode = exkeyNode[digest];
                    let inoCount = 0;
                    for (const ino in digestNode) {
                        ++inoCount;
                        if (yield {exkeyNode, ino, paths: digestNode[ino], size}) {
                            delete digestNode[ino]; --inoCount;
                        }
                    }
                    if (inoCount < 2) {
                        delete exkeyNode[digest]; --digestCount;
                    }
                }
                if (digestCount === 0 && !exkeyNode['']) {
                    delete sizeNode[exkey]; --exkeyCount;
                }
            }
            if (exkeyCount === 0) {
                delete devNode[size]; --sizeCount;
            }
        }
        if (sizeCount === 0) {
            delete this.entry[dev];
        }   
    
    }
    /**
     * solutions iterator, get next with true will delete the solution
     * @param {string} dev 
     * @returns {IterableIterator<{size: string, src: Path, dst: Path}>}
     */
    * solutions (dev) {
        const devNode = this.entry[dev];
        if (!devNode) return;
        let sizeCount = 0;
        for (const size in devNode) {
            ++sizeCount;
            const sizeNode = devNode[size];
            let exkeyCount = 0;
            for (const exkey in sizeNode) {
                ++exkeyCount;
                const exkeyNode = sizeNode[exkey];
                let digestCount = 0;
                for (const digest in exkeyNode) {
                    ++digestCount;
                    if (digest === '') continue;
                    // find major
                    const digestNode = exkeyNode[digest];
                    let majorIno = '';
                    let majorCount = 0;
                    let inoCount = 0;
                    for (const ino in digestNode) {
                        ++inoCount;
                        const paths = digestNode[ino];
                        if (majorCount < paths.length) {
                            majorCount = paths.length;
                            majorIno = ino;
                        }
                    }
                    if (inoCount > 1) {
                        // solutions
                        const src = digestNode[majorIno][0];
                        for (const ino in digestNode) {
                            if (ino === majorIno) continue;
                            let deleted = false;
                            let paths = digestNode[ino];
                            for (let i = 0; i < paths.length; ++i) {
                                if (yield {size: size, src: src, dst: paths[i]}) {
                                    paths[i] = '';
                                    deleted = true;
                                }
                            }
                            if (deleted) {
                                paths = paths.filter(path => path !== '');
                                if (paths.length === 0) {
                                    delete digestNode[ino]; --inoCount;
                                } else {
                                    digestNode[ino] = paths;
                                }
                            }
                        }
                    }
                    if (inoCount < 2) {
                        delete exkeyNode[digest]; --digestCount;
                    }
                    
                }
                if (digestCount === 0) {
                    delete sizeNode[exkey]; --exkeyCount;
                }
            }
            if (exkeyCount === 0) {
                delete devNode[size]; --sizeCount;
            }
        }
        if (sizeCount === 0) {
            delete this.entry[dev];
        }   
    }
}

module.exports = Tree;
