var log = require('debug')('index-net:models:history')
var common = require('../common.js')
var indexes = require('./indexes.js')
var hashers = common.hashers

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

  var classified = 0
  return Promise.all(
    indexes.cached.map((index) => {
      var query = {ticker: index.ticker, beginDate: options.beginDate}
      return common.fetchAPI(history.api, query)
      .then((body) => {
        if (!body.data) {
          log(` data for ${index.ticker}`)
          log(body)
          return
        }
        var exchangeCD = body.data[0].exchangeCD
        history.store.tickerExchangeCDs[index.ticker] = exchangeCD

        log(`classifying: ${classified}-${classified + body.data.length}`)
        history.classify(index.ticker, body.data)
        classified += body.data.length
        history.store.availableTickers.push(index.ticker)
      })
    })
  )
  .then(() => {
    history.store.updatedAt = Date.now()
    log('mormalizing training data')
    return history.normalize()
  })
}
history.api = '/api/market/getMktIdxd.json'

history.cacheInterval = 6 * 60 * 60 * 1000 // 6 hours

history.store = {}
history.store.availableTickers = []
history.store.classified = Object.create(null)
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

  var classified = history.store.classified
  for (var i = 0, l = data.length - 1; i < l; i++) {
    var row = data[i]
    classified[row.date] = classified[row.date] || Object.create(null)
    classified[row.date][ticker] = row
  }
}

history.normalize = () => {
  var data = history.store.classified
  var dates = Object.keys(data).map(Number).sort((a, b) => a - b)
  history.store.dates = dates

  var past = []
  for (var i = 1, l = dates.length - 2; i < l; i++) {

    var input = history.selectInputValues(i)
    input.date = history.shrinkDate(dates[i])
    input = hashers.input.serialize(input)

    var output = history.addValuesFromDay(
      'tomorrow',
      i + 1,
      history.options.ticker
    )
    output = hashers.output.serialize(output)

    past.push({input, output})

  }

  return past
}

history.selectInputValues = (index) => {
  var dates   = history.store.dates
  var data    = history.store.classified
  var tickers = history.store.availableTickers
  var fields  = history.fields
  var input = Object.create(null)
  for (var i = 0, l = tickers.length; i < l; i++) {
    var ticker = tickers[i];
    history.addValuesFromDay('yesterday', index - 1 , ticker, input)
    history.addValuesFromDay('today'    , index     , ticker, input)
  }
  return input
}

history.addValuesFromDay = (day, index, ticker, ref) => {
  ref = ref || Object.create(null)
  var dates   = history.store.dates
  var data    = history.store.classified
  var fields  = history.fields[day]
  var today     = dates[index]
  var yesterday = dates[index - 1]

  if (index >= dates.length - 1) {
    return ref
  }

  for (var j = 0, l = fields.length; j < l; j++) {
    var field = fields[j];

    var value = undefined
    try {
      if (!data[today][ticker][field]) {
        data[today][ticker][field] = data[yesterday][ticker][field]
      }
      value = data[today][ticker][field]
    } catch (e) {}

    ref[`${ticker}.${day}.${field}`] = history.shrink(
      ticker,
      field,
      value
    )
  }
  return ref
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
  var ratio = (value - range.min) / range.size
  return ratio
}

history.expand = (ticker, field, ratio) => {
  var range = history.store.ranges[ticker][field]
  var value = ratio * range.size + range.min
  return value
}

history.shrinkDate = (date) => {
  return (date - history.options.beginDate) /
    (Date.now() - history.options.beginDate)
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
  return history.selectInputValues(
    history.store.dates.length - 1
  )
}

module.exports = history
