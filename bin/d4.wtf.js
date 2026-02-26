'use strict';

const fs = require('fs');

/**
 * @typedef {Object} FileDescriptor
 * @property {string} path 文件路径
 * @property {Buffer} buffer 文件缓冲区
 * @property {fs.ReadStream|null} [stream] 文件读取流
 * @property {boolean} [ended] 标识流是否已结束
 * @property {number} [streamPosition] 流当前读取位置
 */

/**
 * 惰性差异比较树节点，用于比较多个文件的二进制差异
 */
class LazyDiffNode {
	/**
	 * 创建LazyDiffNode实例
	 * @param {FileDescriptor[]} files 文件描述符数组（所有权属于该节点）
	 * @param {number} currentOffset 当前比较的偏移量
	 * @param {number} windowSize 滑动窗口大小(字节)
	 */
	constructor(files, currentOffset = 0, windowSize = 4096) {
		this._files = files; // 使用私有变量明确所有权
		this.currentOffset = currentOffset;
		this.windowSize = windowSize;
		this.children = new Map();
		this.diffPosition = null;
		this._isClosed = false;
	}

	/**
	 * 获取文件列表（只读）
	 */
	get files() {
		return this._files;
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
			buffer: Buffer.alloc(0),
			stream: null,
			ended: false,
			streamPosition: 0
		}));
		return new LazyDiffNode(files, 0, windowSize);
	}

	/**
	 * 开始比较过程
	 * @returns {Promise<void>}
	 */
	async startCompare() {
		if (this._isClosed) throw new Error('Instance already closed');
		if (this._files.length <= 1) return;

		try {
			await this._fillBuffers();
			await this._findAndSplit();
		} catch (err) {
			await this.close();
			throw err;
		}
	}

	/**
	 * 填充所有文件的缓冲区
	 * @private
	 * @returns {Promise<void>}
	 */
	async _fillBuffers() {
		const fillPromises = this._files.map(async file => {
			if (file.ended || file.buffer.length >= this.windowSize) return;

			if (!file.stream) {
				file.stream = this._createFileStream(file);
				file.streamPosition = this.currentOffset + file.buffer.length;
			}

			try {
				for await (const chunk of file.stream) {
					file.buffer = Buffer.concat([file.buffer, chunk]);
					file.streamPosition += chunk.length;
					if (file.buffer.length >= this.windowSize) break;
				}
			} catch (err) {
				this._destroyStream(file);
				throw err;
			}

			// 检测流是否自然结束
			if (file.buffer.length < this.windowSize) {
				file.ended = true;
				this._destroyStream(file);
			}
		});

		await Promise.all(fillPromises);
	}

	/**
	 * 创建文件读取流
	 * @private
	 */
	_createFileStream(file) {
		const stream = fs.createReadStream(file.path, {
			start: this.currentOffset + file.buffer.length,
			highWaterMark: Math.min(
				this.windowSize - file.buffer.length,
				64 * 1024 // 最大64KB防止内存过大
			)
		});
		return stream;
	}

	/**
	 * 销毁文件流
	 * @private
	 */
	_destroyStream(file) {
		if (file.stream) {
			file.stream.destroy();
			file.stream = null;
		}
	}

	/**
	 * 查找差异并分裂节点
	 * @private
	 * @returns {Promise<void>}
	 */
	async _findAndSplit() {
		const minBufferLength = Math.min(...this._files.map(f => f.buffer.length));
		const allEnded = this._files.every(f => f.ended);

		if (minBufferLength === 0 || allEnded) {
			return this._finalize();
		}

		for (let pos = 0; pos < minBufferLength; pos++) {
			const byteGroups = new Map();

			for (const file of this._files) {
				const byte = file.buffer[pos];
				if (!byteGroups.has(byte)) {
					byteGroups.set(byte, []);
				}
				byteGroups.get(byte).push(file);
			}

			if (byteGroups.size > 1) {
				this.diffPosition = this.currentOffset + pos;
				return this._createChildren(byteGroups, pos);
			}
		}

		// 移动窗口
		this.currentOffset += minBufferLength;
		this._files.forEach(file => {
			file.buffer = file.buffer.subarray(minBufferLength);
		});

		return this.startCompare();
	}

	/**
	 * 创建子节点（完全移交文件所有权）
	 * @private
	 */
	async _createChildren(byteGroups, relativePos) {
		const childPromises = [];

		// 清空父节点文件引用
		this._files = [];

		for (const [byte, files] of byteGroups) {
			// 准备移交的文件描述符
			const transferredFiles = files.map(file => {
				// 创建新的文件描述符副本，确保所有权转移
				const newFile = {
					...file,
					buffer: file.buffer.subarray(relativePos + 1),
					// 保持流引用（如果有）
					stream: file.stream,
					ended: file.ended,
					streamPosition: file.streamPosition
				};

				// 原文件引用置空
				file.stream = null;
				file.buffer = Buffer.alloc(0);
				return newFile;
			});

			const child = new LazyDiffNode(
				transferredFiles,
				this.currentOffset + relativePos + 1,
				this.windowSize
			);

			this.children.set(byte, child);
			childPromises.push(child.startCompare());
		}

		await Promise.all(childPromises);
	}

	/**
	 * 处理文件结束情况
	 * @private
	 */
	_finalize() {
		const fileLengths = this._files.map(f => this.currentOffset + f.buffer.length);
		const minLength = Math.min(...fileLengths);
		const maxLength = Math.max(...fileLengths);

		if (minLength !== maxLength) {
			this.diffPosition = minLength;
			console.log(`Files differ at offset ${minLength} (file length mismatch)`);
		} else if (this._files.length > 1) {
			console.log(`Files identical up to ${minLength} bytes`);
		}
	}

	/**
	 * 打印树形结构
	 */
	printTree(prefix = '', isLast = true) {
		const status = this.diffPosition !== null 
			? `Diff @${this.diffPosition}`
			: `Offset ${this.currentOffset}`;

		const fileList = this._files.length > 0 
			? `[${this._files.map(f => `${f.path.split('/').pop()}(${f.buffer.length}b)`).join(', ')}]`
			: '[files transferred to children]';

		console.log(`${prefix}${isLast ? '└─ ' : '├─ '}${status} ${fileList}`);

		const entries = Array.from(this.children.entries())
			.sort((a, b) => a[0] - b[0]);

		entries.forEach(([byte, child], index) => {
			const isLastChild = index === entries.length - 1;
			console.log(`${prefix}${isLast ? '	' : '│   '}Byte 0x${byte.toString(16)}:`);
			child.printTree(`${prefix}${isLast ? '	' : '│   '}`, isLastChild);
		});
	}

	/**
	 * 关闭所有文件流
	 * @returns {Promise<void>}
	 */
	async close() {
		if (this._isClosed) return;
		this._isClosed = true;

		// 关闭子节点
		await Promise.all(
			Array.from(this.children.values()).map(child => child.close())
		);

		// 关闭当前节点的流
		this._files.forEach(file => {
			this._destroyStream(file);
		});
		this._files = [];
	}
}