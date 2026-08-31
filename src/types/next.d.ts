declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "next" {
  export type Metadata = any;
  export type Viewport = any;
  export type NextConfig = any;
  export type PageProps = any;
  const Next: any;
  export default Next;
}

declare module "next/link" {
  import type { AnchorHTMLAttributes, ForwardRefExoticComponent, PropsWithoutRef, ReactNode, RefAttributes } from "react";

  export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string | { pathname?: string; query?: Record<string, any>; hash?: string };
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
    locale?: string | false;
    legacyBehavior?: boolean;
    children?: ReactNode;
  }

  const Link: ForwardRefExoticComponent<
    PropsWithoutRef<LinkProps> & RefAttributes<HTMLAnchorElement>
  >;
  export default Link;
}

declare module "next/navigation" {
  export interface ReadonlyURLSearchParams extends URLSearchParams {}

  export interface AppRouterInstance {
    back(): void;
    forward(): void;
    refresh(): void;
    push(href: string, options?: { scroll?: boolean }): void;
    replace(href: string, options?: { scroll?: boolean }): void;
    prefetch(href: string): void;
  }

  export function useRouter(): AppRouterInstance;
  export function usePathname(): string;
  export function useSearchParams(): ReadonlyURLSearchParams;
  export function useParams<T = Record<string, string | string[]>>(): T;
  export function redirect(url: string, type?: any): never;
  export function notFound(): never;
}

declare module "next/image" {
  import type { FC, ImgHTMLAttributes } from "react";

  export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    src: string | any;
    alt: string;
    width?: number | `${number}`;
    height?: number | `${number}`;
    fill?: boolean;
    loader?: (props: any) => string;
    quality?: number | `${number}`;
    priority?: boolean;
    placeholder?: "blur" | "empty" | `data:image/${string}`;
    blurDataURL?: string;
    unoptimized?: boolean;
    overrideSrc?: string;
    onLoadingComplete?: (img: HTMLImageElement) => void;
  }

  const Image: FC<ImageProps>;
  export default Image;
}

declare module "next/font/google" {
  export interface FontOptions {
    weight?: string | string[];
    style?: string | string[];
    subsets?: string[];
    display?: string;
    preload?: boolean;
    fallback?: string[];
    adjustFontFallback?: boolean;
    variable?: string;
  }

  export interface FontConfig {
    className: string;
    style: { fontFamily: string; fontWeight?: number; fontStyle?: string };
    variable?: string;
  }

  export function Inter(options?: FontOptions): FontConfig;
  export function Roboto(options?: FontOptions): FontConfig;
  export function Montserrat(options?: FontOptions): FontConfig;
  export function Open_Sans(options?: FontOptions): FontConfig;
  export function Lato(options?: FontOptions): FontConfig;
  export function Poppins(options?: FontOptions): FontConfig;
}

interface RequestInit {
  next?: { revalidate?: number | false; tags?: string[] };
}

declare module "next/server" {
  export class NextResponse<Body = any> extends Response {
    static json(body: any, init?: ResponseInit): NextResponse;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
    static rewrite(url: string | URL, init?: ResponseInit): NextResponse;
    static next(init?: ResponseInit): NextResponse;
  }
  export class NextRequest extends Request {
    readonly nextUrl: URL;
    readonly ip?: string;
    readonly geo?: {
      city?: string;
      country?: string;
      region?: string;
      latitude?: string;
      longitude?: string;
    };
    readonly cookies: any;
  }
}

declare module "next/server.js" {
  export * from "next/server";
}

declare module "next/types" {
  export type ResolvingMetadata = Promise<any>;
  export type ResolvingViewport = Promise<any>;
}

declare module "next/types.js" {
  export * from "next/types";
}

