# lndup

Tiny program to hardlink duplicate files optimally

- Asynchronous I/O
- One file one stat() system call
- Hash least files, multi-process hashing with small file acceleration
- ~~Fill your memory~~

## Usuage

```shell
$ lndup [PATH] [PATH] [PATH]...
```

- The `PATH` can be not only a directory, but also a file.


- The program don't follow symbolic links.


- All output is executable unix-shell code, using comment to carry extra information.

### Output

A summary will be output to `stdout` after finished, like this:

```
#Done:  TODO  235.17MiB  246596728  19811  33439
#Done:  SUCC  235.17MiB  246596728  19811  33439
#Done:  FAIL         0B          0      0      0
```

Columns: Prefix, Action, Freed Space, Freed Space(Bytes), Count of Link Sources, Count of Link Destinations

### Use Safely

`stderr` outputs failed operations with format `ln -f -- 'src' 'dst' #Error:...`  . For  `ln` outputs, you can choose whether to execute without losing data. But beware of `mv` `rm` outputs, they are remedies of failed `ln` operations, **you must ensure them to be done**.

Fortunately, remedies rarely fail, as they are all counter-operations of just-successful operations.

## Requirement

- Node.js 9+

## Tested

- Linux 4.14: ext4, ntfs-3g
- Windows 10: NTFS

## Performance

#### Hardware

- Disk: SSD,
- CPU: 8x Intel CPU @ 2.60GHz
- Memory: 16G

#### Result/Output

```shell
$ sudo ./lndup.dry /usr /etc /var /boot /home /opt /root /media/linux1/ /media/linux2/ /media/win10/ 2>/dev/null
#Stat: 1-probe: Readdir:   137753  108.46MiB
#Stat: 1-probe: Stat:     1254845  72.167GiB
#Stat: 1-probe: Select:    987723  72.167GiB
#Profile: Time: 1-probe: 26721.298ms
#Stat: 2-verify: Hash-Int:  806.89MiB   4.45%  522734  60.93%   1.6KiB   1.00x
#Stat: 2-verify: Hash-Ext:  16.935GiB  95.55%  335163  39.07%  53.0KiB  33.52x
#Stat: 2-verify: SMALL_FILE: avg: 3.7KiB
#Profile: Time: 2-verify: 193733.672ms
#Profile: Time: 3-solve: 213.278ms
#Profile: Time: scheme: 220668.508ms
#Profile: Time: execute: 17.160ms
#Profile: Memory: rss: 889.44MiB
#Profile: Memory: heapTotal: 633.13MiB
#Profile: Memory: heapUsed: 565.48MiB
#Profile: Memory: external: 8.5KiB
#Result: TODO:  4.829GiB  5185105911  89447  147148
#Result: DONE:        0B           0      0       0
#Result: FAIL:        0B           0      0       0
```

- probe files may duplicate in **1,254,845** files in **26s**. 
- the size 108.46MiB of Readdir mean all path strings' size
- master process hashed **60.93%** of files but only **4.45%** of data, this is the small file acceleration


- the small file size criteria `SMALL_FILE` is adaptive, so this is the average 3.7KiB
- memory killer, even there are 8 work processes not mentioned here, each one of them used about 40M, so the real total memory usage is about **1209.44MiB**

## Introduction

So it just made of nested Maps:

```
map_size = map_dev[stat.dev]
map_hash = map_size[stat.size]
map_ino = map_hash[hash]
paths = map_ino[ino] 
paths = [path, path, ...]
```

In first step **probe** we group the files with information from a single `fs.stat` call, benefiting from this grouping, we can hash the fewest files enough to further group the files by content in second step **verify**. 

The third step **solve** scans the complex Maps to make a simple table `solutions` , then the fourth step **execute** actually use it and statistic the result.

### probe

Use a fully asynchronous recursive traversal process to fill I/O.

**TODO:** I want to detect "Inline Storage" files, which is so small that it's content was storaged in Metadata. It seems can't always successfully make hardlinks from these files, for example, it failed to work on files, which have non-zero "Size" but zero "Occupied Space", on NTFS at Windows 10, even report to me with an "Unknown Error". Theoretically it can be detected by `stat.blocks==0 && stat.size>0` , but on Windows, the `stat.blocks` is always `undefined` . So... I don't know how to do.

### verify

Multi-processed, while small files are still processed in the master processs

### solve

Make solutions which instruct to hardlink files whose inode is majority to others.

**TODO:** 

### execute

**TODO:** command-line options support

## License

- GPL v3.0
