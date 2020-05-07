#!/usr/bin/env node

const { program } = require('commander')

function prepareAction () {
  if (program.debug) process.env.DEBUG = (process.env.DEBUG ? process.env.DEBUG + ',' : '') + 'openmaptiles-world'
  const debug = require('debug')('openmaptiles-world')
  debug('options', program.opts())
}

program
  .version(require('../package.json').version)
  .option('-d, --debug', 'output debugging info')
  .option('-z, --max-zoom <number>', 'max tiles zoom, 14 is the maximum recommended', '7')

program.command('list')
  .description('list available ares')
  .action(async () => {
    prepareAction()
    await require('../lib').listAreas()
  })

program.command('inspect')
  .description('show the current world.mbtiles in a simple map')
  .action(async () => {
    prepareAction()
    await require('../lib/serve')()
  })

program.command('update <areas...>')
  .description('prepare the tiles for given areas and merge them into data/world.mbtiles')
  .action(async (areas) => {
    prepareAction()
    await require('../lib').updateAreas(areas, parseInt(program.maxZoom))
  })

async function main () {
  await program.parseAsync(process.argv)
}

main()
  .then(() => process.exit())
  .catch(error => { console.error(error); process.exit(-1) })
