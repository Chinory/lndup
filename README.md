# lndup

Tiny program to hardlink duplicate files optimally

- Asynchronous I/O
- One file one stat() system call
- Hash least files, multi-process hashing with small file acceleration
- ~~Fill your memory~~

## Usage

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

Profiles and Stats outputs are also online. See Performance

### Use Safely

`stderr` outputs failed operations with format `ln -f -- 'src' 'dst' #Error:...`  . For  `ln` outputs, you can choose whether to execute without losing data. But beware of `mv` `rm` outputs, they are remedies of failed `ln` operations, **you must ensure them to be done**.

Fortunately, remedies rarely fail, as they are all counter-operations of just-successful operations.

## Requirement

- Node.js 9+

## Tested

- Linux 4.14: ext4, ntfs-3g
- Windows 10: NTFS

## Performance

### Linux 4.14: 3x Linux root + 1x Windows C: Disk

- 8x Intel CPU @ 2.60GHz, 16G DDR3 Memory, SSD
- Linux root are all **ext4**, Windows C: Disk is mounted by **ntfs-3g**

#### use built-in hash map Map()

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

#### use sorted map SMap() (New)

```shell
$ sudo ./lndup.dry /usr /etc /var /boot /home /opt /root /media/linux1/ /media/linux2/ /media/win10/ 2>/dev/null
#Stat: 1-probe: Readdir:   137835  108.71MiB
#Stat: 1-probe: Stat:     1258656  72.255GiB
#Stat: 1-probe: Select:    991483  72.255GiB
#Profile: Time: 1-probe: 22854.681ms
#Stat: 2-verify: Hash-Int:  700.18MiB   3.85%  488142  56.66%   1.5KiB   1.00x
#Stat: 2-verify: Hash-Ext:  17.080GiB  96.15%  373324  43.34%  48.0KiB  32.66x
#Stat: 2-verify: smalls_size: avg: 3.5KiB
#Profile: Time: 2-verify: 187013.600ms
#Profile: Time: 3-solve: 153.372ms
#Profile: Time: scheme: 210021.918ms
#Profile: Time: execute: 20.372ms
#Profile: Memory: rss: 1.005GiB
#Profile: Memory: heapTotal: 789.74MiB
#Profile: Memory: heapUsed: 725.94MiB
#Profile: Memory: external: 8.5KiB
#Result: TODO:  4.833GiB  5189661793  89433  147134
#Result: DONE:        0B           0      0       0
#Result: FAIL:        0B           0      0       0
```

- ~~much more memory usage~~, bit faster
- ^ only 100M not too much, compare to that all-in-one-Map implement 

### Windows 10: C:\Windows

- 8x Intel CPU @ 2.60GHz, 16G DDR3 Memory, SSD

```shell
lndup>node lndup.dry "C:\Windows" 2>nul
#Stat: 1-probe: Readdir:   27070   18.13MiB
#Stat: 1-probe: Stat:     161881  23.873GiB
#Stat: 1-probe: Select:   134768  23.873GiB
#Profile: Time: 1-probe: 10033.147ms
#Stat: 2-verify: Hash-Int:  63.32MiB   1.15%  51503  58.66%    1.3KiB    1.00x
#Stat: 2-verify: Hash-Ext:  5.330GiB  98.85%  36292  41.34%  154.0KiB  122.32x
#Stat: 2-verify: SMALL_FILE: avg: 4.3KiB
#Profile: Time: 2-verify: 9790.634ms
#Profile: Time: 3-solve: 143.799ms
#Profile: Time: scheme: 19969.387ms
#Profile: Time: execute: 12.100ms
#Profile: Memory: rss: 148.43MiB
#Profile: Memory: heapTotal: 123.21MiB
#Profile: Memory: heapUsed: 89.85MiB
#Profile: Memory: external: 16.5KiB
#Result: TODO:  1.495GiB  1605673630  10958  18379
#Result: DONE:        0B           0      0      0
#Result: FAIL:        0B           0      0      0
```

- **probe** is much slower than on Linux, so about Windows... nothing I can do(

### Windows 10: 3x Media Disks

- 8x Intel CPU @ 2.60GHz, 16G DDR3 Memory, **HDD**
- The size of files varies in a large range, including some **same-size big file**

```shell
lndup>node lndup.dry D: E: F: 2>nul
#Stat: 1-probe: Readdir:    5105     9.67MiB
#Stat: 1-probe: Stat:     122320  441.091GiB
#Stat: 1-probe: Select:   117085  441.091GiB
#Profile: Time: 1-probe: 17175.348ms
#Stat: 2-verify: Hash-Int:   60.28MiB   0.13%  39816  54.80%   1.6KiB    1.00x
#Stat: 2-verify: Hash-Ext:  45.907GiB  99.87%  32838  45.20%  1.43MiB  945.61x
#Stat: 2-verify: SMALL_FILE: avg: 4.7KiB
#Profile: Time: 2-verify: 750492.623ms
#Profile: Time: 3-solve: 100.584ms
#Profile: Time: scheme: 767769.280ms
#Profile: Time: execute: 11.359ms
#Profile: Memory: rss: 116.61MiB
#Profile: Memory: heapTotal: 83.09MiB
#Profile: Memory: heapUsed: 64.94MiB
#Profile: Memory: external: 8.5KiB
#Result: TODO:  5.396GiB  5794002877  18531  23337
#Result: DONE:        0B           0      0      0
#Result: FAIL:        0B           0      0      0
```

- As you can see, **verify** took almost 13 minutes, just because it distinguish a group of files by hashing all the files whole, so it stupidly hashed 45GiB data to found nothing. I may need a multi-stream-diff algorithm... 

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
