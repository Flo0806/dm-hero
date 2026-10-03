import MarkdownIt from 'markdown-it'

// DM texts are Markdown. Rendered safely: raw HTML is off and markdown-it
// refuses javascript:/data: links by default - nothing from a text can run.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

// Links open in a new tab and don't hand the player page to the target
const defaultLink = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]!.attrSet('target', '_blank')
  tokens[idx]!.attrSet('rel', 'noopener noreferrer')
  return defaultLink(tokens, idx, options, env, self)
}

export const renderMarkdown = (text: string) => md.render(text)
