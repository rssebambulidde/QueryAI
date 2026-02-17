// Temporary module declaration to satisfy imports of 'next/types.js'
// This avoids build failures when Next's shipped types are not recognized by
// the TypeScript configuration in this workspace.

declare module 'next/types.js' {
  export type ResolvingMetadata = any;
  export type ResolvingViewport = any;
  const _default: any;
  export default _default;
}

declare module 'next/navigation' {
  export function useRouter(...args: any[]): any;
  export function usePathname(...args: any[]): any;
  export function useSearchParams(...args: any[]): any;
  export function useParams(...args: any[]): any;
  export function createSearchParams(...args: any[]): any;
  const _default: any;
  export default _default;
}

declare module 'next/link' {
  const _default: any;
  export default _default;
}

declare module 'next' {
  export type Metadata = any;
  export const metadata: any;
  const _default: any;
  export default _default;
}
