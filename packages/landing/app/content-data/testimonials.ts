export interface Testimonial {
  id: number
  githubUsername: string
  quote: string // Supports markdown (italic, bold)
  role: string
  badge?: {
    icon: string
    text: string
    color: string
  }
}

export const testimonials: Testimonial[] = [
  {
    id: 1,
    githubUsername: 'danielroe',
    quote: "really all I need to know is that florian built this. his keen attention to detail and knowledge of nuxt are _fantastic_. I would absolutely use this.",
    role: 'Nuxt Maintainer',
    badge: {
      icon: 'mdi-nuxt',
      text: 'Nuxt Core Team',
      color: '#00DC82',
    },
  },
  {
    id: 2,
    githubUsername: 'firefly2103',
    quote: "A well rounded tool for DMs and players alike, to organize your stuff and keep your sessions smooth and easy going. Looking forward for future updates and new features in this amazing app.",
    role: 'DM Hero User',
  },
  {
    id: 3,
    githubUsername: 'svenjahoppe1991-maker',
    quote: "DM Hero ist eine pure Bereicherung. Man hat alle benötigten Infos sofort auf einen Blick parat. Selbst als Spieler kann man es super nutzen um bekannte Infos zu speichern und abzurufen. Ich kann es jemandem nur wärmstens ans Herz legen.",
    role: 'DM Hero User',
  },
]
