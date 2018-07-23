'use strict'
function * MapDeepIterator (map, maxDepth) {
  if (maxDepth < 1) {
    yield map
    return
  }
  for (const stack = [map.values()]; stack.length > 0;) {
    const result = stack[stack.length - 1].next()
    if (result.done) {
      stack.pop()
    } else if (stack.length < maxDepth && result.value instanceof Map) {
      stack.push(result.value.values())
    } else {
      yield result.value
    }
  }
}

module.exports = MapDeepIterator
