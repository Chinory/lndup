# lndup

Tiny Node.js program to hardlink duplicate files optimally.

- Use async I/O for the best performance
- One file one stat system call, making only needed files to hash
- Multi-process hash with small file optimization

## Usage

```shell
$ lndup [PATH] [PATH] [PATH]...
```

- `PATH` can be not only a directory, but also a file.


- It does not follow symbolic links.


- All outputs are executable unix-shell code, using comment to carry extra information.

### Output

```shell
#Stat: 1-probe: Readdir:   29351  20.96MiB
#Stat: 1-probe: Stat:     267937  8.851GiB
#Stat: 1-probe: Select:   197240  8.851GiB
#Profile: Time: 1-probe: 3616.733ms
#Stat: 2-verify: Hash-Int:  287.63MiB  14.80%  145224  80.83%   2.0KiB   1.00x
#Stat: 2-verify: Hash-Ext:   1.617GiB  85.20%   34438  19.17%  49.2KiB  24.28x
#Profile: Time: 2-verify: 39884.123ms
#Profile: Time: 3-solve: 90.670ms
#Profile: Time: scheme: 43591.887ms
#Profile: Time: execute: 9.931ms
#Profile: Memory: rss: 243.33MiB
#Profile: Memory: heapTotal: 165.09MiB
#Profile: Memory: heapUsed: 120.41MiB
#Profile: Memory: external: 27.1KiB
#Result: TODO:  222.46MiB  233269209  20830  29523
#Result: DONE:         0B          0      0      0
#Result: FAIL:         0B          0      0      0
```

| hashed:                          | data        | %        | files    | %        | average file size | x        |
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

made of nested maps

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

execute that solution, run or dry-run

## License

- GPL v3.0
