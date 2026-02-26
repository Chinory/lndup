/** @template T */
class ByteMap {
	constructor() {
		this.I = Buffer.allocUnsafe(256).fill(255);
		/** @type {T[]} */
		this.V = []; // 此结构自然地使原随机访问顺序变成了顺序访问
	}
	clear() { this.I.fill(255); this.V = []; }
	size() { return this.V.length; }
	/** @param {number} k */
	get(k) { return this.V[this.I[k]]; }
	/** @param {number} k */
	has(k) { return this.I[k]<this.V.length; }
	/** @param {number} k @param {T} v */
	set(k, v) {
		const i = this.I[k], n = this.V.length;
		if (i < 255 || n > 255) this.V[i] = v;
    else { this.I[k] = n; this.V.push(v); } 
	}
}

// 使用示例
const map = new ByteMap();
// map.set(65, 'A'); // 65 是 'A' 的 ASCII 码
// map.set(66, 'B');
// map.set(97, 'a');

// console.log(map.get(65)); // 输出: 'A'
// console.log(map.has(66)); // 输出: true
// console.log(map.size); // 输出: 3

// for (const [key, value] of map) {
// 	console.log(key, value); // 输出: 65 'A'，66 'B'，97 'a'
// }

for (let i = 0; i < 240; i += 20) {
	map.set(i, i + 255);
}
// for (let i = 0; i < 256; ++i) {
// 	map.set(i, 255 - i);
// }
console(map);