var log = require('debug')('index-net:models:latest')
var common = require('../common.js')
var history = require('./history.js')
var hashers = common.hashers

function latest() {
  if (latest.store.normalized &&
      (!common.isBusinessTime() ||
       !latest.shouldCacheUpdate()
      )
     ) {
    return Promise.resolve(latest.store.normalized)
  }
  log('cache is not available')

  var query = {
    securityID: '000001.XSHG'
  }
  return common.fetchAPI(latest.api, query)
  .then((body) => {
    var data = body.data[0]
    latest.store.data = data
    latest.store.normalized = latest.normalize(data)
    return latest.store.normalized
  })
}
latest.api = '/api/market/getTickRTSnapshot.json'
latest.store = {}
latest.cacheInterval = 10 * 60 * 1000 // 10 minutes
latest.shouldCacheUpdate = () => {
  return Date.now() - latest.store.updatedAt > latest.cacheInterval
}
latest.normalize = (latest) => {
  var yesterday = history.latest()
  var source = {
    date:             history.store.ranges.date.max,
    openIndex:        latest.openPrice,
    closeIndex:       latest.lastPrice,
    preOpenIndex:     yesterday.openIndex,
    preCloseIndex:    yesterday.closeIndex,
    preHighestIndex:  yesterday.highestIndex,
    preLowestIndex:   yesterday.lowestIndex,
    preTurnoverValue: yesterday.turnoverValue,
    preTurnoverVol:   yesterday.turnoverVol
  }
  var input = history.shrink(source)
  input = hashers.input.serialize(input)
  return input
}
latest.explain = (source) => {
  var currentIndex = latest.store.data.lastPrice
  var ratioIncreased = (source.tomorrowCloseIndex - currentIndex) / currentIndex
  return {currentIndex, ratioIncreased}
}

module.exports = latest
