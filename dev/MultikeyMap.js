'use strict'
const util = require('util')
class MultikeyMap {
  set (keys, value) {
    if (keys.length > 0) {
      let map = this.hasOwnProperty('entry') ? this.entry : this.entry = new Map()
      const last = keys.length - 1
      for (let i = 0; i < last; ++i) {
        if (map.has(keys[i])) {
          map = map.get(keys[i])
        } else {
          const next = new Map()
          map.set(keys[i], next)
          map = next
        }
      }
      map.set(keys[last], value)
    } else {
      this.value = value
    }
    return this
  }
  get (keys) {
    if (keys.length > 0) {
      if (this.hasOwnProperty('entry')) {
        let map = this.entry
        const last = keys.length - 1
        for (let i = 0; i < last; ++i) {
          if (map.has(keys[i])) {
            map = map.get(keys[i])
          } else {
            return
          }
        }
        return map.get(keys[last])
      }
    } else {
      return this.value
    }
  }
  * values () { // bug: if value is Map, will iter it too
    if (this.hasOwnProperty('value')) {
      yield this.value
    }
    if (this.hasOwnProperty('entry')) {
      for (const stack = [this.entry.values()]; stack.length > 0;) {
        const result = stack[stack.length - 1].next()
        if (result.done) {
          stack.pop()
        } else if (util.types.isMap(result.value)) {
          stack.push(result.value.values())
        } else {
          yield result.value
        }
      }
    }
  }
}

module.exports = MultikeyMap
