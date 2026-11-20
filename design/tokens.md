# Design System Tokens (`tokens.md`)

## 1. Brand & Semantic Color Tokens
| Token | Value | Usage | Contrast vs `--surface-base` |
| :--- | :--- | :--- | :--- |
| `--surface-base` | `#070709` | Main app background (Obsidian Black) | — |
| `--surface-elevated` | `#0E0F14` | Sidebar & header glass base | — |
| `--surface-card` | `#13151C` | Company directory card surface | — |
| `--surface-card-hover` | `#191C26` | Hovered / focused card state | — |
| `--surface-interactive` | `#1E2230` | Inputs, selects, secondary controls | — |
| `--text-primary` | `#FFFFFF` | Primary headings & titles | 19.8:1 (AAA) |
| `--text-secondary` | `#CBD5E1` | Body descriptions & addresses | 13.4:1 (AAA) |
| `--text-muted` | `#94A3B8` | Metadata labels & subtle counters | 7.2:1 (AA) |
| `--brand-primary` | `#FF6B00` | Tiered System Solar Orange | 7.6:1 on Dark (AA) |
| `--brand-primary-hover` | `#FF8533` | Primary CTA hover state | 9.1:1 on Dark (AAA) |
| `--brand-glow` | `rgba(255, 107, 0, 0.42)` | Ambient elevation & active pin glow | — |
| `--brand-subtle` | `rgba(255, 107, 0, 0.12)` | Active filter chip & tag fill | — |
| `--border-subtle` | `rgba(255, 255, 255, 0.09)` | Default hairlines & dividers | — |
| `--border-strong` | `rgba(255, 255, 255, 0.18)` | Input & interactive button borders | — |
| `--status-success` | `#34D399` | Active MOA badge text | 10.5:1 (AAA) |
| `--status-warning` | `#FBBF24` | Expiring / limited slots indicator | 11.8:1 (AAA) |
| `--status-danger` | `#F87171` | Error banner & full-slots state | 7.4:1 (AA) |

## 2. Typography Scale
- `--font-sans`: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
- `--font-mono`: `'Geist Mono', monospace`
- `--text-xs`: `clamp(0.68rem, 0.65rem + 0.15vw, 0.74rem)`
- `--text-sm`: `clamp(0.76rem, 0.72rem + 0.2vw, 0.84rem)`
- `--text-base`: `clamp(0.86rem, 0.82rem + 0.2vw, 0.95rem)`
- `--text-lg`: `clamp(1.0rem, 0.95rem + 0.3vw, 1.15rem)`
- `--text-xl`: `clamp(1.2rem, 1.1rem + 0.5vw, 1.45rem)`

## 3. Spatial Rhythm & Radii
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-8`: `32px`
- `--radius-xs`: `6px`
- `--radius-sm`: `8px`
- `--radius-md`: `12px`
- `--radius-lg`: `16px`
- `--radius-full`: `9999px`

## 4. Motion & Physics
- `--ease-spring`: `cubic-bezier(0.16, 1, 0.3, 1)`
- `--duration-fast`: `150ms`
- `--duration-normal`: `240ms`
