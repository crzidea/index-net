var log = require('debug')('index-net:models:latest')
var common = require('../common.js')
var history = require('./history.js')
var hashers = common.hashers

function latest() {
  if (latest.store.normalized &&
      (!common.isBusinessTime() ||
       !common.shouldCacheUpdate(latest)
      )
     ) {
    return Promise.resolve(latest.store.normalized)
  }
  log('cache is not available')

  var securityID = history.store.availableTickers.map(
    (ticker) => `${ticker}.${history.store.tickerExchangeCDs[ticker]}`
  )
  .join()

  var query = { securityID }
  return common.fetchAPI(latest.api, query)
  .then((body) => {
    history.store.updatedAt = Date.now()
    var data = body.data
    latest.store.data = data
    latest.store.normalized = latest.normalize(data)
    return latest.store.normalized
  })
}
latest.api = '/api/market/getTickRTSnapshot.json'
latest.store = {}

latest.cacheInterval = 10 * 60 * 1000 // 10 minutes

latest.normalize = () => {
  var data = latest.store.data

  var input = history.latest()
  for (var i = 0, l = data.length; i < l; i++) {
    var row = data[i];
    if (history.options.ticker === row.ticker) {
      latest.store.target = row
      var date = new Date(row.dataDate)
      input.date = history.shrinkDate(date.valueOf())
    }
    for (var j = 0, l = latest.fields.length; j < l; j++) {
      var fieldLatest = latest.fields[j];
      var fieldHistory = history.fields.today[j];
      var key = `${row.ticker}.today.${fieldHistory}`
      var ratio = history.shrink(
        row.ticker,
        fieldHistory,
        row[fieldLatest]
      )
      input[key] = ratio
    }
  }
  input = hashers.input.serialize(input)
  return input
}

latest.fields = ['openPrice', 'lastPrice']

latest.explain = (index) => {
  var currentIndex = latest.store.target.lastPrice
  var ratioIncreased = (index - currentIndex) / currentIndex
  return {currentIndex, ratioIncreased}
}

module.exports = latest
