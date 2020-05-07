const fs = require('fs-extra')
const { spawn } = require('child-process-promise')
const { readMbtiles, mergeTiles, tileData } = require('./mbtiles')
const debug = require('debug')('openmaptiles-world')

async function exec (cmd, args = []) {
  debug(`\n> OpenMapTiles > ${[cmd].concat(args).join(' ')}\n`)
  await spawn(cmd, args, { cwd: 'openmaptiles', stdio: 'inherit' })
}

async function clear () {
  // we do not want data to accumulate, so we clear it between areas
  // TODO: we clear everything for simplicity, maybe we could keep some things for a more efficient use of resources
  await fs.remove('./openmaptiles/data')
  await fs.remove('./openmaptiles/build')
  await fs.remove('./openmaptiles/pgdata')
}

exports.listAreas = async () => {
  await exec('make')
  await exec('make', ['list'])
}

exports.updateAreas = async (areas, maxZoom) => {
  await fs.ensureDir('./data')
  const world = await readMbtiles('./data/world.mbtiles', {}, 'rwc')
  await world.startWriting()

  try {
    // prepare OpenMapTiles
    await exec('make')
    // await exec('make list')

    for (const area of areas) {
      await clear()
      debug(`Apply max zoom ${maxZoom} in openmaptiles/.env`)
      await fs.writeFile('openmaptiles/.env',
        (await fs.readFile('openmaptiles/.env', 'utf8')).replace(/QUICKSTART_MAX_ZOOM=[0-9]+/, `QUICKSTART_MAX_ZOOM=${maxZoom}`)
      )
      await exec('bash', ['quickstart.sh', area])

      const areaTiles = await readMbtiles('./openmaptiles/data/tiles.mbtiles', { area })
      const areaInfo = await areaTiles.getInfo()
      debug('Area mbtiles', area, areaInfo)

      await world.putInfo({
        id: 'openmaptiles-world',
        name: 'OpenMapTiles World',
        description: 'Merged tiles from OpenMapTiles areas',
        type: 'baselayer',
        pixel_scale: '256',
        format: 'pbf',
        scheme: 'xyz',
        version: 3.10,
        minZoom: 0,
        maxZoom,
        center: [0, 0, 1],
        bounds: [-180, -85.0511, 180, 85.0511],
        attribution: areaInfo.attribution,
        vector_layers: areaInfo.vector_layers,
        mtime: areaInfo.mtime
      })

      for await (const tilesPacket of areaTiles.createZXYStream()) {
        for (const tileKey of tilesPacket.toString().split('\n').map(t => t.trim()).filter(t => !!t)) {
          debug(`Read tile ${tileKey} from area ${area}`)
          const { tile: areaTile } = await areaTiles.getTilePromise(tileKey)
          let updated = false
          let worldTile, worldData, newWorldData
          try {
            const worldTileObj = await world.getTilePromise(tileKey)
            worldTile = worldTileObj.tile
            worldData = worldTileObj.data
          } catch (err) {
            if (err.message !== 'Tile does not exist') throw err
          }
          if (!worldTile) {
            debug(`Tile ${tileKey} doesn't exist yet in world.mbtiles, add it whole`)
            newWorldData = await tileData(areaTile)
            updated = true
          } else {
            mergeTiles(worldTile, areaTile, area)
            newWorldData = await tileData(worldTile)
            if (newWorldData.equals(worldData)) {
              debug('merged tile has same data as original, nothing to do')
            } else {
              updated = true
            }
          }

          if (updated) {
            // TODO: also produce a diff mbtiles
            await world.putTilePromise(tileKey, newWorldData)
          }
        }
      }
    }
  } finally {
    await world.stopWriting()
  }
}
