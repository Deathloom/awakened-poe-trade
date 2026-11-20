import { StatCalculated, statSourcesTotal, translateStatWithRoll } from '@/parser/modifiers'
import { roundRoll } from '../price-check/filters/util'

export interface PreparedStat {
  matcher: string
  roll?: number
  // Deathloom fork (Q4): English stat ref and the parser's value (before the display
  // sign flip), for build-aware warnings
  ref: string
  value?: number
}

export function prepareMapStat (calc: StatCalculated): PreparedStat {
  const roll = statSourcesTotal(calc.sources)
  const translation = translateStatWithRoll(calc, roll)

  const prepared: PreparedStat = {
    matcher: translation.string,
    roll: roll && roundRoll(roll.value, translation.dp ?? false),
    ref: calc.stat.ref,
    value: roll?.value
  }

  if (translation.negate) {
    if (prepared.roll != null) {
      prepared.roll = -1 * prepared.roll
    }
  }

  return prepared
}
