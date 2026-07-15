import { type ComponentPropsWithoutRef, type MouseEvent } from 'react'

interface AppLinkProps extends Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'onClick'> {
    href: '/' | '/about/'
    onNavigate: () => void
}

const shouldUseBrowserNavigation = (event: MouseEvent<HTMLAnchorElement>): boolean =>
    event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

/**
 * Small internal SPA link used by the demo without adding a router dependency.
 * Modified clicks keep the browser's normal new-tab and new-window behavior.
 */
export const AppLink = ({ href, onNavigate, ...anchorProps }: AppLinkProps) => (
    <a
        {...anchorProps}
        href={href}
        onClick={(event) => {
            if (shouldUseBrowserNavigation(event)) {
                return
            }

            event.preventDefault()
            onNavigate()
        }}
    />
)
