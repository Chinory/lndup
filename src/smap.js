#!/usr/bin/env node
// smap.js: lndup's sorted map
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

/*lndup smap.js GPL-3.0 <https://github.com/chinory/lndup>*/


class SMap {
    constructor () { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    i(k) {
        var s = 0, m, e = this.k.length; 
        while (s < e) {
            m = s + e >> 1;
            k > this.k[m] ? s = m + 1: e = m; 
        }
        return s;
    }
    add(i, k, v) {
        this.k.splice(i, 0, k); 
        this.v.splice(i, 0, v); 
    }
    del(i) {
        this.k.splice(i, 1); 
        this.v.splice(i, 1);
    }
    delete(k) {
        var i = this.i(k); 
        if (k === this.k[i]) {
            this.del(i);
            return true;
        } else {
            return false;
        }
    }
    set(k, v) { 
        var i = this.i(k); 
        if (k === this.k[i]) {
            this.v[i] = v;
        } else {
            this.add(i, k, v);
        }
        return this;
    }
    get(k) { 
        var i = this.i(k); 
        return k === this.k[i] ? this.v[i] : undefined; 
    }
    get_smap(k) {
        var v, i = this.i(k); 
        if (k === this.k[i]) {
            v = this.v[i];
        } else {
            v = new SMap();
            this.add(i, k, v);
        }
        return v;
    }
    get_array(k) { var i = this.i(k); 
        var v, i = this.i(k); 
        if (k === this.k[i]) {
            v = this.v[i];
        } else {
            v = [];
            this.add(i, k, v);
        }
        return v;
    }
}

// class SAMap extends Array {  // Sorted Map includes Array 
//     constructor () { super(arguments); }
//     search(k) {
//         var s = 0, m, e = this.length; 
//         while (s < e) {
//             m = s + e >> 1;
//             k > this.k[m][0] ? s = m + 1: e = m; 
//         }
//         return s;
//     }
//     set(k, a) { 
//         var i = this.search(k); 
//         if (k === this.k[i][0]) {
//             this[i] = a;
//         } else {
//             this.splice(i, 0, a); 
//         }
//         return this;
//     }
//     get(k) { 
//         var i = this.search(k); 
//         return k === this[i][0] ? this[i] : undefined; 
//     }
//     delete(k) {
//         var i = this.search(k); 
//         if (k === this.k[i][0]) {
//             this.splice(i, 1); 
//             return true;
//         } else {
//             return false;
//         }
//     }
// }

class skvArray extends Array {  // Sorted kv pairs
    constructor() {super(arguments)}
    search(k) {
        var s = 0, m, e = this.length; 
        while (s < e) {
            m = s + e >> 1;
            k > this[m].k ? s = m + 1: e = m; 
        }
        return s;
    }
    set(k, v) { 
        var i = this.search(k); 
        if (k === this[i].k) {
            this[i].v = v;
        } else {
            this.splice(i, 0, {k:k,v:v}); 
        }
        return this;
    }
    get(k) { 
        var i = this.search(k); 
        return k === this[i].k ? this[i].v : undefined; 
    }
    delete(k) {
        var i = this.search(k); 
        if (k === this[i].k) {
            this.splice(i, 1); 
            return true;
        } else {
            return false;
        }
    }
}
