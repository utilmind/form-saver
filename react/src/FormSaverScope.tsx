/**
 * Lightweight wrapper component for DOM-based FormSaver scopes.
 *
 * The component is deliberately thin: it delegates all persistence behavior to
 * useFormSaverDom and only provides a declarative JSX wrapper. Use `asChild`
 * when you want to attach FormSaver to an existing child element without
 * rendering an extra DOM node.
 */

import {
    Children,
    cloneElement,
    type ComponentPropsWithoutRef,
    type ElementType,
    isValidElement,
    type ReactElement,
    type ReactNode,
    type Ref
} from 'react'

import type { UseFormSaverDomOptions } from './types'
import { useFormSaverDom } from './useFormSaverDom'

type RefTarget = HTMLElement

type FormSaverScopeOwnProps = UseFormSaverDomOptions & {
    /** Render no wrapper element; clone the only child and attach FormSaver's ref to it. */
    asChild?: boolean

    /** Element/component to render when `asChild` is false. Defaults to `div`. */
    as?: ElementType

    children: ReactNode
}

export type FormSaverScopeProps<TElement extends ElementType = 'div'> = FormSaverScopeOwnProps &
    Omit<ComponentPropsWithoutRef<TElement>, keyof FormSaverScopeOwnProps>

type RefObjectLike<TValue> = {
    current: TValue | null
}

type ReactElementWithMaybeRef = ReactElement<{ ref?: Ref<RefTarget> }> & {
    ref?: Ref<RefTarget>
}

type WarningGetter = (() => unknown) & {
    isReactWarning?: boolean
}

const assignRef = <TValue,>(ref: Ref<TValue> | undefined, value: TValue | null): void => {
    if (!ref) {
        return
    }

    if (typeof ref === 'function') {
        ref(value)
        return
    }

    ;(ref as RefObjectLike<TValue>).current = value
}

const isWarningGetter = (getter: unknown): getter is WarningGetter =>
    typeof getter === 'function' && Boolean((getter as WarningGetter).isReactWarning)

const getRefGetter = (value: object): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'ref')

    return descriptor ? (descriptor as { get?: unknown }).get : undefined
}

const getElementRef = (element: ReactElement): Ref<RefTarget> | undefined => {
    const elementWithRef = element as ReactElementWithMaybeRef
    const propsRefGetter = getRefGetter(elementWithRef.props)
    const elementRefGetter = getRefGetter(elementWithRef)

    // React 19 exposes ref as a prop. React 18 stores it on the element object.
    if (isWarningGetter(propsRefGetter)) {
        return elementWithRef.ref
    }

    if (isWarningGetter(elementRefGetter)) {
        return elementWithRef.props.ref
    }

    return elementWithRef.props.ref || elementWithRef.ref
}

const composeRefs = <TValue,>(
    firstRef: Ref<TValue> | undefined,
    secondRef: Ref<TValue> | undefined
) => {
    return (value: TValue | null): void => {
        assignRef(firstRef, value)
        assignRef(secondRef, value)
    }
}

export const FormSaverScope = <TElement extends ElementType = 'div'>(
    props: FormSaverScopeProps<TElement>
): ReactElement | null => {
    const {
        as: Component = 'div',
        asChild = false,
        children,
        storageKey,
        storage,
        enabled,
        debounceMs,
        saveEvent,
        restoreOnMount,
        version,
        mergeUnknownKeys,
        includePasswords,
        controlSelector,
        ignoreSelector,
        mapBeforeSave,
        mapAfterLoad,
        onRestore,
        onSave,
        onError,
        ...rootProps
    } = props

    const formSaver = useFormSaverDom({
        storageKey,
        storage,
        enabled,
        debounceMs,
        saveEvent,
        restoreOnMount,
        version,
        mergeUnknownKeys,
        includePasswords,
        controlSelector,
        ignoreSelector,
        mapBeforeSave,
        mapAfterLoad,
        onRestore,
        onSave,
        onError
    })

    if (asChild) {
        const child = Children.only(children)

        if (!isValidElement(child)) {
            return null
        }

        const childElement = child as ReactElement<{ ref?: Ref<RefTarget> }>
        const childRef = getElementRef(childElement)

        return cloneElement(childElement, {
            ...rootProps,
            ref: composeRefs(childRef, formSaver.ref)
        } as Partial<unknown> & { ref: Ref<RefTarget> })
    }

    const RootComponent = Component

    return (
        <RootComponent {...rootProps} ref={formSaver.ref}>
            {children}
        </RootComponent>
    )
}
