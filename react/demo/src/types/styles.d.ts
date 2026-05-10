/**
 * Ambient style-module declarations used by TypeScript-aware bundlers.
 *
 * The demo and downstream consumers may import plain CSS/SASS files or CSS
 * modules even though TypeScript does not understand those file types by
 * default. These declarations are compile-time only and do not generate any
 * runtime JavaScript.
 */

declare module '*.css'
declare module '*.sass'
declare module '*.scss'

// Allows default imports from CSS/SCSS modules:
// import styles from './file.module.scss'
declare module '*.module.css' {
    const classes: { readonly [key: string]: string }
    export default classes
}

declare module '*.module.scss' {
    const classes: { readonly [key: string]: string }
    export default classes
}

declare module '*.module.sass' {
    const classes: { readonly [key: string]: string }
    export default classes
}
