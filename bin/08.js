'use strict';

const fs = require('fs');

/**
 * 文件描述符类型定义
 * @typedef {Object} FileDescriptor
 * @property {string} path 文件路径
 * @property {Buffer} buffer 文件缓冲区
 * @property {fs.promises.FileHandle} fd 文件句柄
 */

/**
 * 惰性差异比较节点类，用于比较多个文件的差异
 */
class LazyDiffNode {
	/**
	 * 构造函数
	 * @param {FileDescriptor[]} files 文件描述符数组
	 * @param {number} [currentOffset=0] 当前比较的偏移量
	 * @param {number} [windowSize=4096] 读取窗口大小
	 */
	constructor(files, currentOffset = 0, windowSize = 4096) {
		this.files = files;
		this.currentOffset = currentOffset;
		this.windowSize = windowSize;
		this.children = new Map();
		this.diffPosition = null;
	}

	/**
	 * 创建LazyDiffNode实例的工厂方法
	 * @param {string[]} filePaths 文件路径数组
	 * @param {number} [windowSize=4096] 读取窗口大小
	 * @returns {Promise<LazyDiffNode>} 新的LazyDiffNode实例
	 */
	static async create(filePaths, windowSize = 4096) {
		const files = [];
		for (const path of filePaths) {
			const fd = await fs.promises.open(path, 'r');
			files.push({ path, buffer: Buffer.alloc(0), fd });
		}
		return new LazyDiffNode(files, 0, windowSize);
	}

	/**
	 * 开始比较文件差异
	 * @returns {Promise<void>} 异步比较完成
	 */
	async startCompare() {
		while (this.files.length > 1) {
			await this._fillBuffers();
			const shouldContinue = await this._findAndSplit();
			if (!shouldContinue) break;
		}
	}

	/**
	 * 填充缓冲区数据
	 * @private
	 * @returns {Promise<void>} 异步填充完成
	 */
	async _fillBuffers() {
		const fillPromises = this.files.map(async (file) => {
			if (file.buffer.length >= this.windowSize) return;

			const bytesToRead = this.windowSize - file.buffer.length;
			const start = this.currentOffset + file.buffer.length;
			const buffer = Buffer.allocUnsafe(bytesToRead);
      
			const { bytesRead } = await file.fd.read(buffer, 0, bytesToRead, start);
Buffer.poolSize
			if (bytesRead > 0) {
				file.buffer = Buffer.concat([file.buffer, buffer.subarray(0, bytesRead)]);
			}
		});

		await Promise.all(fillPromises);
	}

	/**
	 * 查找差异并分割节点
	 * @private
	 * @returns {Promise<boolean>} 是否继续比较
	 */
	async _findAndSplit() {
		const minLength = Math.min(...this.files.map(f => f.buffer.length));
		if (minLength === 0) {
			this._finalize();
			return false;
		}

		for (let pos = 0; pos < minLength; pos++) {
			const byteToFilesMap = new Map();
			for (const file of this.files) {
				const byte = file.buffer[pos];
				const group = byteToFilesMap.get(byte) || [];
				group.push(file);
				byteToFilesMap.set(byte, group);
			}

			if (byteToFilesMap.size > 1) {
				this.diffPosition = this.currentOffset + pos;
				await this._createChildren(byteToFilesMap, pos);
				return false;
			}
		}

		this.currentOffset += minLength;
		this.files.forEach(file => {
			file.buffer = file.buffer.subarray(minLength);
		});
		return true;
	}

	/**
	 * 创建子节点
	 * @private
	 * @param {Map<number, FileDescriptor[]>} byteToFilesMap 按字节分组的文件描述符
	 * @param {number} relativePosition 相对位置
	 * @returns {Promise<void>} 异步创建完成
	 */
	async _createChildren(byteToFilesMap, relativePosition) {
		const childPromises = [];
		for (const [byte, files] of byteToFilesMap) {
			files.forEach(file => {
				file.buffer = file.buffer.subarray(relativePosition + 1);
			});

			const child = new LazyDiffNode(
				files,
				this.currentOffset + relativePosition + 1,
				this.windowSize
			);
			this.children.set(byte, child);
			childPromises.push(child.startCompare());
		}

		this.files = []; // 清空父节点文件
		await Promise.all(childPromises);
	}

	/**
	 * 结束比较处理
	 * @private
	 */
	_finalize() {
		if (this.files.length > 1) {
			console.log(`Files identical up to ${this.currentOffset} bytes`);
		}
	}

	/**
	 * 打印比较树
	 * @param {string} [prefix=''] 前缀字符串
	 * @param {boolean} [isLast=true] 是否是最后一个节点
	 */
	printTree(prefix = '', isLast = true) {
		console.log(`${prefix}${isLast ? '└─ ' : '├─ '}@${this.currentOffset}: [${
			this.files.map(f => `${f.path.split('/').pop()}(${f.buffer.length}b)`).join(', ')
		}]${this.diffPosition !== null ? ` (diff @${this.diffPosition})` : ''}`);

		const entries = [...this.children.entries()].sort((a, b) => a[0] - b[0]);
		entries.forEach(([byte, child], index) => {
			const isLastChild = index === entries.length - 1;
			console.log(`${prefix}${isLast ? '	' : '│   '}Byte 0x${byte.toString(16)}:`);
			child.printTree(`${prefix}${isLast ? '	' : '│   '}`, isLastChild);
		});
	}

	/**
	 * 关闭所有文件句柄
	 * @returns {Promise<void>} 异步关闭完成
	 */
	async close() {
		await Promise.all(this.files.map(file => file.fd.close()));
		await Promise.all([...this.children.values()].map(child => child.close()));
	}
}

/**
 * 测试函数
 */
async function test() {
	try {
		const files = ['file1.bin', 'file2.bin', 'file3.bin', 'file4.bin'];
		await Promise.all([
			fs.promises.writeFile(files[0], Buffer.alloc(1024, 0x01)),
			fs.promises.writeFile(files[1], Buffer.concat([Buffer.alloc(512, 0x01), Buffer.alloc(512, 0x02)])),
			fs.promises.writeFile(files[2], Buffer.concat([Buffer.alloc(256, 0x01), Buffer.alloc(768, 0x03)])),
      fs.promises.writeFile(files[3], Buffer.concat([Buffer.alloc(256, 0x01), Buffer.alloc(769, 0x03)]))
		]);

		const root = await LazyDiffNode.create(files, 1024);
		try {
			await root.startCompare();
			console.log('\nComparison result:');
			root.printTree();
		} finally {
			await root.close();
		}
	} catch (err) {
		console.error(err);
	}
}

test();