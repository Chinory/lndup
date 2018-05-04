# lndup

Tiny Node.js program to hardlink duplicate files optimally.

- Use async I/O for the best performance
- One file one stat system call, making only needed files to hash
- Multi-process hash with small file optimization

## Usage

```shell
$ lndup --help
Usage: lndup [OPTION]... PATH...
Hardlink duplicate files.

  -n, --dry-run  don't link
  -v, --verbose  explain what is being done
  -q, --quiet    don't output extra information
      --help     display this help and exit
      --version  output version information and exit
      --hasher   start as a hash work process

See <https://github.com/chinory/lndup>
```

- `PATH` can be not only a directory, but also a file.


- This program does not follow symbolic links.


### Output

- All outputs are executable unix-shell code, using comment to carry extra information.

```shell
$ lndup -v test/ 
#Stat: 1-probe: Readdir:   3       242B
#Stat: 1-probe: Stat:     21  144.02MiB
#Stat: 1-probe: Select:   17  144.02MiB
#Profile: Time: 1-probe: 7.562ms
#Stat: 2-verify: Hash-Int:         0B    0.00%  0    0.00%       NaN  NaNx
#Stat: 2-verify: Hash-Ext:  144.00MiB  100.00%  9  100.00%  16.00MiB  NaNx
#Profile: Time: 2-verify: 166.890ms
#Profile: Time: 3-solve: 0.394ms
#Profile: Time: scheme: 175.183ms
ln -f -- 'test/b' 'test/a'
ln -f -- 'test/b' 'test/c'
ln -f -- 'test/ran1_1' 'test/ran1_2'
ln -f -- 'test/root/ran4_1' 'test/root/ran4_2'
ln -f -- 'test/root/ran4_1' 'test/root/ran4_2' #Error: EACCES: permission denied, rename 'test/root/ran4_2' -> 'test/root/ran4_2.5ad852766ce2d5d3'
#Profile: Time: execute: 7.152ms
#Profile: Memory: rss: 32.38MiB
#Profile: Memory: heapTotal: 10.33MiB
#Profile: Memory: heapUsed: 5.67MiB
#Profile: Memory: external: 16.6KiB
#Result: TODO:  64.00MiB  67108864  3  4
#Result: DONE:  48.00MiB  50331648  2  3
#Result: FAIL:  16.00MiB  16777216  1  1
```

Notice that the `ran4_1` appeared twice, the first one is in **stdout**, the second one is in **stderr**.

- Plenty of information provided by default. You can use `-q, --quiet` to disable it.

```shell
$ sudo lndup -n /usr
#Stat: 1-probe: Readdir:   16235  14.81MiB
#Stat: 1-probe: Stat:     295368  8.163GiB
#Stat: 1-probe: Select:   252786  8.163GiB
#Profile: Time: 1-probe: 2345.568ms
#Stat: 2-verify: Hash-Int:  383.35MiB  23.66%  186581  82.27%   2.1KiB   1.00x
#Stat: 2-verify: Hash-Ext:   1.208GiB  76.34%   40204  17.73%  31.5KiB  14.98x
#Profile: Time: 2-verify: 2906.962ms
#Profile: Time: 3-solve: 88.435ms
#Profile: Time: scheme: 5341.290ms
#Profile: Time: execute: 10.915ms
#Profile: Memory: rss: 288.58MiB
#Profile: Memory: heapTotal: 200.59MiB
#Profile: Memory: heapUsed: 135.77MiB
#Profile: Memory: external: 49.1KiB
#Result: TODO:  235.19MiB  246617152  19824  33488
#Result: DONE:         0B          0      0      0
#Result: FAIL:         0B          0      0      0
```

|                                  | data        | % (CPU)  | files    | % (I/O)  | average file size | x        |
| -------------------------------- | ----------- | -------- | -------- | -------- | ----------------- | -------- |
| `#Stat:` `2-verify:` `Hash-Int:` | `287.63MiB` | `14.80%` | `145224` | `80.83%` | `2.0KiB`          | `1.00x`  |
| `#Stat:` `2-verify:` `Hash-Ext:` | `1.617GiB`  | `85.20%` | `34438`  | `19.17%` | `49.2KiB`         | `24.28x` |

|                    | Freed Space | Freed Space in Bytes | Link Sources | Link Destinations |
| ------------------ | ----------- | -------------------- | ------------ | ----------------- |
| `#Result:` `TODO:` | `222.46MiB` | `233269209`          | `20830`      | `29523`           |

### Use Safely

`stderr` outputs failed operations with format `ln -f -- 'src' 'dst' #Error:...`  . For  `ln` outputs, you can choose whether to execute without losing data. But beware of `mv` `rm` outputs, they are remedies of failed `ln` operations, **you must ensure them to be done**.

Fortunately, remedies **rarely** fail, as they are all counter-operations of just-successful operations.

## Requirement

- Node.js 9+

## Tested

- Linux 4.14: ext4, ntfs-3g
- Windows 10: NTFS

## Performance

See [releases](https://github.com/chinory/lndup/releases)

## Introduction

made of nested maps:

```
by_size = by_dev[stat.dev]
by_content = by_size[stat.size]
by_ino = by_content[hash]
paths = by_ino[ino] 
```

### probe

fully asynchronous recursive travel

I want to detect "Inline Storage" files, which is so small that it's content was storaged in Metadata. It seems can't always successfully make hardlinks from these files. Theoretically it can be detected by `stat.blocks==0 && stat.size>0` , but on Windows, the `stat.blocks` is always `undefined` . So I don't know how to do.

### verify

multi-process hash, hash small files in master process synchronously

### solve

instruct to hardlink files whose inode is majority to others.

### execute

execute that solution

## License

- GPL v3.0
