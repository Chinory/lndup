# lndup

Hardlink duplicate files.

- use asynchronous I/O
- one file one stat() call
- full-speed hash least files

## Usage

```
Usage: lndup [OPTION]... [PATH]...
Hardlink duplicate files.

  -n, --dry-run  don't link
  -v, --verbose  explain what is being done
  -q, --quiet    don't output extra information
  -i, --stdin    read more paths from stdin
  -h, --help     display this help and exit
      --version  output version information and exit
      --hasher   start as a hash work process

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
#Time: verify: 183.209ms
#Time: solve: 0.110ms
ln -f -- '16M/null_2' '16M/null_3'
ln -f -- '16M/null_2' '16M/null_1'
ln -f -- '16M/ran1_1' '16M/ran1_2'
ln -f -- 'root/ran4_1' 'root/ran4_2'
ln -f -- 'root/ran4_1' 'root/ran4_2' #Error: EACCES: permission denied, rename 'root/ran4_2' -> 'root/ran4_2.e8c70ebe0635ab41'
#Time: execute: 8.331ms
#Result: TODO:  64.00MiB  3  4
#Result: DONE:  48.00MiB  2  3
#Result: FAIL:  16.00MiB  1  1
```

## Notice

Failed operation will be output to stderr in following format:

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
by_dev // by_dev instanceof Map
by_size = by_dev[stat.dev] // by_size instanceof Map
by_content = by_size[stat.size] // by_content instanceof Map
by_ino = by_content[hash.digest] // by_ino instanceof Map
paths = by_ino[stat.ino] // paths instanceof Array
```

### processing

```javascript
probe(paths).then(verify).then(solve).then(execute)
```

**probe**: Traverse the input paths asynchronously while use the stat()'s result to group files.

**verify**: Find out least files to hash, and group files by the digest. 

**solve: **Make solution that instruct to hard link the file whose inode is majority to other files.

**execute**: Execute that solution or just dry-run.

## License

- GPL v3.0
