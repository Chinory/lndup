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
    i(k) {var s = 0, e = this.k.length, m; while (s < e) m = (s + e) >> 1, k > this.k[m] ? s = m + 1: e = m; return s;}
    add(i, k, v) {this.k.splice(i, 0, k); this.v.splice(i, 0, v); return i;}
    del(i) {this.k.splice(i, 1); return this.v.splice(i, 1);}
    loc(k, v) {const i = this.i(k); return k===this.k[i]?i:this.add(i, k, v);}
    loc_smap(k) {const i = this.i(k); return k===this.k[i]?i:this.add(i, k, new SMap());}
    loc_array(k) {const i = this.i(k); return k===this.k[i]?i:this.add(i, k, []);}
}
