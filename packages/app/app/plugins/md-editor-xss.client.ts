import { config, XSSPlugin } from 'md-editor-v3'

/**
 * Markdown previews render raw HTML from the text (markdown-it `html: true`). Texts can come
 * from imported archives or AI agents, so filter that HTML: XSSPlugin drops scripts, event
 * handlers and javascript: links and keeps safe tags. Applies to every md-editor preview.
 */
export default defineNuxtPlugin(() => {
  config({
    /** The default plugins plus the XSS filter. */
    markdownItPlugins: plugins => [...plugins, { type: 'xss', plugin: XSSPlugin, options: {} }],
  })
})
