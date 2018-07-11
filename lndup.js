#!/usr/bin/env node
// lndup: Tiny program to hardlink duplicate files optimally
// Copyright (C) 2018  Chinory

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

/* lndup v0.5 GPL-3.0 <https://github.com/chinory/lndup> */
'use strict'
{
  const noop = function () {}
  const path = require('path')
  const BASENAME = path.basename(process.argv[1])

  // consts
  const HASH_ALGORITHM = 'sha1'
  const HASH_LENGTH = 20

  // parse arguments to a Map
  const argm = (function argv2m (argv) {
    var argm = new Map()
    for (var i = 0; i < argv.length && argv[i].length > 1 && argv[i].startsWith('-'); ++i) {
      if (argv[i].startsWith('--')) {
        if (argv[i].length > 2) {
          argm.set(argv[i].slice(2))
        } else {
          ++i; break
        }
      } else {
        for (let char of argv[i].slice(1)) {
          argm.set(char)
        }
      }
    }
    return argm.set('', argv.slice(i))
  })(process.argv.slice(2))

  if (argm.delete('help')) {
    console.log(`Usage: ${BASENAME} [OPTION]... PATH...`)
    console.log("Hardlink duplicate files.\n\n  -n, --dry-run  don't link\n  -v, --verbose  explain what is being done\n  -q, --quiet    don't output extra information\n  -i, --stdin    use stdin for extra paths\n      --help     display this help and exit\n      --version  output version information and exit\n      --hasher   start as a hash work process\n\nSee <https://github.com/chinory/lndup>")
  } else
  if (argm.delete('version')) {
    console.log('lndup v0.5')
  } else {
    const fs = require('fs')
    const crypto = require('crypto')
    const readline = require('readline')

    if (argm.delete('hasher')) {
      ; // main
      (function main () {
        const BUFSIZE = 1024 ** 2 * 16
        const buff = Buffer.allocUnsafe(BUFSIZE)
        const fail = Buffer.alloc(HASH_LENGTH)
        readline.createInterface({input: process.stdin}).on('line', line => {
          if (line.length === 0) process.exit()
          try {
            var fd = fs.openSync(line, 'r')
            let len = fs.fstatSync(fd).size
            const hash = crypto.createHash(HASH_ALGORITHM)
            while (len > BUFSIZE) {
              fs.readSync(fd, buff, 0, BUFSIZE, null)
              hash.update(buff)
              len -= BUFSIZE
            }
            fs.readSync(fd, buff, 0, len, null)
            var digest = hash.update(buff.slice(0, len)).digest()
          } catch (err) {
            process.stdout.write(fail)
            process.stderr.write(`#${err.toString()}\n`)
          }
          if (fd) {
            fs.close(fd, noop)
            if (digest) process.stdout.write(digest)
          }
        })
      })()
    } else {
      const child_process = require('child_process')

      // command-line options
      const ACTION = (argm.delete('dry-run') | argm.delete('n')) === 0
      const VERBOSE = (argm.delete('verbose') | argm.delete('v')) > 0
      const EXTINFO = (argm.delete('quiet') | argm.delete('q')) === 0
      const USE_STDIN = (argm.delete('stdin') | argm.delete('i')) > 0

      // check invaild command-line options
      if (argm.size > 1) {
        for (const name of argm.keys()) {
          if (name.length > 0) {
            console.error(`${BASENAME}: invalid option -- ${name}`)
            break // usually just one
          }
        }
        console.error(`Try '${BASENAME} --help' for more information.`)
        process.exit(1)
      }

      // consts
      const HASHER_N = require('os').cpus().length // use how many hash work child process
      const SMALLS_SIZE = 1024 * 8 // the max value of small file criteria size

      // format size(bytes) to human readable text
      const SIZE_UNIT = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
      const szstr = function (size) {
        for (var i = 0; i < 8 && size >= 1024; ++i) size /= 1024
        return size.toFixed(i) + SIZE_UNIT[i]
      }

      // print right aligned table
      const tprintf = function () {
        const maxlen = []
        for (const line of arguments) {
          for (const i in line) {
            line[i] = line[i].toString()
            if (maxlen[i] === undefined || line[i].length > maxlen[i]) {
              maxlen[i] = line[i].length
            }
          }
        }
        for (const line of arguments) {
          for (const i in line) {
            line[i] = line[i].padStart(maxlen[i])
          }
          console.log(line.join('  '))
        }
      }

      // report error
      const report = function (err) {
        return console.error(`#${err}`)
      }
      const report_if = function (err) {
        if (err) return report(err)
      }

      // use program self as hasher
      const hasher = function (callback, n) {
        var procs = []
        var queue = []
        var i = n
        function onerror (chunk) {
          return process.stderr.write(chunk)
        }
        function spawn () {
          const q = []
          const p = child_process.spawn(process.argv0, [process.argv[1], '--hasher'], {windowsHide: true})
          p.stdout.on('readable', () => {
            for (var buff; (buff = p.stdout.read(HASH_LENGTH)) !== null;) {
              callback(buff, q.shift())
            }
          })
          p.stderr.on('data', onerror)
          procs.push(p)
          queue.push(q)
        }
        function send (path, extra) {
          queue[i].push(extra)
          procs[i].stdin.write(`${path}\n`)
          if (++i === n) i = 0
        }
        function kill () {
          for (const p of procs) p.stdin.write('\n')
          // procs = undefined; queue = undefined; i = undefined
        }
        do { spawn() } while (--i > 0)
        return [send, kill]
      }

      // safe link
      const link = function (src, dst) {
        const sav = `${dst}.${crypto.randomBytes(8).toString('hex')}`
        fs.renameSync(dst, sav)
        try {
          fs.linkSync(src, dst)
        } catch (err) {
          try {
            fs.renameSync(sav, dst)
          } catch (err) {
            console.error(`mv -f -- '${sav}' '${dst}' #${err.toString()}`)
          }
          throw err
        }
        try {
          fs.unlinkSync(sav)
        } catch (err) {
          console.error(`rm -f -- '${sav}' #${err.toString()}`)
        }
      }

      // get_*() methods with default value
      class DefaultMap extends Map {
        get_array (key) {
          if (this.has(key)) {
            return this.get(key)
          } else {
            let value = []
            this.set(key, value)
            return value
          }
        }
        get_map (key) {
          if (this.has(key)) {
            return this.get(key)
          } else {
            let value = new DefaultMap()
            this.set(key, value)
            return value
          }
        }
      }

      ; // main
      (function main () {
        function probe (pathsArray, pathsReadline) {
          return new Promise(resolve => {
            if (EXTINFO) {
              // console.time('#time: scheme')
              console.time('#time: probe')
            }
            var n = 0
            var by_dev = new DefaultMap()
            var select_n = 0; var select_size = 0
            var stat_n = 0; var stat_size = 0
            var readdir_n = 0; var readdir_size = 0
            function done () {
              if (EXTINFO) {
                tprintf(['#stat: probe: readdir', szstr(readdir_size), readdir_n],
                  ['#stat: probe: stat   ', szstr(stat_size), stat_n],
                  ['#stat: probe: select ', szstr(select_size), select_n])
              }
              return resolve(by_dev)
            }
            function readdir (dir) {
              ++n; ++readdir_n
              return fs.readdir(dir, (err, files) => {
                --n
                if (err) report(err); else {
                  for (let name of files) {
                    name = path.join(dir, name)
                    readdir_size += name.length
                    stat(name)
                  }
                }
                if (n === 0) return done()
              })
            }
            function stat (path) {
              ++n; ++stat_n
              return fs.lstat(path, (err, stat) => {
                --n
                if (err) report(err); else {
                  if (stat.isDirectory()) {
                    return readdir(path)
                  } else if (stat.isFile()) {
                    stat_size += stat.size
                    if (stat.size > 0) {
                      ++select_n; select_size += stat.size
                      by_dev.get_map(stat.dev).get_map(stat.size).get_map('').get_array(stat.ino).push(path)
                    }
                  }
                }
                if (n === 0) return done()
              })
            }
            if (pathsArray) {
              for (const path of pathsArray) {
                stat(path)
              }
            }
            if (pathsReadline) {
              ++n
              pathsReadline.on('line', stat).on('close', () => { if (--n === 0) return done() })
            }
          })
        }
        function verify (by_dev) {
          return new Promise(resolve => {
            if (EXTINFO) {
              console.timeEnd('#time: probe')
              console.time('#time: verify')
            }
            var n = 0
            var smalls_size = SMALLS_SIZE
            var hash_int_n = 0; var hash_int_size = 0
            var hash_ext_n = 0; var hash_ext_size = 0
            var flow_int = 0; var flow_ext = 0; var flow_n = 0
            var buff = Buffer.allocUnsafe(SMALLS_SIZE)
            var fail = Buffer.alloc(HASH_LENGTH)
            var send, kill; [send, kill] = hasher(hashback, HASHER_N)
            function hashback (hash, extra) {
              --n
              if (!hash.equals(fail)) {
                extra[0].get_map(hash.toString('binary')).set(extra[1], extra[2])
              }
              if (n === 0) return done()
            }
            function done () {
              if (EXTINFO) {
                // const hash_n = hash_int_n + hash_ext_n
                // const hash_size = hash_int_size + hash_ext_size
                // const hash_int_avg = hash_int_size / hash_int_n
                // const hash_ext_avg = hash_ext_size / hash_ext_n
                // const hash_ext_to_int = hash_ext_avg / hash_int_avg
                tprintf(
                  ['#stat: verify: internal',
                    szstr(hash_int_size),
                    // `${hash_size > 0 ? (hash_int_size * 100 / hash_size).toFixed(2) : '0.00'}%`,
                    hash_int_n
                    // `${hash_n > 0 ? (hash_int_n * 100 / hash_n).toFixed(2) : '0.00'}%`,
                    // isNaN(hash_int_avg) ? 'NaN' : szstr(hash_int_avg),
                    // isNaN(hash_ext_to_int) ? 'NaNx' : '1.00x',
                  ],
                  ['#stat: verify: external',
                    szstr(hash_ext_size),
                    // `${hash_size > 0 ? (hash_ext_size * 100 / hash_size).toFixed(2) : '0.00'}%`,
                    hash_ext_n
                    // `${hash_n > 0 ? (hash_ext_n * 100 / hash_n).toFixed(2) : '0.00'}%`,
                    // isNaN(hash_ext_avg) ? 'NaN' : szstr(hash_ext_avg),
                    // hash_ext_to_int.toFixed(2) + 'x',
                  ]
                )
              }
              kill()
              return resolve(by_dev)
            }
            // for (const [dev, by_size] of by_dev) {
            for (const by_size of by_dev.values()) {
              for (const [size, by_content] of by_size) {
                const by_ino = by_content.get('')
                if (by_ino) {
                  if (by_ino.size > 1) {
                    for (const [ino, paths] of by_ino) {
                      if (size > smalls_size) {
                        ++hash_ext_n; hash_ext_size += size
                        ++n
                        send(paths[0], [by_content, ino, paths])
                      } else {
                        ++hash_int_n; hash_int_size += size
                        let fd
                        try {
                          fd = fs.openSync(paths[0], 'r')
                          const hash = crypto.createHash(HASH_ALGORITHM)
                          fs.readSync(fd, buff, 0, size, null)
                          hash.update(buff.slice(0, size))
                          by_content.get_map(hash.digest('binary')).set(ino, paths)
                        } catch (err) {
                          report(err)
                        }
                        if (fd) fs.close(fd, report_if)
                      }
                      ++flow_n; flow_ext += size
                      smalls_size = SMALLS_SIZE * flow_ext / (flow_int + flow_ext)
                      if (flow_n === 8) {
                        flow_n = 4; flow_int >>= 1; flow_ext >>= 1
                      }
                    }
                  }
                  by_content.delete('')
                }
              }
            }
            if (n === 0) return done()
          })
        }
        function solve (by_dev) {
          if (EXTINFO) {
            console.timeEnd('#time: verify')
            console.time('#time: solve')
          }
          const solutions = []
          // for (const [dev, by_size] of by_dev) {
          for (const by_size of by_dev.values()) {
            for (const [size, by_content] of by_size) {
              // for (const [digest, by_ino] of by_content) {
              for (const by_ino of by_content.values()) {
                if (by_ino.size > 1) {
                  let major_n = 0
                  let major_i = 0
                  const dsts = []
                  for (const [ino, paths] of by_ino) {
                    if (paths.length > major_n) {
                      major_n = paths.length
                      major_i = ino
                    }
                  }
                  for (const [ino, paths] of by_ino) {
                    if (ino !== major_i) {
                      dsts.push(...paths)
                    }
                  }
                  solutions.push([size, by_ino.get(major_i)[0], dsts])
                }
              }
            }
          }
          return solutions
        }
        function execute (solutions) {
          if (EXTINFO) {
            console.timeEnd('#time: solve')
            // console.timeEnd('#time: scheme')
            console.time('#time: execute')
          }
          var todo_size = 0; var todo_src_n = 0; var todo_dst_n = 0
          var succ_size = 0; var succ_src_n = 0; var succ_dst_n = 0
          var fail_size = 0; var fail_src_n = 0; var fail_dst_n = 0
          for (const [size, src, dsts] of solutions) {
            let succ_src_a = 0
            let fail_src_a = 0
            for (const dst of dsts) {
              if (VERBOSE) {
                console.log(`ln -f -- '${src}' '${dst}'`)
              }
              if (ACTION) {
                try {
                  link(src, dst)
                  succ_size += size
                  succ_src_a = 1
                  succ_dst_n += 1
                } catch (err) {
                  console.error(`ln -f -- '${src}' '${dst}' #${err.toString()}`)
                  fail_size += size
                  fail_src_a = 1
                  fail_dst_n += 1
                }
              }
              todo_size += size
              todo_dst_n += 1
            }
            todo_src_n += 1
            succ_src_n += succ_src_a
            fail_src_n += fail_src_a
          }
          if (EXTINFO) {
            console.timeEnd('#time: execute')
            // const mem = process.memoryUsage()
            // console.log(`#Prof: Memory: rss: ${szstr(mem.rss)}`)
            // console.log(`#Prof: Memory: heapTotal: ${szstr(mem.heapTotal)}`)
            // console.log(`#Prof: Memory: heapUsed: ${szstr(mem.heapUsed)}`)
            // console.log(`#Prof: Memory: external: ${szstr(mem.external)}`)
            tprintf(['#result: todo:', szstr(todo_size), /* todo_size, */todo_src_n, todo_dst_n],
              ['#result: done:', szstr(succ_size), /* succ_size, */succ_src_n, succ_dst_n],
              ['#result: fail:', szstr(fail_size), /* fail_size, */fail_src_n, fail_dst_n])
          }
        }
        probe(argm.get(''), USE_STDIN ? readline.createInterface({input: process.stdin}) : undefined)
          .then(verify).then(solve).then(execute)
      })()
    }
  }
}
