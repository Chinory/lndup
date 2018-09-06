const Tree       = require('./models/tree');
const Probe      = require('./controllers/probe');
const Validator  = require('./controllers/validator');
const Solver     = require('./controllers/solver');

class Suite {
    constructor (tree = new Tree()) {
        this.tree = tree;
        this._probe = new Probe(tree);
        this._validator = new Validator(tree);
        this._probe.onDone = () => this._validator.validate();
    }
    probe (path) {
        this._probe.probe(path);
        return this;
    }
    validate () {
        this._probe.close();
        return this;
    }
    /**
     * @param {{}} options 
     * @param {boolean} options.quiet  print operation before do
     * @param {boolean} options.dryrun dry-run
     */
    solveSync (options) {
        const solver = new Solver(this.tree, options);
        solver.solveSync();
        return this;
    }
}

module.exports = {
    Tree,
    Probe,
    Validator,
    Solver,
    Suite
};