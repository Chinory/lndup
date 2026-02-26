class ByteMap {
	constructor() {
		this.I = Buffer.allocUnsafe(256).fill(255);
		this.V = [];
	}
	set(k, v) {
		const i = this.I[k], 
      n = this.V.length;
		if (i<255||n>255) {
      this.V[i] = v;
    } else {
      this.I[k] = n;
      this.V.push(v);
    }
		// const i = this.I[k];
		// if (i === 255 && this.V.length < 256) {
    //   this.I[k] = this.V.length;
    //   this.V.push(v);
    // } else {
    //   this.V[i] = v;
    // }
	}


	get(key) {
		return this.V[this.I[key]];
	}

	has(key) {
		return this.I[key] < this.V.length;
	}

	delete(key) {
		if (typeof key !== 'number' || key < 0 || key > 255 || !this.has(key)) {
			return false;
		}

		const index = this.I[key];
		// 简单实现：标记为删除，不实际从数组中移除
		this.I[key] = 255;
		this.V[index] = undefined; // 标记为删除
		this.V.length--;
		return true;
	}

	clear() {
		this.I.fill(255);
		this.V = [];
		this.V.length = 0;
	}

	getSize() {
		return this.V.length;
	}

	// 可选：实现迭代器
	*[Symbol.iterator]() {
		for (let i = 0; i < 256; i++) {
			if (this.I[i] !== 255) {
				yield [i, this.V[this.I[i]]];
			}
		}
	}
}

// 使用示例
const map = new ByteMap();
map.set(65, 'A'); // 65 是 'A' 的 ASCII 码
map.set(66, 'B');
map.set(97, 'a');

console.log(map.get(65)); // 输出: 'A'
console.log(map.has(66)); // 输出: true
console.log(map.getSize()); // 输出: 3

for (const [key, value] of map) {
	console.log(key, value); // 输出: 65 'A'，66 'B'，97 'a'
}