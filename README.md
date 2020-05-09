# openmaptiles-world

Helper to incrementally produce worldwide vector tiles for OSM with OpenMapTiles.

## Who is this for

If you do not care about self-hosting you should probably check out a hosting service like [maptiler](https://www.maptiler.com/cloud/).

If you want self-hosting, the freshest data without hassle and have some budget you might prefer downloading [production packages from OpenMapTiles.com](https://openmaptiles.com/production-package/).

This project is for people with more time than money or infrastructure, and people who want freedom of distribution of the rendered tiles. It will let you incrementally render areas tilesets, then merge them in a growing worldwide tileset. It will also let you generate the diff tiles of these incremental updates.

TODO: reference to upcoming ipfs-tiles project.

## OpenMapTiles integration

This projects integrates [OpenMapTiles](https://github.com/openmaptiles/openmaptiles) using git submodules.

```
git submodule init
```

The currently checked out version is v3.11. Update it like this:

```
cd openmaptiles
git fetch --all --tags
git checkout tags/v3.11
```

## Use it

List available areas:

```
bin/openmaptiles-world.js list
```

Add or update an area to world.mbtiles:

```
bin/openmaptiles-world.js --debug update bretagne
bin/openmaptiles-world.js --debug update pays-de-la-loire
bin/openmaptiles-world.js --debug update basse-normandie
```

Run a mini server with a map to inspect current state of world.mbtiles:

```
bin/openmaptiles-world.js inspect
```
