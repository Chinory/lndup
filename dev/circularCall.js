'use strict'
function circularCall () {
  const a = function () {
    console.log(`a: ${++num}`)
    return b()
  }
  const b = function () {
    console.log(`b: ${++num}`)
    return a()
  }
  let num = 1
  a(0)
}
if (module.parent) {
  module.exports = circularCall
} else {
  circularCall()
}
