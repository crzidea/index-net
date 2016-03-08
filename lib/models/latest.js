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

  var tickers = history.store.availableTickers

  var securityIDGroupLength = 150
  var securityIDGroup = []
  var securityIDGroups = [securityIDGroup]
  for (var i = 0, l = tickers.length; i < l; i++) {
    var ticker = tickers[i];
    var securityID = `${ticker}.${history.store.tickerExchangeCDs[ticker]}`
    if (securityIDGroup.length <= securityIDGroupLength) {
      securityIDGroup.push(securityID)
    } else {
      securityIDGroup = [securityID]
      securityIDGroups.push(securityIDGroup)
    }
  }
  log(`${tickers.length}/${securityIDGroups.length} tickers/groups available`)

  latest.store.data = []
  return Promise.all(
    securityIDGroups.map((securityIDs) => {
      var query = { securityID: securityIDs.join() }
      return common.fetchAPI(latest.api, query)
      .then((body) => {
        for (var i = 0, l = body.data.length; i < l; i++) {
          var row = body.data[i];
          latest.store.data.push(row)
        }
        latest.classify(body.data)
        log(`fetched: ${latest.store.data.length}/${tickers.length}`)
      })
    })
  )
  .then(() => {
    history.store.updatedAt = Date.now()
    log('normalizing latest')
    latest.store.normalized = latest.normalize()
    return latest.store.normalized
  })
}
latest.api = '/api/market/getTickRTSnapshot.json'
latest.store = {}
latest.store.classified = Object.create(null)

latest.cacheInterval = 30 * 60 * 1000 // 30 minutes

latest.classify = (data) => {
  for (var i = 0, l = data.length; i < l; i++) {
    var row = data[i];
    latest.store.classified[row.ticker] = row
  }
}

latest.normalize = () => {
  var data        = latest.store.data
  var classified  = latest.store.classified
  var tickers     = history.store.availableTickers


  var historyLastDate = history.store.dates[history.store.dates.length - 1]
  return Promise.all(
    tickers.map((ticker) => {
      if (latest.store.classified[ticker]) {
        return Promise.resolve()
      }
      var row = classified[ticker] = {ticker}
      return history.addValuesFromDay(
        'yesterday',
        history.store.dates.length - 1,
        ticker
      )
      .then(() => {
        var key = history.databaseKey(historyLastDate, ticker)
        return history.database.getAsync(key)
      })
      .then((rowTicker) => {
        for (var j = 0, l2 = latest.fields.length; j < l2; j++) {
          var fieldLatest = latest.fields[j];
          var fieldHistory = history.fields.today[j];
          row[fieldLatest] = rowTicker[fieldHistory]
        }
        data.push(row)
      })
    })
  )
  .then(() => {
    return history.latest()
  })
  .then((input) => {
    for (var i = 0, l = data.length; i < l; i++) {
      var row = data[i];
      if (history.options.ticker === row.ticker) {
        latest.store.target = row
        var date = new Date(row.dataDate)
        input.date = history.shrinkDate(date.valueOf())
      }
      for (var j = 0, l2 = latest.fields.length; j < l2; j++) {
        var fieldLatest = latest.fields[j];
        var fieldHistory = history.fields.today[j];
        var key = `${row.ticker}.today.${fieldHistory}`
        var value = row[fieldLatest]
        var ratio = history.shrink(
          row.ticker,
          fieldHistory,
          value
        )
        input[key] = ratio
      }
    }
    input = hashers.input.serialize(input)
    return input
  })

}

latest.fields = ['openPrice', 'lastPrice']

latest.explain = (index) => {
  var currentIndex = latest.store.target.lastPrice
  var ratioIncreased = (index - currentIndex) / currentIndex
  return {currentIndex, ratioIncreased}
}

module.exports = latest
