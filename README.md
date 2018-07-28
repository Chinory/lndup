# lndup

Hardlink duplicate files. Ultra fast!

- asynchronous I/O
- one file one stat() call
- full-speed hash least files
- customize filters and keys with javascript

## Installation

```
$ npm i -g lndup
```

## Usage

```
Usage: lndup [OPTION]... [PATH]...
Hardlink duplicate files.

  -n, --dry-run  don't link
  -v, --verbose  explain what is being done
  -q, --quiet    don't output extra information
  -i, --stdin    read more paths from stdin

  -f, --file     add a file filter
                 (stats: fs.Stats, path: string): boolean
  -d, --dir      add a directory filter
                 (stats: fs.Stats, path: string, files: string[]): boolean
  -k, --key      add a key to differentiate files
                 (stats: fs.Stats, path: string): any
  -H, --hash     select a digest algorithm, default: sha1
                 run 'openssl list -digest-algorithms' for available algorithms.

  -h, --help     display this help and exit
  -V, --version  output version information and exit

See <https://github.com/chinory/lndup>
```

- Not follow symbolic links.

## Example

All outputs are executable unix-shell code, using comment to carry extra information.

```shell
$ lndup -v .
#Stat: probe: readdir       204B   3
#Stat: probe: stat     144.02MiB  23
#Stat: probe: select   144.02MiB  19
#Time: probe: 7.351ms
#Stat: verify: internal         0B  0
#Stat: verify: external  144.00MiB  9
#Stat: verify: total     144.00MiB  9
#Time: verify: 183.209ms
#Stat: solve: current  112.00MiB  7
#Time: solve: 0.110ms
ln -f -- '16M/null_2' '16M/null_3'
ln -f -- '16M/null_2' '16M/null_1'
ln -f -- '16M/ran1_1' '16M/ran1_2'
ln -f -- 'root/ran4_1' 'root/ran4_2'
ln -f -- 'root/ran4_1' 'root/ran4_2' #Error: EACCES: permission denied, rename 'root/ran4_2' -> 'root/ran4_2.e8c70ebe0635ab41'
#Stat: execute: todo  64.00MiB  3  4
#Stat: execute: done  48.00MiB  2  3
#Stat: execute: fail  16.00MiB  1  1
#Time: execute: 8.331ms
```

### Customize filter & key

**File Filters**: If you don't want to hardlink files smaller than 1024 bytes:

```shell
$ lndup /path -f 'stats=>stats.size>=1024'
```

**Directory Filters**: While you don't want to consider a directory with more than 100 files:

```shell
$ lndup /path -f 'stats=>stats.size>=1024' -d '(s,p,f)=>f.length<=100'
```

**Extra keys**: Obviously, you don't want to hardlink the same files with different user, group and mode:

```shell
$ lndup /path -k 's=>s.uid' -k 's=>s.gid' -k 's=>s.mode'
```

**Require more**: Finally, you have a super idea:

```shell
$ lndup /path -k 'require("/path/to/keyfunc.js")' -f 'require("/path/to/filter.js")'
```

## Notice

Failed operation will be output to stderr like following:

```shell
ln -f -- 'root/ran4_1' 'root/ran4_2' #Error: EACCES: permission denied, rename 'root/ran4_2' -> 'root/ran4_2.e8c70ebe0635ab41'
```

Beware of `mv` and `rm` fails, they are remedies of failed link operation, **you need to complete them manually**. Fortunately, the remedies rarely fail, as they are all counter-operations of just-successful operations.

## Requirement

- Node.js >=9

## Introduction

### data structure

```javascript
// nested maps
devMap // devMap instanceof Map
sizeMap = devMap[stat.dev] // sizeMap instanceof Map
exkeyMap = sizeMap[stat.size] // exkeyMap instanceof Map
contentMap = exkeyMap[value of extra keys] // contentMap instanceof Map
inoMap = contentMap[hash.digest] // inoMap instanceof Map
paths = inoMap[stat.ino] // paths instanceof Array
```

### processing

```javascript
probe(paths).then(verify).then(solve).then(execute)
```

**probe**: Traverse the input paths asynchronously while use the stat()'s result to group files.

**verify**: Find out least files to hash, and group files by the digest. 

**solve**: Make solution that instruct to hardlink the file whose inode is majority to other files.

**execute**: Execute that solution or just dry-run.

## License

MIT © Chinory