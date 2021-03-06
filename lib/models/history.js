var log = require('debug')('index-net:models:history')
var indexes = require('./indexes.js')
var bluebird = require('bluebird')
var levelup = require('levelup')
var common = require('../common.js')
var hashers = common.hashers
var opts = require('../options.js')
log.verbose = require('debug')('index-net:models:history:verbose')

function history(options) {
  options = options || {}
  options.ticker = options.ticker || '000001'
  var index = indexes.find(options.ticker)
  options.beginDate = options.beginDate || index.publishDate.replace(/-/g, '')
  history.options = options

  if (!common.shouldCacheUpdate(history)) {
    return Promise.resolve(history.normalize())
  }
  log('cache is not available')

  var pathDatabase = `${opts.home}/history`
  history.database = bluebird.promisifyAll(
    levelup(
      pathDatabase,
      {
        valueEncoding: 'json'
      }
    )
  )

  var classified = 0
  return Promise.all(
    indexes.cached.map((index) => {
      var query = {ticker: index.ticker, beginDate: options.beginDate}
      return common.fetchAPI(history.api, query)
      .then((body) => {
        if (!body.data) {
          log(`no data for ${index.ticker}`)
          log(body)
          return
        }

        var exchangeCD = body.data[0].exchangeCD
        if (!exchangeCD) {
          log(`no \`exchangeCD\` for ${index.ticker}`)
          return
        }
        history.store.tickerExchangeCDs[index.ticker] = exchangeCD

        log(`classifying: ${classified}-${classified + body.data.length}`)
        return history.classify(index.ticker, body.data)
        .then(() => {
          classified += body.data.length
          history.store.availableTickers.push(index.ticker)
          body = null
          index = null
        })
      })
    })
  )
  .then(() => {
    history.store.dates = history.store.dates.sort((a, b) => a - b)
    history.store.updatedAt = Date.now()
    log('mormalizing training data')
    return history.normalize()
  })
}
history.api = '/api/market/getMktIdxd.json'
history.cacheInterval = 6 * 60 * 60 * 1000 // 6 hours

history.store = {}
history.store.dates = []
history.store.availableTickers = []
history.store.ranges = Object.create(null)
history.store.tickerExchangeCDs = Object.create(null)

history.classify = (ticker, data) => {
  for (var i = 0, l = data.length; i < l; i++) {
    var v = data[i];
    v.date = (new Date(v.tradeDate)).valueOf()
  }
  var ranges = common.ranges(
    data,
    [
      'openIndex',
      'closeIndex',
      'openIndex',
      'closeIndex',
      'highestIndex',
      'lowestIndex',
      'turnoverValue',
      'turnoverVol'
    ]
  )
  history.store.ranges[ticker] = ranges

  var ops = data.map((row) => {
    var date = Number(row.date)
    if (!~history.store.dates.indexOf(date)) {
      history.store.dates.push(date)
    }
    return {
      type: 'put',
      key: history.databaseKey(row.date, ticker),
      value: row
    }
  })
  return history.database.batchAsync(ops, {sync: true})
}

history.databaseKey = (date, ticker) => {
  return `${date}:${ticker}`
}

history.lastNormalizedKey = 'last_normalized'

history.normalize = (start, end) => {
  var dates = history.store.dates

  if (start && end) {
    var past = []
  }

  var indexMin = 1
  var indexMax = dates.length - 2
  start = start || indexMin
  if (start < indexMin) {
    start = indexMin
  }
  end = end || indexMax
  if (end > indexMax) {
    end = indexMax
  }

  return Promise.coroutine(function*() {
    for (var index = start; index < end; index++) {
      var date = dates[index]

      var input = yield history.selectInputValues(index)
      input.date = history.shrinkDate(date)
      input = hashers.input.serialize(input)

      var output = yield history.addValuesFromDay(
        'tomorrow',
        index + 1,
        history.options.ticker
      )
      output = hashers.output.serialize(output)

      log(`collect date of index ${index}`)
      if (!past) {
        yield history.database.putAsync(history.lastNormalizedKey, date)
        continue
      }

      past.push({input, output})
    }
  })()
  .then(() => {
    log(`input hashes: ${hashers.input.hash.length}`)
    log(`output hashes: ${hashers.output.hash.length}`)
    return past
  })
}

history.chunk = function* (start, steps) {
  var dates = history.store.dates
  for (var i = start, l = dates.length - 1; i < l; i += steps) {
    yield history.normalize(i, i + steps)
  }
}

history.selectInputValues = (index) => {
  var dates   = history.store.dates
  var tickers = history.store.availableTickers
  var fields  = history.fields
  var input = Object.create(null)
  return Promise.all(
    tickers.map((ticker) => {
      return bluebird.coroutine(function*() {
        yield history.addValuesFromDay('yesterday', index - 1, ticker, input)
        yield history.addValuesFromDay('today'    , index    , ticker, input)
        ticker = null
      })()
    })
  )
  .then(() => {
    var result = input
    index = null
    input = null
    return result
  })
}

history.addValuesFromDay = (day, index, ticker, ref) => {
  var dates   = history.store.dates
  var fields  = history.fields[day]

  ref = ref || Object.create(null)

  var today = dates[index]
  if (index > dates.length - 1) {
    today = dates[dates.length - 1]
  } else {
    today = dates[index]
  }
  var yesterday
  if (index - 1 < 0) {
    yesterday = dates[0]
  } else {
    yesterday = dates[index - 1]
  }

  function ignoreError(promise) {
    return promise.catch((error) => {
      log.verbose(`${error.message}, date index: ${index}`);
    })
  }

  var key = history.databaseKey(today, ticker)
  return Promise.all([
    ignoreError(history.database.getAsync(key)),
    ignoreError(
      history.database.getAsync(history.databaseKey(yesterday, ticker))
    )
  ])
  .then((rows) => {
    if (!rows) {
      log(`can not find rows for ticker ${ticker}`)
    }
    var row = rows[0] || {}
    var rowYesterday = rows[1] || {}
    var reput = false
    for (var i = 0, l = fields.length; i < l; i++) {
      var field = fields[i];
      var value = row[field]
      if (undefined === value && undefined !== rowYesterday[field]) {
        reput = true
        value = row[field] = rowYesterday[field]
      }
      if (undefined === value) {
        log.verbose(`can not find \`${field}\` for ${ticker}, index: ${index}`)
      }
      ref[`${ticker}.${day}.${field}`] = history.shrink(
        ticker,
        field,
        value
      )
    }
    if (reput) {
      return history.database.putAsync(key, row, {sync: true})
    }
  })
  .then(() => {
    var result = ref

    // do cleaning
    day = null
    index = null
    ticker = null
    ref = null
    today = null
    yesterday = null
    key = null

    return result
  })
}

history.fields = {}
history.fields.tomorrow   = ['closeIndex']
history.fields.today      = ['openIndex', 'closeIndex']
history.fields.yesterday  = [
  'openIndex',
  'closeIndex',
  'highestIndex',
  'lowestIndex',
  'turnoverValue',
  'turnoverVol'
]

history.shrink = (ticker, field, value) => {
  if (undefined === value) {
    return 0
  }
  var range = history.store.ranges[ticker][field]
  if (!range.size) {
    return 0
  }
  var ratio = (value - range.min) / range.size
  return ratio
}

history.expand = (ticker, field, ratio) => {
  var range = history.store.ranges[ticker][field]
  var value = ratio * range.size + range.min
  return value
}

history.shrinkDate = (date) => {
  var totalTime = Date.now() - history.options.beginDate
  if (!totalTime) {
    return 0
  }
  return (date - history.options.beginDate) / totalTime
}

history.nextDate = (latest) => {
  var latestDate = new Date(history.latest().date + common.DAY)
  var nextDate
  if (5 === latestDate.getDay()) {
    nextDate = latestDate.valueOf() + common.DAY * 2 + common.DAY
  } else {
    nextDate = latestDate.valueOf() + common.DAY
  }
  return nextDate
}

history.latest = () => {
  return history.selectInputValues(history.store.dates.length)
}

module.exports = history
