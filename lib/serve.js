const express = require('express')
const eventToPromise = require('event-to-promise')
const { readMbtiles } = require('./mbtiles')

module.exports = async () => {
  const app = express()
  const worldMbtiles = await readMbtiles('./data/world.mbtiles')
  const info = await worldMbtiles.getInfo()
  app.get('/world.json', (req, res) => {
    res.send({
      ...info,
      tiles: ['http://localhost:5937/world/{z}/{x}/{y}.pbf']
    })
  })
  app.get('/world/:z/:x/:y.pbf', (req, res, next) => {
    worldMbtiles.getTile(req.params.z, req.params.x, req.params.y, (err, data, headers) => {
      if (err) return next(err)
      res.set(headers)
      res.send(data)
    })
  })
  app.use(express.static('public'))

  const server = require('http').createServer(app)
  server.listen(5937)
  await eventToPromise(server, 'listening')
  console.log('Open http://localhost:5937')

  process.on('SIGINT', () => server.close())
  await eventToPromise(server, 'close')
  console.log('...closed')
}
