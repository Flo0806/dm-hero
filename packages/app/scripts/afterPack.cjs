const fs = require('fs')
const path = require('path')

exports.default = async function afterPack(context) {
  // Only for Linux
  if (context.electronPlatformName !== 'linux') return

  const appDir = context.appOutDir
  const execName = context.packager.executableName || 'dm-hero'
  const binPath = path.join(appDir, execName)

  // Rename original binary
  fs.renameSync(binPath, binPath + '.bin')

  // Create wrapper script
  const wrapper = `#!/bin/bash
DIR="$(dirname "$(readlink -f "$0")")"
exec "$DIR/${execName}.bin" --no-sandbox --ozone-platform=x11 "$@"
`
  fs.writeFileSync(binPath, wrapper)
  fs.chmodSync(binPath, 0o755)

  console.log(`[afterPack] Created Linux wrapper for ${execName}`)
}
