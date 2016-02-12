var common = require('../common.js')
var hashers = common.hashers

function history() {
  var query = {
    indexID: '000001.ZICN',
    beginDate: process.env.INDEX_NET_HISTORY_BEGIN_DATE,
    ticker: '000001'
  }
  return common.fetchAPI(history.api, query)
  .then((body) => {
    history.store.data = body.data
    return history.normalize(body.data)
  })
}
history.api = '/api/market/getMktIdxd.json'
history.store = {}
history.normalize = (data) => {
  for (var i = 0, l = data.length; i < l; i++) {
    var v = data[i];
    v.date = (new Date(v.tradeDate)).valueOf()
  }
  history.store.ranges = common.getRanges(
    data,
    {
      date:             'date',
      openIndex:        'openIndex',
      closeIndex:       'closeIndex',
      preOpenIndex:     'openIndex',
      preCloseIndex:    'closeIndex',
      preHighestIndex:  'highestIndex',
      preLowestIndex:   'lowestIndex',
      preTurnoverValue: 'turnoverValue',
      preTurnoverVol:   'turnoverVol'
    }
  )
  var ranges = history.store.ranges
  ranges.date.max = history.nextDate().valueOf()
  ranges.date.size = ranges.date.max - ranges.date.min

  var past = []
  for (var i = 1, l = data.length - 2; i < l; i++) {
    var yesterday = data[i - 1]
    var today     = data[i]
    var tomorrow  = data[i + 1]
    var source = {
      date:             tomorrow.date,
      openIndex:        today.openIndex,
      closeIndex:       today.closeIndex,
      preOpenIndex:     yesterday.openIndex,
      preCloseIndex:    yesterday.closeIndex,
      preHighestIndex:  yesterday.highestIndex,
      preLowestIndex:   yesterday.lowestIndex,
      preTurnoverValue: yesterday.turnoverValue,
      preTurnoverVol:   yesterday.turnoverVol
    }
    var input = history.shrink(source)
    input = hashers.input.serialize(input)
    var tomorrowCloseIndex = history
    .shrink({closeIndex: tomorrow.closeIndex})
    .closeIndex
    var output = {tomorrowCloseIndex}
    output = hashers.output.serialize(output)
    if (!input || !output) {
      continue
    }
    past.push({input, output})
  }
  return past
}
history.shrink = (source) => {
  var dist = {}
  Object.keys(source).forEach((key) => {
    var range = history.store.ranges[key]
    var ratio = (source[key] - range.min) / range.size
    dist[key] = ratio
  })
  return dist
}
history.expand = (source) => {
  source = hashers.output.deserialize(source)
  var dist = {}
  var ranges = history.store.ranges
  var tomorrowCloseIndex =
    source.tomorrowCloseIndex * ranges.closeIndex.size +
    ranges.closeIndex.min
  return {tomorrowCloseIndex}
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
  var data = history.store.data
  return data[data.length - 1]
}

module.exports = history
