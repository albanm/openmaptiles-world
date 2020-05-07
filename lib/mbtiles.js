// a wrapper around @mapbox/mbtiles for promise based mbtiles containing editable vector tiles

const { promisify } = require('util')
const zlib = require('zlib')
const gunzip = promisify(zlib.gunzip)
const gzip = promisify(zlib.gzip)
const MBTiles = require('@mapbox/mbtiles')
const Protobuf = require('pbf')
const { VectorTile } = require('@mapbox/vector-tile')
const vtpbf = require('vt-pbf')
const debug = require('debug')('openmaptiles-world')

const prepareVectorTile = async (data, addProps) => {
  const tile = new VectorTile(new Protobuf(data))
  for (const layer in tile.layers) {
    tile.layers[layer].features = []
    for (let i = 0; i < tile.layers[layer].length; i++) {
      const feature = tile.layers[layer].feature(i)
      Object.assign(feature.properties, addProps)
      tile.layers[layer].features.push(feature)
    }
    // monkey patch tile, so that vt-pbf will read the potentially altered .features array
    tile.layers[layer].feature = (i) => tile.layers[layer].features[i]
    Object.defineProperty(tile.layers[layer], 'length', {
      get: () => tile.layers[layer].features.length
    })
  }
  return { data, tile }
}

exports.tileData = async (tile) => {
  return Buffer.from(vtpbf(tile))
}

exports.readMbtiles = (mbtilesPath, addProps, mode = 'ro') => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-new
    new MBTiles(`${mbtilesPath}?mode=${mode}`, (err, mbtiles) => {
      if (err) return reject(err)
      mbtiles.getInfo = promisify(mbtiles.getInfo)
      mbtiles.putInfo = promisify(mbtiles.putInfo)
      mbtiles.startWriting = promisify(mbtiles.startWriting)
      mbtiles.stopWriting = promisify(mbtiles.stopWriting)
      mbtiles.putTilePromise = async (tileKey, data) => {
        data = await gzip(data)
        return new Promise((resolve, reject) => {
          mbtiles.putTile(...tileKey.split('/'), data, (err) => {
            if (err) return reject(err)
            resolve()
          })
        })
      }
      mbtiles.getTilePromise = async (tileKey) => {
        let { data, headers } = await new Promise((resolve, reject) => {
          mbtiles.getTile(...tileKey.split('/'), (err, data, headers) => {
            if (err) return reject(err)
            resolve({ data, headers })
          })
        })
        if (headers['Content-Encoding'] === 'gzip') {
          data = await gunzip(data)
        }
        return prepareVectorTile(data, addProps)
      }
      resolve(mbtiles)
    })
  })
}

// used to compare geometries of features when merging
// cf https://github.com/mapbox/vector-tile-js/blob/58df1e9344ee64f26deee84a9f54cee11fb95ef6/lib/vectortilefeature.js#L41
function rawGeometry (tile) {
  const pbf = tile._pbf
  pbf.pos = tile._geometry
  return pbf.readBytes()
}

// TODO: do not work on tiles that only contain common layers (water, etc.)
// TODO: identify duplicate features accross areas
exports.mergeTiles = (target, origin, area) => {
  for (const layer in origin.layers) {
    if (!target.layers[layer]) {
      debug(`Layer ${layer} does not exist yet in target tile, add it whole`)
      target.layers[layer] = origin.layers[layer]
    } else {
      debug(`Merge features in layer ${layer}`)
      // remove previous features from same area
      target.layers[layer].features = target.layers[layer].features
        .filter(f => f.properties.area !== area)
      // do not add matching features already present (case of overlapping tiles)
      origin.layers[layer].features = origin.layers[layer].features
        .filter(f => {
          const sameFeature = target.layers[layer].features.find(tf => {
            if (JSON.stringify({ ...f.properties, area: '' }) !== JSON.stringify({ ...tf.properties, area: '' })) return false
            if (!rawGeometry(f).equals(rawGeometry(tf))) return false
            return true
          })
          return !sameFeature
        })
      target.layers[layer].features = target.layers[layer].features.concat(origin.layers[layer].features)

      // sort features by area so that order is kept between iteration and the buffers are not changes unnecessarily
      target.layers[layer].features.sort((a, b) => {
        if (a.properties.area === b.properties.area) return 0
        if (a.properties.area < b.properties.area) return -1
        return 1
      })
    }
  }
}
