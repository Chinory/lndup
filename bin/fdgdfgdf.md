用Buffer.alloc(256): Buffer<byte_key, byte_val> 加上一个可扩容的Array<index, any> 实现 Map<byte_key, any> 。具体来说，当用 byte_key 查询时，由于 byte_val 初始值是0，则 index=(255-byte_val)=255，由于Array.length<256，就知道这个 byte_val=0 代表的是空值，于是可以Array.push()，然后设置设置byte_val=(255-index)=255，那么下次再查到这个byte_val时，就有index=(255-255)=0,找到了。可以说，在查询时，byte_val的非0取值个数等于Arr.len()，那么当!(Arr.len()<256)时，byte_val=0可以直接用来计算index=(255-0)=255找到对应容器。

key=0, index=(3-0)=3, arr.len=0, so index=0, arr.len=1, val=(3-0)=3
key=0, index=(3-0)=3, arr.len=1  so index=1, arr.len=2, val=(3-0)=3
key=0, index=(3-0)=3, arr.len=2
key=0, index=(3-0)=3, arr.len=3