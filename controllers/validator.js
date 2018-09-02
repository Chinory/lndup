const fs = require('fs');
const crypto = require('crypto');

const Tree = require('../models/tree');
 
class Validator {
    /**
     * constructor
     * @param {Tree} tree 
     */
    constructor (tree) {
        this.tree = tree || new Tree();
        this.stats = Validator.Stats();
        this.undone = 0;
    }
    static Stats () {
        return {
            hash: { size: 0, count: 0 }
        };
    }

    validate () {
        for (const dev of Object.keys(this.tree)) {
            const validations = this.validations(dev);
            const callback = err => {
                if (err) this.onError(err);
                const next = validations.next();
                if (next.done) if (!--this.undone) return this.onDone(); else return;
                // validate
                const hash = crypto.createHash('sha1');
                fs.createReadStream(next.value.paths[0])
                    .on('error', callback)
                    .pipe(hash)
                    .on('finish', () => { 
                        const inoNode = next.value.contentNode[hash.digest('hex')];
                        if (inoNode[next.value.ino]) {
                            inoNode[next.value.ino].push(...next.value.paths);
                        } else {
                            inoNode[next.value.ino] = next.value.paths;
                        }
                        this.stats.count++;
                        this.stats.size += next.value.size;
                        return callback(null);
                    });
            };
            ++this.undone;
            callback(null);
        }
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
    
}

module.exports = Validator;
