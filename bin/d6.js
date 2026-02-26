'use strict';

const fs = require('fs');

/**
 * @typedef {Object} FileDescriptor
 * @property {string} path 文件路径
 * @property {Buffer} buffer 文件缓冲区
 * @property {fs.ReadStream} [stream] 文件读取流
 */

/**
 * 惰性差异比较树节点，用于比较多个文件的二进制差异
 */
class LazyDiffNode {
	/**
	 * 创建LazyDiffNode实例
	 * @param {FileDescriptor[]} files 文件描述符数组
	 * @param {number} [currentOffset=0] 当前比较的偏移量
	 * @param {number} [windowSize=4096] 滑动窗口大小(字节)
	 */
	constructor(files, currentOffset = 0, windowSize = 4096) {
		this.files = files;
		this.currentOffset = currentOffset;
		this.windowSize = windowSize;
		this.children = new Map();
		this.diffPosition = null;
	}

	/**
	 * 工厂方法创建LazyDiffNode实例
	 * @param {string[]} filePaths 要比较的文件路径数组
	 * @param {number} [windowSize=4096] 滑动窗口大小(字节)
	 * @returns {LazyDiffNode}
	 */
	static create(filePaths, windowSize = 4096) {
		const files = filePaths.map(path => ({
			path,
			buffer: Buffer.alloc(0)
		}));
		return new LazyDiffNode(files, 0, windowSize);
	}

	/**
	 * 开始比较过程
	 * @returns {Promise<void>}
	 */
	async startCompare() {
		if (this.files.length <= 1) return;

		await this._fillBuffers();
		return this._findAndSplit();
	}

	/**
	 * 填充所有文件的缓冲区
	 * @private
	 * @returns {Promise<void>}
	 */
	async _fillBuffers() {
		await Promise.all(this.files.map(file => this._fillSingleBuffer(file)));
	}

	/**
	 * 填充单个文件的缓冲区
	 * @private
	 * @param {FileDescriptor} file 文件描述符
	 * @returns {Promise<void>}
	 */
	async _fillSingleBuffer(file) {
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
	}

	/**
	 * 查找差异并分裂节点
	 * @private
	 * @returns {Promise<void>}
	 */
	async _findAndSplit() {
		const minLength = this._getMinBufferLength();
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

	/**
	 * 获取所有文件缓冲区的最小长度
	 * @private
	 * @returns {number} 最小缓冲区长度
	 */
	_getMinBufferLength() {
		let minLength = Infinity;
		for (const file of this.files) {
			if (file.buffer.length < minLength) {
				minLength = file.buffer.length;
			}
		}
		return minLength === Infinity ? 0 : minLength;
	}

	/**
	 * 创建子节点
	 * @private
	 * @param {Map<number, FileDescriptor[]>} byteGroups 字节分组映射
	 * @param {number} relativePos 相对于当前偏移的差异位置
	 * @returns {Promise<void>}
	 */
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

		this.files = [];
		await Promise.all(childPromises);
	}

	/**
	 * 处理文件结束情况
	 * @private
	 * @returns {void}
	 */
	_finalize() {
		if (this.files.length > 1) {
			console.log(`Files identical up to ${this.currentOffset} bytes`);
		}
	}

	/**
	 * 打印树形结构
	 * @param {string} [prefix=''] 前缀字符串
	 * @param {boolean} [isLast=true] 是否为最后一个子节点
	 * @returns {void}
	 */
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

	/**
	 * 关闭所有文件流
	 * @returns {Promise<void>}
	 */
	async close() {
		for (const file of this.files) {
			file.stream?.destroy();
		}
		await Promise.all([...this.children.values()].map(c => c.close()));
	}
}

// 测试
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