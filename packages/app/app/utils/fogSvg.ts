import { fogStrokePath, type FogStroke, type MapFog } from '~~/types/fog'

// Renders a fog of war as SVG: a dark layer with a mask - white = covered,
// black = visible. Strokes are drawn in order, so cover/reveal overlap correctly.
// Units: the map's own coordinate space (width x height), percent converted here.

const SVG_NS = 'http://www.w3.org/2000/svg'

export interface FogCanvas {
  svg: SVGSVGElement
  /** Path for the stroke being painted right now (live preview) */
  livePath: (stroke: FogStroke) => void
  render: (fog: MapFog) => void
}

function strokeElement(stroke: FogStroke, width: number, height: number) {
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', fogStrokePath(stroke, width, height))
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', stroke.mode === 'cover' ? 'white' : 'black')
  path.setAttribute('stroke-width', String(stroke.radius * 2 * width / 100))
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  return path
}

let counter = 0

export function createFogCanvas(width: number, height: number, color: string): FogCanvas {
  const id = `fog-mask-${++counter}`
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('preserveAspectRatio', 'none')

  const mask = document.createElementNS(SVG_NS, 'mask')
  mask.setAttribute('id', id)
  mask.setAttribute('maskUnits', 'userSpaceOnUse')
  const defs = document.createElementNS(SVG_NS, 'defs')
  defs.append(mask)

  const layer = document.createElementNS(SVG_NS, 'rect')
  for (const [k, v] of Object.entries({ x: '0', y: '0', width: String(width), height: String(height), fill: color, mask: `url(#${id})` })) {
    layer.setAttribute(k, v)
  }
  svg.append(defs, layer)

  let live: SVGPathElement | null = null

  return {
    svg,
    render(fog) {
      const base = document.createElementNS(SVG_NS, 'rect')
      for (const [k, v] of Object.entries({ x: '0', y: '0', width: String(width), height: String(height), fill: fog.base === 'covered' ? 'white' : 'black' })) {
        base.setAttribute(k, v)
      }
      mask.replaceChildren(base, ...fog.strokes.map(s => strokeElement(s, width, height)))
      live = null
    },
    livePath(stroke) {
      if (!live) {
        live = strokeElement(stroke, width, height)
        mask.append(live)
      }
      live.setAttribute('d', fogStrokePath(stroke, width, height))
    },
  }
}
