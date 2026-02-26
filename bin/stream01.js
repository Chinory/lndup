const { Transform } = require('stream');

class ClassificationNode {
  constructor(parent = null, position = 0) {
    this.parent = parent;
    this.position = position;
    this.child = {};
    this.streams = [];
    this.activeStreams = 0;
    this.done = false;
  }

  addStream(stream) {
    this.streams.push(stream);
    this.activeStreams++;
  }

  process() {
    if (this.streams.length === 1) {
      // 只有一个流，停止处理
      this.done = true;
      this.emit('done');
      return;
    }

    const buffers = {};
    const positions = {};
    let completed = 0;

    // 为每个流创建转换流来读取字节
    this.streams.forEach((stream, index) => {
      const processor = new Transform({
        transform(chunk, encoding, callback) {
          if (this._node.done) return callback();

          const byte = chunk[0];
          if (this._position === undefined) {
            this._position = this._node.position;
            this._buffer = [];
          }

          this._buffer.push(byte);
          this._position++;

          // 检查是否所有流都读取了足够的字节
          if (this._position === this._node.position + 1) {
            this._node.checkDiff(this._buffer[0], this);
          }

          callback();
        },
        flush(callback) {
          this._node.streamComplete(this);
          callback();
        }
      });

      processor._node = this;
      processor._index = index;

      // 存储处理器以便后续使用
      this._processors = this._processors || [];
      this._processors.push(processor);

      // 管道流到处理器
      stream.pipe(processor);
    });
  }

  checkDiff(byte, processor) {
    if (this.done) return;

    if (!this._bytes) {
      this._bytes = new Map();
    }

    this._bytes.set(processor, byte);

    // 检查是否所有流都读取了这个位置的字节
    if (this._bytes.size === this.streams.length) {
      const uniqueBytes = new Set(this._bytes.values());

      if (uniqueBytes.size === 1) {
        // 所有字节相同，继续读取下一个位置
        this.position++;
        this._bytes.clear();
      } else {
        // 发现差异，创建子节点
        this.split();
      }
    }
  }

  split() {
    // 根据不同的字节值创建子节点
    const byteGroups = new Map();

    for (const [processor, byte] of this._bytes) {
      if (!byteGroups.has(byte)) {
        byteGroups.set(byte, []);
      }
      byteGroups.get(byte).push(processor);
    }

    // 创建子节点并分配流
    byteGroups.forEach((processors, byte) => {
      const childNode = new ClassificationNode(this, this.position + 1);
      this.child[byte] = childNode;

      processors.forEach(processor => {
        const originalStream = this.streams[processor._index];
        childNode.addStream(originalStream);
      });

      // 开始处理子节点
      childNode.process();
    });

    // 标记当前节点为完成
    this.done = true;
    this.streams = []; // 清空流引用，子节点现在管理它们
    this.emit('done');
  }

  streamComplete(processor) {
    this.activeStreams--;
    if (this.activeStreams === 0) {
      this.emit('done');
    }
  }

  on(event, listener) {
    this._events = this._events || {};
    this._events[event] = listener;
  }

  emit(event) {
    if (this._events && this._events[event]) {
      this._events[event]();
    }
    if (this.parent) {
      this.parent.emit(event);
    }
  }
}

class ClassificationTree {
  constructor(streams) {
    this.root = new ClassificationNode();
    this.completed = false;
    this.streams = streams;

    // 检查所有流长度是否相同
    // 实际应用中可能需要更完善的检查
  }

  start() {
    return new Promise((resolve) => {
      // 将所有流添加到根节点
      this.streams.forEach(stream => {
        this.root.addStream(stream);
      });

      this.root.on('done', () => {
        if (!this.completed) {
          this.completed = true;
          resolve(this.root);
        }
      });

      // 开始处理
      this.root.process();
    });
  }
}

// 使用示例
async function main() {
  // 创建几个测试流（长度相同）
  const { PassThrough } = require('stream');
  
  const stream1 = new PassThrough();
  const stream2 = new PassThrough();
  const stream3 = new PassThrough();
  
  // 写入一些数据
  stream1.write(Buffer.from([0x01, 0x02, 0x03, 0x04]));
  stream2.write(Buffer.from([0x01, 0x02, 0x05, 0x06]));
  stream3.write(Buffer.from([0x01, 0x07, 0x08, 0x09]));
  
  stream1.end();
  stream2.end();
  stream3.end();

  // 创建分类树
  const tree = new ClassificationTree([stream1, stream2, stream3]);
  
  // 开始分类
  const root = await tree.start();
  
  // 打印结果
  console.log(JSON.stringify(root, (key, value) => {
    if (key === 'parent' || key === 'streams' || key === '_processors' || key === '_events') {
      return undefined; // 排除循环引用和大数据字段
    }
    return value;
  }, 2));
}

main().catch(console.error);