# lndup 🧷✨

Hardlink duplicate files — **fast**, **scriptable**, and **Unix-friendly** 🐧⚡

`lndup` finds duplicate files and replaces duplicates with **hard links** (so they share the same inode), saving disk space **without changing file contents**. Neat, right? 😼

## Why lndup 🤔

Most dedup tools are either:

- 🚀 **fast but rigid** (fixed rules), or
- 🧩 **flexible but clunky** (external scripts, awkward integration).

`lndup` is different: you can **inject tiny JavaScript functions** as filters and keys — naturally, like writing Node.js callbacks. One-liners welcome ✨

### Highlights 🌟

- ⚡ **Asynchronous I/O** (fast traversal on big trees)
- 📉 **Minimal metadata overhead**: one `stat()` per file
- 🔍 **Hash only what’s necessary** (“least files” strategy)
- 🧠 **JavaScript injection** for filters & keys (standard Node.js `fs.Stats` API)

> 🚫 Does **not** follow symbolic links.

## Installation 📦

```bash
npm i -g lndup
````

## Usage 🧰

```text
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
```

## Quick start 🚀

### 1) Dry-run first (recommended) ✅

```bash
lndup -n -v /path/to/scan
```

### 2) Actually hardlink duplicates 🧷

```bash
lndup -v /path/to/scan
```

### 3) Feed paths via stdin 🍜

```bash
find /data -type f -print0 | lndup -i -n -v
```

## Output model (important!) 🧾✨

`lndup` prints **executable Unix-shell commands** to stdout.
Extra information is carried in `# comments`.

That means it’s:

* 👀 easy to review / audit,
* 🧪 safe to start with `--dry-run`,
* 🧰 easy to pipe into other tools.

Example:

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

## Scriptable filters & keys (core feature) 🧠🔧

### File filter (`-f`) 🗂️

Skip files smaller than 1024 bytes:

```bash
lndup /path -f 's => s.size >= 1024'
```

Only process files owned by a specific uid (example: 1001):

```bash
lndup /path -f '(s, p) => s.uid === 1001'
```

### Directory filter (`-d`) 📁

Ignore directories with more than 100 files:

```bash
lndup /path -d '(s, p, files) => files.length <= 100'
```

Combine filters like LEGO 🧱:

```bash
lndup /path \
  -f 's => s.size >= 1024' \
  -d '(s, p, files) => files.length <= 100'
```

### Extra keys (`-k`) 🔑

By default, duplicates are decided by content (hash).
If you want to avoid hardlinking across different metadata constraints, add keys.

Example: separate by uid / gid / mode:

```bash
lndup /path -k 's => s.uid' -k 's => s.gid' -k 's => s.mode'
```

### Require your own JS modules 📎

```bash
lndup /path \
  -k 'require("/path/to/keyfunc.js")' \
  -f 'require("/path/to/filter.js")'
```

> 💡 Tip: keep your filter/key functions **pure and cheap** (no I/O) for best performance.

## Safety & recovery (aka “what if something fails?”) 🛡️🧯

Hardlinking is fast, but it’s not always “atomic” — permissions, readonly dirs, races… stuff happens 😅

So `lndup` executes each link as a **3-step mini-transaction**:

1. 🏷️ **Rename the target file** to a temporary name with a random hex suffix
   (e.g. `file` → `file.<hex>`)
2. 🧷 **Create the hardlink** (`ln`) from the chosen source inode to the target path
3. 🧹 **Delete the temporary file** (`rm file.<hex>`) after the link succeeds

### Recovery commands 🧰

If something fails mid-way, `lndup` prints the failing command to **stderr** and may also emit
**recovery / rollback commands** so you can restore consistency:

* `mv` to put the original file back (undo step 1)
* `rm` to remove a newly-created link if needed (undo step 2)

Example:

```shell
ln -f -- 'root/ran4_1' 'root/ran4_2' #Error: EACCES: permission denied, rename 'root/ran4_2' -> 'root/ran4_2.e8c70ebe0635ab41'
```

### Safety-first rule 🧡

Recovery commands are designed to be the **inverse of just-completed steps**, so failures are rare.
But if a recovery command fails, you’ll need to run it manually.

When in doubt, `lndup` prefers leaving extra files behind over risking data loss:
**space saving is optional, your data isn’t** ✅

## Requirements ✅

* Node.js >= 9

## How it works (internals) 🧩

### Data structure 🗺️

```js
// nested maps
devMap                        // Map
sizeMap = devMap[stat.dev]    // Map
exkeyMap = sizeMap[stat.size] // Map
contentMap = exkeyMap[extraKeyValue] // Map
inoMap = contentMap[digest]   // Map
paths = inoMap[stat.ino]      // Array<string>
```

### Pipeline 🏃‍♂️

```js
probe(paths).then(verify).then(solve).then(execute)
```

* 🔎 **probe**: async traverse inputs, `stat()` each file, group candidates
* 🧮 **verify**: hash the least amount of data needed, group by digest
* 🧠 **solve**: choose a “majority inode” as the link target
* 🛠️ **execute**: run (or dry-run) the generated link plan

## License 📜

MIT © Chinory
