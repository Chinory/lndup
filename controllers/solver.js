'use strict';

const fs = require('fs');
const crypto = require('crypto');
const shellescape = require('shell-escape');

const Tree = require('../models/tree');

class Solver {
    /**
     * constructor
     * @param {Tree} tree 
     * @param {{}} options 
     * @param {boolean} options.quiet  print operation before do
     * @param {boolean} options.dryrun dry-run
     */
    constructor (tree, options) {
        if (options == null) options = {};
        this.tree = tree;
        this.stats = Solver.Stats();
        this.undone = 0;
        this.onLink = options.quiet
            ? options.dryrun ? Solver._onLinkNoop : Solver._onLinkExecute
            : options.dryrun ? Solver._onLinkPrint : Solver._onLinkPrintExecute;
            
    }
    static Stats () {
        return {
            range:   { size: 0, count: 0 },
            target:  { size: 0, src: 0, dst: 0 },
            success: { size: 0, src: 0, dst: 0 },
            failure: { size: 0, src: 0, dst: 0 }
        };
    }
    /**
     * @param {string} src 
     * @param {string} dst 
     */
    static _onLinkPrintExecute (src, dst) {
        console.log(shellescape(['ln', '-f', '--', src, dst]));
        return true;
    }
    /**
     * @param {string} src 
     * @param {string} dst 
     */
    static _onLinkPrint (src, dst) {
        console.log(shellescape(['ln', '-f', '--', src, dst]));
        return false;
    }
    /**
     * @param {string} src 
     * @param {string} dst 
     */
    static _onLinkExecute (src, dst) {
        return true;
    }
    /**
     * @param {string} src 
     * @param {string} dst 
     */
    static _onLinkNoop (src, dst) {
        return false;
    }
    /**
     * @param {string} src 
     * @param {string} dst 
     */
    onLink (src, dst) {
        return false;
    }
    solveSync () {
        for (const dev of Object.keys(this.tree)) {
            for (const {size, src, dsts} of this.solutions(dev)) {
                this.stats.range.count += dsts.length + 1;
                this.stats.range.size += (dsts.length + 1) * size;
                let srcSuccess = false;
                let srcFailure = false;
                this.stats.target.src++;
                for (const dst of dsts) {
                    this.stats.target.dst++;
                    this.stats.target.size += size;
                    success: if (this.onLink(src, dst)) {
                        const mid = `${dst}.${crypto.randomBytes(4).toString('hex')}`;
                        try {
                            fs.renameSync(dst, mid);
                        } catch (err) {
                            if (this.onError(err, 'ln', src, dst)) return; else break success;
                        }
                        try {
                            fs.linkSync(src, dst);
                        } catch (err) {
                            let giveup = false;
                            try {
                                fs.renameSync(mid, dst);
                            } catch (err) {
                                giveup = this.onError(err, 'mv', mid, dst);
                            }
                            if (this.onError(err, 'ln', src, dst) || giveup) return; else break success;
                        }
                        try {
                            fs.unlinkSync(mid);
                        } catch (err) {
                            if (this.onError(err, 'rm', mid)) return;
                        }
                        // success
                        srcSuccess = true;
                        this.stats.success.dst++;
                        this.stats.success.size += size;
                    } else {
                        continue;
                    }
                    // failure
                    srcFailure = true;
                    this.stats.failure.dst++;
                    this.stats.failure.size += size;

                }
                if (srcSuccess) this.stats.success.src++;
                if (srcFailure) this.stats.failure.src++;
            }
        }
        if (!this.undone) return this.onDone();
    }
    /**
     * an error occurred
     * @param   {Error}           err 
     * @param   {"ln"|"mv"|"rm"}  cmd  fail operation in unix-command
     * @param   {string}          src 
     * @param   {string}          dst 
     * @returns {boolean} abort
     */
    onError (err, cmd, src, dst) {
        if (dst) {
            console.error(shellescape([cmd, '-f', '--', src, dst]) + ' #' + err);
        } else {
            console.error(shellescape([cmd, '-f', '--', src]) + ' #' + err);
        }
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


module.exports = Solver;
