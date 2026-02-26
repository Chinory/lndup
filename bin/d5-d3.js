'use strict';

const fs = require('fs');

/**
 * @typedef {Object} FileDescriptor
 * @property {string} path 文件路径
 * @property {Buffer} buffer 文件缓冲区
 * @property {fs.ReadStream} [stream] 文件读取流
 */

class LazyDiffNode {
	constructor(files, currentOffset = 0, windowSize = 4096) {
		this.files = files;
		this.currentOffset = currentOffset;
		this.windowSize = windowSize;
		this.children = new Map();
		this.diffPosition = null;
	}

	static create(filePaths, windowSize = 4096) {
		const files = filePaths.map(path => ({
			path,
			buffer: Buffer.alloc(0)
		}));
		return new LazyDiffNode(files, 0, windowSize);
	}

	async startCompare() {
		if (this.files.length <= 1) return;

		await this._fillBuffers();
		return this._findAndSplit();
	}

	async _fillBuffers() {
		const fillPromises = this.files.map(async file => {
			if (file.buffer.length >= this.windowSize) return;

			if (!file.stream) {
				file.stream = fs.createReadStream(file.path, {
					start: this.currentOffset + file.buffer.length,
					highWaterMark: this.windowSize - file.buffer.length
				});
			}

			for await (const chunk of file.stream) {
				file.buffer = Buffer.concat([file.buffer, chunk]);
				if (file.buffer.length >= this.windowSize) break;
			}
		});

		await Promise.all(fillPromises);
	}

	async _findAndSplit() {
		const minLength = Math.min(...this.files.map(f => f.buffer.length));
		if (minLength === 0) return this._finalize();

		for (let pos = 0; pos < minLength; pos++) {
			const byteGroups = new Map();
			
			for (const file of this.files) {
				const byte = file.buffer[pos];
				let group = byteGroups.get(byte);
				if (!group) {
					group = [];
					byteGroups.set(byte, group);
				}
				group.push(file);
			}

			if (byteGroups.size > 1) {
				this.diffPosition = this.currentOffset + pos;
				return this._createChildren(byteGroups, pos);
			}
		}

		this.currentOffset += minLength;
		for (const file of this.files) {
			file.buffer = file.buffer.subarray(minLength);
		}
		return this.startCompare();
	}

	async _createChildren(byteGroups, relativePos) {
		const childPromises = [];
		
		for (const [byte, files] of byteGroups) {
			for (const file of files) {
				file.buffer = file.buffer.subarray(relativePos + 1);
			}

			const child = new LazyDiffNode(
				files,
				this.currentOffset + relativePos + 1,
				this.windowSize
			);
			this.children.set(byte, child);
			childPromises.push(child.startCompare());
		}

		// 关键修改：父节点移交文件描述符后清空自身files
		this.files = [];
		await Promise.all(childPromises);
	}

	_finalize() {
		if (this.files.length > 1) {
			console.log(`Files identical up to ${this.currentOffset} bytes`);
		}
	}

	printTree(prefix = '', isLast = true) {
		console.log(`${prefix}${isLast ? '└─ ' : '├─ '}@${this.currentOffset}: [${
			this.files.map(f => `${f.path.split('/').pop()}(${f.buffer.length}b)`).join(', ')
		}]${this.diffPosition !== null ? ` (diff @${this.diffPosition})` : ''}`);

		const entries = [...this.children.entries()].sort((a, b) => a[0] - b[0]);
		for (let i = 0; i < entries.length; i++) {
			const [byte, child] = entries[i];
			console.log(`${prefix}${isLast ? '   ' : '│  '}Byte 0x${byte.toString(16)}:`);
			child.printTree(`${prefix}${isLast ? '	' : '│   '}`, i === entries.length - 1);
		}
	}

	async close() {
		for (const file of this.files) {
			file.stream?.destroy();
		}
		await Promise.all([...this.children.values()].map(c => c.close()));
	}
}

// 测试用例保持不变
function test() {
	const files = ['file1.bin', 'file2.bin', 'file3.bin'];
	Promise.all([
		fs.promises.writeFile(files[0], Buffer.alloc(1024, 0x01)),
		fs.promises.writeFile(files[1], Buffer.from([...Buffer.alloc(512, 0x01), ...Buffer.alloc(512, 0x02)])),
		fs.promises.writeFile(files[2], Buffer.from([...Buffer.alloc(256, 0x01), ...Buffer.alloc(768, 0x03)]))
	])
	.then(() => LazyDiffNode.create(files, 1024))
	.then(root => {
		return root.startCompare()
			.then(() => {
				console.log('\nComparison result:');
				root.printTree();
			})
			.finally(() => root.close());
	})
	.catch(console.error);
}

test();