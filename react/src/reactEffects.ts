/**
 * React effect helpers shared by browser-aware hooks.
 */

import { useEffect, useLayoutEffect } from 'react'

export const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
