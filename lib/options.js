var options = {}
options.home = `${process.env.HOME}/.index-net`
options.chunkSteps = Math.round(5 * (365 / 7))
//options.chunkSteps = Infinity

module.exports = options
