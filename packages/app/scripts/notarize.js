/**
 * macOS Notarization Script for electron-builder
 * Called automatically after signing via "afterSign" hook
 *
 * Required environment variables:
 * - APPLE_ID: Apple ID email
 * - APPLE_APP_PASSWORD: App-specific password (not regular password)
 * - APPLE_TEAM_ID: Team ID from Apple Developer Portal
 */

import { notarize } from '@electron/notarize'

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    return
  }

  // Skip if no credentials (unsigned build)
  if (!process.env.APPLE_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_APP_PASSWORD) {
    console.log('Skipping notarization (no Apple credentials set)')
    return
  }

  const appName = context.packager.appInfo.productFilename

  console.log(`Notarizing ${appName}...`)
  console.log(`  App path: ${appOutDir}/${appName}.app`)
  console.log(`  Team ID: ${process.env.APPLE_TEAM_ID}`)

  try {
    await notarize({
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    })

    console.log('Notarization complete!')
  } catch (error) {
    console.error('Notarization failed:', error.message)
    throw error
  }
}
