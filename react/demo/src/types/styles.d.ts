// Allows TypeScript to understand stylesheet imports handled by Next.js/bundler.
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
